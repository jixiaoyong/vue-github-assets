<script setup lang="ts">
    /**
     * ConfirmDialog Component
     * Standardized confirmation dialog
     */
    import { AlertCircle } from 'lucide-vue-next';

    const props = defineProps<{
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        type?: 'danger' | 'warning' | 'info';
    }>();

    const emit = defineEmits<{
        confirm: [];
        cancel: [];
    }>();
</script>

<template>
    <div class="vga-dialog-backdrop" @click.self="emit('cancel')">
        <div class="vga-dialog">
            <h3 class="vga-dialog__title">
                <AlertCircle v-if="props.type === 'danger'" :size="20" class="vga-text-destructive" />
                {{ title }}
            </h3>
            <p class="vga-dialog__message">{{ message }}</p>
            <div class="vga-dialog__actions">
                <button class="vga-btn vga-btn-secondary" @click="emit('cancel')">
                    {{ cancelText || 'Cancel' }}
                </button>
                <button class="vga-btn" :class="type === 'danger' ? 'vga-btn-destructive' : 'vga-btn-primary'"
                    @click="emit('confirm')">
                    {{ confirmText || 'Confirm' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .vga-dialog-backdrop {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        backdrop-filter: blur(2px);
    }

    .vga-dialog {
        width: 90%;
        max-width: 400px;
        padding: var(--vga-space-5);
        background: var(--vga-bg-primary);
        border-radius: var(--vga-radius-lg);
        box-shadow: var(--vga-shadow-lg);
        border: 1px solid var(--vga-border);
    }

    .vga-dialog__title {
        display: flex;
        align-items: center;
        gap: var(--vga-space-2);
        margin: 0 0 var(--vga-space-3);
        font-size: var(--vga-text-lg);
        font-weight: var(--vga-font-semibold);
        color: var(--vga-text-primary);
    }

    .vga-text-destructive {
        color: var(--vga-destructive);
    }

    .vga-dialog__message {
        margin: 0 0 var(--vga-space-5);
        color: var(--vga-text-secondary);
        font-size: var(--vga-text-base);
        line-height: var(--vga-leading-relaxed);
    }

    .vga-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--vga-space-2);
    }

    /* Enforce button styles if global styles miss */
    .vga-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .vga-btn-secondary {
        background: #f2f2f7;
        color: #000000;
    }

    .vga-btn-secondary:hover {
        background: #e5e5ea;
    }

    .vga-btn-primary {
        background: #007aff;
        color: white;
    }

    .vga-btn-primary:hover {
        background: #0056cc;
    }

    .vga-btn-destructive {
        background: #ff3b30;
        color: white;
    }

    .vga-btn-destructive:hover {
        background: #d32f2f;
    }
</style>
