import cors from 'cors';
import type { CorsOptions } from 'cors';
import express from 'express';
import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from './generated/prisma/client.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { env } from './lib/env.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createDeckRouter } from './routes/decks.js';
import { createCardRouter } from './routes/cards.js';
import { createImageRouter } from './routes/images.js';
import { createGameRouter } from './routes/games.js';

export const createApp = (
    prisma: PrismaClient,
    cognito: CognitoIdentityProviderClient,
    s3: S3Client,
    s3Bucket: string,
    corsOrigin: CorsOptions['origin'],
) => {
    const app = express();
    const authMiddleware = createAuthMiddleware(
        env.COGNITO_USER_POOL_ID,
        env.COGNITO_CLIENT_ID,
    );

    app.use(cors({ origin: corsOrigin }));
    app.use(express.json());
    app.use('/api/health', createHealthRouter(prisma));
    app.use('/api/auth', createAuthRouter(prisma, cognito));
    app.use('/api/decks', createDeckRouter(prisma, authMiddleware));
    app.use('/api/decks', createCardRouter(prisma, authMiddleware));
    app.use('/api/images', createImageRouter(s3, s3Bucket, authMiddleware));
    app.use('/api/games', createGameRouter(prisma, authMiddleware));

    return app;
};
