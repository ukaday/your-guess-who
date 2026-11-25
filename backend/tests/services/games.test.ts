import { describe, expect, it, vi } from 'vitest';
import {
    createGame,
    joinGame,
    getGame,
    createGameService,
    startGame,
} from '../../src/services/games.js';

const makeTx = () => ({
    game: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    gamePlayer: { update: vi.fn() },
});

type Tx = ReturnType<typeof makeTx>;

type UpdateArgs = { data: { status: string; activePlayerId: string } };

type DealArgs = {
    where: { gameId_userId: { userId: string } };
    data: { secretCardId: string };
};

const makePrisma = () => ({
    deck: { findFirst: vi.fn() },
    game: { create: vi.fn(), findFirst: vi.fn() },
    gamePlayer: { create: vi.fn() },
});

const makeTransactionPrisma = (tx: Tx) => ({
    $transaction: vi.fn((callback: (tx: Tx) => unknown) => callback(tx)),
});

const USER_ID = 'user-123';
const OTHER_USER_ID = 'user-456';
const DECK_ID = 'deck-abc';
const GAME_ID = 'game-xyz';

const makeActiveGameRow = () => ({
    id: GAME_ID,
    inviteCode: 'ABC123',
    status: 'ACTIVE',
    deckId: DECK_ID,
    activePlayerId: USER_ID,
    winnerId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    players: [
        { gameId: GAME_ID, userId: USER_ID, secretCardId: 'card-1' },
        { gameId: GAME_ID, userId: OTHER_USER_ID, secretCardId: 'card-2' },
    ],
    deck: {
        cards: [
            { id: 'card-1', name: 'Alice', imageKey: 'img/a', deckId: DECK_ID },
        ],
    },
});

const makeLobbyGameRow = () => ({
    id: GAME_ID,
    inviteCode: 'ABC123',
    status: 'LOBBY',
    deckId: DECK_ID,
    activePlayerId: null,
    winnerId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    players: [
        { gameId: GAME_ID, userId: USER_ID, secretCardId: null },
        { gameId: GAME_ID, userId: OTHER_USER_ID, secretCardId: null },
    ],
    deck: {
        cards: [
            { id: 'card-1', name: 'Alice', imageKey: 'img/a', deckId: DECK_ID },
            { id: 'card-2', name: 'Bob', imageKey: 'img/b', deckId: DECK_ID },
        ],
    },
});

describe('createGame', () => {
    it('returns only the invite details of the created game', async () => {
        const prisma = makePrisma();
        const game = {
            id: GAME_ID,
            inviteCode: 'ABC123',
            status: 'LOBBY',
            deckId: DECK_ID,
            winnerId: null,
        };
        prisma.deck.findFirst.mockResolvedValueOnce({ id: DECK_ID });
        prisma.game.create.mockResolvedValueOnce(game);

        const result = await createGame(prisma as never, USER_ID, DECK_ID);

        expect(result).toStrictEqual({
            id: GAME_ID,
            inviteCode: 'ABC123',
            status: 'LOBBY',
        });
    });

    it('returns null when deck not found or not owned', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce(null);

        const result = await createGame(prisma as never, USER_ID, DECK_ID);

        expect(result).toBeNull();
    });

    it('does not create game when deck not found', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce(null);

        await createGame(prisma as never, USER_ID, DECK_ID);

        expect(prisma.game.create).not.toHaveBeenCalled();
    });

    it('creates game with LOBBY status and creator as player', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce({ id: DECK_ID });
        prisma.game.create.mockResolvedValueOnce({});

        await createGame(prisma as never, USER_ID, DECK_ID);

        expect(prisma.game.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                status: 'LOBBY',
                deckId: DECK_ID,
                players: { create: { userId: USER_ID } },
            }) as unknown,
        });
    });

    it('creates game with a 6-character invite code', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce({ id: DECK_ID });
        prisma.game.create.mockResolvedValueOnce({});

        await createGame(prisma as never, USER_ID, DECK_ID);

        const callArg = (prisma.game.create as ReturnType<typeof vi.fn>).mock
            .calls[0] as [{ data: { inviteCode: string } }];
        expect(callArg[0].data.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockRejectedValueOnce(new Error('db error'));

        await expect(
            createGame(prisma as never, USER_ID, DECK_ID),
        ).rejects.toThrow('db error');
    });
});

describe('joinGame', () => {
    it('returns only the game id when joined successfully', async () => {
        const prisma = makePrisma();
        const gamePlayer = {
            gameId: GAME_ID,
            userId: OTHER_USER_ID,
            secretCardId: null,
        };
        prisma.game.findFirst.mockResolvedValueOnce({
            id: GAME_ID,
            status: 'LOBBY',
            players: [{ userId: USER_ID }],
        });
        prisma.gamePlayer.create.mockResolvedValueOnce(gamePlayer);

        const result = await joinGame(prisma as never, OTHER_USER_ID, 'ABC123');

        expect(result).toStrictEqual({ gameId: GAME_ID });
    });

    it('returns null when game not found', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce(null);

        const result = await joinGame(prisma as never, USER_ID, 'NOPE00');

        expect(result).toBeNull();
    });

    it('returns null when user already in game', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce({
            id: GAME_ID,
            status: 'LOBBY',
            players: [{ userId: USER_ID }],
        });

        const result = await joinGame(prisma as never, USER_ID, 'ABC123');

        expect(result).toBeNull();
    });

    it('returns null when game already has two players', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce({
            id: GAME_ID,
            status: 'LOBBY',
            players: [{ userId: USER_ID }, { userId: OTHER_USER_ID }],
        });

        const result = await joinGame(prisma as never, 'user-999', 'ABC123');

        expect(result).toBeNull();
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockRejectedValueOnce(new Error('db error'));

        await expect(
            joinGame(prisma as never, USER_ID, 'ABC123'),
        ).rejects.toThrow('db error');
    });
});

describe('getGame', () => {
    it('returns the game view when user is a player', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce(makeActiveGameRow());

        const result = await getGame(prisma as never, USER_ID, GAME_ID);

        expect(result).toStrictEqual({
            id: GAME_ID,
            status: 'ACTIVE',
            activePlayerId: USER_ID,
            players: [{ userId: USER_ID }, { userId: OTHER_USER_ID }],
            deck: { cards: [{ id: 'card-1', name: 'Alice' }] },
            yourSecretCardId: 'card-1',
            winnerId: null,
        });
    });

    it('never returns the opponent secret card in an ACTIVE game', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce(makeActiveGameRow());

        const result = await getGame(prisma as never, USER_ID, GAME_ID);

        expect(JSON.stringify(result)).not.toContain('card-2');
    });

    it('returns null when game not found or user not a player', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce(null);

        const result = await getGame(prisma as never, USER_ID, GAME_ID);

        expect(result).toBeNull();
    });

    it('queries by gameId and player userId', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce(null);

        await getGame(prisma as never, USER_ID, GAME_ID);

        expect(prisma.game.findFirst).toHaveBeenCalledWith({
            where: { id: GAME_ID, players: { some: { userId: USER_ID } } },
            include: expect.any(Object) as unknown,
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockRejectedValueOnce(new Error('db error'));

        await expect(
            getGame(prisma as never, USER_ID, GAME_ID),
        ).rejects.toThrow('db error');
    });
});

describe('startGame', () => {
    const LOBBY_CARD_IDS = ['card-1', 'card-2'];

    const dealtCards = (tx: Tx) =>
        tx.gamePlayer.update.mock.calls.map(([args]) => ({
            userId: (args as DealArgs).where.gameId_userId.userId,
            secretCardId: (args as DealArgs).data.secretCardId,
        }));

    it('updates the game only where the status is LOBBY', async () => {
        const tx = makeTx();
        const prisma = makeTransactionPrisma(tx);

        await startGame(prisma as never, makeLobbyGameRow() as never);

        expect(tx.game.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: GAME_ID, status: 'LOBBY' },
            }),
        );
    });

    it('sets the game ACTIVE with one of its players to move first', async () => {
        const tx = makeTx();
        const prisma = makeTransactionPrisma(tx);

        await startGame(prisma as never, makeLobbyGameRow() as never);

        const [[args]] = tx.game.updateMany.mock.calls as [[UpdateArgs]];

        expect(args.data.status).toBe('ACTIVE');
        expect([USER_ID, OTHER_USER_ID]).toContain(args.data.activePlayerId);
    });

    it('returns true and deals each player a distinct deck card when it wins the start', async () => {
        const tx = makeTx();
        const prisma = makeTransactionPrisma(tx);

        const started = await startGame(
            prisma as never,
            makeLobbyGameRow() as never,
        );

        const dealt = dealtCards(tx);

        expect(started).toBe(true);
        expect(dealt.map((deal) => deal.userId)).toEqual([
            USER_ID,
            OTHER_USER_ID,
        ]);
        expect(LOBBY_CARD_IDS).toContain(dealt[0]!.secretCardId);
        expect(LOBBY_CARD_IDS).toContain(dealt[1]!.secretCardId);
        expect(dealt[0]!.secretCardId).not.toBe(dealt[1]!.secretCardId);
    });

    it('returns false and deals no cards when the game already started', async () => {
        const tx = makeTx();
        tx.game.updateMany.mockResolvedValueOnce({ count: 0 });
        const prisma = makeTransactionPrisma(tx);

        const started = await startGame(
            prisma as never,
            makeLobbyGameRow() as never,
        );

        expect(started).toBe(false);
        expect(tx.gamePlayer.update).not.toHaveBeenCalled();
    });

    it('rejects when dealing a card fails so the transaction rolls back', async () => {
        const tx = makeTx();
        tx.gamePlayer.update.mockRejectedValueOnce(new Error('db error'));
        const prisma = makeTransactionPrisma(tx);

        await expect(
            startGame(prisma as never, makeLobbyGameRow() as never),
        ).rejects.toThrow('db error');
    });
});

describe('createGameService', () => {
    it('createGame delegates to createGame fn', async () => {
        const prisma = makePrisma();
        prisma.deck.findFirst.mockResolvedValueOnce({ id: DECK_ID });
        prisma.game.create.mockResolvedValueOnce({
            id: GAME_ID,
            inviteCode: 'ABC123',
            status: 'LOBBY',
        });

        const result = await createGameService(prisma as never).createGame(
            USER_ID,
            DECK_ID,
        );

        expect(result?.id).toBe(GAME_ID);
    });

    it('joinGame delegates to joinGame fn', async () => {
        const prisma = makePrisma();
        const gamePlayer = {
            gameId: GAME_ID,
            userId: OTHER_USER_ID,
            secretCardId: null,
        };
        prisma.game.findFirst.mockResolvedValueOnce({
            id: GAME_ID,
            status: 'LOBBY',
            players: [{ userId: USER_ID }],
        });
        prisma.gamePlayer.create.mockResolvedValueOnce(gamePlayer);

        const result = await createGameService(prisma as never).joinGame(
            OTHER_USER_ID,
            'ABC123',
        );

        expect(result).toStrictEqual({ gameId: GAME_ID });
    });

    it('getGame delegates to getGame fn', async () => {
        const prisma = makePrisma();
        prisma.game.findFirst.mockResolvedValueOnce(makeActiveGameRow());

        const result = await createGameService(prisma as never).getGame(
            USER_ID,
            GAME_ID,
        );

        expect(result?.id).toBe(GAME_ID);
    });
});
