<script setup lang="ts">
    /**
     * Toast Component
     * Transient notification
     */
    import { Check, AlertCircle, Info } from 'lucide-vue-next';

    defineProps<{
        message: string;
        type?: 'success' | 'error' | 'info';
    }>();
</script>

<template>
    <div class="vga-toast" :class="`vga-toast--${type || 'success'}`">
        <Check v-if="!type || type === 'success'" :size="16" />
        <AlertCircle v-else-if="type === 'error'" :size="16" />
        <Info v-else :size="16" />
        <span>{{ message }}</span>
    </div>
</template>

<style scoped>
    .vga-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 16px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
    }

    .vga-toast--error {
        background: #ff3b30;
    }
</style>
