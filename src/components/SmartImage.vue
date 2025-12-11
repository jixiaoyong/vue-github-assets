<script setup lang="ts">
  /**
   * 智能图片组件 / SmartImage Component
   * 
   * 自动将 GitHub Pages 链接转换为 CDN 优化链接 / Automatically converts GitHub Pages URLs to CDN-optimized URLs
   * 支持回退和懒加载 / with fallback support and lazy loading
   */
  import { computed, ref, watch } from 'vue';
  import type { SmartImageProps } from '@/types';
  import {
    toRawUrl,
    toCdnUrl,
    isGitHubPagesUrl,
    isGitHubRawUrl,
  } from '@/utils/url-transformer';

  // ============================================
  // Props
  // ============================================

  const props = withDefaults(defineProps<SmartImageProps & { branch?: string }>(), {
    quality: 75,
    lazy: true,
    fallbackCdn: undefined,
    alt: '',
    objectFit: 'cover',
    mutable: false,
    branch: 'main',
  });

  // ============================================
  // 状态 / State
  // ============================================

  const imageLoaded = ref(false);
  const imageError = ref(false);
  const currentCdn = ref<'wsrv' | 'statically' | 'raw'>('wsrv');
  const retryCount = ref(0);

  // ============================================
  // 计算 URL / Computed URLs
  // ============================================

  const rawUrl = computed(() => {
    // 如果已经是 raw URL，直接使用 / If already raw URL, use directly
    if (isGitHubRawUrl(props.src)) {
      return props.src;
    }
    // 如果是 GitHub Pages URL，转换时使用正确的 branch / Convert with correct branch
    if (isGitHubPagesUrl(props.src)) {
      return toRawUrl(props.src, props.branch);
    }
    return props.src;
  });

  const wsrvUrl = computed(() => {
    return toCdnUrl(rawUrl.value, {
      provider: 'wsrv',
      width: props.width,
      height: props.height,
      quality: props.quality,
      format: 'webp',
      cacheBust: props.mutable || retryCount.value > 0,
    });
  });

  const staticallyUrl = computed(() => {
    return toCdnUrl(rawUrl.value, {
      provider: 'statically',
      cacheBust: props.mutable || retryCount.value > 0,
    });
  });

  const currentSrc = computed(() => {
    switch (currentCdn.value) {
      case 'wsrv':
        return wsrvUrl.value;
      case 'statically':
        return staticallyUrl.value;
      case 'raw':
      default:
        return rawUrl.value;
    }
  });

  // ============================================
  // 样式 / Styles
  // ============================================

  const containerStyles = computed(() => ({
    width: props.width ? `${props.width}px` : '100%',
    height: props.height ? `${props.height}px` : '100%',
  }));

  const imageStyles = computed(() => ({
    objectFit: props.objectFit,
  }));

  // ============================================
  // 事件处理 / Event Handlers
  // ============================================

  function handleLoad() {
    imageLoaded.value = true;
    imageError.value = false;
  }

  function handleError() {
    // 尝试备用 CDN / Try fallback CDN
    if (currentCdn.value === 'wsrv') {
      if (props.fallbackCdn === 'statically') {
        currentCdn.value = 'statically';
      } else {
        // 降级到原始链接 / Skip to raw
        currentCdn.value = 'raw';
      }
    } else if (currentCdn.value === 'statically') {
      // 降级到原始链接 / Fall back to raw
      currentCdn.value = 'raw';
    } else {
      // 所有 CDN 都失败 / All CDNs failed
      imageError.value = true;
    }
  }

  function retry() {
    retryCount.value++;
    imageError.value = false;
    imageLoaded.value = false;
    currentCdn.value = 'wsrv';
  }

  // Watch for src changes to reset state
  watch(() => props.src, () => {
    imageLoaded.value = false;
    imageError.value = false;
    currentCdn.value = 'wsrv';
    retryCount.value = 0;
  });
</script>

<template>
  <div 
    class="vga-smart-image" 
    :style="containerStyles"
    @click="imageError && retry()"
  >
    <!-- Main image -->
    <img 
      v-show="!imageError"
      :src="currentSrc" 
      :alt="alt" 
      :loading="lazy ? 'lazy' : 'eager'" 
      :style="imageStyles" 
      :class="[
        'vga-smart-image__img',
        { 'vga-smart-image__img--loaded': imageLoaded }
      ]" 
      @load="handleLoad" 
      @error="handleError" 
    />

    <!-- Loading state - iOS style shimmer -->
    <div 
      v-if="!imageLoaded && !imageError" 
      class="vga-smart-image__loading"
    >
      <div class="vga-smart-image__shimmer"></div>
      <div class="vga-smart-image__loading-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    </div>

    <!-- Error state - iOS style with retry -->
    <div 
      v-if="imageError" 
      class="vga-smart-image__error"
    >
      <div class="vga-smart-image__error-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="3" x2="21" y2="21" />
        </svg>
      </div>
      <span class="vga-smart-image__error-text">加载失败</span>
      <span class="vga-smart-image__error-hint">点击重试</span>
    </div>
  </div>
</template>

<style scoped>
  .vga-smart-image {
    position: relative;
    overflow: hidden;
    background: var(--vga-bg-secondary, #f5f5f7);
    border-radius: var(--vga-radius-sm, 8px);
    cursor: default;
  }

  .vga-smart-image__img {
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .vga-smart-image__img--loaded {
    opacity: 1;
  }

  /* Loading state */
  .vga-smart-image__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%);
  }

  .vga-smart-image__shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 100%
    );
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .vga-smart-image__loading-icon {
    position: relative;
    z-index: 1;
    color: #c7c7cc;
    opacity: 0.6;
  }

  /* Error state */
  .vga-smart-image__error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .vga-smart-image__error:hover {
    background: linear-gradient(135deg, #e8e8ed 0%, #d1d1d6 100%);
  }

  .vga-smart-image__error:active {
    transform: scale(0.98);
  }

  .vga-smart-image__error-icon {
    color: #c7c7cc;
  }

  .vga-smart-image__error-text {
    font-size: 13px;
    font-weight: 500;
    color: #8e8e93;
  }

  .vga-smart-image__error-hint {
    font-size: 11px;
    color: #007aff;
    opacity: 0.8;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .vga-smart-image {
      background: #1c1c1e;
    }

    .vga-smart-image__loading {
      background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    }

    .vga-smart-image__shimmer {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 50%,
        transparent 100%
      );
    }

    .vga-smart-image__loading-icon {
      color: #48484a;
    }

    .vga-smart-image__error {
      background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    }

    .vga-smart-image__error:hover {
      background: linear-gradient(135deg, #2c2c2e 0%, #3a3a3c 100%);
    }

    .vga-smart-image__error-icon {
      color: #48484a;
    }

    .vga-smart-image__error-text {
      color: #8e8e93;
    }
  }
</style>
