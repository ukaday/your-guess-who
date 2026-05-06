import { describe, expect, it, vi } from 'vitest';
import {
    createDeck,
    createDeckService,
    deleteDeck,
    getDeck,
    listDecks,
    renameDeck,
} from '../../src/services/decks.js';

const makePrisma = () => ({
    deck: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
    },
});

const USER_ID = 'user-123';
const DECK_ID = 'deck-456';

describe('listDecks', () => {
    it('returns decks for user', async () => {
        const prisma = makePrisma();
        const decks = [{ id: DECK_ID, name: 'My Deck', ownerId: USER_ID }];
        prisma.deck.findMany.mockResolvedValueOnce(decks);

        const result = await listDecks(prisma as never, USER_ID);

        expect(result).toBe(decks);
    });

    it('queries by ownerId', async () => {
        const prisma = makePrisma();
        prisma.deck.findMany.mockResolvedValueOnce([]);

        await listDecks(prisma as never, USER_ID);

        expect(prisma.deck.findMany).toHaveBeenCalledWith({
            where: { ownerId: USER_ID },
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.deck.findMany.mockRejectedValueOnce(new Error('db error'));

        await expect(listDecks(prisma as never, USER_ID)).rejects.toThrow(
            'db error',
        );
    });
});

describe('createDeck', () => {
    it('returns created deck', async () => {
        const prisma = makePrisma();
        const deck = { id: DECK_ID, name: 'New Deck', ownerId: USER_ID };
        prisma.deck.create.mockResolvedValueOnce(deck);

        const result = await createDeck(prisma as never, USER_ID, 'New Deck');

        expect(result).toBe(deck);
    });

    it('creates deck with name and ownerId', async () => {
        const prisma = makePrisma();
        prisma.deck.create.mockResolvedValueOnce({});

        await createDeck(prisma as never, USER_ID, 'New Deck');

        expect(prisma.deck.create).toHaveBeenCalledWith({
            data: { name: 'New Deck', ownerId: USER_ID },
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.deck.create.mockRejectedValueOnce(new Error('db error'));

        await expect(
            createDeck(prisma as never, USER_ID, 'New Deck'),
        ).rejects.toThrow('db error');
    });
});

describe('getDeck', () => {
    it('returns deck with cards when found', async () => {
        const prisma = makePrisma();
        const deck = {
            id: DECK_ID,
            name: 'My Deck',
            ownerId: USER_ID,
            cards: [],
        };
        prisma.deck.findFirst.mockResolvedValueOnce(deck);

        const result = await getDeck(prisma as never, USER_ID, DECK_ID);

        expect(result).toBe(deck);
    });

    it('returns null when deck not found', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce(null);

        const result = await getDeck(prisma as never, USER_ID, DECK_ID);

        expect(result).toBeNull();
    });

    it('queries by id and ownerId with cards included', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce(null);

        await getDeck(prisma as never, USER_ID, DECK_ID);

        expect(prisma.deck.findFirst).toHaveBeenCalledWith({
            where: { id: DECK_ID, ownerId: USER_ID },
            include: { cards: true },
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockRejectedValueOnce(new Error('db error'));

        await expect(
            getDeck(prisma as never, USER_ID, DECK_ID),
        ).rejects.toThrow('db error');
    });
});

describe('renameDeck', () => {
    it('returns true when deck renamed', async () => {
        const prisma = makePrisma();
        prisma.deck.updateMany.mockResolvedValueOnce({ count: 1 });

        const result = await renameDeck(
            prisma as never,
            USER_ID,
            DECK_ID,
            'New Name',
        );

        expect(result).toBe(true);
    });

    it('returns null when deck not found or not owned', async () => {
        const prisma = makePrisma();
        prisma.deck.updateMany.mockResolvedValueOnce({ count: 0 });

        const result = await renameDeck(
            prisma as never,
            USER_ID,
            DECK_ID,
            'New Name',
        );

        expect(result).toBeNull();
    });

    it('updates by id and ownerId', async () => {
        const prisma = makePrisma();
        prisma.deck.updateMany.mockResolvedValueOnce({ count: 1 });

        await renameDeck(prisma as never, USER_ID, DECK_ID, 'New Name');

        expect(prisma.deck.updateMany).toHaveBeenCalledWith({
            where: { id: DECK_ID, ownerId: USER_ID },
            data: { name: 'New Name' },
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.deck.updateMany.mockRejectedValueOnce(new Error('db error'));

        await expect(
            renameDeck(prisma as never, USER_ID, DECK_ID, 'New Name'),
        ).rejects.toThrow('db error');
    });
});

describe('deleteDeck', () => {
    it('returns true when deck deleted', async () => {
        const prisma = makePrisma();
        prisma.deck.deleteMany.mockResolvedValueOnce({ count: 1 });

        const result = await deleteDeck(prisma as never, USER_ID, DECK_ID);

        expect(result).toBe(true);
    });

    it('returns null when deck not found or not owned', async () => {
        const prisma = makePrisma();
        prisma.deck.deleteMany.mockResolvedValueOnce({ count: 0 });

        const result = await deleteDeck(prisma as never, USER_ID, DECK_ID);

        expect(result).toBeNull();
    });

    it('deletes by id and ownerId', async () => {
        const prisma = makePrisma();
        prisma.deck.deleteMany.mockResolvedValueOnce({ count: 1 });

        await deleteDeck(prisma as never, USER_ID, DECK_ID);

        expect(prisma.deck.deleteMany).toHaveBeenCalledWith({
            where: { id: DECK_ID, ownerId: USER_ID },
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.deck.deleteMany.mockRejectedValueOnce(new Error('db error'));

        await expect(
            deleteDeck(prisma as never, USER_ID, DECK_ID),
        ).rejects.toThrow('db error');
    });
});

describe('createDeckService', () => {
    it('listDecks delegates to listDecks fn', async () => {
        const prisma = makePrisma();
        const decks = [{ id: DECK_ID, name: 'My Deck', ownerId: USER_ID }];
        prisma.deck.findMany.mockResolvedValueOnce(decks);

        const result = await createDeckService(prisma as never).listDecks(USER_ID);

        expect(result).toBe(decks);
    });

    it('createDeck delegates to createDeck fn', async () => {
        const prisma = makePrisma();
        const deck = { id: DECK_ID, name: 'New Deck', ownerId: USER_ID };
        prisma.deck.create.mockResolvedValueOnce(deck);

        const result = await createDeckService(prisma as never).createDeck(USER_ID, 'New Deck');

        expect(result).toBe(deck);
    });

    it('getDeck delegates to getDeck fn', async () => {
        const prisma = makePrisma();
        const deck = { id: DECK_ID, name: 'My Deck', ownerId: USER_ID, cards: [] };
        prisma.deck.findFirst.mockResolvedValueOnce(deck);

        const result = await createDeckService(prisma as never).getDeck(USER_ID, DECK_ID);

        expect(result).toBe(deck);
    });

    it('renameDeck delegates to renameDeck fn', async () => {
        const prisma = makePrisma();
        prisma.deck.updateMany.mockResolvedValueOnce({ count: 1 });

        const result = await createDeckService(prisma as never).renameDeck(USER_ID, DECK_ID, 'New Name');

        expect(result).toBe(true);
    });

    it('deleteDeck delegates to deleteDeck fn', async () => {
        const prisma = makePrisma();
        prisma.deck.deleteMany.mockResolvedValueOnce({ count: 1 });

        const result = await createDeckService(prisma as never).deleteDeck(USER_ID, DECK_ID);

        expect(result).toBe(true);
    });
});
