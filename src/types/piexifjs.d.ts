/**
 * Type declarations for piexifjs
 */
declare module 'piexifjs' {
    interface ImageIFD {
        Make: number;
        Model: number;
        Orientation: number;
        XResolution: number;
        YResolution: number;
        ResolutionUnit: number;
        Software: number;
        DateTime: number;
        Artist: number;
        Copyright: number;
        YCbCrPositioning: number;
    }

    interface ExifIFD {
        ExposureTime: number;
        FNumber: number;
        ISOSpeedRatings: number;
        DateTimeOriginal: number;
        DateTimeDigitized: number;
        MakerNote: number;
        UserComment: number;
        FocalLength: number;
        Flash: number;
        ColorSpace: number;
        PixelXDimension: number;
        PixelYDimension: number;
        ImageUniqueID: number;
        CameraOwnerName: number;
        BodySerialNumber: number;
        LensMake: number;
        LensModel: number;
        LensSerialNumber: number;
    }

    interface GPSIFD {
        GPSLatitudeRef: number;
        GPSLatitude: number;
        GPSLongitudeRef: number;
        GPSLongitude: number;
        GPSAltitudeRef: number;
        GPSAltitude: number;
    }

    interface ExifObject {
        '0th': Record<number, unknown>;
        'Exif': Record<number, unknown>;
        'GPS': Record<number, unknown>;
        '1st': Record<number, unknown>;
        'Interop': Record<number, unknown>;
        'thumbnail'?: ArrayBuffer;
    }

    const ImageIFD: ImageIFD;
    const ExifIFD: ExifIFD;
    const GPSIFD: GPSIFD;

    function load(dataUrl: string): ExifObject;
    function dump(exifObject: ExifObject): string;
    function insert(exifBytes: string, dataUrl: string): string;
    function remove(dataUrl: string): string;

    export default {
        ImageIFD,
        ExifIFD,
        GPSIFD,
        load,
        dump,
        insert,
        remove,
    };
}
