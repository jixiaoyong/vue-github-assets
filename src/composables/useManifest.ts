/**
 * useManifest Composable
 * Manages the .vga-manifest.json index file
 * Implements Stale-While-Revalidate pattern
 */
import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { Octokit } from '@octokit/rest';
import type { VgaManifest, AssetItem, StoreConfig } from '@/types';

// ============================================
// Constants
// ============================================

import { IMAGE_EXTENSIONS_REGEX } from '@/constants/extensions';

const MANIFEST_FILENAME = '.vga-manifest.json';

// const IMAGE_EXTENSIONS = ... (Removed, using imported constant)

// ============================================
// Types
// ============================================

interface UseManifestOptions {
    config: StoreConfig;
    octokit: MaybeRefOrGetter<Octokit | null>;
}

interface SyncResult {
    success: boolean;
    changes: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    error?: Error;
}

// ============================================
// Composable
// ============================================

export function useManifest(options: UseManifestOptions) {
    const { config, octokit: octokitRef } = options;

    const manifest = ref<VgaManifest | null>(null);
    const manifestSha = ref<string | null>(null);
    const loading = ref(false);
    const syncing = ref(false);
    const error = ref<Error | null>(null);

    // ============================================
    // Helper Functions
    // ============================================

    function getOctokit(): Octokit {
        const octo = toValue(octokitRef);
        if (!octo) {
            throw new Error('Octokit not initialized - token may be missing');
        }
        return octo;
    }

    const detectedBranch = ref<string>('');
    const lastSavedState = ref<string | null>(null);

    function getManifestHash(m: VgaManifest): string {
        const meta = { ...m.meta };
        // Ignore timestamp changes for saved state comparison
        // @ts-ignore
        delete meta.lastUpdated;

        return JSON.stringify({
            meta,
            stats: m.stats,
            files: m.files.map(f => ({ ...f, sha: f.sha, path: f.path })),
            folders: m.folders
        });
    }

    // helper to get branch, fetching default if not configured
    async function ensureBranch(): Promise<string> {
        if (config.branch) {
            return config.branch;
        }
        if (detectedBranch.value) return detectedBranch.value;

        try {
            const octo = getOctokit();
            const { data } = await octo.repos.get({
                owner: config.owner,
                repo: config.repo,
            });
            detectedBranch.value = data.default_branch;
            return detectedBranch.value;
        } catch (e) {
            console.error('Failed to detect branch, defaulting to main:', e);
            return 'main';
        }
    }



    function getPath(): string {
        return config.basePath || '';
    }

    // ============================================
    // Load Manifest
    // ============================================

    /**
     * 加载 Manifest 文件 / Load Manifest file
     * 
     * 如果文件不存在 (404)，会创建一个空的 Manifest
     * If file does not exist (404), creates an empty Manifest
     */
    async function loadManifest(): Promise<VgaManifest | null> {
        loading.value = true;
        error.value = null;
        manifestSha.value = null;
        detectedBranch.value = '';

        try {
            const octo = getOctokit();
            const currentBranch = await ensureBranch();
            const response = await octo.repos.getContent({
                owner: config.owner,
                repo: config.repo,
                path: MANIFEST_FILENAME,
                ref: currentBranch,
            });

            if ('content' in response.data && response.data.type === 'file') {
                manifestSha.value = response.data.sha;
                const content = atob(response.data.content);
                const rawManifest = JSON.parse(content);

                // Compatibility handling: migrate V1 to V2 structure if needed
                if (!rawManifest.meta && rawManifest.version) {
                    manifest.value = {
                        meta: {
                            version: '1.1.0',
                            // @ts-ignore
                            generator: rawManifest.generator || 'vue-github-assets',
                            // @ts-ignore
                            lastUpdated: rawManifest.lastUpdated || new Date().toISOString(),
                            // @ts-ignore
                            lastSyncedSha: rawManifest.lastSyncedSha || '',
                        },
                        stats: {
                            totalCount: rawManifest.files?.length || 0,
                            totalSize: 0, // Need recalculation or default to 0
                            formattedSize: '0 B',
                        },
                        files: rawManifest.files || [],
                        folders: rawManifest.folders || [],
                    };
                } else {
                    manifest.value = rawManifest as VgaManifest;
                }

                lastSavedState.value = getManifestHash(manifest.value);
                return manifest.value;
            }
        } catch (e) {
            // Manifest 不存在 - 这是正常的 / Manifest doesn't exist yet - that's okay
            if ((e as { status?: number }).status === 404) {
                manifest.value = createEmptyManifest();
                lastSavedState.value = getManifestHash(manifest.value);
                return manifest.value;
            }
            error.value = e as Error;
        } finally {
            loading.value = false;
        }
        return null;
    }

    // ============================================
    // Create Empty Manifest
    // ============================================

    function createEmptyManifest(): VgaManifest {
        return {
            meta: {
                version: '1.1.0',
                generator: 'vue-github-assets',
                lastUpdated: new Date().toISOString(),
                lastSyncedSha: '',
            },
            stats: {
                totalCount: 0,
                totalSize: 0,
                formattedSize: '0 B',
            },
            files: [],
            folders: [],
        };
    }

    // ============================================
    // Save Manifest
    // ============================================

    /**
     * 保存 Manifest 到 GitHub / Save Manifest to GitHub
     * 
     * @returns 是否保存成功 / Whether save was successful
     */
    async function saveManifest(
        updatedManifest: VgaManifest,
        retryCount = 0
    ): Promise<boolean> {
        try {
            // Check if content (excluding timestamp) changed
            const currentHash = getManifestHash(updatedManifest);
            if (lastSavedState.value === currentHash) {
                // No meaningful changes, skip save
                manifest.value = updatedManifest;
                return true;
            }

            const octo = getOctokit();
            const content = JSON.stringify(updatedManifest, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));

            const params: Parameters<typeof octo.repos.createOrUpdateFileContents>[0] = {
                owner: config.owner,
                repo: config.repo,
                path: MANIFEST_FILENAME,
                message: 'chore: update asset manifest',
                content: encodedContent,
                branch: await ensureBranch(),
            };

            // 如果是更新，带上 SHA / Include SHA if updating existing file
            if (manifestSha.value) {
                params.sha = manifestSha.value;
            }

            const response = await octo.repos.createOrUpdateFileContents(params);

            manifestSha.value = response.data.content?.sha || null;
            manifest.value = updatedManifest;
            lastSavedState.value = currentHash;

            return true;
        } catch (e) {
            // 处理冲突 - 其他人更新了 Manifest / Handle conflict - someone else updated the manifest
            if ((e as { status?: number }).status === 409) {
                if (retryCount < 2) {
                    console.log(`Manifest conflict (409), retrying... (${retryCount + 1}/2)`);
                    // 重新加载获取最新 SHA / Reload to get latest SHA
                    await loadManifest();
                    // 再次尝试保存（使用最新的 SHA 但保留我们的 updatedManifest 内容）
                    // Retry save (using latest SHA but keeping our updatedManifest content)
                    return saveManifest(updatedManifest, retryCount + 1);
                }
            }
            error.value = e as Error;
            return false;
        }
    }

    // ============================================
    // Sync with Real Files (Background)
    // ============================================

    /**
     * 与 GitHub 真实文件同步 / Sync with real files on GitHub
     * 
     * 会遍历所有文件并更新 Manifest / Iterates all files and updates Manifest
     */
    async function syncWithRealFiles(): Promise<SyncResult> {
        syncing.value = true;
        const result: SyncResult = {
            success: false,
            changes: { added: [], removed: [], modified: [] },
        };

        try {
            const octo = getOctokit();
            // 扫描时始终从根目录开始，basePath 仅用于 UI 显示 / Always scan from root, basePath is only for UI display
            const scanPath = '';
            const currentBranch = await ensureBranch();

            // 获取真实文件列表 / Fetch actual files from GitHub
            // capture SHA before async op
            const initialManifestSha = manifestSha.value;

            const scanResult = await fetchAllFiles(octo, scanPath, currentBranch);
            const realFiles = scanResult.files;
            const scannedCommitSha = scanResult.commitSha;

            // Race Condition Check: Abort if manifest updated during fetch
            if (manifestSha.value !== initialManifestSha) {
                console.warn('Manifest updated during sync, aborting stale sync');
                return {
                    success: false,
                    changes: { added: [], removed: [], modified: [] },
                    error: new Error('Manifest updated during sync')
                };
            }

            if (!manifest.value) {
                manifest.value = createEmptyManifest();
            }

            // 对比 Manifest / Compare with manifest
            const manifestPaths = new Set(manifest.value.files.map(f => f.path));
            const realPaths = new Set(realFiles.map(f => f.path));

            // 查找新增 / Find additions
            for (const file of realFiles) {
                if (!manifestPaths.has(file.path)) {
                    result.changes.added.push(file.path);
                }
            }

            // 查找删除 / Find removals
            for (const file of manifest.value.files) {
                if (!realPaths.has(file.path)) {
                    result.changes.removed.push(file.path);
                }
            }

            // 检查修改 / Check for modifications (SHA changed)
            for (const file of realFiles) {
                const manifestFile = manifest.value.files.find(f => f.path === file.path);
                if (manifestFile && manifestFile.sha !== file.sha) {
                    result.changes.modified.push(file.path);
                }
            }

            // 如果有变更则更新 / Update manifest if there are changes
            const hasChanges =
                result.changes.added.length > 0 ||
                result.changes.removed.length > 0 ||
                result.changes.modified.length > 0;

            if (hasChanges) {
                console.log('Sync detected changes:', result.changes);
                // Calculate stats
                const totalSize = realFiles.reduce((acc, f) => acc + f.size, 0);
                const { formatBytes } = await import('@/utils/format');

                const updatedManifest: VgaManifest = {
                    meta: {
                        version: '1.1.0',
                        generator: 'vue-github-assets',
                        lastUpdated: new Date().toISOString(),
                        lastSyncedSha: scannedCommitSha || '', // Update synced SHA
                    },
                    stats: {
                        totalCount: realFiles.length,
                        totalSize: totalSize,
                        formattedSize: formatBytes(totalSize),
                    },
                    files: realFiles,
                    folders: extractFolders(realFiles),
                };

                await saveManifest(updatedManifest);
            } else if (manifest.value.meta.lastSyncedSha !== scannedCommitSha) {
                // No content changes, but update synced SHA to prevent re-scan
                manifest.value.meta.lastSyncedSha = scannedCommitSha || '';
                await saveManifest(manifest.value);
            }

            result.success = true;
        } catch (e) {
            result.error = e as Error;
            error.value = e as Error;
        } finally {
            syncing.value = false;
        }

        return result;
    }

    // ============================================
    // Fetch All Files Recursively
    // ============================================

    async function fetchAllFiles(
        octo: Octokit,
        basePath: string,
        branch: string
    ): Promise<{ files: AssetItem[], commitSha: string }> {
        const files: AssetItem[] = [];

        // 1. Get Branch Commit SHA
        const refResponse = await octo.git.getRef({
            owner: config.owner,
            repo: config.repo,
            ref: `heads/${branch}`,
        });
        const commitSha = refResponse.data.object.sha;

        // 2. Get Tree (Recursive)
        // Using Git Tree API is much more efficient than recursive getContent
        const commitResponse = await octo.git.getCommit({
            owner: config.owner,
            repo: config.repo,
            commit_sha: commitSha,
        });
        const treeSha = commitResponse.data.tree.sha;

        const treeResponse = await octo.git.getTree({
            owner: config.owner,
            repo: config.repo,
            tree_sha: treeSha,
            recursive: 'true',
        });

        if (treeResponse.data.truncated) {
            console.warn('Tree truncated! Sync may be incomplete.');
        }

        // 3. Process items
        for (const item of treeResponse.data.tree) {
            if (item.type === 'blob' && item.path && IMAGE_EXTENSIONS_REGEX.test(item.path)) {
                // Filter by basePath if needed (though we scan root usually)
                if (basePath && !item.path.startsWith(basePath)) continue;

                files.push({
                    name: item.path.split('/').pop() || '',
                    path: item.path,
                    size: item.size || 0,
                    sha: item.sha || '',
                    downloadUrl: undefined, // Tree API doesn't give download URL directly, but we can construct it if needed, or leave undefined
                });
            }
        }

        return { files, commitSha };
    }

    // ============================================
    // Extract Folders from Files
    // ============================================

    function extractFolders(files: AssetItem[]): string[] {
        const folders = new Set<string>();

        for (const file of files) {
            const parts = file.path.split('/');
            parts.pop(); // Remove filename

            let current = '';
            for (const part of parts) {
                current = current ? `${current}/${part}` : part;
                folders.add(current);
            }
        }

        return Array.from(folders).sort();
    }

    // ============================================
    // Update After Upload
    // ============================================

    function addFile(file: AssetItem): void {
        /* Deprecated: Logic moved to Atomic Upload, but keeping for compatibility if needed */
        if (!manifest.value) {
            manifest.value = createEmptyManifest();
        }

        // Remove existing file with same path
        manifest.value.files = manifest.value.files.filter(f => f.path !== file.path);

        // Add new file
        manifest.value.files.push(file);

        // Update Meta
        manifest.value.meta.lastUpdated = new Date().toISOString();

        // Update Stats (Simplified, proper calc is in sync)
        manifest.value.stats.totalCount = manifest.value.files.length;
        // Total size update would require iterating all files usually

        // Update folders
        manifest.value.folders = extractFolders(manifest.value.files);
    }

    function removeFile(path: string): void {
        /* Deprecated: Logic moved to Atomic Upload */
        if (!manifest.value) return;

        manifest.value.files = manifest.value.files.filter(f => f.path !== path);

        manifest.value.meta.lastUpdated = new Date().toISOString();
        manifest.value.stats.totalCount = manifest.value.files.length;

        manifest.value.folders = extractFolders(manifest.value.files);
    }

    // ============================================
    // Return
    // ============================================

    function markAsSaved(newManifest: VgaManifest, sha: string): void {
        manifest.value = newManifest;
        manifestSha.value = sha;
        lastSavedState.value = getManifestHash(newManifest);
    }

    return {
        manifest,
        loading,
        syncing,
        error,
        currentBranch: computed(() => config.branch || detectedBranch.value || 'main'),
        loadManifest,
        saveManifest,
        syncWithRealFiles,
        addFile,
        removeFile,
        createEmptyManifest,
        markAsSaved,
    };
}
