import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/http-error.js';

export const createErrorHandler = (logger: (err: unknown) => void) => {
    return (err: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            next(err);
            return;
        }

        if (err instanceof HttpError) {
            res.status(err.status).json({ error: err.message });
            return;
        }

        logger(err);

        res.status(500).json({ error: 'Internal server error' });
    };
};
