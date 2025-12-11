/**
 * 核心 Store Hook / useAssetStore - Main Entry Composable
 * 
 * 集成所有资源管理功能 / Integrates all asset management functionality
 */
import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import { Octokit } from '@octokit/rest';
import type {
    StoreConfig,
    AssetItem,
    FolderItem,
    UploadOptions,
    UploadResult,
    CdnOptions,
    UseAssetStoreReturn,
} from '@/types';
import { useUploader } from './useUploader';
import { useManifest } from './useManifest';
import { buildUrlChain, toCdnUrl } from '@/utils/url-transformer';

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

    // forceRefresh 的缓存破坏时间戳 / Cache bust timestamps for forceRefresh
    const refreshTimestamps = ref<Record<string, number>>({});

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
            // 后台触发 Manifest 保存 / Trigger manifest save in background
            manifest.saveManifest(manifest.manifest.value!);
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
            if (!manifest.manifest.value?.lastSyncedSha) {
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

        currentPath.value = path || '';
        const basePath = path || config.basePath || '';

        // 过滤当前路径的直接文件 / Filter files DIRECTLY in current path
        const directFiles = manifest.manifest.value.files.filter((file) => {
            if (!basePath) {
                // Root level: only show files without / in path
                return !file.path.includes('/');
            }
            // Check if file is directly in this folder (not in a subfolder)
            const relativePath = file.path.startsWith(basePath + '/')
                ? file.path.slice(basePath.length + 1)
                : null;
            // File should be in this folder and not have any more / (no subfolders)
            return relativePath !== null && !relativePath.includes('/');
        });

        // 子文件夹中的文件 / Files from subfolders (shown at end with different style)
        const subfolderFiles = manifest.manifest.value.files.filter((file) => {
            if (!basePath) {
                // Root level: files WITH / in path are from subfolders
                return file.path.includes('/');
            }
            // Check if file is in a subfolder of current path
            const relativePath = file.path.startsWith(basePath + '/')
                ? file.path.slice(basePath.length + 1)
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
                if (!basePath) {
                    // Root level: only show top-level folders (no / in path)
                    return !folder.includes('/');
                }
                // Check if folder is a direct child
                if (!folder.startsWith(basePath + '/')) return false;
                const relativePath = folder.slice(basePath.length + 1);
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
        loading.value = true;
        try {
            return await uploader.upload(file, options);
        } finally {
            loading.value = false;
        }
    }

    async function uploadMultiple(
        files: File[],
        options?: UploadOptions
    ): Promise<UploadResult[]> {
        loading.value = true;
        try {
            return await uploader.uploadMultiple(files, options);
        } finally {
            loading.value = false;
        }
    }

    // ============================================
    // 删除 / Delete
    // ============================================

    async function remove(item: AssetItem): Promise<void> {
        loading.value = true;
        error.value = null;

        try {
            const octo = octokit.value;
            if (!octo) throw new Error('未授权 / Not authenticated');

            await octo.repos.deleteFile({
                owner: config.owner,
                repo: config.repo,
                path: item.path,
                message: `Delete via Asset Plugin: ${item.name}`,
                sha: item.sha,
                branch: manifest.currentBranch.value,
            });

            // 更新 Manifest / Update Manifest
            manifest.removeFile(item.path);
            await manifest.saveManifest(manifest.manifest.value!);

            // 更新本地列表 / Update local list
            fileList.value = fileList.value.filter((f) => f.path !== item.path);
        } catch (e) {
            error.value = e as Error;
            // 404 时同步真实文件 / On 404, sync with real files
            if ((e as { status?: number }).status === 404) {
                await manifest.syncWithRealFiles();
                updateFromManifest(currentPath.value);
            }
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function removeMultiple(items: AssetItem[]): Promise<void> {
        for (const item of items) {
            await remove(item);
        }
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
        ([newToken, newOwner, newRepo, newBranch]) => {
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
