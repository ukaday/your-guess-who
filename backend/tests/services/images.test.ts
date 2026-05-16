import { describe, it, vi, expect } from 'vitest';
import {
    createImageService,
    generateUploadUrl,
} from '../../src/services/images.js';
import { S3Client } from '@aws-sdk/client-s3';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: vi.fn().mockResolvedValue('https://fakeurl.com'),
}));

describe('generateUploadUrl', () => {
    it('returns uploadUrl and imageKey', async () => {
        const s3Client = {} as S3Client;
        const s3Bucket = 'fake-bucket';
        const userId = '123456';

        const result = await generateUploadUrl(s3Client, s3Bucket, userId);

        expect(result.uploadUrl).toMatch(/^https:\/\//);
        expect(result.imageKey).toMatch(/^cards\/123456\//);
    });
});

describe('createImageService', () => {
    it('generateUploadUrl delegates to generateUploadUrl function', async () => {
        const s3Client = {} as S3Client;
        const s3Bucket = 'fake-bucket';
        const userId = '123456';

        const result = await createImageService(
            s3Client,
            s3Bucket,
        ).generateUploadUrl(userId);

        expect(result.uploadUrl).toMatch(/^https:\/\//);
        expect(result.imageKey).toMatch(/^cards\/123456\//);
    });
});
