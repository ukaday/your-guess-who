import { Router } from 'express';

export const createHealthRouter = () => {
    const router = Router();

    router.get('/', (_req, res) => {
        res.json({ status: 'ok' });
    });

    return router;
};
