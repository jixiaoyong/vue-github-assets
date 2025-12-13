/**
 * Vue GitHub Assets - 主入口文件 / Main Entry Point
 */

// Styles
import './styles/variables.css';

// Composables
export { useAssetStore } from './composables/useAssetStore';
export { useManifest } from './composables/useManifest';
export { useUploader } from './composables/useUploader';

// Components
export { default as AssetManager } from './components/AssetManager.vue';
export { default as AssetUploader } from './components/AssetUploader.vue';
export { default as FolderTree } from './components/FolderTree.vue';
export { default as SmartImage } from './components/SmartImage.vue';

// Utilities
export {
    DEFAULT_COPYRIGHT_INFO,
    DEFAULT_OFFSET_TIME,
    PRIVACY_TAGS,
    USEFUL_TAGS, cleanExif,
    cleanExifBatch, cleanupExifBatch, cleanupExifFromBlob, cleanupExifFromFile, formatFileSize, isHeicFormat, isJpegFormat, isSupportedFormat, type CleanupOptions,
    type CleanupResult
} from './utils/exif-cleaner';
export { compressImage } from './utils/image-compressor';
export {
    buildUrlChain,
    isGitHubPagesUrl,
    isGitHubRawUrl, toCdnUrl,
    toDisplayUrl, toRawUrl
} from './utils/url-transformer';

// Types
export type {

    // Assets
    AssetItem, AssetManagerProps, AssetOperationResult, AssetUploaderProps, CdnOptions,
    // CDN
    CdnProvider, CompressOptions, CopyFormat, FolderItem,
    // Components
    SmartImageProps,
    // Config
    StoreConfig,
    UploadOptions, UploadResult,
    // Composables
    UseAssetStoreReturn, VgaManifest
} from './types';

