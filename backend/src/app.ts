import cors from 'cors';
import type { CorsOptions } from 'cors';
import express from 'express';
import type { PrismaClient } from './generated/prisma/client.js';

export const createApp = (
    prisma: PrismaClient,
    corsOrigin: CorsOptions['origin'],
) => {
    const app = express();

    app.use(cors({ origin: corsOrigin }));
    app.use(express.json());

    app.get('/api/health', async (_req, res) => {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
    });

    return app;
};
