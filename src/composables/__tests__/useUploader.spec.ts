import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUploader } from '../useUploader';
import { ref } from 'vue';
import type { Octokit } from '@octokit/rest';

// Mock Octokit
const createMockOctokit = () => ({
    git: {
        getRef: vi.fn().mockResolvedValue({
            data: { object: { sha: 'parent-commit-sha-abc123' } }
        }),
        getCommit: vi.fn().mockResolvedValue({
            data: { tree: { sha: 'tree-sha-xyz' } }
        }),
        getTree: vi.fn().mockResolvedValue({
            data: {
                truncated: false,
                tree: [
                    { type: 'blob', path: 'existing.jpg', sha: 'existing-sha', size: 100 }
                ]
            }
        }),
        createBlob: vi.fn().mockResolvedValue({
            data: { sha: 'new-blob-sha' }
        }),
        createTree: vi.fn().mockResolvedValue({
            data: { sha: 'new-tree-sha' }
        }),
        createCommit: vi.fn().mockResolvedValue({
            data: { sha: 'new-commit-sha' }
        }),
        updateRef: vi.fn().mockResolvedValue({}),
    },
    repos: {
        getContent: vi.fn(),
    },
} as unknown as Octokit);

describe('useUploader', () => {
    const config = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
    };

    let mockOctokit: Octokit;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOctokit = createMockOctokit();
    });

    describe('generateFilePath (timestamp renaming)', () => {
        it('generates timestamp-based filename', async () => {
            const { uploadAtomic } = useUploader({
                config,
                octokit: ref(mockOctokit),
            });

            // Create a mock file
            const mockFile = new File(['test content'], 'original-name.jpg', { type: 'image/jpeg' });

            const result = await uploadAtomic([mockFile], '');

            // Verify the path uses timestamp format: YYYYMMDDHHmmssSSS.jpg
            expect(result.assets).toBeDefined();
            expect(result.assets!.length).toBe(1);

            const uploadedAsset = result.assets![0];
            // Name should match timestamp pattern, NOT original filename
            expect(uploadedAsset.name).not.toBe('original-name.jpg');
            expect(uploadedAsset.name).toMatch(/^\d{17}\.jpg$/); // 17 digits + .jpg

            // Path should also contain the timestamp filename
            expect(uploadedAsset.path).toMatch(/\d{17}\.jpg$/);
        });

        it('preserves folder structure with timestamp filename', async () => {
            const configWithBasePath = {
                ...config,
                basePath: 'images',
            };

            const { uploadAtomic } = useUploader({
                config: configWithBasePath,
                octokit: ref(mockOctokit),
            });

            const mockFile = new File(['test'], 'photo.png', { type: 'image/png' });
            const result = await uploadAtomic([mockFile], 'subfolder');

            expect(result.assets![0].path).toMatch(/^images\/subfolder\/\d{17}\.png$/);
        });
    });

    describe('uploadAtomic - lastSyncedSha', () => {
        it('sets lastSyncedSha to parent commit SHA', async () => {
            const { uploadAtomic } = useUploader({
                config,
                octokit: ref(mockOctokit),
            });

            const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            await uploadAtomic([mockFile], '');

            // Verify createBlob was called with manifest containing correct lastSyncedSha
            const createBlobCalls = (mockOctokit.git.createBlob as any).mock.calls;

            // Second createBlob call is the manifest
            const manifestBlobCall = createBlobCalls[1];
            const manifestContent = JSON.parse(atob(manifestBlobCall[0].content));

            expect(manifestContent.meta.lastSyncedSha).toBe('parent-commit-sha-abc123');
        });
    });

    describe('uploadAtomic - name field consistency', () => {
        it('uses renamed filename in assets, not original', async () => {
            const { uploadAtomic } = useUploader({
                config,
                octokit: ref(mockOctokit),
            });

            const mockFile = new File(['test'], 'my-vacation-photo.jpeg', { type: 'image/jpeg' });
            const result = await uploadAtomic([mockFile], 'photos');

            // The returned asset name should be the timestamp, not original
            const asset = result.assets![0];
            expect(asset.name).not.toBe('my-vacation-photo.jpeg');
            expect(asset.name).toMatch(/^\d{17}\.jpeg$/);

            // Path should start with folder and contain timestamp
            expect(asset.path).toMatch(/^photos\/\d{17}\.jpeg$/);
        });
    });

    describe('deleteAtomic - lastSyncedSha', () => {
        it('sets lastSyncedSha to parent commit SHA', async () => {
            const { deleteAtomic } = useUploader({
                config,
                octokit: ref(mockOctokit),
            });

            const itemToDelete = {
                name: 'existing.jpg',
                path: 'existing.jpg',
                sha: 'existing-sha',
                size: 100,
            };

            await deleteAtomic([itemToDelete], {});

            // Verify manifest blob contains correct lastSyncedSha
            const createBlobCalls = (mockOctokit.git.createBlob as any).mock.calls;
            const manifestBlobCall = createBlobCalls[0]; // Only one blob for delete (manifest)
            const manifestContent = JSON.parse(atob(manifestBlobCall[0].content));

            expect(manifestContent.meta.lastSyncedSha).toBe('parent-commit-sha-abc123');
        });
    });
});
