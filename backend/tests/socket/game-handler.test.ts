import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { io as Client, type Socket } from 'socket.io-client';
import { startTestServer } from './helpers/server.js';
import { seedLobbyGame, resetDb } from './helpers/seed.js';
import type {
    ServerEvents,
    ClientEvents,
    GameSnapshotPayload,
    GameYourCardPayload,
    GameErrorPayload,
    GameActivePlayerChangedPayload,
} from '../../src/types/socket.js';

type TestClient = Socket<ServerEvents, ClientEvents>;

async function startTwoPlayerGame(port: number) {
    const seeded = await seedLobbyGame();

    const client1: TestClient = Client(`http://localhost:${port}`, {
        auth: { token: seeded.player1Id },
    });
    const client2: TestClient = Client(`http://localhost:${port}`, {
        auth: { token: seeded.player2Id },
    });

    const started1 = new Promise<GameSnapshotPayload>(function (resolve) {
        client1.once('game:started', resolve);
    });
    const started2 = new Promise<GameSnapshotPayload>(function (resolve) {
        client2.once('game:started', resolve);
    });

    const yourCard1 = new Promise<GameYourCardPayload>(function (resolve) {
        client1.once('game:your-card', resolve);
    });
    const yourCard2 = new Promise<GameYourCardPayload>(function (resolve) {
        client2.once('game:your-card', resolve);
    });

    await client1.emitWithAck('game:join', { gameId: seeded.gameId });
    await client2.emitWithAck('game:join', { gameId: seeded.gameId });

    return {
        client1,
        client2,
        started1,
        started2,
        yourCard1,
        yourCard2,
        seeded,
    };
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

    it('emits game:started with ACTIVE status to both players when second unique player joins', async function () {
        const game = await startTwoPlayerGame(port);

        expect((await game.started1).status).toBe('ACTIVE');
        expect((await game.started2).status).toBe('ACTIVE');

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('emits game:your-card with distinct cards to each player when second unique player joins', async function () {
        const game = await startTwoPlayerGame(port);

        const yourCard1 = await game.yourCard1;
        const yourCard2 = await game.yourCard2;

        expect(yourCard1.cardId).not.toBe(yourCard2.cardId);

        game.client1.disconnect();
        game.client2.disconnect();
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

describe('game:eliminate', function () {
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

    it('emits game:active-player-changed with opponent as new activePlayerId after eliminate', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.started1;

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

        activeClient.emit('game:eliminate');

        const result = await activePlayerChanged;

        expect(result.activePlayerId).toBe(inactivePlayerId);

        game.client1.disconnect();
        game.client2.disconnect();
    });

    it('emits game:error when non-active player tries to eliminate', async function () {
        const game = await startTwoPlayerGame(port);

        const state = await game.started1;

        const noneActiveClient =
            state.activePlayerId === game.seeded.player1Id
                ? game.client2
                : game.client1;

        const gameError = new Promise<GameErrorPayload>(function (resolve) {
            noneActiveClient.once('game:error', resolve);
        });

        noneActiveClient.emit('game:eliminate');

        const result = await gameError;

        expect(result.message).toBe('Not your turn');

        game.client1.disconnect();
        game.client2.disconnect();
    });
});
