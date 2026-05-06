import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createDeckService } from '../services/decks.js';
import { handleError } from '../utils/handle-error.js';

export const createDeckRouter = (
    prisma: PrismaClient,
    authMiddleware: RequestHandler,
) => {
    const router = Router();
    const deckService = createDeckService(prisma);

    router.use(authMiddleware);

    router.get(
        '/',
        handleError(async (req, res) => {
            const decks = await deckService.listDecks(req.userId);

            res.json(decks);
        }),
    );

    router.post(
        '/',
        handleError(async (req, res) => {
            const { name } = req.body as { name: string };

            const deck = await deckService.createDeck(req.userId, name);

            res.status(201).json(deck);
        }),
    );

    router.get(
        '/:id',
        handleError<{ id: string }>(async (req, res) => {
            const deck = await deckService.getDeck(req.userId, req.params.id);

            if (!deck) {
                res.status(404).json({ error: 'Deck not found' });
                return;
            }

            res.json(deck);
        }),
    );

    router.patch(
        '/:id',
        handleError<{ id: string }>(async (req, res) => {
            const { name } = req.body as { name: string };

            const result = await deckService.renameDeck(
                req.userId,
                req.params.id,
                name,
            );

            if (!result) {
                res.status(404).json({ error: 'Deck not found' });
                return;
            }

            res.status(204).send();
        }),
    );

    router.delete(
        '/:id',
        handleError<{ id: string }>(async (req, res) => {
            const result = await deckService.deleteDeck(
                req.userId,
                req.params.id,
            );

            if (!result) {
                res.status(404).json({ error: 'Deck not found' });
                return;
            }

            res.status(204).send();
        }),
    );

    return router;
};
