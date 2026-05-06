import type { Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { errorToMessage } from './error-to-message.js';

type AsyncHandler<P extends ParamsDictionary = ParamsDictionary> = (
    req: Request<P>,
    res: Response,
) => Promise<void>;

export const handleError = <P extends ParamsDictionary = ParamsDictionary>(
    fn: AsyncHandler<P>,
) => {
    return (req: Request<P>, res: Response) => {
        return fn(req, res).catch((err: unknown) => {
            res.status(500).json({ error: errorToMessage(err) });
        });
    };
};
