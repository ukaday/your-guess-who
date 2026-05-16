import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const UPLOAD_URL_EXPIRES_IN_SECONDS = 300;

export const generateUploadUrl = async (
    s3: S3Client,
    bucket: string,
    userId: string,
) => {
    const imageKey = `cards/${userId}/${randomUUID()}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: imageKey });
    const uploadUrl = await getSignedUrl(s3, command, {
        expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return { uploadUrl, imageKey };
};

export const createImageService = (s3: S3Client, bucket: string) => ({
    generateUploadUrl: (userId: string) =>
        generateUploadUrl(s3, bucket, userId),
});
