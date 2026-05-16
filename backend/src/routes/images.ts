import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { S3Client } from '@aws-sdk/client-s3';
import { createImageService } from '../services/images.js';
import { handleError } from '../utils/handle-error.js';

export const createImageRouter = (
    s3: S3Client,
    bucket: string,
    authMiddleware: RequestHandler,
) => {
    const router = Router();
    const imageService = createImageService(s3, bucket);

    router.use(authMiddleware);

    router.post(
        '/upload-url',
        handleError(async (req, res) => {
            const result = await imageService.generateUploadUrl(req.userId);

            res.json(result);
        }),
    );

    return router;
};
