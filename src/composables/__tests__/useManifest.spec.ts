import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useManifest } from '../useManifest';
import { ref } from 'vue';
import type { Octokit } from '@octokit/rest';

// Mock Octokit
const mockOctokit = {
    repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
    },
} as unknown as Octokit;

describe('useManifest', () => {
    const config = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes correctly', () => {
        const { manifest, loading, error } = useManifest({
            config,
            octokit: ref(mockOctokit),
        });

        expect(manifest.value).toBeNull();
        expect(loading.value).toBe(false);
        expect(error.value).toBeNull();
    });

    // More tests to be added
    it('loads manifest from GitHub', async () => {
        // Mock successful get content
        (mockOctokit.repos.getContent as any).mockResolvedValue({
            data: {
                type: 'file',
                content: btoa(JSON.stringify({
                    meta: {
                        version: '1.0.0',
                        generator: 'vue-github-assets',
                        lastUpdated: '2023-01-01T00:00:00Z',
                        lastSyncedSha: 'sha123',
                    },
                    stats: {
                        totalCount: 0,
                        totalSize: 0,
                        formattedSize: '0 B',
                    },
                    files: [],
                    folders: [],
                })),
                sha: 'mock-sha',
            },
        });

        const { manifest, loadManifest } = useManifest({
            config,
            octokit: ref(mockOctokit),
        });

        await loadManifest();

        expect(manifest.value).not.toBeNull();
        expect(manifest.value?.meta.version).toBe('1.0.0');
    });

    it('handles missing manifest gracefully', async () => {
        // Mock 404
        (mockOctokit.repos.getContent as any).mockRejectedValue({ status: 404 });

        const { manifest, loadManifest } = useManifest({
            config,
            octokit: ref(mockOctokit),
        });

        await loadManifest();

        // Should create empty manifest
        expect(manifest.value).not.toBeNull();
        expect(manifest.value?.files).toEqual([]);
    });

    it('adds file to manifest', async () => {
        const { manifest, addFile, loadManifest } = useManifest({
            config,
            octokit: ref(mockOctokit),
        });

        // Initialize with empty
        (mockOctokit.repos.getContent as any).mockRejectedValue({ status: 404 });
        await loadManifest();

        const newFile = {
            name: 'test.jpg',
            path: 'test.jpg',
            size: 100,
            sha: 'newsha',
            mimeType: 'image/jpeg',
            uploadedAt: new Date().toISOString(),
        };

        addFile(newFile);

        expect(manifest.value?.files).toHaveLength(1);
        expect(manifest.value?.files[0].name).toBe('test.jpg');
    });
});
