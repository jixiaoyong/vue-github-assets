<script setup lang="ts">
    /**
     * EXIF 警告弹窗 / ExifWarningDialog
     * 
     * 处理 EXIF 清理失败的交互弹窗 / Dialog to handle EXIF cleaning failures
     */
    import { ref } from 'vue';
    import { AlertTriangle, ShieldAlert, RotateCcw, XCircle } from 'lucide-vue-next';
    import type { ExifFailedItem, ExifFailureAction } from '@/composables/useUploader';

    // ============================================
    // Props & Emits
    // ============================================

    const props = defineProps<{
        failedItems: ExifFailedItem[];
    }>();

    const emit = defineEmits<{
        resolve: [actions: ExifFailureAction[]];
        cancel: [];
    }>();

    // ============================================
    // 状态 / State
    // ============================================

    const selectedAction = ref<'retry' | 'upload-original' | 'skip'>('skip');
    const applyToAll = ref(true);
    const selections = ref<Record<string, 'retry' | 'upload-original' | 'skip'>>({});

    // 初始化选择 / Initialize selections
    props.failedItems.forEach((item) => {
        selections.value[item.file.name] = 'skip';
    });

    // ============================================
    // 操作 / Actions
    // ============================================

    function confirm() {
        const actions: ExifFailureAction[] = props.failedItems.map((item) => ({
            fileName: item.file.name,
            action: applyToAll.value ? selectedAction.value : selections.value[item.file.name],
        }));
        emit('resolve', actions);
    }

    function cancel() {
        emit('cancel');
    }
</script>

<template>
    <div class="vga-overlay">
        <div class="vga-dialog vga-exif-dialog">
            <!-- Header -->
            <div class="vga-dialog__header">
                <div class="vga-dialog__icon-wrapper">
                    <ShieldAlert class="vga-dialog__icon" :size="24" />
                </div>
                <h3 class="vga-dialog__title">Privacy Warning</h3>
            </div>

            <!-- Content -->
            <div class="vga-dialog__content">
                <p class="vga-text-secondary">
                    Unable to clean privacy information (EXIF) from the following files.
                    Uploading original files may expose location and device data.
                </p>
                <p class="vga-text-secondary">
                    无法清除以下文件的隐私信息（EXIF）。上传原图可能会泄露您的位置和设备信息。
                </p>

                <!-- List of failed files -->
                <div class="vga-failed-list">
                    <div v-for="item in failedItems" :key="item.file.name" class="vga-failed-item">
                        <div class="vga-failed-item__info">
                            <span class="vga-failed-item__name">{{ item.file.name }}</span>
                            <span class="vga-failed-item__error">{{ item.error }}</span>
                        </div>

                        <!-- Individual Action Selector (if not apply to all) -->
                        <div v-if="!applyToAll" class="vga-failed-item__actions">
                            <select v-model="selections[item.file.name]" class="vga-select vga-select-sm">
                                <option value="retry">Retry (重试)</option>
                                <option value="upload-original">Upload Original (原图)</option>
                                <option value="skip">Skip (跳过)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Global Action Selector -->
                <div class="vga-global-actions">
                    <label class="vga-checkbox-label">
                        <input type="checkbox" v-model="applyToAll" class="vga-checkbox" />
                        <span>Apply to all files (应用到所有文件)</span>
                    </label>

                    <div v-if="applyToAll" class="vga-action-cards">
                        <label class="vga-action-card"
                            :class="{ 'vga-action-card--active': selectedAction === 'retry' }">
                            <input type="radio" v-model="selectedAction" value="retry" class="vga-sr-only" />
                            <RotateCcw :size="20" />
                            <div class="vga-action-card__text">
                                <span class="vga-action-card__title">Retry Cleaning</span>
                                <span class="vga-action-card__sub">Try to clean again</span>
                            </div>
                        </label>

                        <label class="vga-action-card"
                            :class="{ 'vga-action-card--active': selectedAction === 'upload-original' }">
                            <input type="radio" v-model="selectedAction" value="upload-original" class="vga-sr-only" />
                            <AlertTriangle :size="20" class="vga-text-warning" />
                            <div class="vga-action-card__text">
                                <span class="vga-action-card__title">Upload Original</span>
                                <span class="vga-action-card__sub">Risk privacy leak</span>
                            </div>
                        </label>

                        <label class="vga-action-card"
                            :class="{ 'vga-action-card--active': selectedAction === 'skip' }">
                            <input type="radio" v-model="selectedAction" value="skip" class="vga-sr-only" />
                            <XCircle :size="20" />
                            <div class="vga-action-card__text">
                                <span class="vga-action-card__title">Skip Upload</span>
                                <span class="vga-action-card__sub">Don't upload these</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="vga-dialog__footer">
                <button class="vga-btn vga-btn-ghost" @click="cancel">Cancel</button>
                <button class="vga-btn vga-btn-primary" @click="confirm">
                    Confirm
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .vga-exif-dialog {
        width: 100%;
        max-width: 500px;
    }

    .vga-dialog__icon-wrapper {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--vga-bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--vga-space-3);
        color: var(--vga-warning);
    }

    .vga-failed-list {
        margin: var(--vga-space-4) 0;
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--vga-border);
        border-radius: var(--vga-radius-md);
    }

    .vga-failed-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--vga-space-3);
        border-bottom: 1px solid var(--vga-border);
        background: var(--vga-bg-secondary);
    }

    .vga-failed-item:last-child {
        border-bottom: none;
    }

    .vga-failed-item__info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
    }

    .vga-failed-item__name {
        font-weight: var(--vga-font-medium);
        font-size: var(--vga-text-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .vga-failed-item__error {
        font-size: var(--vga-text-xs);
        color: var(--vga-destructive);
    }

    .vga-global-actions {
        margin-top: var(--vga-space-4);
    }

    .vga-checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--vga-space-2);
        margin-bottom: var(--vga-space-3);
        font-size: var(--vga-text-sm);
        cursor: pointer;
    }

    .vga-action-cards {
        display: flex;
        flex-direction: column;
        gap: var(--vga-space-2);
    }

    .vga-action-card {
        display: flex;
        align-items: center;
        gap: var(--vga-space-3);
        padding: var(--vga-space-3);
        border: 2px solid var(--vga-border);
        border-radius: var(--vga-radius-md);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .vga-action-card:hover {
        background: var(--vga-bg-secondary);
    }

    .vga-action-card--active {
        border-color: var(--vga-accent);
        background: var(--vga-bg-secondary);
    }

    .vga-action-card__text {
        display: flex;
        flex-direction: column;
    }

    .vga-action-card__title {
        font-weight: var(--vga-font-medium);
        font-size: var(--vga-text-sm);
    }

    .vga-action-card__sub {
        font-size: var(--vga-text-xs);
        color: var(--vga-text-secondary);
    }

    .vga-select-sm {
        padding: 4px 8px;
        font-size: var(--vga-text-xs);
        height: auto;
    }
</style>
