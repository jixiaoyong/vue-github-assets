import { describe, it, expect, vi } from 'vitest';
import { cleanupExifFromFile, cleanupExifFromBlob } from '../exif-cleaner';

// Mock piexifjs and libheif-js
vi.mock('piexifjs', () => ({
    default: {
        load: vi.fn(() => ({
            '0th': {},
            'Exif': {},
            'GPS': {},
            '1st': {},
            'thumbnail': null,
        })),
        dump: vi.fn(() => 'dumped_exif_binary'),
        insert: vi.fn((exif, data) => data), // Return data unchanged for mock
        ImageIFD: {},
        ExifIFD: {},
        GPSIFD: {},
    },
}));

// We don't need to mock dynamic import of libheif-js if we are not testing HEIC specifically in unit tests
// or we can mock the import itself. For basic file structure tests, focusing on JPEG flow is safer.

describe('exif-cleaner', () => {
    it('identifies JPEG files', async () => {
        const file = new File(['fake-jpeg-content'], 'test.jpg', { type: 'image/jpeg' });
        const result = await cleanupExifFromFile(file);

        // Since our mock piexifjs.insert returns original data, 
        // and we passed "fake-jpeg-content", the result should be successful but maybe same data
        // In real flow, it reads content as DataURL.

        // Actually testing file reading in JSDOM is tricky without a real FileReader behavior for blobs.
        // JSDOM supports FileReader for text but maybe not complex binary flows perfectly?
        // Let's check result structure.

        expect(result.success).toBe(true);
        expect(result.file).toBeInstanceOf(File);
    });

    it('skips non-supported files', async () => {
        const file = new File(['fake-png'], 'test.png', { type: 'image/png' });
        const result = await cleanupExifFromFile(file);

        // It returns success: true for unsupported files, but returns original file
        expect(result.success).toBe(true);
        // And error message is set as a warning
        expect(result.error).toContain('Unsupported format');
    });
});
