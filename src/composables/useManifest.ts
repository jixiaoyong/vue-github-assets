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

const MANIFEST_FILENAME = '.vga-manifest.json';
const MANIFEST_VERSION = '1.0.0';
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

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
        return JSON.stringify({
            version: m.version,
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

    function getBranchSync(): string {
        return config.branch || detectedBranch.value || 'main';
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
                manifest.value = JSON.parse(content) as VgaManifest;
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
            version: MANIFEST_VERSION,
            lastUpdated: new Date().toISOString(),
            lastSyncedSha: '',
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
        updatedManifest: VgaManifest
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
                // 重新加载并合并 / Reload and merge
                await loadManifest();
                return false;
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
            const basePath = getPath();
            const currentBranch = await ensureBranch();

            // 获取真实文件列表 / Fetch actual files from GitHub
            const realFiles = await fetchAllFiles(octo, basePath, currentBranch);

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
                const updatedManifest: VgaManifest = {
                    version: MANIFEST_VERSION,
                    lastUpdated: new Date().toISOString(),
                    lastSyncedSha: '', // Will be updated by GitHub Action if configured
                    files: realFiles,
                    folders: extractFolders(realFiles),
                };

                await saveManifest(updatedManifest);
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
    ): Promise<AssetItem[]> {
        const files: AssetItem[] = [];

        async function fetchDir(path: string) {
            try {
                const response = await octo.repos.getContent({
                    owner: config.owner,
                    repo: config.repo,
                    path: path || '',
                    ref: branch,
                });

                if (!Array.isArray(response.data)) return;

                for (const item of response.data) {
                    if (item.type === 'dir') {
                        await fetchDir(item.path);
                    } else if (item.type === 'file' && IMAGE_EXTENSIONS.test(item.name)) {
                        files.push({
                            name: item.name,
                            path: item.path,
                            size: item.size || 0,
                            sha: item.sha,
                            downloadUrl: item.download_url || undefined,
                        });
                    }
                }
            } catch {
                // Directory might not exist
            }
        }

        await fetchDir(basePath);
        return files;
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
        if (!manifest.value) {
            manifest.value = createEmptyManifest();
        }

        // Remove existing file with same path
        manifest.value.files = manifest.value.files.filter(f => f.path !== file.path);

        // Add new file
        manifest.value.files.push(file);
        manifest.value.lastUpdated = new Date().toISOString();

        // Update folders
        manifest.value.folders = extractFolders(manifest.value.files);
    }

    function removeFile(path: string): void {
        if (!manifest.value) return;

        manifest.value.files = manifest.value.files.filter(f => f.path !== path);
        manifest.value.lastUpdated = new Date().toISOString();
        manifest.value.folders = extractFolders(manifest.value.files);
    }

    // ============================================
    // Return
    // ============================================

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
    };
}
