import type { Request, Response } from 'express';
import { errorToMessage } from './error-to-message.js';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

export const handleError = (fn: AsyncHandler) => {
    return (req: Request, res: Response) => {
        return fn(req, res).catch((err: unknown) => {
            res.status(500).json({ error: errorToMessage(err) });
        });
    };
};
