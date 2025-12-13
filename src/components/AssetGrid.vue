<script setup lang="ts">
    /**
     * AssetGrid Component
     * Responsive grid display for image assets with selection and preview
     */
    import { ref, watch } from 'vue';
    import { Trash2, Check, X, ZoomIn, Link, Code, FileCode } from 'lucide-vue-next';
    import type { AssetItem } from '@/types';
    import SmartImage from './SmartImage.vue';
    import Toast from './common/Toast.vue';
    import { buildUrlChain } from '@/utils/url-transformer';

    // ============================================
    // Props & Emits
    // ============================================

    const props = withDefaults(defineProps<{
        items: AssetItem[];
        config: { owner: string; repo: string; branch?: string };
        copyFormats?: ('url' | 'markdown' | 'html')[];
        selectable?: boolean;
        loading?: boolean;
        error?: Error | null;
        /** 是否有操作进行中 / Whether an operation is in progress */
        isOperating?: boolean;
    }>(), {
        copyFormats: () => ['url', 'markdown', 'html'],
        selectable: true,
        loading: false,
        error: null,
        isOperating: false,
    });

    const emit = defineEmits<{
        select: [url: string, item: AssetItem];
        confirm: [url: string, item: AssetItem];
        delete: [item: AssetItem];
        retry: [];
    }>();

    // ============================================
    // State
    // ============================================

    const selectedItem = ref<AssetItem | null>(null);
    const copiedFormat = ref<string | null>(null);
    const showPreview = ref(false);
    const previewLoading = ref(false);
    const toastMessage = ref<string | null>(null);

    // ============================================
    // URL Generation
    // ============================================

    function getUrl(item: AssetItem): string {
        const urls = buildUrlChain(item.path, props.config);
        return urls.displayUrl;
    }

    function getRawUrl(item: AssetItem): string {
        const urls = buildUrlChain(item.path, props.config);
        return urls.rawUrl;
    }

    // ============================================
    // Selection
    // ============================================

    function handleItemClick(item: AssetItem) {
        if (selectedItem.value?.path === item.path) {
            // Clicking same item - deselect
            selectedItem.value = null;
        } else {
            selectedItem.value = item;
            // Only select locally. Confirm event is used for final selection.
            // emit('select', getUrl(item), item); 
        }
    }

    function clearSelection() {
        selectedItem.value = null;
        showPreview.value = false;
    }

    // Watch for items change to clear selection
    watch(() => props.items, () => {
        selectedItem.value = null;
        showPreview.value = false;
    });

    // ============================================
    // Copy Functions
    // ============================================

    function getFormatLabel(format: 'url' | 'markdown' | 'html'): string {
        switch (format) {
            case 'markdown': return 'Markdown';
            case 'html': return 'HTML';
            case 'url': return 'URL';
        }
    }

    // Fallback copy method for mobile browsers
    function fallbackCopyText(text: string): boolean {
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // Avoid scrolling to bottom
        textArea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        let success = false;
        try {
            success = document.execCommand('copy');
        } catch {
            success = false;
        }

        document.body.removeChild(textArea);
        return success;
    }

    async function copyUrl(format: 'url' | 'markdown' | 'html') {
        if (!selectedItem.value) return;
        const url = getUrl(selectedItem.value);
        let text: string;

        switch (format) {
            case 'markdown':
                text = `![${selectedItem.value.name}](${url})`;
                break;
            case 'html':
                text = `<img src="${url}" alt="${selectedItem.value.name}" />`;
                break;
            case 'url':
            default:
                text = url;
        }

        let success = false;

        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                success = true;
            } catch {
                // Fallback to execCommand
                success = fallbackCopyText(text);
            }
        } else {
            // Use fallback for non-secure contexts or unsupported browsers
            success = fallbackCopyText(text);
        }

        if (success) {
            copiedFormat.value = format;
            toastMessage.value = `已复制 ${getFormatLabel(format)} 链接`;
            setTimeout(() => {
                copiedFormat.value = null;
                toastMessage.value = null;
            }, 2500);
        } else {
            console.error('Failed to copy text');
            toastMessage.value = '复制失败，请手动复制';
            setTimeout(() => {
                toastMessage.value = null;
            }, 2000);
        }
    }

    // ============================================
    // Delete
    // ============================================

    function handleDelete() {
        if (!selectedItem.value) return;
        emit('delete', selectedItem.value);
        selectedItem.value = null;
    }

    // 操作进行中点击提示 / Toast when clicking while operating
    function showOperatingToast() {
        toastMessage.value = '操作进行中，请稍候 / Operation in progress, please wait';
    }

    // ============================================
    // Preview
    // ============================================

    function openPreview() {
        if (selectedItem.value) {
            showPreview.value = true;
            previewLoading.value = true;
        }
    }

    function closePreview() {
        showPreview.value = false;
        previewLoading.value = false;
    }

    function onPreviewLoad() {
        previewLoading.value = false;
    }

    // ============================================
    // Format file size
    // ============================================

    function formatSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // ============================================
    // Computed
    // ============================================

    const isSelected = (item: AssetItem) => selectedItem.value?.path === item.path;
</script>

<template>
    <div class="vga-grid-container">
        <!-- Loading state -->
        <div v-if="loading && items.length === 0" class="vga-grid-loading">
            <div class="vga-grid-loading__spinner"></div>
            <span>加载中... / Loading...</span>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="vga-grid-error">
            <span>加载失败: {{ error.message }}</span>
            <button class="vga-grid-error__retry" @click="emit('retry')">
                重试 / Retry
            </button>
        </div>

        <!-- Image Grid -->
        <div v-else class="vga-grid vga-root">
            <div v-for="item in items" :key="item.path" class="vga-grid-item" :class="{
                'vga-grid-item--selected': isSelected(item),
                'vga-grid-item--subfolder': item.isFromSubfolder
            }" @click="handleItemClick(item)" @dblclick="emit('confirm', getUrl(item), item)">
                <SmartImage :src="getUrl(item)" :branch="props.config.branch" :quality="70" object-fit="contain" lazy
                    class="vga-grid-item__image" />
                <!-- Selection indicator -->
                <div v-if="isSelected(item)" class="vga-grid-item__check">
                    <Check :size="16" />
                </div>
                <!-- File name overlay (always visible on mobile) -->
                <div class="vga-grid-item__name-overlay">
                    <span>{{ item.name }}</span>
                </div>
            </div>

            <!-- Empty state -->
            <div v-if="items.length === 0" class="vga-grid-empty">
                <p>暂无图片 / No images found</p>
            </div>
        </div>

        <!-- Selection Toolbar (shown when item selected) -->
        <Transition name="toolbar">
            <div v-if="selectedItem" class="vga-toolbar">
                <div class="vga-toolbar__content">
                    <!-- Thumbnail preview (click to enlarge) -->
                    <button class="vga-toolbar__preview" @click="openPreview" title="放大查看 / Preview">
                        <SmartImage :src="getUrl(selectedItem)" :branch="props.config.branch" :quality="70"
                            object-fit="cover" :lazy="false" />
                        <div class="vga-toolbar__preview-icon">
                            <ZoomIn :size="14" />
                        </div>
                    </button>

                    <!-- File info -->
                    <div class="vga-toolbar__info">
                        <span class="vga-toolbar__name">{{ selectedItem.name }}</span>
                        <span class="vga-toolbar__size">{{ formatSize(selectedItem.size) }}</span>
                    </div>

                    <!-- Actions -->
                    <div class="vga-toolbar__actions">
                        <!-- Confirm / Insert Button -->
                        <button class="vga-toolbar__btn vga-toolbar__btn--primary"
                            @click="emit('confirm', getUrl(selectedItem), selectedItem)" title="插入图片 / Insert Image">
                            <Check :size="18" />
                            <span class="vga-toolbar__btn-text">Use Image</span>
                        </button>

                        <div class="vga-toolbar__divider"></div>

                        <!-- Copy buttons with labels -->
                        <button class="vga-toolbar__copy-btn"
                            :class="{ 'vga-toolbar__copy-btn--copied': copiedFormat === 'url' }" @click="copyUrl('url')"
                            title="复制链接 / Copy URL">
                            <Check v-if="copiedFormat === 'url'" :size="16" />
                            <Link v-else :size="16" />
                            <span class="vga-toolbar__copy-label">URL</span>
                        </button>
                        <button class="vga-toolbar__copy-btn"
                            :class="{ 'vga-toolbar__copy-btn--copied': copiedFormat === 'markdown' }"
                            @click="copyUrl('markdown')" title="复制 Markdown">
                            <Check v-if="copiedFormat === 'markdown'" :size="16" />
                            <Code v-else :size="16" />
                            <span class="vga-toolbar__copy-label">MD</span>
                        </button>
                        <button class="vga-toolbar__copy-btn"
                            :class="{ 'vga-toolbar__copy-btn--copied': copiedFormat === 'html' }"
                            @click="copyUrl('html')" title="复制 HTML">
                            <Check v-if="copiedFormat === 'html'" :size="16" />
                            <FileCode v-else :size="16" />
                            <span class="vga-toolbar__copy-label">HTML</span>
                        </button>

                        <div class="vga-toolbar__divider"></div>

                        <!-- Delete button -->
                        <button class="vga-toolbar__btn vga-toolbar__btn--danger"
                            :class="{ 'vga-toolbar__btn--disabled': isOperating }"
                            @click="isOperating ? showOperatingToast() : handleDelete()"
                            :title="isOperating ? '操作进行中，请稍候 / Operation in progress' : '删除 / Delete'">
                            <Trash2 :size="18" />
                        </button>

                        <!-- Close button -->
                        <button class="vga-toolbar__btn vga-toolbar__btn--close" @click="clearSelection"
                            title="关闭 / Close">
                            <X :size="18" />
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Full Preview Modal -->
        <Teleport to="body">
            <Transition name="preview">
                <div v-if="showPreview && selectedItem" class="vga-preview-modal" @click="closePreview">
                    <div class="vga-preview-modal__content" @click.stop>
                        <div v-if="previewLoading" class="vga-preview-modal__loading">
                            <div class="vga-grid-loading__spinner"></div>
                        </div>
                        <img v-show="!previewLoading" :src="getRawUrl(selectedItem)" :alt="selectedItem.name"
                            class="vga-preview-modal__image" @load="onPreviewLoad" />
                        <div class="vga-preview-modal__info">
                            <span>{{ selectedItem.name }}</span>
                            <span>{{ formatSize(selectedItem.size) }}</span>
                        </div>
                    </div>
                    <button class="vga-preview-modal__close" @click="closePreview">
                        <X :size="24" />
                    </button>
                </div>
            </Transition>
        </Teleport>

        <!-- Toast notification -->
        <Teleport to="body">
            <Transition name="toast">
                <Toast v-if="toastMessage" :message="toastMessage" />
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
    .vga-grid-container {
        display: flex;
        flex-direction: column;
        gap: var(--vga-space-3, 12px);
    }

    .vga-grid {
        display: grid;
        gap: var(--vga-space-2, 8px);
        grid-template-columns: repeat(2, 1fr);
    }

    @media (min-width: 480px) {
        .vga-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    @media (min-width: 768px) {
        .vga-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: var(--vga-space-3, 12px);
        }
    }

    @media (min-width: 1024px) {
        .vga-grid {
            grid-template-columns: repeat(5, 1fr);
        }
    }

    /* Loading state */
    .vga-grid-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px;
        color: var(--vga-text-secondary, #8e8e93);
    }

    .vga-grid-loading__spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--vga-bg-tertiary, #e5e5e7);
        border-top-color: #007aff;
        border-radius: 50%;
        animation: grid-spin 0.8s linear infinite;
    }

    @keyframes grid-spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Error state */
    .vga-grid-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px;
        color: #ff3b30;
        text-align: center;
    }

    .vga-grid-error__retry {
        padding: 10px 20px;
        border: none;
        border-radius: 20px;
        background: #007aff;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .vga-grid-error__retry:hover {
        background: #0066d6;
    }

    .vga-grid-error__retry:active {
        transform: scale(0.95);
    }

    .vga-grid-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: var(--vga-radius-md, 12px);
        overflow: hidden;
        background: var(--vga-bg-secondary, #f5f5f7);
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
    }

    .vga-grid-item:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .vga-grid-item:active {
        transform: scale(0.98);
    }

    .vga-grid-item--selected {
        border-color: #007aff;
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
    }

    /* Subfolder items have dashed border */
    .vga-grid-item--subfolder {
        border: 2px dashed #c7c7cc;
        opacity: 0.8;
    }

    .vga-grid-item--subfolder:hover {
        opacity: 1;
        border-color: #8e8e93;
    }

    .vga-grid-item--subfolder.vga-grid-item--selected {
        border-color: #007aff;
        border-style: solid;
        opacity: 1;
    }

    .vga-grid-item__image {
        width: 100%;
        height: 100%;
    }

    .vga-grid-item__image :deep(.vga-smart-image__img) {
        object-fit: contain !important;
        padding: 4px;
    }

    .vga-grid-item__check {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #007aff;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
    }

    .vga-grid-item__name-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 4px 8px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
        color: white;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .vga-grid-item:hover .vga-grid-item__name-overlay,
    .vga-grid-item--selected .vga-grid-item__name-overlay {
        opacity: 1;
    }

    @media (max-width: 640px) {
        .vga-grid-item__name-overlay {
            opacity: 1;
        }
    }

    .vga-grid-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: var(--vga-space-7, 48px);
        color: var(--vga-text-secondary, #8e8e93);
    }

    /* Toolbar */
    .vga-toolbar {
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        padding: 12px 16px;
        z-index: 50;
    }

    @media (prefers-color-scheme: dark) {
        .vga-toolbar {
            background: rgba(28, 28, 30, 0.95);
            border-top-color: rgba(255, 255, 255, 0.1);
        }
    }

    .vga-toolbar__content {
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 800px;
        margin: 0 auto;
    }

    .vga-toolbar__preview {
        position: relative;
        width: 48px;
        height: 48px;
        border-radius: 8px;
        overflow: hidden;
        border: none;
        padding: 0;
        cursor: pointer;
        flex-shrink: 0;
    }

    .vga-toolbar__preview-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.3);
        color: white;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .vga-toolbar__preview:hover .vga-toolbar__preview-icon {
        opacity: 1;
    }

    .vga-toolbar__info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .vga-toolbar__name {
        font-size: 14px;
        font-weight: 500;
        color: var(--vga-text-primary, #1c1c1e);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .vga-toolbar__size {
        font-size: 12px;
        color: var(--vga-text-secondary, #8e8e93);
    }

    @media (prefers-color-scheme: dark) {
        .vga-toolbar__name {
            color: #f5f5f7;
        }
    }

    .vga-toolbar__actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
    }

    .vga-toolbar__btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: none;
        background: var(--vga-bg-secondary, #f5f5f7);
        color: var(--vga-text-primary, #1c1c1e);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .vga-toolbar__btn:hover {
        background: var(--vga-bg-tertiary, #e5e5e7);
    }

    .vga-toolbar__btn:active {
        transform: scale(0.95);
    }

    .vga-toolbar__btn--copied {
        background: #34c759;
        color: white;
    }

    .vga-toolbar__btn--danger {
        color: #ff3b30;
    }

    .vga-toolbar__btn--danger:hover {
        background: #ff3b30;
        color: white;
    }

    .vga-toolbar__btn--primary {
        background: var(--vga-accent, #007aff);
        color: white;
        width: auto;
        padding: 0 16px;
        gap: 8px;
    }

    .vga-toolbar__btn--primary:hover {
        background: var(--vga-accent-hover, #0066d6);
    }

    .vga-toolbar__btn-text {
        font-size: 14px;
        font-weight: 500;
    }

    @media (max-width: 640px) {
        .vga-toolbar__btn-text {
            display: none;
        }

        .vga-toolbar__btn--primary {
            padding: 0;
            width: 44px;
            /* Match other buttons */
        }
    }

    .vga-toolbar__btn--close {
        color: var(--vga-text-secondary, #8e8e93);
    }

    @media (prefers-color-scheme: dark) {
        .vga-toolbar__btn {
            background: #2c2c2e;
            color: #f5f5f7;
        }

        .vga-toolbar__btn:hover {
            background: #3a3a3c;
        }
    }

    @media (max-width: 480px) {
        .vga-toolbar__info {
            display: none;
        }

        .vga-toolbar__btn {
            width: 44px;
            height: 44px;
        }
    }

    /* Toolbar animation */
    .toolbar-enter-active,
    .toolbar-leave-active {
        transition: all 0.3s ease;
    }

    .toolbar-enter-from,
    .toolbar-leave-to {
        transform: translateY(100%);
        opacity: 0;
    }

    /* Preview Modal */
    .vga-preview-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }

    .vga-preview-modal__content {
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
    }

    .vga-preview-modal__image {
        max-width: 100%;
        max-height: calc(90vh - 60px);
        object-fit: contain;
        border-radius: 8px;
    }

    .vga-preview-modal__info {
        display: flex;
        gap: 16px;
        color: white;
        font-size: 14px;
    }

    .vga-preview-modal__close {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    }

    .vga-preview-modal__close:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    /* Preview animation */
    .preview-enter-active,
    .preview-leave-active {
        transition: all 0.3s ease;
    }

    .preview-enter-from,
    .preview-leave-to {
        opacity: 0;
    }

    .preview-enter-from .vga-preview-modal__content,
    .preview-leave-to .vga-preview-modal__content {
        transform: scale(0.9);
    }

    /* Copy buttons with labels */
    .vga-toolbar__copy-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-radius: 10px;
        border: none;
        background: var(--vga-bg-secondary, #f5f5f7);
        color: var(--vga-text-primary, #1c1c1e);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
    }

    .vga-toolbar__copy-btn:hover {
        background: var(--vga-bg-tertiary, #e5e5e7);
    }

    .vga-toolbar__copy-btn:active {
        transform: scale(0.95);
    }

    .vga-toolbar__copy-btn--copied {
        background: #34c759;
        color: white;
    }

    .vga-toolbar__copy-label {
        display: inline;
    }

    @media (max-width: 600px) {
        .vga-toolbar__copy-label {
            display: none;
        }

        .vga-toolbar__copy-btn {
            padding: 10px;
        }
    }

    @media (prefers-color-scheme: dark) {
        .vga-toolbar__copy-btn {
            background: #2c2c2e;
            color: #f5f5f7;
        }

        .vga-toolbar__copy-btn:hover {
            background: #3a3a3c;
        }
    }

    /* Divider */
    .vga-toolbar__divider {
        width: 1px;
        height: 24px;
        background: var(--vga-border, #e5e5e5);
        margin: 0 4px;
    }

    @media (prefers-color-scheme: dark) {
        .vga-toolbar__divider {
            background: #3a3a3c;
        }
    }

    /* Toast animation */
    .toast-enter-active,
    .toast-leave-active {
        transition: all 0.3s ease;
    }

    .toast-enter-from,
    .toast-leave-to {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
    }
</style>
