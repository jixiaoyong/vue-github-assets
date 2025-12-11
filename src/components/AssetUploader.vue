<script setup lang="ts">
    /**
     * 上传组件 / AssetUploader Component
     * 
     * 支持拖拽上传区域 / Drag-and-drop upload zone with file validation
     */
    import { ref, computed, toValue } from 'vue';
    import { Upload, X, AlertCircle, CheckCircle } from 'lucide-vue-next';
    import type { AssetUploaderProps, UploadResult, UploadOptions } from '@/types';
    import { useAssetStore } from '@/composables/useAssetStore';

    // ============================================
    // Props & Emits
    // ============================================

    const props = withDefaults(defineProps<AssetUploaderProps>(), {
        accept: 'image/*',
        multiple: true,
        maxSize: 10 * 1024 * 1024, // 10MB
    });

    const emit = defineEmits<{
        upload: [results: UploadResult[]];
        error: [error: Error];
    }>();

    // ============================================
    // 状态 / State
    // ============================================

    const isDragging = ref(false);
    const isUploading = ref(false);
    const uploadQueue = ref<{ file: File; status: 'pending' | 'uploading' | 'success' | 'error'; result?: UploadResult }[]>([]);

    const store = useAssetStore(props.config);

    const fileInputRef = ref<HTMLInputElement | null>(null);

    // ============================================
    // Computed
    // ============================================

    const acceptedExtensions = computed(() => {
        if (props.accept === 'image/*') {
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        }
        return props.accept.split(',').map((ext) => ext.trim());
    });

    // ============================================
    // 文件验证 / File Validation
    // ============================================

    function validateFile(file: File): { valid: boolean; error?: string } {
        // 检查文件类型 / Check file type
        if (props.accept === 'image/*') {
            if (!file.type.startsWith('image/')) {
                return { valid: false, error: `${file.name}: Not an image file` };
            }
        }

        // 检查文件大小 / Check file size
        if (file.size > props.maxSize) {
            const maxSizeMB = (props.maxSize / 1024 / 1024).toFixed(1);
            return { valid: false, error: `${file.name}: File too large (max ${maxSizeMB}MB)` };
        }

        return { valid: true };
    }

    // ============================================
    // 拖拽处理 / Drag & Drop Handlers
    // ============================================

    function handleDragEnter(e: DragEvent) {
        e.preventDefault();
        isDragging.value = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        // 只有当完全离开容器时才取消拖拽状态 / Only set to false if leaving the container entirely
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const currentTarget = e.currentTarget as HTMLElement | null;
        if (!relatedTarget || !currentTarget?.contains(relatedTarget)) {
            isDragging.value = false;
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging.value = false;

        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) {
            handleFiles(files);
        }
    }

    // ============================================
    // 文件选择 / File Selection
    // ============================================

    function handleFileSelect() {
        fileInputRef.value?.click();
    }

    function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (files.length > 0) {
            handleFiles(files);
        }
        // 重置输入框 / Reset input
        input.value = '';
    }

    // ============================================
    // 上传逻辑 / Upload Logic
    // ============================================

    async function handleFiles(files: File[]) {
        // 过滤有效文件 / Filter to valid files only
        const validFiles: File[] = [];
        const errors: string[] = [];

        for (const file of files) {
            const validation = validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else if (validation.error) {
                errors.push(validation.error);
            }
        }

        // 触发错误 / Emit errors
        if (errors.length > 0) {
            emit('error', new Error(errors.join('\n')));
        }

        // 如果不支持多选，只取第一个 / If not allowing multiple, only take first file
        const filesToUpload = props.multiple ? validFiles : validFiles.slice(0, 1);

        if (filesToUpload.length === 0) return;

        // 添加到队列 / Add to queue
        uploadQueue.value = filesToUpload.map((file) => ({
            file,
            status: 'pending' as const,
        }));

        // 开始上传 / Start upload
        isUploading.value = true;
        const results: UploadResult[] = [];

        for (let i = 0; i < uploadQueue.value.length; i++) {
            const item = uploadQueue.value[i];
            item.status = 'uploading';

            try {
                const result = await store.upload(item.file);
                item.result = result;
                item.status = result.success ? 'success' : 'error';
                results.push(result);
            } catch (e) {
                item.status = 'error';
                item.result = { success: false, error: e as Error };
                results.push(item.result);
            }
        }

        isUploading.value = false;
        emit('upload', results);

        // 延迟清空队列 / Clear queue after a delay
        setTimeout(() => {
            uploadQueue.value = [];
        }, 3000);
    }

    // ============================================
    // 清空队列 / Clear Queue
    // ============================================

    function clearQueue() {
        uploadQueue.value = [];
    }
</script>

<template>
    <div class="vga-uploader vga-root">
        <!-- Hidden file input -->
        <input ref="fileInputRef" type="file" :accept="accept" :multiple="multiple" class="vga-sr-only"
            @change="handleFileChange" />

        <!-- Drop Zone -->
        <div :class="[
            'vga-uploader__zone',
            { 'vga-uploader__zone--dragging': isDragging },
            { 'vga-uploader__zone--uploading': isUploading }
        ]" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover="handleDragOver" @drop="handleDrop"
            @click="handleFileSelect">
            <slot :is-dragging="isDragging" :is-uploading="isUploading">
                <!-- Default content -->
                <div class="vga-uploader__content">
                    <Upload class="vga-uploader__icon" :size="32" />
                    <p class="vga-uploader__text">
                        <span v-if="isDragging">Drop files here</span>
                        <span v-else-if="isUploading">Uploading...</span>
                        <span v-else>Drag & drop images or click to select</span>
                    </p>
                    <p class="vga-uploader__hint">
                        {{ acceptedExtensions.join(', ') }} • Max {{ (maxSize / 1024 / 1024).toFixed(0) }}MB
                    </p>
                </div>
            </slot>
        </div>

        <!-- Upload Queue -->
        <div v-if="uploadQueue.length > 0" class="vga-uploader__queue">
            <div v-for="(item, index) in uploadQueue" :key="index"
                :class="['vga-uploader__item', `vga-uploader__item--${item.status}`]">
                <span class="vga-uploader__filename">{{ item.file.name }}</span>
                <span class="vga-uploader__status">
                    <div v-if="item.status === 'uploading'" class="vga-spinner" />
                    <CheckCircle v-else-if="item.status === 'success'" :size="16" />
                    <AlertCircle v-else-if="item.status === 'error'" :size="16" />
                </span>
            </div>
            <button v-if="!isUploading" class="vga-btn vga-btn-ghost vga-btn-sm" @click="clearQueue">
                <X :size="14" />
                Clear
            </button>
        </div>
    </div>
</template>

<style scoped>
    .vga-uploader {
        width: 100%;
    }

    .vga-uploader__zone {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 150px;
        padding: var(--vga-space-5);
        border: 2px dashed var(--vga-border);
        border-radius: var(--vga-radius-lg);
        background: var(--vga-bg-secondary);
        cursor: pointer;
        transition: all var(--vga-duration-normal) var(--vga-ease-smooth);
    }

    .vga-uploader__zone:hover,
    .vga-uploader__zone--dragging {
        border-color: var(--vga-accent);
        background: var(--vga-bg-tertiary);
    }

    .vga-uploader__zone--uploading {
        cursor: wait;
        opacity: 0.7;
    }

    .vga-uploader__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--vga-space-2);
        text-align: center;
    }

    .vga-uploader__icon {
        color: var(--vga-accent);
    }

    .vga-uploader__text {
        font-size: var(--vga-text-md);
        font-weight: var(--vga-font-medium);
        color: var(--vga-text-primary);
        margin: 0;
    }

    .vga-uploader__hint {
        font-size: var(--vga-text-sm);
        color: var(--vga-text-secondary);
        margin: 0;
    }

    .vga-uploader__queue {
        display: flex;
        flex-direction: column;
        gap: var(--vga-space-2);
        margin-top: var(--vga-space-3);
    }

    .vga-uploader__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--vga-space-2) var(--vga-space-3);
        background: var(--vga-bg-secondary);
        border-radius: var(--vga-radius-sm);
    }

    .vga-uploader__item--success {
        color: var(--vga-success);
    }

    .vga-uploader__item--error {
        color: var(--vga-destructive);
    }

    .vga-uploader__filename {
        font-size: var(--vga-text-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
    }

    .vga-uploader__status {
        display: flex;
        align-items: center;
        margin-left: var(--vga-space-2);
    }
</style>
