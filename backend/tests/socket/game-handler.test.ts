import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { io as Client, type Socket } from 'socket.io-client';
import { startTestServer } from './helpers/server.js';
import { seedLobbyGame, resetDb } from './helpers/seed.js';
import { prisma } from '../../src/lib/db.js';
import { startGame } from '../../src/services/games.js';
import type {
    ServerEvents,
    ClientEvents,
    GameView,
    GameErrorPayload,
    GameActivePlayerChangedPayload,
    GameGuessWrongPayload,
    GameOverPayload,
} from '@your-guess-who/contract';

type TestClient = Socket<ServerEvents, ClientEvents>;

function connectClient(port: number, userId: string): TestClient {
    return Client(`http://localhost:${port}`, { auth: { token: userId } });
}

function nextState(client: TestClient): Promise<GameView> {
    return new Promise<GameView>(function (resolve) {
        client.once('game:state', resolve);
    });
}

function nextActiveState(client: TestClient): Promise<GameView> {
    return new Promise<GameView>(function (resolve) {
        const onState = function (state: GameView) {
            if (state.status !== 'ACTIVE') {
                return;
            }

            client.off('game:state', onState);
            resolve(state);
        };

        client.on('game:state', onState);
    });
}

async function startTwoPlayerGame(port: number) {
    const seeded = await seedLobbyGame();

    const client1 = connectClient(port, seeded.player1Id);
    const client2 = connectClient(port, seeded.player2Id);

    const state1 = nextActiveState(client1);
    const state2 = nextActiveState(client2);

    await client1.emitWithAck('game:join', { gameId: seeded.gameId });
    await client2.emitWithAck('game:join', { gameId: seeded.gameId });

    return { client1, client2, state1, state2, seeded };
}

describe('game:join', function () {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async function () {
        ({ port, close } = await startTestServer());
    });

    afterAll(async function () {
        await close();
    });

    afterEach(async function () {
        await resetDb();
    });

    it('sends a lone joiner a LOBBY game:state with no secret card', async function () {
        const seeded = await seedLobbyGame();
        const client = connectClient(port, seeded.player1Id);
        const state = nextState(client);

        await client.emitWithAck('game:join', { gameId: seeded.gameId });

        expect(await state).toMatchObject({
            id: seeded.gameId,
            status: 'LOBBY',
            activePlayerId: null,
            yourSecretCardId: null,
            winnerId: null,
        });

        client.disconnect();
    });

    it('does not start the game while only one player is connected', async function () {
        const seeded = await seedLobbyGame();
        const client = connectClient(port, seeded.player1Id);

        await client.emitWithAck('game:join', { gameId: seeded.gameId });

        const game = await prisma.game.findUniqueOrThrow({
            where: { id: seeded.gameId },
        });

        expect(game.status).toBe('LOBBY');

        client.disconnect();
    });

    it('sends both players an ACTIVE game:state when the second player joins', async function () {
        const game = await startTwoPlayerGame(port);

        const state1 = await game.state1;
        const state2 = await game.state2;

        expect(state1.status).toBe('ACTIVE');
        expect(state2.status).toBe('ACTIVE');
        expect(state1.activePlayerId).toBe(state2.activePlayerId);

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('gives each player their own distinct secret card', async function () {
        const game = await startTwoPlayerGame(port);

        const state1 = await game.state1;
        const state2 = await game.state2;
        const players = await prisma.gamePlayer.findMany({
            where: { gameId: game.seeded.gameId },
        });
        const secretCardOf = function (userId: string) {
            return players.find((p) => p.userId === userId)?.secretCardId;
        };

        expect(state1.yourSecretCardId).toBe(
            secretCardOf(game.seeded.player1Id),
        );
        expect(state2.yourSecretCardId).toBe(
            secretCardOf(game.seeded.player2Id),
        );
        expect(state1.yourSecretCardId).not.toBe(state2.yourSecretCardId);

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('starts the game once when both players join at the same moment', async function () {
        const seeded = await seedLobbyGame();
        const client1 = connectClient(port, seeded.player1Id);
        const client2 = connectClient(port, seeded.player2Id);
        const state1 = nextActiveState(client1);
        const state2 = nextActiveState(client2);

        await Promise.all([
            client1.emitWithAck('game:join', { gameId: seeded.gameId }),
            client2.emitWithAck('game:join', { gameId: seeded.gameId }),
        ]);

        const game = await prisma.game.findUniqueOrThrow({
            where: { id: seeded.gameId },
        });

        expect((await state1).activePlayerId).toBe(game.activePlayerId);
        expect((await state2).activePlayerId).toBe(game.activePlayerId);

        client1.disconnect();
        client2.disconnect();
    });

    it('sends a socket joining an ACTIVE game the current state', async function () {
        const game = await startTwoPlayerGame(port);
        const started = await game.state1;

        const refreshed = connectClient(port, game.seeded.player1Id);
        const state = nextState(refreshed);

        await refreshed.emitWithAck('game:join', {
            gameId: game.seeded.gameId,
        });

        expect(await state).toStrictEqual(started);

        refreshed.disconnect();
        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('emits game:error when the user is not a player in the game', async function () {
        const seeded = await seedLobbyGame();
        const client = connectClient(port, 'stranger');

        const errorReceived = new Promise<GameErrorPayload>(function (resolve) {
            client.once('game:error', resolve);
        });

        client.emit('game:join', { gameId: seeded.gameId });

        expect((await errorReceived).message).toBe('Game not found');

        client.disconnect();
    });

    it('emits game:error when the game does not exist', async function () {
        const client: TestClient = Client(`http://localhost:${port}`, {
            auth: { token: 'any-user' },
        });

        const errorReceived = new Promise<GameErrorPayload>(function (resolve) {
            client.once('game:error', resolve);
        });

        client.emit('game:join', { gameId: 'nonexistent-id' });

        const error = await errorReceived;

        expect(error.message).toBe('Game not found');

        client.disconnect();
    });
});

describe('game:end-turn', function () {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async function () {
        ({ port, close } = await startTestServer());
    });

    afterAll(async function () {
        await close();
    });

    afterEach(async function () {
        await resetDb();
    });

    it('emits game:active-player-changed with opponent as new activePlayerId after ending turn', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.state1;

        const activeClient =
            state.activePlayerId === game.seeded.player1Id
                ? game.client1
                : game.client2;

        const inactivePlayerId =
            state.activePlayerId === game.seeded.player1Id
                ? game.seeded.player2Id
                : game.seeded.player1Id;

        const activePlayerChanged = new Promise<GameActivePlayerChangedPayload>(
            function (resolve) {
                activeClient.once('game:active-player-changed', resolve);
            },
        );

        activeClient.emit('game:end-turn');

        const result = await activePlayerChanged;

        expect(result.activePlayerId).toBe(inactivePlayerId);

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('emits game:error when non-active player tries to end turn', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.state1;

        const noneActiveClient =
            state.activePlayerId === game.seeded.player1Id
                ? game.client2
                : game.client1;

        const gameError = new Promise<GameErrorPayload>(function (resolve) {
            noneActiveClient.once('game:error', resolve);
        });

        noneActiveClient.emit('game:end-turn');

        const result = await gameError;

        expect(result.message).toBe('Not your turn');

        game.client1.disconnect();
        game.client2.disconnect();
    });
});

describe('game:guess', function () {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async function () {
        ({ port, close } = await startTestServer());
    });

    afterAll(async function () {
        await close();
    });

    afterEach(async function () {
        await resetDb();
    });

    it('emits game:over with active player as winnerId when guess matches opponent secret', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.state1;
        const activePlayerId = state.activePlayerId!;
        const activeClient =
            activePlayerId === game.seeded.player1Id
                ? game.client1
                : game.client2;
        const opponentState =
            activePlayerId === game.seeded.player1Id
                ? await game.state2
                : await game.state1;
        const opponentCardId = opponentState.yourSecretCardId!;

        const gameOver = new Promise<GameOverPayload>(function (resolve) {
            activeClient.once('game:over', resolve);
        });

        activeClient.emit('game:guess', { cardId: opponentCardId });

        const result = await gameOver;

        expect(result.winnerId).toBe(activePlayerId);

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('emits game:guess-wrong with new activePlayerId and guessedCardId when guess is wrong', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.state1;
        const activePlayerId = state.activePlayerId!;
        const activeClient =
            activePlayerId === game.seeded.player1Id
                ? game.client1
                : game.client2;
        const inactivePlayerId =
            activePlayerId === game.seeded.player1Id
                ? game.seeded.player2Id
                : game.seeded.player1Id;
        const ownState =
            activePlayerId === game.seeded.player1Id
                ? await game.state1
                : await game.state2;
        const ownCardId = ownState.yourSecretCardId!;

        const guessWrong = new Promise<GameGuessWrongPayload>(function (
            resolve,
        ) {
            activeClient.once('game:guess-wrong', resolve);
        });

        activeClient.emit('game:guess', { cardId: ownCardId });

        const result = await guessWrong;

        expect(result.activePlayerId).toBe(inactivePlayerId);
        expect(result.guessedCardId).toBe(ownCardId);

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('emits game:error when non-active player tries to guess', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.state1;
        const inactiveClient =
            state.activePlayerId === game.seeded.player1Id
                ? game.client2
                : game.client1;

        const gameError = new Promise<GameErrorPayload>(function (resolve) {
            inactiveClient.once('game:error', resolve);
        });

        inactiveClient.emit('game:guess', { cardId: 'any-card' });

        const result = await gameError;

        expect(result.message).toBe('Not your turn');

        game.client1.disconnect();
        game.client2.disconnect();
    });
});

describe('disconnect / reconnect', function () {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async function () {
        ({ port, close } = await startTestServer());
    });

    afterAll(async function () {
        await close();
    });

    afterEach(async function () {
        await resetDb();
    });

    it('emits game:opponent-disconnected to remaining client when one client disconnects', async function () {
        const game = await startTwoPlayerGame(port);

        await Promise.all([game.state1, game.state2]);

        const opponentDisconnected = new Promise<void>(function (resolve) {
            game.client2.once('game:opponent-disconnected', function () {
                resolve();
            });
        });

        game.client1.disconnect();

        await opponentDisconnected;

        game.client2.disconnect();
    });

    it('emits game:opponent-reconnected to remaining client when player rejoins ACTIVE game', async function () {
        const game = await startTwoPlayerGame(port);

        await Promise.all([game.state1, game.state2]);

        const opponentDisconnected = new Promise<void>(function (resolve) {
            game.client2.once('game:opponent-disconnected', function () {
                resolve();
            });
        });

        game.client1.disconnect();
        await opponentDisconnected;

        const opponentReconnected = new Promise<void>(function (resolve) {
            game.client2.once('game:opponent-reconnected', function () {
                resolve();
            });
        });

        const reconnectClient = connectClient(port, game.seeded.player1Id);

        await reconnectClient.emitWithAck('game:join', {
            gameId: game.seeded.gameId,
        });

        await opponentReconnected;

        reconnectClient.disconnect();
        game.client2.disconnect();
    });
});

describe('startGame against Postgres', function () {
    afterEach(async function () {
        await resetDb();
    });

    it('starts the game exactly once when two starts race', async function () {
        const seeded = await seedLobbyGame();
        const game = await prisma.game.findUniqueOrThrow({
            where: { id: seeded.gameId },
            include: { players: true, deck: { include: { cards: true } } },
        });

        const results = await Promise.all([
            startGame(prisma, game),
            startGame(prisma, game),
        ]);

        const stored = await prisma.game.findUniqueOrThrow({
            where: { id: seeded.gameId },
            include: { players: true },
        });
        const secretCardIds = stored.players.map((p) => p.secretCardId);

        expect(results.filter(Boolean)).toHaveLength(1);
        expect(stored.status).toBe('ACTIVE');
        expect(secretCardIds).not.toContain(null);
        expect(new Set(secretCardIds).size).toBe(2);
    });
});
