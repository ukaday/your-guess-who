import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createCardService } from '../services/cards.js';
import { handleError } from '../utils/handle-error.js';

export const createCardRouter = (
    prisma: PrismaClient,
    authMiddleware: RequestHandler,
) => {
    const router = Router({ mergeParams: true });
    const cardService = createCardService(prisma);

    router.use(authMiddleware);

    router.post(
        '/:deckId/cards',
        handleError<{ deckId: string }>(async (req, res) => {
            const { name, imageKey } = req.body as {
                name: string;
                imageKey: string;
            };

            const card = await cardService.createCard(
                req.userId,
                req.params.deckId,
                name,
                imageKey,
            );

            if (!card) {
                res.status(404).json({ error: 'Deck not found' });
                return;
            }

            res.status(201).json(card);
        }),
    );

    router.delete(
        '/:deckId/cards/:cardId',
        handleError<{ deckId: string; cardId: string }>(async (req, res) => {
            const result = await cardService.deleteCard(
                req.userId,
                req.params.deckId,
                req.params.cardId,
            );

            if (!result) {
                res.status(404).json({ error: 'Card not found' });
                return;
            }

            res.status(204).send();
        }),
    );

    return router;
};
