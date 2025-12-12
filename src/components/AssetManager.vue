<script setup lang="ts">
    /**
     * 资源管理器组件 / AssetManager Component
     * 
     * 完整的资源管理与上传界面 / Complete asset management UI with uploader, grid, and folder navigation
     */
    import { ref, onMounted, computed } from 'vue';
    import {
        RefreshCw, FolderPlus, ChevronRight, Home, Menu
    } from 'lucide-vue-next';
    import type { AssetManagerProps, AssetItem } from '@/types';
    import { useAssetStore } from '@/composables/useAssetStore';
    import type { ExifFailedItem, ExifFailureAction } from '@/composables/useUploader';
    import AssetUploader from './AssetUploader.vue';
    import AssetGrid from './AssetGrid.vue';
    import FolderTree from './FolderTree.vue';
    import ExifWarningDialog from './ExifWarningDialog.vue';

    // ============================================
    // Props & Emits
    // ============================================

    const props = withDefaults(defineProps<AssetManagerProps>(), {
        showFolders: true,
        showUploader: true,
        copyFormats: () => ['url', 'markdown', 'html'],
    });

    const emit = defineEmits<{
        select: [url: string, item: AssetItem];
        upload: [results: { success: boolean; url?: string; error?: Error }[]];
        delete: [item: AssetItem];
        error: [error: Error];
    }>();

    // ============================================
    // EXIF 弹窗逻辑 / EXIF Dialog Logic
    // ============================================

    const showExifDialog = ref(false);
    const exifFailedItems = ref<ExifFailedItem[]>([]);
    let exifResolve: ((value: ExifFailureAction[]) => void) | null = null;

    const handleExifCleanupFailed = (failedItems: ExifFailedItem[]): Promise<ExifFailureAction[]> => {
        exifFailedItems.value = failedItems;
        showExifDialog.value = true;

        return new Promise((resolve) => {
            exifResolve = resolve;
        });
    };

    const onExifDialogResolve = (actions: ExifFailureAction[]) => {
        showExifDialog.value = false;
        if (exifResolve) {
            exifResolve(actions);
            exifResolve = null;
        }
    };

    const onExifDialogCancel = () => {
        showExifDialog.value = false;
        // 如果取消，默认跳过所有文件 / Default to skipping all if cancelled
        if (exifResolve) {
            const actions = exifFailedItems.value.map(item => ({
                fileName: item.file.name,
                action: 'skip' as const
            }));
            exifResolve(actions);
            exifResolve = null;
        }
    };

    // ============================================
    // Store
    // ============================================

    const store = useAssetStore(props.config, {
        onExifCleanupFailed: handleExifCleanupFailed
    });

    // ============================================
    // Resolved Config
    // ============================================

    const resolvedConfig = computed(() => ({
        ...props.config,
        branch: store.currentBranch.value,
    }));

    // ============================================
    // 状态 / State
    // ============================================

    const showNewFolderDialog = ref(false);
    const newFolderName = ref('');
    const isSidebarOpen = ref(true);

    // ============================================
    // 面包屑 / Breadcrumb
    // ============================================

    const breadcrumbs = computed(() => {
        const path = store.currentPath.value;
        if (!path) return [];

        const parts = path.split('/').filter(Boolean);
        const result: { name: string; path: string }[] = [];

        let currentPath = '';
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            result.push({ name: part, path: currentPath });
        }

        return result;
    });

    // 获取所有唯一的文件夹路径用于树形展示 / Get all unique folder paths for tree
    const allFolderPaths = computed(() => {
        // 从文件列表和显式文件夹中提取所有路径 / Extract all folder paths from file list and explicit folders
        const paths = new Set<string>();

        // 添加当前已知文件夹 / Add current known folders
        store.folders.value.forEach(f => paths.add(f.path));

        // 从文件中提取路径（防止某些空文件夹丢失） / Add paths generated from files (in case some empty folders are missing)
        if (store.manifest.value) {
            store.manifest.value.folders.forEach((f: string) => paths.add(f));
        }

        return Array.from(paths).sort();
    });

    // ============================================
    // 导航 / Navigation
    // ============================================

    function navigateTo(path: string) {
        store.fetchList(path);
    }

    function handleFolderSelect(path: string) {
        navigateTo(path);
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth <= 640) {
            isSidebarOpen.value = false;
        }
    }

    function goHome() {
        store.fetchList('');
    }

    // ============================================
    // 文件夹创建 / Folder Creation
    // ============================================

    async function createFolder() {
        if (!newFolderName.value.trim()) return;

        try {
            await store.createFolder(newFolderName.value, store.currentPath.value || undefined);
            newFolderName.value = '';
            showNewFolderDialog.value = false;
        } catch (e) {
            emit('error', e as Error);
        }
    }

    // ============================================
    // 事件处理 / Event Handlers
    // ============================================

    function handleSelect(url: string, item: AssetItem) {
        emit('select', url, item);
    }

    function handleUpload(results: { success: boolean; url?: string; error?: Error }[]) {
        emit('upload', results);
        // 上传后刷新列表 / Refresh list after upload
        store.fetchList(store.currentPath.value);
    }

    async function handleDelete(item: AssetItem) {
        if (!confirm(`Confirm delete "${item.name}"?`)) return;

        try {
            await store.remove(item);
            emit('delete', item);
        } catch (e) {
            emit('error', e as Error);
        }
    }

    function handleError(error: Error) {
        emit('error', error);
    }

    function refresh() {
        store.fetchList(store.currentPath.value);
    }

    // ============================================
    // 生命周期 / Lifecycle
    // ============================================

    onMounted(() => {
        store.fetchList(props.config.basePath || '');
    });
</script>

<template>
    <div class="vga-manager vga-root">
        <!-- Main Toolbar -->
        <div class="vga-manager__toolbar">
            <div class="vga-toolbar-left">
                <button v-if="showFolders" class="vga-btn vga-btn-ghost vga-btn-icon vga-sidebar-toggle"
                    @click="isSidebarOpen = !isSidebarOpen" title="Toggle Sidebar">
                    <Menu :size="18" />
                </button>

                <!-- Breadcrumb -->
                <nav class="vga-manager__breadcrumb">
                    <button class="vga-btn vga-btn-ghost vga-btn-icon" @click="goHome">
                        <Home :size="18" />
                    </button>
                    <template v-for="crumb in breadcrumbs" :key="crumb.path">
                        <ChevronRight :size="14" class="vga-manager__sep" />
                        <button class="vga-btn vga-btn-ghost vga-btn-sm" @click="navigateTo(crumb.path)">
                            {{ crumb.name }}
                        </button>
                    </template>
                </nav>
            </div>

            <!-- Actions -->
            <div class="vga-manager__actions">
                <button v-if="showFolders" class="vga-btn vga-btn-secondary vga-btn-sm"
                    @click="showNewFolderDialog = true">
                    <FolderPlus :size="16" />
                    <span class="vga-hidden-mobile">New Folder</span>
                </button>
                <button class="vga-btn vga-btn-ghost vga-btn-icon" :disabled="store.loading.value" @click="refresh">
                    <RefreshCw :size="18" :class="{ 'vga-spin': store.loading.value }" />
                </button>
            </div>
        </div>

        <div class="vga-manager__body">
            <!-- Mobile Sidebar Backdrop -->
            <div v-if="showFolders && isSidebarOpen" class="vga-manager__sidebar-backdrop"
                @click="isSidebarOpen = false"></div>

            <!-- Sidebar (Folder Tree) -->
            <aside v-if="showFolders" class="vga-manager__sidebar"
                :class="{ 'vga-manager__sidebar--closed': !isSidebarOpen }">
                <div class="vga-sidebar-content">
                    <FolderTree :folders="allFolderPaths" :current-path="store.currentPath.value"
                        @select="handleFolderSelect" />
                </div>
            </aside>

            <!-- Main Content -->
            <main class="vga-manager__content">
                <!-- Uploader -->
                <AssetUploader v-if="showUploader" :config="resolvedConfig" class="vga-manager__uploader"
                    @upload="handleUpload" @error="handleError" />

                <!-- Grid with loading/error states -->
                <AssetGrid :items="store.fileList.value" :config="resolvedConfig" :copy-formats="copyFormats"
                    :loading="store.loading.value" :error="store.error.value" @select="handleSelect"
                    @delete="handleDelete" @retry="refresh" />
            </main>
        </div>

        <!-- EXIF Warning Dialog -->
        <ExifWarningDialog v-if="showExifDialog" :failed-items="exifFailedItems" @resolve="onExifDialogResolve"
            @cancel="onExifDialogCancel" />

        <!-- New Folder Dialog -->
        <div v-if="showNewFolderDialog" class="vga-dialog-backdrop" @click.self="showNewFolderDialog = false">
            <div class="vga-dialog">
                <h3 class="vga-dialog__title">New Folder</h3>
                <input v-model="newFolderName" type="text" class="vga-input" placeholder="Folder name"
                    @keyup.enter="createFolder" />
                <div class="vga-dialog__actions">
                    <button class="vga-btn vga-btn-secondary" @click="showNewFolderDialog = false">
                        Cancel
                    </button>
                    <button class="vga-btn vga-btn-primary" @click="createFolder">
                        Create
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .vga-manager {
        display: flex;
        flex-direction: column;
        gap: var(--vga-space-4);
        height: 100%;
        min-height: 500px;
    }

    .vga-manager__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--vga-space-3);
        padding-bottom: var(--vga-space-3);
        border-bottom: 1px solid var(--vga-border);
    }

    .vga-toolbar-left {
        display: flex;
        align-items: center;
        gap: var(--vga-space-2);
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .vga-manager__breadcrumb {
        display: flex;
        align-items: center;
        gap: var(--vga-space-1);
        flex: 1;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        mask-image: linear-gradient(to right, black 90%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%);
    }

    .vga-manager__breadcrumb::-webkit-scrollbar {
        display: none;
    }

    .vga-manager__breadcrumb .vga-btn {
        flex-shrink: 0;
        white-space: nowrap;
    }

    /* On very narrow screens, only show last crumb */
    @media (max-width: 400px) {
        .vga-manager__breadcrumb .vga-btn {
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }

    .vga-manager__sep {
        color: var(--vga-text-tertiary);
        flex-shrink: 0;
    }

    .vga-manager__actions {
        display: flex;
        align-items: center;
        gap: var(--vga-space-2);
        flex-shrink: 0;
    }

    .vga-manager__body {
        display: flex;
        gap: var(--vga-space-4);
        flex: 1;
        min-height: 0;
        /* Important for scrolling */
        position: relative;
    }

    /* Sidebar */
    .vga-manager__sidebar {
        width: 240px;
        flex-shrink: 0;
        border-right: 1px solid var(--vga-border);
        padding-right: var(--vga-space-3);
        transition: width 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
        overflow-y: auto;
    }

    .vga-manager__sidebar--closed {
        width: 0;
        padding-right: 0;
        opacity: 0;
        pointer-events: none;
        overflow: hidden;
    }

    .vga-sidebar-content {
        min-width: 220px;
        /* Prevent wrapping during transition */
    }

    /* Main Content */
    .vga-manager__content {
        flex: 1;
        min-width: 0;
        /* Prevent flex overflow */
        display: flex;
        flex-direction: column;
        gap: var(--vga-space-4);
        overflow-y: auto;
    }

    .vga-manager__uploader {
        margin-bottom: var(--vga-space-2);
    }

    .vga-manager__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--vga-space-3);
        padding: var(--vga-space-6);
        color: var(--vga-text-secondary);
    }

    .vga-manager__error {
        padding: var(--vga-space-3);
        background: rgba(255, 59, 48, 0.1);
        border-radius: var(--vga-radius-sm);
        color: var(--vga-destructive);
        font-size: var(--vga-text-sm);
    }

    /* Spinning animation for refresh */
    .vga-spin {
        animation: vga-spin 1s linear infinite;
    }

    @keyframes vga-spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Dialog */
    .vga-dialog-backdrop {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
    }

    .vga-dialog {
        width: 90%;
        max-width: 400px;
        padding: var(--vga-space-5);
        background: var(--vga-bg-primary);
        border-radius: var(--vga-radius-lg);
        box-shadow: var(--vga-shadow-lg);
    }

    .vga-dialog__title {
        margin: 0 0 var(--vga-space-4);
        font-size: var(--vga-text-lg);
        font-weight: var(--vga-font-semibold);
    }

    .vga-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--vga-space-2);
        margin-top: var(--vga-space-4);
    }

    .vga-hidden-mobile {
        display: inline;
    }

    @media (max-width: 640px) {
        .vga-hidden-mobile {
            display: none;
        }

        .vga-manager__sidebar-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 99;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
        }

        .vga-manager__sidebar {
            position: fixed;
            z-index: 100;
            top: 0;
            bottom: 0;
            left: 0;
            width: 260px;
            max-width: 75vw;
            background: var(--vga-bg-primary, white);
            border-right: 1px solid var(--vga-border, #e5e5e5);
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
            padding: var(--vga-space-4, 16px);
            transform: translateX(0);
            transition: transform 0.3s ease;
        }

        .vga-manager__sidebar--closed {
            transform: translateX(-100%);
            width: 280px;
            opacity: 1;
            pointer-events: auto;
        }

        .vga-manager__body {
            flex-direction: column;
        }
    }

    /* Hide backdrop on desktop */
    .vga-manager__sidebar-backdrop {
        display: none;
    }

    @media (max-width: 640px) {
        .vga-manager__sidebar-backdrop {
            display: block;
        }
    }
</style>
