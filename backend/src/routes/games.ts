import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createGameService } from '../services/games.js';
import { handleError } from '../utils/handle-error.js';

export const createGameRouter = (
    prisma: PrismaClient,
    authMiddleware: RequestHandler,
) => {
    const router = Router();
    const gameService = createGameService(prisma);

    router.use(authMiddleware);

    router.post(
        '/',
        handleError(async (req, res) => {
            const { deckId } = req.body as { deckId: string };

            const game = await gameService.createGame(req.userId, deckId);

            if (!game) {
                res.status(404).json({ error: 'Deck not found' });
                return;
            }

            res.status(201).json(game);
        }),
    );

    router.post(
        '/join',
        handleError(async (req, res) => {
            const { inviteCode } = req.body as { inviteCode: string };

            const player = await gameService.joinGame(req.userId, inviteCode);

            if (!player) {
                res.status(404).json({
                    error: 'Game not found or not joinable',
                });
                return;
            }

            res.status(201).json(player);
        }),
    );

    router.get(
        '/:id',
        handleError<{ id: string }>(async (req, res) => {
            const game = await gameService.getGame(req.userId, req.params.id);

            if (!game) {
                res.status(404).json({ error: 'Game not found' });
                return;
            }

            res.json(game);
        }),
    );

    return router;
};
