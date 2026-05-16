import { describe, expect, it, vi } from 'vitest';
import {
    createCard,
    deleteCard,
    createCardService,
} from '../../src/services/cards.js';

const makePrisma = () => ({
    deck: { findFirst: vi.fn() },
    card: { create: vi.fn(), deleteMany: vi.fn() },
});

const USER_ID = 'user-123';
const DECK_ID = 'deck-abc';
const CARD_ID = 'card-xyz';

describe('createCard', () => {
    it('returns created card when deck owned by user', async () => {
        const prisma = makePrisma();
        const card = {
            id: CARD_ID,
            name: 'Alice',
            imageKey: 'key.jpg',
            deckId: DECK_ID,
        };
        prisma.deck.findFirst.mockResolvedValueOnce({ id: DECK_ID });
        prisma.card.create.mockResolvedValueOnce(card);

        const result = await createCard(
            prisma as never,
            USER_ID,
            DECK_ID,
            'Alice',
            'key.jpg',
        );

        expect(result).toBe(card);
    });

    it('returns null when deck not found or not owned', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce(null);

        const result = await createCard(
            prisma as never,
            USER_ID,
            DECK_ID,
            'Alice',
            'key.jpg',
        );

        expect(result).toBeNull();
    });

    it('does not create card when deck not found', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce(null);

        await createCard(prisma as never, USER_ID, DECK_ID, 'Alice', 'key.jpg');

        expect(prisma.card.create).not.toHaveBeenCalled();
    });
});

describe('deleteCard', () => {
    it('returns true when card deleted', async () => {
        const prisma = makePrisma();
        prisma.card.deleteMany.mockResolvedValueOnce({ count: 1 });

        const result = await deleteCard(
            prisma as never,
            USER_ID,
            DECK_ID,
            CARD_ID,
        );

        expect(result).toBe(true);
    });

    it('returns null when card not found or not owned', async () => {
        const prisma = makePrisma();
        prisma.card.deleteMany.mockResolvedValueOnce({ count: 0 });

        const result = await deleteCard(
            prisma as never,
            USER_ID,
            DECK_ID,
            CARD_ID,
        );

        expect(result).toBeNull();
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.card.deleteMany.mockRejectedValueOnce(new Error('db error'));

        await expect(
            deleteCard(prisma as never, USER_ID, DECK_ID, CARD_ID),
        ).rejects.toThrow('db error');
    });
});

describe('createCardService', () => {
    it('createCard delegates to createCard fn', async () => {
        const prisma = makePrisma();
        const card = {
            id: CARD_ID,
            name: 'Alice',
            imageKey: 'key.jpg',
            deckId: DECK_ID,
        };
        prisma.deck.findFirst.mockResolvedValueOnce({ id: DECK_ID });
        prisma.card.create.mockResolvedValueOnce(card);

        const result = await createCardService(prisma as never).createCard(
            USER_ID,
            DECK_ID,
            'Alice',
            'key.jpg',
        );

        expect(result).toBe(card);
    });

    it('deleteCard delegates to deleteCard fn', async () => {
        const prisma = makePrisma();
        prisma.card.deleteMany.mockResolvedValueOnce({ count: 1 });

        const result = await createCardService(prisma as never).deleteCard(
            USER_ID,
            DECK_ID,
            CARD_ID,
        );

        expect(result).toBe(true);
    });
});
