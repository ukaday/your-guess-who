import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { Request, Response, NextFunction } from 'express';

declare global {
    namespace Express {
        interface Request {
            userId: string
        }
    }
}

export const createAuthMiddleware = (userPoolId: string, clientId: string) => {
    const verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId});

    return async (req: Request, res: Response, next: NextFunction) => {
        const token = getAuthToken(req)

        if (!token) {
            res.status(401).json({ error: 'Missing token' })
            return
        }

        try {
            const payload = await verifier.verify(token)

            req.userId = payload.sub

            next()
        } catch {
            res.status(401).json({ error: 'Invalid or expired token' })
        }
    }
}

export const getAuthToken = (req: Request) => req.headers['authorization']?.split(' ')[1]
