/**
 * 上传 Hook / useUploader Composable
 * 
 * 处理文件上传逻辑，包括 EXIF 清理和压缩
 * Handles file upload logic including EXIF cleaning and compression
 */
import { ref, toValue } from 'vue';
import type { Octokit } from '@octokit/rest';
import type { MaybeRefOrGetter } from 'vue';
import type { StoreConfig, UploadOptions, UploadResult, AssetItem } from '@/types';
import { cleanupExifFromFile, type CleanupResult } from '@/utils/exif-cleaner';
import { compressImage, needsCompression } from '@/utils/image-compressor';
import { buildUrlChain } from '@/utils/url-transformer';

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
    const { config, octokit: octokitRef, onFileUploaded, onExifCleanupFailed } = options;

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

    function getBasePath(): string {
        return config.basePath || '';
    }

    function generateFilePath(file: File, folder?: string): string {
        // 使用自定义路径生成器 / Use custom generator if provided
        if (config.generatePath) {
            return config.generatePath(file);
        }

        // 构建路径 / Build path with optional folder
        const basePath = getBasePath();
        const targetFolder = folder || '';

        let path = '';
        if (basePath) path = basePath;
        if (targetFolder) path = path ? `${path}/${targetFolder}` : targetFolder;
        if (path) path = `${path}/${file.name}`;
        else path = file.name;

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
    // 上传单个文件 / Upload Single File
    // ============================================

    async function upload(
        file: File,
        uploadOptions: UploadOptions = {}
    ): Promise<UploadResult> {
        uploading.value = true;
        progress.value = 0;
        error.value = null;

        try {
            let processedFile = file;

            // 步骤 1: EXIF 清理（除非跳过）/ Step 1: EXIF cleaning (unless skipped)
            if (!uploadOptions.skipExifClean) {
                progress.value = 10;
                const cleanResult = await cleanupExifFromFile(file);

                // 检查是否有错误（不是格式跳过的警告）
                // Check if there's an error (not a format skip warning)
                const hasRealError = cleanResult.error &&
                    !cleanResult.error.includes('不支持的格式') &&
                    !cleanResult.error.includes('Unsupported format');

                if (hasRealError && onExifCleanupFailed) {
                    // 调用回调让用户选择 / Call callback to let user choose
                    const actions = await onExifCleanupFailed([{
                        file,
                        error: cleanResult.error || 'Unknown error',
                        result: cleanResult,
                    }]);

                    const action = actions.find(a => a.fileName === file.name);
                    if (action?.action === 'skip') {
                        return { success: false, error: new Error('用户取消上传 / User cancelled upload') };
                    } else if (action?.action === 'retry') {
                        // 重试一次 / Retry once
                        const retryResult = await cleanupExifFromFile(file);
                        if (retryResult.success && retryResult.file) {
                            processedFile = retryResult.file;
                        } else {
                            // 重试失败，使用原文件 / Retry failed, use original
                            processedFile = file;
                        }
                    } else {
                        // upload-original: 使用原文件 / Use original file
                        processedFile = file;
                    }
                } else if (cleanResult.success && cleanResult.file) {
                    processedFile = cleanResult.file;
                }
            }
            progress.value = 30;

            // 步骤 2: 压缩 (如果需要) / Step 2: Compression (if requested)
            if (uploadOptions.compress && needsCompression(processedFile, uploadOptions.compress)) {
                progress.value = 40;
                processedFile = await compressImage(processedFile, uploadOptions.compress);
            }
            progress.value = 50;

            // 步骤 3: 转换为 Base64 / Step 3: Convert to Base64
            const base64Content = await fileToBase64(processedFile);
            progress.value = 60;

            // 步骤 4: 生成路径 / Step 4: Generate path
            const filePath = generateFilePath(processedFile, uploadOptions.folder);
            progress.value = 70;

            // 步骤 5: 检查文件是否存在 (用于覆盖逻辑) / Step 5: Check if file exists (for overwrite)
            const octo = getOctokit();
            let existingSha: string | undefined;

            try {
                const existing = await octo.repos.getContent({
                    owner: config.owner,
                    repo: config.repo,
                    path: filePath,
                    ref: getBranch(),
                });

                if ('sha' in existing.data) {
                    existingSha = existing.data.sha;
                }
            } catch {
                // 文件不存在，这是正常的 / File doesn't exist, that's fine
            }
            progress.value = 80;

            // 步骤 6: 上传到 GitHub / Step 6: Upload to GitHub
            const response = await octo.repos.createOrUpdateFileContents({
                owner: config.owner,
                repo: config.repo,
                path: filePath,
                message: `Upload via Asset Plugin: ${processedFile.name}`,
                content: base64Content,
                branch: getBranch(),
                sha: existingSha,
            });
            progress.value = 95;

            // 步骤 7: 构建返回链接 / Step 7: Build result URLs
            const urls = buildUrlChain(filePath, config);

            // 创建 Manifest 资源项 / Create asset item for manifest
            const assetItem: AssetItem = {
                name: processedFile.name,
                path: filePath,
                size: processedFile.size,
                sha: response.data.content?.sha || '',
                mimeType: processedFile.type,
                uploadedAt: new Date().toISOString(),
            };

            // 通知文件上传完成 / Notify about uploaded file
            if (onFileUploaded) {
                onFileUploaded(assetItem);
            }

            progress.value = 100;

            return {
                success: true,
                url: urls.displayUrl,
                rawUrl: urls.rawUrl,
                path: filePath,
            };
        } catch (e) {
            error.value = e as Error;
            return {
                success: false,
                error: e as Error,
            };
        } finally {
            uploading.value = false;
        }
    }

    // ============================================
    // 批量上传 / Upload Multiple Files
    // ============================================

    async function uploadMultiple(
        files: File[],
        uploadOptions: UploadOptions = {}
    ): Promise<UploadResult[]> {
        const results: UploadResult[] = [];

        for (let i = 0; i < files.length; i++) {
            const result = await upload(files[i], uploadOptions);
            results.push(result);

            // 更新总体进度 / Update overall progress
            progress.value = Math.round(((i + 1) / files.length) * 100);
        }

        return results;
    }

    // ============================================
    // 返回 / Return
    // ============================================

    return {
        uploading,
        progress,
        error,
        upload,
        uploadMultiple,
    };
}
