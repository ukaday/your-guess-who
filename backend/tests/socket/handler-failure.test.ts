import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterAll,
    beforeEach,
} from 'vitest';
import { io as Client, type Socket } from 'socket.io-client';
import { startTestServer } from './helpers/server.js';
import { INTERNAL_ERROR_MESSAGE } from '../../src/socket/guard-handler.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type * as GameLogic from '../../src/services/game-logic.js';
import type {
    ServerEvents,
    ClientEvents,
    GameErrorPayload,
} from '../../src/types/socket.js';

type TestClient = Socket<ServerEvents, ClientEvents>;

const startFailure = vi.hoisted(() => new Error('cannot pick secret cards'));

vi.mock('../../src/services/game-logic.js', async (importOriginal) => ({
    ...(await importOriginal<typeof GameLogic>()),
    selectSecretCards: vi.fn(() => {
        throw startFailure;
    }),
}));

const failure = new Error('db down');
const findUnique = vi.fn();
const stubPrisma = { game: { findUnique } } as unknown as PrismaClient;
const logger = vi.fn();

const lobbyGame = {
    id: 'game-1',
    status: 'LOBBY',
    activePlayerId: null,
    winnerId: null,
    players: [
        { userId: 'user-1', secretCardId: null },
        { userId: 'user-2', secretCardId: null },
    ],
    deck: { cards: [] },
};

const failingEmits = [
    {
        event: 'game:join',
        emit: (client: TestClient) =>
            client.emit('game:join', { gameId: 'game-1' }),
    },
    {
        event: 'game:eliminate',
        emit: (client: TestClient) => client.emit('game:eliminate'),
    },
    {
        event: 'game:guess',
        emit: (client: TestClient) =>
            client.emit('game:guess', { cardId: 'card-1' }),
    },
];

function connectClient(port: number, userId = 'user-1'): TestClient {
    return Client(`http://localhost:${port}`, {
        auth: { token: userId, gameId: 'game-1' },
    });
}

function nextError(client: TestClient): Promise<GameErrorPayload> {
    return new Promise<GameErrorPayload>(function (resolve) {
        client.once('game:error', resolve);
    });
}

describe('handler failure', function () {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async function () {
        ({ port, close } = await startTestServer({
            prisma: stubPrisma,
            logger,
        }));
    });

    afterAll(async function () {
        await close();
    });

    beforeEach(function () {
        logger.mockClear();
        findUnique.mockReset();
        findUnique.mockRejectedValue(failure);
    });

    it.each(failingEmits)(
        '$event emits game:error and logs the failure when the handler rejects',
        async function ({ emit }) {
            const client = connectClient(port);
            const errorReceived = nextError(client);

            emit(client);

            const error = await errorReceived;

            expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
            expect(logger).toHaveBeenCalledWith(failure);

            client.disconnect();
        },
    );

    it('game:join still acks when the handler rejects', async function () {
        const client = connectClient(port);

        await client.emitWithAck('game:join', { gameId: 'game-1' });

        expect(logger).toHaveBeenCalledWith(failure);

        client.disconnect();
    });

    it('keeps serving the same socket after a handler rejects', async function () {
        findUnique.mockRejectedValueOnce(failure).mockResolvedValueOnce(null);

        const client = connectClient(port);
        const firstError = nextError(client);

        client.emit('game:join', { gameId: 'game-1' });

        expect((await firstError).message).toBe(INTERNAL_ERROR_MESSAGE);

        const secondError = nextError(client);

        client.emit('game:join', { gameId: 'game-1' });

        expect((await secondError).message).toBe('Game not found');
        expect(logger).toHaveBeenCalledTimes(1);

        client.disconnect();
    });

    it('game:join emits game:error, logs the failure and still acks when starting the game throws', async function () {
        findUnique.mockResolvedValue(lobbyGame);

        const waiting = connectClient(port, 'user-1');
        const joining = connectClient(port, 'user-2');

        await waiting.emitWithAck('game:join', { gameId: 'game-1' });

        const errorReceived = nextError(joining);

        await joining.emitWithAck('game:join', { gameId: 'game-1' });

        expect((await errorReceived).message).toBe(INTERNAL_ERROR_MESSAGE);
        expect(logger).toHaveBeenCalledTimes(1);
        expect(logger).toHaveBeenCalledWith(startFailure);
        expect(waiting.connected).toBe(true);

        waiting.disconnect();
        joining.disconnect();
    });
});
