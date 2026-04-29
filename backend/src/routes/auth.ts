import { Router } from 'express';
import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createAuthService } from '../services/auth.js';
import { handleError } from '../utils/handle-error.js';
import { env } from '../lib/env.js';

export const createAuthRouter = (
    prisma: PrismaClient,
    cognito: CognitoIdentityProviderClient,
) => {
    const router = Router();
    const authService = createAuthService(
        prisma,
        cognito,
        env.COGNITO_CLIENT_ID,
        env.COGNITO_USER_POOL_ID,
    );

    router.post(
        '/register',
        handleError(async (req, res) => {
            const { username, password } = req.body as {
                username: string;
                password: string;
            };

            await authService.register(username, password);

            res.status(201).json({ message: 'registered' });
        }),
    );

    router.post(
        '/login',
        handleError(async (req, res) => {
            const { username, password } = req.body as {
                username: string;
                password: string;
            };

            const token = await authService.login(username, password);

            res.json({ token });
        }),
    );

    return router;
};
