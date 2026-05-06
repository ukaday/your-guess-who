import cors from 'cors';
import type { CorsOptions } from 'cors';
import express from 'express';
import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { PrismaClient } from './generated/prisma/client.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { env } from './lib/env.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createDeckRouter } from './routes/decks.js';

export const createApp = (
    prisma: PrismaClient,
    cognito: CognitoIdentityProviderClient,
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

    return app;
};
