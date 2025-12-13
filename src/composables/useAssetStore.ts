/**
 * 核心 Store Hook / useAssetStore - Main Entry Composable
 * 
 * 集成所有资源管理功能 / Integrates all asset management functionality
 */
import type {
    AssetItem,
    CdnOptions,
    FolderItem,
    StoreConfig,
    UploadOptions,
    UploadResult,
    UseAssetStoreReturn,
} from '@/types';
import { buildUrlChain, toCdnUrl } from '@/utils/url-transformer';
import { Octokit } from '@octokit/rest';
import { computed, ref, toValue, watch } from 'vue';
import { useManifest } from './useManifest';
import { useUploader } from './useUploader';

// ============================================
// Composable
// ============================================

import type { ExifFailedItem, ExifFailureAction } from './useUploader';

export interface UseAssetStoreOptions {
    onExifCleanupFailed?: (failedItems: ExifFailedItem[]) => Promise<ExifFailureAction[]>;
}

export function useAssetStore(config: StoreConfig, options?: UseAssetStoreOptions): UseAssetStoreReturn {
    // ============================================
    // 状态 / State
    // ============================================

    const loading = ref(false);
    const error = ref<Error | null>(null);
    const fileList = ref<AssetItem[]>([]);
    const folders = ref<FolderItem[]>([]);
    const currentPath = ref('');

    // 操作互斥锁 / Operation mutex lock - prevents concurrent operations
    const isOperating = ref(false);

    // forceRefresh 的缓存破坏时间戳 / Cache bust timestamps for forceRefresh
    const refreshTimestamps = ref<Record<string, number>>({});

    // 操作锁辅助函数 / Operation lock helper
    async function withOperationLock<T>(fn: () => Promise<T>): Promise<T> {
        if (isOperating.value) {
            throw new Error('操作进行中，请稍候 / Operation in progress, please wait');
        }

        isOperating.value = true;
        try {
            return await fn();
        } finally {
            isOperating.value = false;
        }
    }

    // ============================================
    // Octokit 实例 / Octokit Instance
    // ============================================

    const octokit = computed(() => {
        const token = toValue(config.token);
        if (!token) return null;
        return new Octokit({ auth: token });
    });

    // ============================================
    // 子 Hook / Sub-composables
    // ============================================

    const manifest = useManifest({
        config,
        octokit,
    });

    const uploader = useUploader({
        config,
        octokit,
        onFileUploaded: (file) => {
            manifest.addFile(file);
        },
        onExifCleanupFailed: options?.onExifCleanupFailed,
    });

    // ============================================
    // 获取列表 / Fetch List
    // ============================================

    /**
     * 获取资源列表 / Fetch asset list
     */
    async function fetchList(path?: string): Promise<void> {
        loading.value = true;
        error.value = null;

        try {
            // 首先尝试从 Manifest 加载 (快速) / First, try to load from manifest (fast)
            if (!manifest.manifest.value) {
                await manifest.loadManifest();
            }

            // 立即显示 Manifest 数据 / Show manifest data immediately
            if (manifest.manifest.value) {
                updateFromManifest(path);
            }

            // 后台同步真实文件 (首次加载时) / Sync with real files in background (on first load)
            // 防止并发重复同步 / Prevent concurrent syncs
            if (!manifest.manifest.value?.meta.lastSyncedSha && !manifest.syncing.value) {
                manifest.syncWithRealFiles().then(() => {
                    updateFromManifest(path);
                });
            }
        } catch (e) {
            error.value = e as Error;

            // 出错时，触发全量同步 / On error, trigger full sync
            await manifest.syncWithRealFiles();
            updateFromManifest(path);
        } finally {
            loading.value = false;
        }
    }

    function updateFromManifest(path?: string): void {
        if (!manifest.manifest.value) return;

        // 使用 ?? 运算符，确保 path 为空字符串（Root）时也能生效，只有 undefined 时才回退到 initialPath
        // Use ?? operator to ensure empty string (Root) is valid, only fallback to initialPath on undefined
        const resolvedPath = path ?? config.initialPath ?? '';
        currentPath.value = resolvedPath;
        const currentBasePath = resolvedPath;


        // 过滤当前路径的直接文件 / Filter files DIRECTLY in current path
        const directFiles = manifest.manifest.value.files.filter((file) => {
            if (!currentBasePath) {
                // Root level: only show files without / in path
                return !file.path.includes('/');
            }
            // Check if file is directly in this folder (not in a subfolder)
            const relativePath = file.path.startsWith(currentBasePath + '/')
                ? file.path.slice(currentBasePath.length + 1)
                : null;
            // File should be in this folder and not have any more / (no subfolders)
            return relativePath !== null && !relativePath.includes('/');
        });

        // 子文件夹中的文件 / Files from subfolders (shown at end with different style)
        const subfolderFiles = manifest.manifest.value.files.filter((file) => {
            if (!currentBasePath) {
                // Root level: files WITH / in path are from subfolders
                return file.path.includes('/');
            }
            // Check if file is in a subfolder of current path
            const relativePath = file.path.startsWith(currentBasePath + '/')
                ? file.path.slice(currentBasePath.length + 1)
                : null;
            // File is in subfolder if it has more / in relative path
            return relativePath !== null && relativePath.includes('/');
        }).map(file => ({
            ...file,
            isFromSubfolder: true,
        }));

        // Combine: direct files first, then subfolder files
        fileList.value = [
            ...directFiles.map(f => ({ ...f, isFromSubfolder: false })),
            ...subfolderFiles
        ] as AssetItem[];

        // 获取直接子文件夹 / Get direct child folders only
        folders.value = manifest.manifest.value.folders
            .filter((folder) => {
                if (!currentBasePath) {
                    // Root level: only show top-level folders (no / in path)
                    return !folder.includes('/');
                }
                // Check if folder is a direct child
                if (!folder.startsWith(currentBasePath + '/')) return false;
                const relativePath = folder.slice(currentBasePath.length + 1);
                // Should not have any more / (direct child only)
                return !relativePath.includes('/');
            })
            .map((folder) => ({
                name: folder.split('/').pop() || folder,
                path: folder,
            }));
    }

    // ============================================
    // 上传 / Upload
    // ============================================

    async function upload(
        file: File,
        options?: UploadOptions
    ): Promise<UploadResult> {
        return withOperationLock(async () => {
            loading.value = true;
            try {
                // Direct use of atomic upload to get SHA
                const result = await uploader.uploadAtomic([file], options?.folder || '', options);
                if (result.success && result.manifestSha) {
                    // success: update local state
                    if (result.assets && result.assets.length > 0) {
                        manifest.addFile(result.assets[0]);
                    }

                    // Sync persistence state
                    if (manifest.manifest.value) {
                        manifest.markAsSaved(manifest.manifest.value, result.manifestSha);
                    }

                    // 🔧 FIX: Refresh fileList from manifest to show new file in UI
                    updateFromManifest(currentPath.value);

                    return result.files[0];
                } else if (!result.success) {
                    throw result.error || new Error('Upload failed');
                }
                return result.files[0];
            } finally {
                loading.value = false;
            }
        });
    }

    async function uploadMultiple(
        files: File[],
        options?: UploadOptions
    ): Promise<UploadResult[]> {
        loading.value = true;
        try {
            const result = await uploader.uploadAtomic(files, options?.folder || '', options);
            if (result.success && result.manifestSha) {
                // success: update local state
                if (result.assets) {
                    result.assets.forEach(f => manifest.addFile(f));
                }

                // Sync persistence state
                if (manifest.manifest.value) {
                    manifest.markAsSaved(manifest.manifest.value, result.manifestSha);
                }

                // 🔧 FIX: Refresh fileList from manifest to show new files in UI
                updateFromManifest(currentPath.value);

                return result.files;
            } else if (!result.success) {
                throw result.error || new Error('Upload failed');
            }
            return result.files;
        } finally {
            loading.value = false;
        }
    }

    // ============================================
    // 删除 / Delete
    // ============================================

    async function remove(item: AssetItem): Promise<void> {
        await removeMultiple([item]);
    }

    async function removeMultiple(items: AssetItem[]): Promise<void> {
        return withOperationLock(async () => {
            loading.value = true;
            error.value = null;

            // Optimistic Update: Remove from local state immediately
            const pathsToRemove = new Set(items.map(i => i.path));
            const previousFileList = [...fileList.value];
            const previousManifest = manifest.manifest.value ? JSON.parse(JSON.stringify(manifest.manifest.value)) : null;

            // Apply optimistic removal to fileList
            fileList.value = fileList.value.filter(f => !pathsToRemove.has(f.path));

            // Apply optimistic removal to manifest (for UI consistency)
            if (manifest.manifest.value) {
                items.forEach(item => manifest.removeFile(item.path));
            }

            try {
                // Atomic delete handles both file deletion and manifest update in one commit
                const result = await uploader.deleteAtomic(items, { branch: manifest.currentBranch.value });

                if (!result.success) {
                    throw result.error || new Error('Delete failed');
                }

                // Success: Sync persistence state
                if (manifest.manifest.value && result.manifestSha) {
                    manifest.markAsSaved(manifest.manifest.value, result.manifestSha);
                }

            } catch (e) {
                // Revert optimistic update on error
                fileList.value = previousFileList;
                if (previousManifest) {
                    manifest.manifest.value = previousManifest;
                }

                error.value = e as Error;
                // On error, try full sync to restore consistency
                await manifest.syncWithRealFiles();
                updateFromManifest(currentPath.value);
                throw e;
            } finally {
                loading.value = false;
            }
        });
    }


    // ============================================
    // 创建文件夹 / Create Folder
    // ============================================

    async function createFolder(
        name: string,
        parentPath?: string
    ): Promise<void> {
        loading.value = true;
        error.value = null;

        try {
            const octo = octokit.value;
            if (!octo) throw new Error('未授权 / Not authenticated');

            // GitHub 没有直接的文件夹 - 创建 .gitkeep 文件 / GitHub doesn't have folders directly - create a .gitkeep file
            const folderPath = parentPath ? `${parentPath}/${name}` : name;
            const gitkeepPath = `${folderPath}/.gitkeep`;

            await octo.repos.createOrUpdateFileContents({
                owner: config.owner,
                repo: config.repo,
                path: gitkeepPath,
                message: `Create folder: ${name}`,
                content: btoa(''),
                branch: manifest.currentBranch.value,
            });

            // 更新文件夹列表 / Update folders list
            folders.value.push({ name, path: folderPath });
        } catch (e) {
            error.value = e as Error;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // ============================================
    // 强制刷新 (缓存破坏) / Force Refresh (Cache Busting)
    // ============================================

    async function forceRefresh(path: string): Promise<void> {
        refreshTimestamps.value[path] = Date.now();

        // 同时触发该文件的 Manifest 同步 / Also trigger a manifest sync for this file
        await manifest.syncWithRealFiles();
        updateFromManifest(currentPath.value);
    }

    // ============================================
    // URL 辅助函数 / URL Helpers
    // ============================================

    function getDisplayUrl(item: AssetItem): string {
        const resolvedConfig = { ...config, branch: manifest.currentBranch.value };
        const urls = buildUrlChain(item.path, resolvedConfig);
        return urls.displayUrl;
    }

    function getOptimizedUrl(item: AssetItem, options?: CdnOptions): string {
        const resolvedConfig = { ...config, branch: manifest.currentBranch.value };
        const urls = buildUrlChain(item.path, resolvedConfig);

        // 如果调用了 forceRefresh，应用缓存破坏 / Apply cache busting if forceRefresh was called
        const timestamp = refreshTimestamps.value[item.path];
        const finalOptions = timestamp
            ? { ...options, cacheBust: true }
            : options;

        return toCdnUrl(urls.rawUrl, finalOptions);
    }

    // ============================================
    // 监听 Token 变化 / Watch for Token Changes
    // ============================================

    watch(
        () => [toValue(config.token), config.owner, config.repo, config.branch],
        ([newToken, newOwner, newRepo]) => {
            if (newToken && newOwner && newRepo) {
                // Token 可用，加载数据 / Token became available, load data
                fetchList();
            } else {
                // Token 移除，清除数据 / Token removed, clear data
                fileList.value = [];
                folders.value = [];
            }
        },
        { immediate: true }
    );

    // ============================================
    // 返回 / Return
    // ============================================

    return {
        loading: computed(() => loading.value || manifest.loading.value || uploader.uploading.value),
        error,
        fileList,
        folders,
        currentPath,
        manifest: manifest.manifest,
        isOperating, // 操作锁状态 / Operation lock state for UI
        upload,
        uploadMultiple,
        fetchList,
        remove,
        removeMultiple,
        createFolder,
        forceRefresh,
        getDisplayUrl,
        getOptimizedUrl,
        currentBranch: manifest.currentBranch,
    };
}
