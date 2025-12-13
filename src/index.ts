/**
 * Vue GitHub Assets - 主入口文件 / Main Entry Point
 */

// Styles
import './styles/variables.css';

// Composables
export { useAssetStore } from './composables/useAssetStore';
export { useUploader } from './composables/useUploader';
export { useManifest } from './composables/useManifest';

// Components
export { default as AssetManager } from './components/AssetManager.vue';
export { default as AssetUploader } from './components/AssetUploader.vue';
export { default as SmartImage } from './components/SmartImage.vue';
export { default as FolderTree } from './components/FolderTree.vue';

// Utilities
export {
    cleanupExifFromFile,
    cleanupExifFromBlob,
    cleanupExifBatch,
    cleanExif,
    cleanExifBatch,
    isJpegFormat,
    isHeicFormat,
    isSupportedFormat,
    formatFileSize,
    DEFAULT_COPYRIGHT_INFO,
    DEFAULT_OFFSET_TIME,
    PRIVACY_TAGS,
    USEFUL_TAGS,
    type CleanupOptions,
    type CleanupResult,
} from './utils/exif-cleaner';
export { compressImage } from './utils/image-compressor';
export {
    toRawUrl,
    toCdnUrl,
    toDisplayUrl,
    buildUrlChain,
    isGitHubPagesUrl,
    isGitHubRawUrl,
} from './utils/url-transformer';

// Types
export type {
    // Config
    StoreConfig,
    UploadOptions,
    CompressOptions,

    // Assets
    AssetItem,
    FolderItem,
    UploadResult,
    VgaManifest,

    // CDN
    CdnProvider,
    CdnOptions,

    // Composables
    UseAssetStoreReturn,

    // Components
    SmartImageProps,
    AssetManagerProps,
    AssetUploaderProps,
} from './types';
