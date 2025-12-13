/**
 * 图片压缩工具 / Image Compressor Utility
 * 
 * 上传前的可选压缩 / Optional compression before upload
 */
import type { CompressOptions } from '@/types';

const DEFAULT_OPTIONS: Required<CompressOptions> = {
    maxWidth: 0,
    maxHeight: 0,
    quality: 0.8,
    convertToWebP: false,
};

/**
 * 压缩图片文件 / Compress an image file
 * 使用 Canvas 进行调整大小和格式转换 / Uses Canvas for resizing and format conversion
 * 
 * @param file 原始图片文件 / Original image file
 * @param options 压缩选项 / Compression options
 * @returns 压缩后的文件 / Compressed file
 */
export async function compressImage(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 如果不需要压缩，返回原文件 / If no compression needed, return original
    if (!opts.maxWidth && !opts.maxHeight && !opts.convertToWebP && opts.quality >= 1) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // 计算新尺寸 / Calculate new dimensions
            let { width, height } = img;

            if (opts.maxWidth && width > opts.maxWidth) {
                height = Math.round((height * opts.maxWidth) / width);
                width = opts.maxWidth;
            }

            if (opts.maxHeight && height > opts.maxHeight) {
                width = Math.round((width * opts.maxHeight) / height);
                height = opts.maxHeight;
            }

            // 创建 Canvas / Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // 绘制图片 / Draw image
            ctx.drawImage(img, 0, 0, width, height);

            // 确定输出格式 / Determine output format
            const mimeType = opts.convertToWebP ? 'image/webp' : file.type;
            const ext = opts.convertToWebP ? 'webp' : file.name.split('.').pop() || 'jpg';
            const newName = file.name.replace(/\.[^.]+$/, `.${ext}`);

            // 转换为 Blob / Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to compress image'));
                        return;
                    }

                    const compressedFile = new File([blob], newName, {
                        type: mimeType,
                        lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                },
                mimeType,
                opts.quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * 检查文件是否需要压缩 / Check if file needs compression based on options
 */
export function needsCompression(file: File, options: CompressOptions): boolean {
    if (options.convertToWebP && !file.type.includes('webp')) {
        return true;
    }

    // 如果设置了最大宽高，假设可能需要压缩（因为需要加载图片才知道尺寸）
    // We can't know dimensions without loading the image
    // So if maxWidth/maxHeight is set, assume we might need to compress
    if (options.maxWidth || options.maxHeight) {
        return true;
    }

    if (options.quality && options.quality < 1) {
        return true;
    }

    return false;
}
