import cors from 'cors';
import express from 'express';
import type { PrismaClient } from './generated/prisma/client.js';

export const createApp = (prisma: PrismaClient) => {
    const app = express();

    app.use(cors({ origin: 'http://localhost:5173' }));
    app.use(express.json());

    app.get('/health', async (_req, res) => {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
    });

    return app;
};
