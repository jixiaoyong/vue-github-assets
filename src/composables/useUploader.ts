/**
 * 上传 Hook / useUploader Composable
 * 
 * 处理文件上传逻辑，包括 EXIF 清理和压缩
 * Handles file upload logic including EXIF cleaning and compression
 */
import { IMAGE_EXTENSIONS_REGEX } from '@/constants/extensions';
import type {
    AssetItem,
    AtomicUploadResult,
    StoreConfig, UploadOptions, UploadResult
} from '@/types';
import { cleanupExifFromFile, type CleanupResult } from '@/utils/exif-cleaner';
import { compressImage, needsCompression } from '@/utils/image-compressor';
import { buildUrlChain } from '@/utils/url-transformer';
import type { Octokit } from '@octokit/rest';
import type { MaybeRefOrGetter } from 'vue';
import { ref, toValue } from 'vue';

// ============================================
// 类型定义 / Type Definitions
// ============================================

/**
 * EXIF 清理失败项 / EXIF cleanup failed item
 */
export interface ExifFailedItem {
    /** 原始文件 / Original file */
    file: File;
    /** 错误信息 / Error message */
    error: string;
    /** 清理结果 / Cleanup result */
    result: CleanupResult;
}

/**
 * EXIF 清理失败回调返回值 / EXIF cleanup failure callback return type
 */
export interface ExifFailureAction {
    /** 文件路径 / File path (file.name) */
    fileName: string;
    /** 用户选择的操作 / User selected action */
    action: 'retry' | 'upload-original' | 'skip';
}

interface UseUploaderOptions {
    config: StoreConfig;
    octokit: MaybeRefOrGetter<Octokit | null>;
    onFileUploaded?: (file: AssetItem) => void;
    /**
     * EXIF 清理失败时的回调，用于显示弹窗让用户选择
     * Callback when EXIF cleanup fails, for showing dialog to let user choose
     * 
     * @param failedItems - 失败的文件列表 / List of failed files
     * @returns 用户选择的操作 / User selected actions
     */
    onExifCleanupFailed?: (failedItems: ExifFailedItem[]) => Promise<ExifFailureAction[]>;
}

// ============================================
// Composable
// ============================================

export function useUploader(options: UseUploaderOptions) {
    const { config, octokit: octokitRef, onFileUploaded } = options;

    const uploading = ref(false);
    const progress = ref(0);
    const error = ref<Error | null>(null);

    // ============================================
    // 辅助函数 / Helpers
    // ============================================

    function getOctokit(): Octokit {
        const octo = toValue(octokitRef);
        if (!octo) {
            throw new Error('Octokit 未初始化 - Token 可能丢失 / Octokit not initialized - token may be missing');
        }
        return octo;
    }

    function getBranch(): string {
        return config.branch || 'main';
    }

    function generateFilePath(file: File, folder?: string): string {
        // 使用自定义路径生成器 / Use custom generator if provided
        if (config.generatePath) {
            return config.generatePath(file);
        }

        // Generate Timestamp Filename: YYYYMMDDHHmmssSSS.ext
        const date = new Date();
        const timestamp =
            date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0') +
            date.getHours().toString().padStart(2, '0') +
            date.getMinutes().toString().padStart(2, '0') +
            date.getSeconds().toString().padStart(2, '0') +
            date.getMilliseconds().toString().padStart(3, '0');

        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const newFileName = `${timestamp}.${extension}`;

        // 构建路径：直接使用传入的 folder 作为目标路径
        // Build path: use the passed folder directly as target path
        const targetFolder = folder || '';
        const path = targetFolder ? `${targetFolder}/${newFileName}` : newFileName;

        // 清理双斜杠 / Clean up any double slashes
        return path.replace(/\/+/g, '/').replace(/^\//, '');
    }

    // ============================================
    // 文件转 Base64 / File to Base64
    // ============================================

    function fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // 移除 data URL 前缀 / Remove data URL prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // Atomic Upload Types
    // ============================================



    // ============================================
    // Atomic Upload Implementation
    // ============================================

    async function uploadAtomic(
        files: File[],
        targetFolder: string = '',
        options: UploadOptions = {}
    ): Promise<AtomicUploadResult> {
        uploading.value = true;
        progress.value = 0;
        error.value = null;

        const results: UploadResult[] = [];

        try {
            const octo = getOctokit();
            const branch = options.branch || getBranch();
            const { formatBytes } = await import('@/utils/format');

            // 1. Prepare Files (Compress & EXIF Clean)
            // =========================================
            const processedFiles: { file: File, path: string, content: string }[] = [];
            const timestamp = new Date().toISOString();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                progress.value = Math.round((i / files.length) * 30); // 0-30% for preparation

                // EXIF Cleaning & Compression Logic
                let finalFile = file;
                if (!options.skipExifClean) {
                    const cleanResult = await cleanupExifFromFile(file);

                    // Simple logic for batch: if clean successful, use it. If error, check fallback.
                    // For atomic batch, we simplify interaction for now: prefer cleaned, fallback to original if safe.

                    if (cleanResult.file) {
                        finalFile = cleanResult.file;
                    }
                }

                if (options.compress && needsCompression(finalFile, options.compress)) {
                    try {
                        finalFile = await compressImage(finalFile, options.compress);
                    } catch (e) {
                        console.warn('Compression failed, using original', e);
                    }
                }

                const base64 = await fileToBase64(finalFile);
                processedFiles.push({
                    file: finalFile,
                    path: generateFilePath(finalFile, targetFolder),
                    content: base64
                });
            }

            // 2. Fetch Current HEAD & Tree
            // =========================================
            progress.value = 40;
            const ref = await octo.git.getRef({
                owner: config.owner,
                repo: config.repo,
                ref: `heads/${branch}`,
            });
            const currentCommitSha = ref.data.object.sha;

            const commitData = await octo.git.getCommit({
                owner: config.owner,
                repo: config.repo,
                commit_sha: currentCommitSha,
            });
            const baseTreeSha = commitData.data.tree.sha;

            // 3. Create Blobs for Images
            // =========================================
            const newTreeItems: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];

            for (let i = 0; i < processedFiles.length; i++) {
                const item = processedFiles[i];
                progress.value = 40 + Math.round((i / processedFiles.length) * 20); // 40-60%

                const blob = await octo.git.createBlob({
                    owner: config.owner,
                    repo: config.repo,
                    content: item.content,
                    encoding: 'base64',
                });

                newTreeItems.push({
                    path: item.path,
                    mode: '100644',
                    type: 'blob',
                    sha: blob.data.sha,
                });

                const urls = buildUrlChain(item.path, { ...config, branch });
                results.push({
                    success: true,
                    path: item.path,
                    url: urls.displayUrl,
                    rawUrl: urls.rawUrl,
                });
            }

            // 4. Update Manifest (InMemory)
            // =========================================
            progress.value = 70;

            const currentTree = await octo.git.getTree({
                owner: config.owner,
                repo: config.repo,
                tree_sha: baseTreeSha,
                recursive: true.toString(),
            });

            // Filter out old manifest and non-blobs
            const existingFiles = currentTree.data.tree.filter(t => t.type === 'blob' && t.path !== '.vga-manifest.json');

            const allFilesMap = new Map<string, { size: number, sha: string }>();

            existingFiles.forEach(f => {
                if (f.path) allFilesMap.set(f.path, { size: f.size || 0, sha: f.sha || '' });
            });

            // Update with new files
            processedFiles.forEach((f, idx) => {
                allFilesMap.set(f.path, { size: f.file.size, sha: newTreeItems[idx].sha });
            });

            // Build File List
            const manifestFiles: AssetItem[] = [];
            let totalSize = 0;

            const sortedPaths = Array.from(allFilesMap.keys()).sort();

            for (const path of sortedPaths) {
                const info = allFilesMap.get(path)!;
                if (IMAGE_EXTENSIONS_REGEX.test(path)) {
                    manifestFiles.push({
                        name: path.split('/').pop() || '',
                        path: path,
                        size: info.size,
                        sha: info.sha,
                    });
                    totalSize += info.size;
                }
            }

            // Extract Folders
            const folders = new Set<string>();
            manifestFiles.forEach(f => {
                const parts = f.path.split('/');
                parts.pop();
                let current = '';
                parts.forEach(p => {
                    current = current ? `${current}/${p}` : p;
                    folders.add(current);
                });
            });

            const newManifest = {
                meta: {
                    version: '1.1.0',
                    generator: 'vue-github-assets',
                    lastUpdated: timestamp,
                    lastSyncedSha: currentCommitSha, // 基于哪个版本构建 / Based on which commit
                },
                stats: {
                    totalCount: manifestFiles.length,
                    totalSize: totalSize,
                    formattedSize: formatBytes(totalSize),
                },
                files: manifestFiles,
                folders: Array.from(folders).sort(),
            };

            // 5. Create Blob for Manifest
            // =========================================
            const manifestContent = JSON.stringify(newManifest, null, 2);
            const manifestBlob = await octo.git.createBlob({
                owner: config.owner,
                repo: config.repo,
                content: btoa(unescape(encodeURIComponent(manifestContent))),
                encoding: 'base64',
            });

            newTreeItems.push({
                path: '.vga-manifest.json',
                mode: '100644',
                type: 'blob',
                sha: manifestBlob.data.sha,
            });

            // 6. Create New Tree
            // =========================================
            progress.value = 85;
            const newTree = await octo.git.createTree({
                owner: config.owner,
                repo: config.repo,
                base_tree: baseTreeSha,
                tree: newTreeItems,
            });

            // 7. Create Commit
            // =========================================
            progress.value = 90;

            // Build commit message with file details
            const fileNames = processedFiles.map(f => f.path.split('/').pop()).join(', ');
            const commitMessage = processedFiles.length === 1
                ? `chore: @${config.owner} upload ${fileNames}`
                : `chore: @${config.owner} upload ${processedFiles.length} assets\n\nFiles:\n${processedFiles.map(f => `- ${f.path}`).join('\n')}`;

            const newCommit = await octo.git.createCommit({
                owner: config.owner,
                repo: config.repo,
                message: commitMessage,
                tree: newTree.data.sha,
                parents: [currentCommitSha],
            });

            // 8. Update Reference (Push)
            // =========================================
            progress.value = 95;
            await octo.git.updateRef({
                owner: config.owner,
                repo: config.repo,
                ref: `heads/${branch}`,
                sha: newCommit.data.sha,
            });

            // Create AssetItems for uploaded files
            const uploadedAssets: AssetItem[] = processedFiles.map((f, i) => ({
                name: f.path.split('/').pop() || '', // Use renamed filename, not original
                path: f.path,
                size: f.file.size,
                sha: newTreeItems[i].sha,
                mimeType: f.file.type,
                uploadedAt: timestamp,
            }));

            // Notify about uploaded files
            if (onFileUploaded) {
                uploadedAssets.forEach(f => onFileUploaded(f));
            }

            progress.value = 100;
            uploading.value = false;

            return {
                success: true,
                files: results,
                assets: uploadedAssets,
                manifestSha: manifestBlob.data.sha,
                commitSha: newCommit.data.sha
            };

        } catch (e) {
            console.error('Atomic Upload Failed', e);
            error.value = e as Error;
            uploading.value = false;
            return {
                success: false,
                files: results,
                error: e as Error
            };
        }
    }

    // ============================================
    // Legacy Wrappers
    // ============================================

    async function upload(
        file: File,
        uploadOptions: UploadOptions = {}
    ): Promise<UploadResult> {
        const targetFolder = uploadOptions.folder || '';
        const result = await uploadAtomic([file], targetFolder, uploadOptions);

        if (result.success && result.files.length > 0) {
            return result.files[0];
        } else {
            return {
                success: false,
                error: result.error || new Error('Upload failed')
            };
        }
    }

    async function uploadMultiple(
        files: File[],
        uploadOptions: UploadOptions = {}
    ): Promise<UploadResult[]> {
        const targetFolder = uploadOptions.folder || '';
        const result = await uploadAtomic(files, targetFolder, uploadOptions);
        return result.files;
    }

    async function deleteAtomic(
        items: AssetItem[],
        options: UploadOptions = {}
    ): Promise<AtomicUploadResult> {
        uploading.value = true;
        error.value = null;

        const results: UploadResult[] = [];
        const pathsToDelete = new Set(items.map(i => i.path));

        try {
            const octo = getOctokit();
            const branch = options.branch || getBranch();
            const { formatBytes } = await import('@/utils/format');

            // 1. Fetch Current HEAD & Tree
            const ref = await octo.git.getRef({
                owner: config.owner,
                repo: config.repo,
                ref: `heads/${branch}`,
            });
            const currentCommitSha = ref.data.object.sha;

            const commitData = await octo.git.getCommit({
                owner: config.owner,
                repo: config.repo,
                commit_sha: currentCommitSha,
            });
            const baseTreeSha = commitData.data.tree.sha;

            const currentTree = await octo.git.getTree({
                owner: config.owner,
                repo: config.repo,
                tree_sha: baseTreeSha,
                recursive: true.toString(),
            });

            if (currentTree.data.truncated) {
                throw new Error('Repository too large for atomic delete (tree truncated). Please delete manually.');
            }

            // 2. Filter Tree (exclude deleted files and old manifest)
            const keptFiles = currentTree.data.tree.filter(t =>
                t.type === 'blob' &&
                t.path &&
                !pathsToDelete.has(t.path) &&
                t.path !== '.vga-manifest.json'
            );

            // 3. Rebuild Manifest
            const manifestFiles: AssetItem[] = [];
            let totalSize = 0;
            const folders = new Set<string>();

            // Convert keptFiles back to Manifest AssetItem format relies on file name parsing and size
            // Note: GitHub Tree API returns size for blobs
            for (const file of keptFiles) {
                if (file.path && IMAGE_EXTENSIONS_REGEX.test(file.path)) {
                    manifestFiles.push({
                        name: file.path.split('/').pop() || '',
                        path: file.path,
                        size: file.size || 0,
                        sha: file.sha || '',
                    });
                    totalSize += file.size || 0;

                    // Extract folders
                    const parts = file.path.split('/');
                    parts.pop();
                    let current = '';
                    parts.forEach(p => {
                        current = current ? `${current}/${p}` : p;
                        folders.add(current);
                    });
                }
            }

            // Create Manifest Object
            const newManifest = {
                meta: {
                    version: '1.1.0',
                    generator: 'vue-github-assets',
                    lastUpdated: new Date().toISOString(),
                    lastSyncedSha: currentCommitSha, // 基于哪个版本构建 / Based on which commit
                },
                stats: {
                    totalCount: manifestFiles.length,
                    totalSize: totalSize,
                    formattedSize: formatBytes(totalSize),
                },
                files: manifestFiles, // This ensures manifest exactly matches the tree we are about to commit
                folders: Array.from(folders).sort(),
            };

            // 4. Create Blob for New Manifest
            const manifestContent = JSON.stringify(newManifest, null, 2);
            const manifestBlob = await octo.git.createBlob({
                owner: config.owner,
                repo: config.repo,
                content: btoa(unescape(encodeURIComponent(manifestContent))),
                encoding: 'base64',
            });

            // 5. Construct New Tree
            // We must include ALL kept files + new Manifest
            // Since we are NOT using base_tree (to effectively delete), we must list every file to keep.
            const newTreeItems: any[] = [
                ...keptFiles.map(f => ({
                    path: f.path,
                    mode: f.mode,
                    type: f.type,
                    sha: f.sha // Use existing SHA, no re-upload needed
                })),
                {
                    path: '.vga-manifest.json',
                    mode: '100644',
                    type: 'blob',
                    sha: manifestBlob.data.sha,
                }
            ];

            // 6. Create New Tree
            const newTree = await octo.git.createTree({
                owner: config.owner,
                repo: config.repo,
                tree: newTreeItems,
            });

            // 7. Create Commit
            const deleteMessage = items.length === 1
                ? `chore: @${config.owner} delete ${items[0].name}`
                : `chore: @${config.owner} delete ${items.length} assets\n\nFiles:\n${items.map(i => `- ${i.path}`).join('\n')}`;

            const newCommit = await octo.git.createCommit({
                owner: config.owner,
                repo: config.repo,
                message: deleteMessage,
                tree: newTree.data.sha,
                parents: [currentCommitSha],
            });

            // 8. Update Ref
            await octo.git.updateRef({
                owner: config.owner,
                repo: config.repo,
                ref: `heads/${branch}`,
                sha: newCommit.data.sha,
            });

            uploading.value = false;

            return {
                success: true,
                files: [], // No uploads
                manifestSha: manifestBlob.data.sha,
                commitSha: newCommit.data.sha
            };

        } catch (e) {
            console.error('Atomic Delete Failed', e);
            error.value = e as Error;
            uploading.value = false;
            return {
                success: false,
                files: [],
                error: e as Error
            };
        }
    }

    return {
        upload,
        uploadMultiple,
        uploadAtomic,
        deleteAtomic,
        uploading,
        progress,
        error,
    };
}
