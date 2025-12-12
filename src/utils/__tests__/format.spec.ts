import { describe, it, expect } from 'vitest';
import { formatBytes } from '../format';

describe('formatBytes', () => {
    it('formats bytes correctly', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1234)).toBe('1.21 KB');
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
        expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });

    it('handles decimals argument', () => {
        expect(formatBytes(1234, 0)).toBe('1 KB');
        expect(formatBytes(1234, 3)).toBe('1.205 KB');
    });
});
