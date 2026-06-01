import type {
    PrismaClient,
    Card,
    GamePlayer,
} from '../generated/prisma/client.js';
import type {
    GameSocket,
    GameServer,
    GameJoinPayload,
    GameRemoteSocket,
    GameSnapshotPayload,
} from '../types/socket.js';
import {
    selectSecretCards,
    pickFirstPlayer,
    decideJoinOutcome,
    decideEliminateOutcome,
} from '../services/game-logic.js';

export function registerGameHandlers(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
) {
    socket.on('game:join', (payload, ack) => {
        void onGameJoin(io, socket, prisma, payload).then(() => ack?.());
    });

    socket.on('game:eliminate', function () {
        void onGameEliminate(io, socket, prisma);
    });
}

async function onGameJoin(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
    payload: GameJoinPayload,
) {
    const game = await prisma.game.findUnique({
        where: { id: payload.gameId },
        include: { players: true, deck: { include: { cards: true } } },
    });

    if (!game) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const roomName = `game:${game.id}`;
    const socketsInRoom = await io.in(roomName).fetchSockets();
    const userIdsInRoom = socketsInRoom.map((s) => s.data.userId);

    const outcome = decideJoinOutcome(game, socket.data.userId, userIdsInRoom);

    if (outcome.type === 'REJECT') {
        socket.emit('game:error', { message: outcome.message });

        return;
    }

    await socket.join(roomName);
    socket.data.gameId = game.id;

    if (outcome.type === 'REVEAL_CARD') {
        socket.emit('game:your-card', { cardId: outcome.cardId });

        return;
    }

    if (outcome.type === 'WAIT') {
        return;
    }

    await startGame(io, prisma, game, roomName);
}

async function startGame(
    io: GameServer,
    prisma: PrismaClient,
    game: GameSnapshotPayload & { deck: { cards: Card[] } },
    roomName: string,
) {
    const [card1, card2] = selectSecretCards(game.deck.cards);
    const playerIds = game.players.map((p) => p.userId);
    const firstPlayerId = pickFirstPlayer(playerIds);

    await activateGame(prisma, game.id, firstPlayerId, playerIds, card1, card2);

    io.to(roomName).emit('game:started', {
        ...game,
        status: 'ACTIVE' as const,
        activePlayerId: firstPlayerId,
        winnerId: null,
        players: game.players,
    });

    const socketsInRoom = await io.in(roomName).fetchSockets();

    emitSecretCards(socketsInRoom, playerIds, card1, card2);
}

async function activateGame(
    prisma: PrismaClient,
    gameId: string,
    firstPlayerId: string,
    playerIds: string[],
    card1: Card,
    card2: Card,
) {
    await prisma.game.update({
        where: { id: gameId },
        data: { status: 'ACTIVE', activePlayerId: firstPlayerId },
    });

    await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: playerIds[0]! } },
        data: { secretCardId: card1.id },
    });

    await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: playerIds[1]! } },
        data: { secretCardId: card2.id },
    });
}

function emitSecretCards(
    socketsInRoom: GameRemoteSocket[],
    playerIds: string[],
    card1: Card,
    card2: Card,
) {
    socketsInRoom.forEach((s) => {
        const cardId = s.data.userId === playerIds[0] ? card1.id : card2.id;

        s.emit('game:your-card', { cardId });
    });
}

async function onGameEliminate(
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
    const outcome = decideEliminateOutcome(
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
