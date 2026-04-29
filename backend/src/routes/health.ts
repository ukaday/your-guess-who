import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { handleError } from '../utils/handle-error.js';

export const createHealthRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get(
        '/',
        handleError(async (_req, res) => {
            await prisma.$queryRaw`SELECT 1`;

            res.json({ status: 'ok' });
        }),
    );

    return router;
};
