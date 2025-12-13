/**
 * Vue GitHub Assets - 类型定义 / Type Definitions
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';

// ============================================
// Configuration Types
// ============================================

/**
 * useAssetStore 的配置项 / Store configuration for useAssetStore
 */
export interface StoreConfig {
    /** GitHub Token - 支持响应式值 / supports reactive values */
    token: MaybeRefOrGetter<string>;
    /** GitHub 用户名 / GitHub username */
    owner: string;
    /** 仓库名称 / Repository name */
    repo: string;
    /** 分支名称 (默认: 'main') / Branch name (default: 'main') */
    branch?: string;
    /** 初始展示路径 (默认: '' 即根目录) / Initial display path (default: '' for root) */
    initialPath?: string;
    /** 自定义上传文件路径生成器 / Custom path generator for uploaded files */
    generatePath?: (file: File) => string;
}

/**
 * 上传选项 / Upload options
 */
export interface UploadOptions {
    /** 跳过 EXIF 元数据清理 (默认: false) / Skip EXIF metadata cleaning (default: false) */
    skipExifClean?: boolean;
    /** 压缩选项 (默认: 不压缩) / Compression options (default: no compression) */
    compress?: CompressOptions;
    /** 上传的目标文件夹 / Target folder for upload */
    folder?: string;
    /** 上传的目标分支 / Target branch for upload */
    branch?: string;
}

/**
 * 压缩选项 / Compression options
 */
export interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    /** 质量 0-1 (默认: 0.8) / Quality 0-1 (default: 0.8) */
    quality?: number;
    /** 转换为 WebP 格式 / Convert to WebP format */
    convertToWebP?: boolean;
}

// ============================================
// Asset Types
// ============================================

/**
 * 文件列表中的资源项 / Asset item in the file list
 */
export interface AssetItem {
    /** 文件名 / File name */
    name: string;
    /** 相对于仓库根目录的完整路径 / Full path relative to repo root */
    path: string;
    /** 文件大小 (字节) / File size in bytes */
    size: number;
    /** Git SHA 值 / Git SHA */
    sha: string;
    /** MIME 类型 / MIME type */
    mimeType?: string;
    /** 上传时间戳 / Upload timestamp */
    uploadedAt?: string;
    /** 分类标签 / Tags for categorization */
    tags?: string[];
    /** GitHub 原始下载链接 / GitHub raw download URL */
    downloadUrl?: string;
    /** 是否来自子文件夹 / Whether this file is from a subfolder */
    isFromSubfolder?: boolean;
}

/**
 * 文件夹项 / Folder item
 */
export interface FolderItem {
    name: string;
    path: string;
}

/**
 * 上传结果 / Upload result
 */
export interface AtomicUploadResult {
    success: boolean;
    files: UploadResult[];
    assets?: AssetItem[];
    manifestSha?: string;
    commitSha?: string;
    error?: Error;
}

export interface UploadResult {
    success: boolean;
    /** GitHub Pages URL 链接 / GitHub Pages URL */
    url?: string;
    /** 原始链接 / Raw URL */
    rawUrl?: string;
    /** 文件路径 / File path */
    path?: string;
    /** 失败时的错误信息 / Error if failed */
    error?: Error;
}

// ============================================
// Manifest Types
// ============================================

/**
 * Manifest 统计信息 / Manifest statistics
 */
export interface ManifestStats {
    /** 资源总数 / Total number of assets */
    totalCount: number;
    /** 资源总大小 (字节) / Total size in bytes */
    totalSize: number;
    /** 格式化后的大小 (如 "1.5 MB") / Formatted size string */
    formattedSize: string;
}

/**
 * Manifest 元数据 / Manifest metadata
 */
export interface ManifestMeta {
    /** Manifest 结构版本 / Manifest schema version */
    version: string;
    /** 生成器标识 / Generator identifier */
    generator: string;
    /** 最后更新时间 / Last updated timestamp */
    lastUpdated: string;
    /** 最后同步的 Git Commit SHA / Last synced git commit SHA */
    lastSyncedSha: string;
}

/**
 * VGA Manifest 文件结构 / VGA Manifest file structure
 */
export interface VgaManifest {
    /** 元数据 / Metadata */
    meta: ManifestMeta;
    /** 统计信息 / Statistics */
    stats: ManifestStats;
    /** 文件列表 / List of files */
    files: AssetItem[];
    /** 文件夹列表 / List of folders */
    folders: string[];
}

// ============================================
// CDN Types
// ============================================

/**
 * CDN 提供商选项 / CDN provider options
 */
export type CdnProvider = 'wsrv' | 'statically';

/**
 * CDN URL 选项 / CDN URL options
 */
export interface CdnOptions {
    provider?: CdnProvider;
    width?: number;
    height?: number;
    /** 质量 1-100 / Quality 1-100 */
    quality?: number;
    /** 输出格式 / Output format */
    format?: 'webp' | 'original';
    /** 是否添加缓存破坏参数 / Cache busting timestamp */
    cacheBust?: boolean;
}

// ============================================
// Composable Return Types
// ============================================

/**
 * useAssetStore 返回类型 / useAssetStore return type
 */
export interface UseAssetStoreReturn {
    // State
    loading: ComputedRef<boolean>;
    error: Ref<Error | null>;
    fileList: Ref<AssetItem[]>;
    folders: Ref<FolderItem[]>;
    currentPath: Ref<string>;
    manifest: Ref<VgaManifest | null>;
    /** 操作锁状态 / Operation lock state - true while upload/delete in progress */
    isOperating: Ref<boolean>;

    // Methods
    upload: (file: File, options?: UploadOptions) => Promise<UploadResult>;
    uploadMultiple: (files: File[], options?: UploadOptions) => Promise<UploadResult[]>;
    fetchList: (path?: string) => Promise<void>;
    remove: (item: AssetItem) => Promise<void>;
    removeMultiple: (items: AssetItem[]) => Promise<void>;
    createFolder: (name: string, parentPath?: string) => Promise<void>;
    forceRefresh: (path: string) => Promise<void>;

    // URL helpers
    getDisplayUrl: (item: AssetItem) => string;
    getOptimizedUrl: (item: AssetItem, options?: CdnOptions) => string;
    currentBranch: Ref<string>;
}

// ============================================
// Component Props Types
// ============================================

/**
 * SmartImage 组件属性 / SmartImage component props
 */
export interface SmartImageProps {
    /** 图片链接 (支持 GitHub Pages 格式) / Source URL (GitHub Pages format) */
    src: string;
    /** 目标宽度 / Target width */
    width?: number;
    /** 目标高度 / Target height */
    height?: number;
    /** 质量 1-100 (默认: 75) / Quality 1-100 (default: 75) */
    quality?: number;
    /** 启用懒加载 / Enable lazy loading */
    lazy?: boolean;
    /** 备用 CDN 提供商 / Fallback CDN provider */
    fallbackCdn?: CdnProvider;
    /** 图片替代文本 / Image alt text */
    alt?: string;
    /** 对象适应模式 / Object fit mode */
    objectFit?: 'cover' | 'contain' | 'fill' | 'none';
    /** 强制刷新缓存 (添加时间戳) / Force cache refresh (add timestamp) */
    mutable?: boolean;
    /** 分支名称 / Branch name for URL conversion */
    branch?: string;
}

/**
 * AssetManager 组件属性 / AssetManager component props
 */
export interface AssetManagerProps {
    config: StoreConfig;
    showFolders?: boolean;
    showUploader?: boolean;
    copyFormats?: ('url' | 'markdown' | 'html')[];
}

/**
 * AssetUploader 组件属性 / AssetUploader component props
 */
export interface AssetUploaderProps {
    config: StoreConfig;
    accept?: string;
    multiple?: boolean;
    maxSize?: number;
    currentPath?: string;
    /** 禁用上传 / Disable upload */
    disabled?: boolean;
    /** 上传函数 (从父组件 store 传入) / Upload function from parent store */
    uploadFn?: (file: File, options?: { folder?: string }) => Promise<UploadResult>;
}

// ============================================
// Event Types
// ============================================

/**
 * 资源操作结果 / Asset operation result
 */
export interface AssetOperationResult {
    /** 资源链接 / Asset URL */
    url: string;
    /** 资源项 / Asset item */
    item: AssetItem;
}

/**
 * 复制格式类型 / Copy format type
 */
export type CopyFormat = 'url' | 'markdown' | 'html';

/**
 * AssetManager 组件事件 / AssetManager component events
 */
export interface AssetManagerEmits {
    /** 确认选择时触发 / Triggered when confirming selection */
    confirm: [urls: string[], items: AssetItem[]];
    /** 上传成功后触发 / Triggered after successful upload */
    upload: [results: AssetOperationResult[]];
    /** 删除成功后触发 / Triggered after successful deletion */
    delete: [results: AssetOperationResult[]];
    /** 复制链接时触发 / Triggered when copying link */
    copy: [content: string, format: CopyFormat, item: AssetItem];
    /** 操作出错时触发 / Triggered on error */
    error: [error: Error];
}

export interface AssetUploaderEmits {
    upload: [results: UploadResult[]];
    error: [error: Error];
}

