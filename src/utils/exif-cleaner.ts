/**
 * EXIF 隐私信息清理工具 (TypeScript)
 * EXIF Privacy Information Cleaner (TypeScript)
 * 
 * 基于 piexifjs 直接操作 EXIF 二进制数据，保持原图像素不变
 * Based on piexifjs to directly manipulate EXIF binary data, preserving original pixels
 * 
 * **禁止使用 Canvas 重绘清理 EXIF - 会导致画质损失**
 * **DO NOT use Canvas redraw to clean EXIF - it causes quality loss**
 * 
 * @example
 * import { cleanupExifFromFile } from '@/utils/exif-cleaner';
 * 
 * async function handleUpload(file: File) {
 *   const result = await cleanupExifFromFile(file);
 *   if (result.success && result.file) {
 *     // 上传清理后的文件 / Upload cleaned file
 *   }
 * }
 */

// ============================================
// 动态加载 piexifjs / Dynamic loading of piexifjs
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let piexifLoaded: Promise<any> | null = null;

/**
 * 动态加载 piexifjs 库
 * Dynamically load piexifjs library
 */
async function loadPiexif() {
    if (piexifLoaded) return piexifLoaded;

    piexifLoaded = (async () => {
        // 从本地 node_modules 导入
        const module = await import('piexifjs');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let piexif: any = module.default || module;

        // ESM 模块可能有多层嵌套
        if (piexif && piexif.default && typeof piexif.default === 'object') {
            piexif = piexif.default;
        }

        // 验证 piexif 对象是否正确加载
        if (!piexif || typeof piexif.load !== 'function') {
            throw new Error('piexifjs 模块加载失败：无法找到 load 函数');
        }

        if (!piexif.ImageIFD || !piexif.ExifIFD) {
            throw new Error('piexifjs 模块加载失败：缺少 IFD 常量');
        }

        return piexif;
    })();

    return piexifLoaded;
}

// ============================================
// 动态加载 libheif-js / Dynamic loading of libheif-js
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let libheifLoaded: Promise<any> | null = null;

/**
 * 动态加载 libheif-js 库（用于 HEIC/HEIF 解码）
 * Dynamically load libheif-js library (for HEIC/HEIF decoding)
 */
async function loadLibheif() {
    if (libheifLoaded) return libheifLoaded;

    libheifLoaded = (async () => {
        // 动态加载 libheif-js / Dynamically load libheif-js
        const module = await import('libheif-js');
        return module.default || module;
    })();

    return libheifLoaded;
}

// ============================================
// 默认配置 / Default Configuration
// ============================================

/**
 * 默认版权信息
 * Default copyright information
 */
export const DEFAULT_COPYRIGHT_INFO = {
    copyright: 'Copyright (c) jixiaoyong. All Rights Reserved. jixiaoyong.github.io',
    artist: 'jixiaoyong (jixiaoyong.github.io)',
};

/**
 * 默认时区偏移（UTC+0）
 * Default timezone offset (UTC+0)
 */
export const DEFAULT_OFFSET_TIME = '+00:00';

// ============================================
// EXIF 标签参考 / EXIF Tag Reference
// ============================================

/**
 * 隐私相关的 EXIF 标签（需要删除）
 * Privacy-related EXIF tags (to be removed)
 */
export const PRIVACY_TAGS = {
    // IFD0 (0th)
    Make: 0x010F,           // 设备制造商 / Device manufacturer
    Model: 0x0110,          // 设备型号 / Device model
    Software: 0x0131,       // 软件 / Software
    HostComputer: 0x013C,   // 主机电脑 / Host computer

    // ExifIFD
    MakerNote: 0x927C,      // 制造商备注（包含 Apple 隐私数据）/ Maker notes (contains Apple privacy data)
    UserComment: 0x9286,    // 用户评论 / User comment
    ImageUniqueID: 0xA420,  // 图像唯一 ID / Image unique ID
    CameraOwnerName: 0xA430, // 相机所有者 / Camera owner
    BodySerialNumber: 0xA431, // 机身序列号 / Body serial number
    LensSerialNumber: 0xA435, // 镜头序列号 / Lens serial number
    LensMake: 0xA433,       // 镜头制造商 / Lens make
    LensModel: 0xA434,      // 镜头型号 / Lens model
};

/**
 * 要保留的有用标签（白名单）
 * Useful tags to preserve (whitelist)
 */
export const USEFUL_TAGS = {
    // IFD0
    Orientation: 0x0112,    // 显示方向（必须保留）/ Display orientation (must keep)
    XResolution: 0x011A,
    YResolution: 0x011B,
    ResolutionUnit: 0x0128,

    // ExifIFD
    ExifVersion: 0x9000,
    DateTimeOriginal: 0x9003,
    DateTimeDigitized: 0x9004,
    ExposureTime: 0x829A,   // 曝光时间 / Exposure time
    FNumber: 0x829D,        // 光圈 / F-number
    ISOSpeedRatings: 0x8827, // ISO
    FocalLength: 0x920A,    // 焦距 / Focal length
    Flash: 0x9209,          // 闪光灯 / Flash
    ColorSpace: 0xA001,     // 色彩空间 / Color space
};

// ============================================
// 工具函数 / Utility Functions
// ============================================

/**
 * 将 File/Blob 转换为 Data URL
 * Convert File/Blob to Data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * 将 Data URL 转换为 Blob
 * Convert Data URL to Blob
 */
function dataURLToBlob(dataURL: string): Blob {
    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * 格式化日期为 EXIF 格式 (YYYY:MM:DD HH:MM:SS)
 * 保留日期，时分秒设为 00:00:00
 * Format date to EXIF format, preserving date but clearing time to 00:00:00
 */
function formatExifDate(dateStr: string | undefined): string | null {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})/);
    if (match) {
        return `${match[1]}:${match[2]}:${match[3]} 00:00:00`;
    }
    return null;
}

/**
 * 检查是否为支持的 JPEG 格式
 * Check if file is JPEG format
 */
export function isJpegFormat(file: File): boolean {
    return file.type === 'image/jpeg' || file.type === 'image/jpg';
}

/**
 * 检查是否为 HEIC/HEIF 格式
 * Check if file is HEIC/HEIF format
 */
export function isHeicFormat(file: File): boolean {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return type === 'image/heic' ||
        type === 'image/heif' ||
        name.endsWith('.heic') ||
        name.endsWith('.heif');
}

/**
 * 检查是否为支持的图片格式 (JPEG 或 HEIC/HEIF)
 * Check if file is supported format (JPEG or HEIC/HEIF)
 */
export function isSupportedFormat(file: File): boolean {
    return isJpegFormat(file) || isHeicFormat(file);
}

/**
 * 格式化文件大小
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ============================================
// 类型定义 / Type Definitions
// ============================================

/**
 * 清理选项
 * Cleanup options
 */
export interface CleanupOptions {
    /** 版权信息 / Copyright information */
    copyright?: string;
    /** 作者信息 / Artist information */
    artist?: string;
    /** 时区偏移 / Timezone offset (default: +00:00) */
    offsetTime?: string;
    /** HEIC 转 JPEG 质量 / HEIC to JPEG quality (0-1) */
    jpegQuality?: number;
}

/**
 * 清理结果
 * Cleanup result
 */
export interface CleanupResult {
    /** 是否成功 / Whether successful */
    success: boolean;
    /** 清理后的文件 / Cleaned file */
    file: File | null;
    /** 清理后的 Blob / Cleaned blob */
    blob: Blob | null;
    /** 原始大小 / Original size */
    originalSize: number;
    /** 清理后大小 / Cleaned size */
    cleanedSize: number;
    /** 错误信息 / Error message */
    error: string | null;
    /** 删除的字段 / Removed fields */
    removedFields: string[];
    /** 添加的字段 / Added fields */
    addedFields: string[];
    /** HEIC 转换来源 / Converted from HEIC */
    convertedFrom?: string;
}

// ============================================
// HEIC 转换 / HEIC Conversion
// ============================================

/**
 * 将 HEIC/HEIF 转换为 JPEG Data URL
 * Convert HEIC/HEIF to JPEG Data URL
 * 
 * @param file - HEIC/HEIF 文件 / HEIC/HEIF file
 * @param quality - JPEG 质量 (0-1) / JPEG quality (0-1)
 */
async function convertHeicToJpeg(file: File, quality = 0.92): Promise<{ dataURL: string; width: number; height: number }> {
    const libheif = await loadLibheif();

    // 读取文件为 ArrayBuffer
    const buffer = await file.arrayBuffer();

    // 创建 HeifDecoder 实例
    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(new Uint8Array(buffer));

    if (!data || data.length === 0) {
        throw new Error('无法解码 HEIC/HEIF 文件 / Cannot decode HEIC/HEIF file');
    }

    // 获取第一帧图像
    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    // 创建 Canvas 并绘制
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('无法创建 Canvas 上下文 / Cannot create Canvas context');
    }

    // 获取像素数据
    const imageData = ctx.createImageData(width, height);
    await new Promise<void>((resolve, reject) => {
        image.display(imageData, (displayData: unknown) => {
            if (!displayData) {
                reject(new Error('HEIC 图像渲染失败 / HEIC image rendering failed'));
                return;
            }
            resolve();
        });
    });

    ctx.putImageData(imageData, 0, 0);

    // 转换为 JPEG Data URL
    const dataURL = canvas.toDataURL('image/jpeg', quality);

    return { dataURL, width, height };
}

// ============================================
// 主要清理函数 / Main Cleanup Function
// ============================================

/**
 * 清理 EXIF 隐私信息
 * Clean EXIF privacy information
 * 
 * 工作流程 / Workflow:
 * 1. 解析 EXIF 二进制数据 / Parse EXIF binary data
 * 2. 删除 GPS（整个块）/ Remove GPS (entire block)
 * 3. 删除设备信息（Make, Model, Software 等）/ Remove device info
 * 4. 删除 MakerNotes（包含所有 Apple 隐私数据）/ Remove MakerNotes
 * 5. 删除唯一标识（ImageUniqueID 等）/ Remove unique identifiers
 * 6. 删除缩略图 / Remove thumbnail
 * 7. 添加版权信息 / Add copyright info
 * 8. 修改时间（保留日期，清除时分秒）/ Modify time (keep date, clear time)
 * 9. 写回 EXIF（像素不变）/ Write back EXIF (pixels unchanged)
 * 
 * @param file - 原始图片文件 / Original image file
 * @param options - 清理选项 / Cleanup options
 * @returns 清理结果 / Cleanup result
 */
export async function cleanupExifFromFile(
    file: File,
    options: CleanupOptions = {}
): Promise<CleanupResult> {
    const {
        copyright = DEFAULT_COPYRIGHT_INFO.copyright,
        artist = DEFAULT_COPYRIGHT_INFO.artist,
        offsetTime = DEFAULT_OFFSET_TIME,
    } = options;

    const result: CleanupResult = {
        success: false,
        file: null,
        blob: null,
        originalSize: file.size,
        cleanedSize: 0,
        error: null,
        removedFields: [],
        addedFields: [],
    };

    try {
        // ===== 处理 HEIC/HEIF 格式 =====
        if (isHeicFormat(file)) {
            result.removedFields.push('HEIC/HEIF converted to JPEG (all original metadata removed)');

            // 转换 HEIC 为 JPEG
            const { dataURL } = await convertHeicToJpeg(file, options.jpegQuality || 0.92);

            // 加载 piexifjs 添加版权信息
            const piexif = await loadPiexif();

            // 创建空的 EXIF 对象，只添加版权和时间信息
            const exifObj = {
                '0th': {} as Record<number, unknown>,
                'Exif': {} as Record<number, unknown>,
                'GPS': {},
                '1st': {},
                'Interop': {},
            };

            // 添加版权信息
            exifObj['0th'][piexif.ImageIFD.Copyright] = copyright;
            exifObj['0th'][piexif.ImageIFD.Artist] = artist;
            result.addedFields.push(`Copyright: ${copyright}`);
            result.addedFields.push(`Artist: ${artist}`);

            // 添加当前日期（清除时分秒）
            const now = new Date();
            const dateStr = `${now.getFullYear()}:${String(now.getMonth() + 1).padStart(2, '0')}:${String(now.getDate()).padStart(2, '0')} 00:00:00`;
            exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateStr;
            exifObj['0th'][piexif.ImageIFD.DateTime] = dateStr;
            result.addedFields.push(`DateTimeOriginal: ${dateStr}`);

            // 设置时区为 UTC+0
            exifObj['Exif'][36881] = offsetTime; // OffsetTimeOriginal
            exifObj['Exif'][36882] = offsetTime; // OffsetTimeDigitized
            exifObj['Exif'][36880] = offsetTime; // OffsetTime
            result.addedFields.push(`OffsetTimeOriginal: ${offsetTime}`);

            // 写入 EXIF
            const exifBytes = piexif.dump(exifObj);
            const newDataURL = piexif.insert(exifBytes, dataURL);

            // 转换为 Blob
            const cleanedBlob = dataURLToBlob(newDataURL);

            // 创建新的 File 对象（扩展名改为 .jpg）
            const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            const cleanedFile = new File(
                [cleanedBlob],
                newFileName,
                { type: 'image/jpeg', lastModified: Date.now() }
            );

            result.success = true;
            result.file = cleanedFile;
            result.blob = cleanedBlob;
            result.cleanedSize = cleanedBlob.size;
            result.convertedFrom = 'HEIC/HEIF';

            return result;
        }

        // ===== 处理非 JPEG 格式 =====
        if (!isJpegFormat(file)) {
            // 对于其他格式（PNG 等），直接返回原文件
            result.success = true;
            result.file = file;
            result.blob = file;
            result.cleanedSize = file.size;
            result.error = '不支持的格式，跳过 EXIF 处理 / Unsupported format, skipping EXIF processing';
            return result;
        }

        // ===== 处理 JPEG 格式 =====
        const piexif = await loadPiexif();
        const dataURL = await blobToDataURL(file);

        // 解析 EXIF
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let exifObj: any;
        try {
            exifObj = piexif.load(dataURL);
        } catch {
            // 无法解析 EXIF，可能是没有 EXIF 数据的图片
            result.success = true;
            result.file = file;
            result.blob = file;
            result.cleanedSize = file.size;
            result.error = '无法解析 EXIF 数据，返回原文件 / Cannot parse EXIF data, returning original file';
            return result;
        }

        // ★★★ 在任何修改之前，先保存原始 Orientation ★★★
        const ifd0 = exifObj['0th'] || {};
        let originalOrientation = ifd0[piexif.ImageIFD.Orientation];
        if (originalOrientation === undefined) {
            originalOrientation = ifd0[274]; // 直接用数字
        }

        // ===== 1. 删除 GPS 数据（整个块）=====
        if (exifObj['GPS'] && Object.keys(exifObj['GPS']).length > 0) {
            result.removedFields.push('GPS (entire block)');
            exifObj['GPS'] = {};
        }

        // ===== 2. 删除 IFD0 中的设备信息 =====
        if (ifd0[piexif.ImageIFD.Make] !== undefined) {
            result.removedFields.push(`Make: ${ifd0[piexif.ImageIFD.Make]}`);
            delete ifd0[piexif.ImageIFD.Make];
        }
        if (ifd0[piexif.ImageIFD.Model] !== undefined) {
            result.removedFields.push(`Model: ${ifd0[piexif.ImageIFD.Model]}`);
            delete ifd0[piexif.ImageIFD.Model];
        }
        if (ifd0[piexif.ImageIFD.Software] !== undefined) {
            result.removedFields.push(`Software: ${ifd0[piexif.ImageIFD.Software]}`);
            delete ifd0[piexif.ImageIFD.Software];
        }
        // HostComputer (tag 0x013C = 316)
        if (ifd0[316] !== undefined) {
            result.removedFields.push(`HostComputer: ${ifd0[316]}`);
            delete ifd0[316];
        }

        // ===== 3. 删除 ExifIFD 中的隐私信息 =====
        const exifIfd = exifObj['Exif'] || {};

        // 删除 MakerNote（包含所有 Apple 隐私数据）
        if (exifIfd[piexif.ExifIFD.MakerNote] !== undefined) {
            result.removedFields.push('MakerNote (Apple privacy data)');
            delete exifIfd[piexif.ExifIFD.MakerNote];
        }
        if (exifIfd[piexif.ExifIFD.UserComment] !== undefined) {
            result.removedFields.push('UserComment');
            delete exifIfd[piexif.ExifIFD.UserComment];
        }
        if (exifIfd[piexif.ExifIFD.ImageUniqueID] !== undefined) {
            result.removedFields.push(`ImageUniqueID: ${exifIfd[piexif.ExifIFD.ImageUniqueID]}`);
            delete exifIfd[piexif.ExifIFD.ImageUniqueID];
        }
        if (exifIfd[piexif.ExifIFD.CameraOwnerName] !== undefined) {
            result.removedFields.push(`CameraOwnerName: ${exifIfd[piexif.ExifIFD.CameraOwnerName]}`);
            delete exifIfd[piexif.ExifIFD.CameraOwnerName];
        }
        if (exifIfd[piexif.ExifIFD.BodySerialNumber] !== undefined) {
            result.removedFields.push('BodySerialNumber');
            delete exifIfd[piexif.ExifIFD.BodySerialNumber];
        }
        if (exifIfd[piexif.ExifIFD.LensMake] !== undefined) {
            result.removedFields.push(`LensMake: ${exifIfd[piexif.ExifIFD.LensMake]}`);
            delete exifIfd[piexif.ExifIFD.LensMake];
        }
        if (exifIfd[piexif.ExifIFD.LensModel] !== undefined) {
            result.removedFields.push(`LensModel: ${exifIfd[piexif.ExifIFD.LensModel]}`);
            delete exifIfd[piexif.ExifIFD.LensModel];
        }
        if (exifIfd[piexif.ExifIFD.LensSerialNumber] !== undefined) {
            result.removedFields.push('LensSerialNumber');
            delete exifIfd[piexif.ExifIFD.LensSerialNumber];
        }

        // ===== 4. 删除缩略图 =====
        if (exifObj['1st'] && Object.keys(exifObj['1st']).length > 0) {
            result.removedFields.push('Thumbnail');
            exifObj['1st'] = {};
        }
        if (exifObj['thumbnail']) {
            delete exifObj['thumbnail'];
        }

        // ===== 5. 添加/修改版权信息 =====
        ifd0[piexif.ImageIFD.Copyright] = copyright;
        result.addedFields.push(`Copyright: ${copyright}`);
        ifd0[piexif.ImageIFD.Artist] = artist;
        result.addedFields.push(`Artist: ${artist}`);

        // ===== 6. 修改时间信息 =====
        const dateTimeOriginal = exifIfd[piexif.ExifIFD.DateTimeOriginal];
        if (dateTimeOriginal) {
            const cleanedDate = formatExifDate(dateTimeOriginal);
            if (cleanedDate) {
                exifIfd[piexif.ExifIFD.DateTimeOriginal] = cleanedDate;
                result.addedFields.push(`DateTimeOriginal: ${cleanedDate}`);
            }
        }

        // 设置时区偏移为 UTC+0
        exifIfd[36881] = offsetTime; // OffsetTimeOriginal
        exifIfd[36882] = offsetTime; // OffsetTimeDigitized
        exifIfd[36880] = offsetTime; // OffsetTime
        result.addedFields.push(`OffsetTimeOriginal: ${offsetTime}`);

        // 更新 IFD0 中的日期时间
        const dateTime = ifd0[piexif.ImageIFD.DateTime];
        if (dateTime) {
            const cleanedDate = formatExifDate(dateTime);
            if (cleanedDate) {
                ifd0[piexif.ImageIFD.DateTime] = cleanedDate;
            }
        }

        // ===== 7. 清理无效值并恢复 Orientation =====
        exifObj['0th'] = ifd0;
        exifObj['Exif'] = exifIfd;

        // 恢复 Orientation（关键！影响照片显示方向）
        if (originalOrientation !== undefined && originalOrientation !== null) {
            exifObj['0th'][piexif.ImageIFD.Orientation] = originalOrientation;
        }

        // ===== 8. 写回 EXIF（多级降级策略）=====
        let newDataURL: string;
        let dumpError: Error | null = null;

        try {
            const exifBytes = piexif.dump(exifObj);
            newDataURL = piexif.insert(exifBytes, dataURL);
        } catch (err) {
            dumpError = err as Error;
            console.warn('[exif-cleaner] Failed to dump modified EXIF, trying minimal EXIF:', dumpError.message);

            // 第二级降级：使用最小化的 EXIF
            try {
                const minimalExif = {
                    '0th': {} as Record<number, unknown>,
                    'Exif': {} as Record<number, unknown>,
                    'GPS': {},
                    '1st': {},
                    'Interop': {},
                };

                // 只保留显示相关的标签
                if (originalOrientation !== undefined) {
                    minimalExif['0th'][piexif.ImageIFD.Orientation] = originalOrientation;
                }
                minimalExif['0th'][piexif.ImageIFD.Copyright] = copyright;
                minimalExif['0th'][piexif.ImageIFD.Artist] = artist;

                if (dateTimeOriginal) {
                    minimalExif['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateTimeOriginal;
                }
                minimalExif['Exif'][36881] = offsetTime;

                const minimalBytes = piexif.dump(minimalExif);
                newDataURL = piexif.insert(minimalBytes, dataURL);

                result.removedFields.push('Some EXIF tags could not be preserved (display-related tags kept)');
            } catch {
                console.warn('[exif-cleaner] Minimal EXIF failed, trying safe EXIF');

                // 第三级降级：完全移除再添加最简单的 EXIF
                try {
                    const strippedDataURL = piexif.remove(dataURL);
                    const safeExif = {
                        '0th': {} as Record<number, unknown>,
                        'Exif': {} as Record<number, unknown>,
                        'GPS': {},
                        '1st': {},
                        'Interop': {},
                    };

                    safeExif['0th'][piexif.ImageIFD.Copyright] = copyright;
                    safeExif['0th'][piexif.ImageIFD.Artist] = artist;

                    if (originalOrientation !== undefined) {
                        safeExif['0th'][piexif.ImageIFD.Orientation] = originalOrientation;
                    }

                    const safeBytes = piexif.dump(safeExif);
                    newDataURL = piexif.insert(safeBytes, strippedDataURL);

                    result.removedFields.push('All EXIF stripped and rebuilt with minimal safe values (Orientation preserved)');
                } catch {
                    // 第四级降级：仅移除 EXIF
                    try {
                        newDataURL = piexif.remove(dataURL);
                        result.removedFields.push('All EXIF completely stripped (no new EXIF added)');
                    } catch {
                        // 最终降级：返回原文件
                        result.success = true;
                        result.file = file;
                        result.blob = file;
                        result.cleanedSize = file.size;
                        result.error = `EXIF 处理异常，返回原文件 / EXIF processing failed, returning original: ${dumpError?.message}`;
                        return result;
                    }
                }
            }
        }

        // 转换回 Blob 和 File
        const cleanedBlob = dataURLToBlob(newDataURL);
        const cleanedFile = new File(
            [cleanedBlob],
            file.name,
            { type: file.type, lastModified: Date.now() }
        );

        result.success = true;
        result.file = cleanedFile;
        result.blob = cleanedBlob;
        result.cleanedSize = cleanedBlob.size;

        return result;

    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        // 出错时返回原文件，让用户决定是否继续上传
        result.file = file;
        result.blob = file;
        result.cleanedSize = file.size;
        return result;
    }
}

/**
 * 清理 Blob 中的 EXIF 隐私信息
 * Clean EXIF privacy information from Blob
 */
export async function cleanupExifFromBlob(
    blob: Blob,
    options: CleanupOptions = {}
): Promise<CleanupResult> {
    const file = new File([blob], 'image.jpg', {
        type: blob.type || 'image/jpeg',
        lastModified: Date.now()
    });
    return cleanupExifFromFile(file, options);
}

/**
 * 批量清理多个文件
 * Batch clean multiple files
 * 
 * @param files - 文件数组 / File array
 * @param options - 清理选项 / Cleanup options
 * @param onProgress - 进度回调 / Progress callback
 */
export async function cleanupExifBatch(
    files: File[],
    options: CleanupOptions = {},
    onProgress?: (current: number, total: number, file: File) => void
): Promise<{
    results: CleanupResult[];
    success: number;
    failed: number;
    totalOriginalSize: number;
    totalCleanedSize: number;
}> {
    const results: CleanupResult[] = [];
    let success = 0;
    let failed = 0;
    let totalOriginalSize = 0;
    let totalCleanedSize = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (onProgress) {
            onProgress(i + 1, files.length, file);
        }

        const result = await cleanupExifFromFile(file, options);
        results.push(result);

        totalOriginalSize += result.originalSize;
        totalCleanedSize += result.cleanedSize;

        if (result.success && !result.error) {
            success++;
        } else {
            failed++;
        }
    }

    return {
        results,
        success,
        failed,
        totalOriginalSize,
        totalCleanedSize,
    };
}

// ============================================
// 兼容旧 API / Legacy API Compatibility
// ============================================

/** @deprecated 使用 cleanupExifFromFile 代替 / Use cleanupExifFromFile instead */
export const cleanExif = cleanupExifFromFile;

/** @deprecated 使用 cleanupExifBatch 代替 / Use cleanupExifBatch instead */
export const cleanExifBatch = cleanupExifBatch;
