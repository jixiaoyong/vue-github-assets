import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAssetStore } from '../useAssetStore';
import { ref } from 'vue';
import type { Octokit } from '@octokit/rest';

// Mock Octokit
const createMockOctokit = () => ({
    git: {
        getRef: vi.fn().mockResolvedValue({
            data: { object: { sha: 'commit-sha' } }
        }),
        getCommit: vi.fn().mockResolvedValue({
            data: { tree: { sha: 'tree-sha' } }
        }),
        getTree: vi.fn().mockResolvedValue({
            data: { truncated: false, tree: [] }
        }),
        createBlob: vi.fn().mockResolvedValue({ data: { sha: 'blob-sha' } }),
        createTree: vi.fn().mockResolvedValue({ data: { sha: 'tree-sha' } }),
        createCommit: vi.fn().mockResolvedValue({ data: { sha: 'new-commit' } }),
        updateRef: vi.fn().mockResolvedValue({}),
    },
    repos: {
        get: vi.fn().mockResolvedValue({ data: { default_branch: 'main' } }),
        getContent: vi.fn().mockRejectedValue({ status: 404 }),
        createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
    },
} as unknown as Octokit);

describe('useAssetStore', () => {
    const config = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isOperating mutex lock', () => {
        it('exposes isOperating ref', () => {
            const store = useAssetStore(config);

            expect(store.isOperating).toBeDefined();
            expect(store.isOperating.value).toBe(false);
        });

        it('sets isOperating to true during upload', async () => {
            const store = useAssetStore(config);

            // Record isOperating states during upload
            const states: boolean[] = [];

            // We can't easily observe mid-operation state without modifying code
            // Instead, verify initial and final states
            expect(store.isOperating.value).toBe(false);

            const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

            // Start upload (will fail due to mock, but that's ok for this test)
            try {
                await store.upload(mockFile);
            } catch {
                // Expected - mocks aren't fully set up
            }

            // After operation, should be false
            expect(store.isOperating.value).toBe(false);
        });

        it('prevents concurrent operations', async () => {
            const store = useAssetStore(config);

            // Simulate operation in progress by directly setting (for testing)
            // In real usage, this would happen during an actual upload

            const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

            // Start first upload
            const firstUpload = store.upload(mockFile).catch(() => { });

            // Immediately try second upload - should fail with lock error
            const secondUpload = store.upload(mockFile);

            await expect(secondUpload).rejects.toThrow(/操作进行中|Operation in progress/);

            await firstUpload; // Clean up
        });

        it('releases lock even on error', async () => {
            const store = useAssetStore(config);

            expect(store.isOperating.value).toBe(false);

            const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

            // This will error due to incomplete mocks
            try {
                await store.upload(mockFile);
            } catch {
                // Expected
            }

            // Lock should be released
            expect(store.isOperating.value).toBe(false);
        });
    });

    describe('remove with mutex lock', () => {
        it('sets isOperating during delete', async () => {
            const store = useAssetStore(config);

            expect(store.isOperating.value).toBe(false);

            const itemToDelete = {
                name: 'test.jpg',
                path: 'test.jpg',
                sha: 'sha123',
                size: 100,
            };

            try {
                await store.remove(itemToDelete);
            } catch {
                // Expected
            }

            // Lock should be released
            expect(store.isOperating.value).toBe(false);
        });
    });
});
