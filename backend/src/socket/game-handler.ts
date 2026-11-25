import type { PrismaClient, GamePlayer } from '../generated/prisma/client.js';
import type {
    GameJoinPayload,
    GameGuessPayload,
} from '@your-guess-who/contract';
import type { GameSocket, GameServer } from '../types/socket.js';
import {
    decideJoinOutcome,
    shouldStartGame,
    decideEndTurnOutcome,
    decideGuessOutcome,
} from '../services/game-logic.js';
import { startGame } from '../services/games.js';
import type { GameWithPlayersAndDeck } from '../payloads/game-started-payload.js';
import { toGameView } from '../payloads/game-view.js';
import { createHandlerGuard, type ErrorLogger } from './guard-handler.js';

const GAME_WITH_PLAYERS_AND_DECK = {
    players: true,
    deck: { include: { cards: true } },
} as const;

export function registerGameHandlers(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
    logger: ErrorLogger,
) {
    const guard = createHandlerGuard(socket, logger);

    socket.on('game:join', (payload, ack) => {
        void guard(() => onGameJoin(io, socket, prisma, payload), ack);
    });

    socket.on('game:end-turn', function () {
        void guard(() => onGameEndTurn(io, socket, prisma));
    });

    socket.on('game:guess', function (payload) {
        void guard(() => onGameGuess(io, socket, prisma, payload));
    });

    socket.on('disconnect', function () {
        onSocketDisconnect(socket);
    });
}

async function onGameJoin(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
    payload: GameJoinPayload,
) {
    const game = await findGameWithPlayersAndDeck(prisma, payload.gameId);

    if (!game) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const outcome = decideJoinOutcome(game, socket.data.userId);

    if (outcome.type === 'REJECT') {
        socket.emit('game:error', { message: outcome.message });

        return;
    }

    const roomName = `game:${game.id}`;

    await socket.join(roomName);
    socket.data.gameId = game.id;
    socket.emit('game:state', toGameView(game, socket.data.userId));

    if (game.status === 'ACTIVE') {
        socket.to(roomName).emit('game:opponent-reconnected');
    }

    await tryStartGame(io, prisma, game, roomName);
}

async function tryStartGame(
    io: GameServer,
    prisma: PrismaClient,
    game: GameWithPlayersAndDeck,
    roomName: string,
) {
    const socketsInRoom = await io.in(roomName).fetchSockets();
    const userIdsInRoom = socketsInRoom.map((s) => s.data.userId);

    if (!shouldStartGame(game, userIdsInRoom)) {
        return;
    }

    const started = await startGame(prisma, game);

    if (!started) {
        return;
    }

    await emitStateToRoom(io, prisma, game.id, roomName);
}

async function emitStateToRoom(
    io: GameServer,
    prisma: PrismaClient,
    gameId: string,
    roomName: string,
) {
    const game = await prisma.game.findUniqueOrThrow({
        where: { id: gameId },
        include: GAME_WITH_PLAYERS_AND_DECK,
    });
    const socketsInRoom = await io.in(roomName).fetchSockets();

    socketsInRoom.forEach((s) => {
        s.emit('game:state', toGameView(game, s.data.userId));
    });
}

async function onGameEndTurn(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
) {
    const gameId = socket.data.gameId;

    if (!gameId) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
    });

    if (!game) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const players = game.players as [GamePlayer, GamePlayer];
    const outcome = decideEndTurnOutcome(
        {
            status: game.status,
            activePlayerId: game.activePlayerId,
            players,
        },
        socket.data.userId,
    );

    if (outcome.type === 'REJECT') {
        socket.emit('game:error', { message: outcome.message });

        return;
    }

    await prisma.game.update({
        where: { id: gameId },
        data: { activePlayerId: outcome.nextActivePlayerId },
    });

    io.to(`game:${game.id}`).emit('game:active-player-changed', {
        activePlayerId: outcome.nextActivePlayerId,
    });
}

async function onGameGuess(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
    payload: GameGuessPayload,
) {
    const gameId = socket.data.gameId;

    if (!gameId) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
    });

    if (!game) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const players = game.players as [GamePlayer, GamePlayer];
    const outcome = decideGuessOutcome(
        {
            status: game.status,
            activePlayerId: game.activePlayerId,
            players,
        },
        socket.data.userId,
        payload.cardId,
    );

    if (outcome.type === 'REJECT') {
        socket.emit('game:error', { message: outcome.message });

        return;
    }

    const roomName = `game:${gameId}`;

    if (outcome.type === 'WIN') {
        await prisma.game.update({
            where: { id: gameId },
            data: { status: 'FINISHED', winnerId: outcome.winnerId },
        });

        io.to(roomName).emit('game:over', { winnerId: outcome.winnerId });

        return;
    }

    await prisma.game.update({
        where: { id: gameId },
        data: { activePlayerId: outcome.nextActivePlayerId },
    });

    io.to(roomName).emit('game:guess-wrong', {
        activePlayerId: outcome.nextActivePlayerId,
        guessedCardId: outcome.guessedCardId,
    });
}

function onSocketDisconnect(socket: GameSocket) {
    const gameId = socket.data.gameId;

    if (!gameId) {
        return;
    }

    socket.to(`game:${gameId}`).emit('game:opponent-disconnected');
}

function findGameWithPlayersAndDeck(prisma: PrismaClient, gameId: string) {
    return prisma.game.findUnique({
        where: { id: gameId },
        include: GAME_WITH_PLAYERS_AND_DECK,
    });
}
