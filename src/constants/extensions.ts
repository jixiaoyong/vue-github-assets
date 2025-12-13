/**
 * 支持的图片扩展名配置 / Supported Image Extensions Configuration
 */

// 扩展名列表 (用于 UI 显示和验证) / Extension list (for UI display and validation)
export const SUPPORTED_IMAGE_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
    '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif'
];

// 扩展名正则 (用于文件扫描和匹配) / Extension regex (for file scanning and matching)
// 自动根据列表生成正则，或者手动维护以确保准确性
// Manually maintained for precision, keeping in sync with list above
export const IMAGE_EXTENSIONS_REGEX = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff?|avif|heic|heif)$/i;
