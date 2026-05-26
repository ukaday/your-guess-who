import type { PrismaClient, Card } from '../generated/prisma/client.js';
import type {
    GameSocket,
    GameServer,
    GameJoinPayload,
    GameRemoteSocket,
    GameSnapshotPayload,
} from '../types/socket.js';
import { selectSecretCards, pickFirstPlayer } from '../services/game-logic.js';

export function registerGameHandlers(
    io: GameServer,
    socket: GameSocket,
    prisma: PrismaClient,
) {
    socket.on('game:join', (payload) =>
        onGameJoin(io, socket, prisma, payload),
    );
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

    if (!game.players.some((p) => p.userId === socket.data.userId)) {
        socket.emit('game:error', { message: 'Game not found' });

        return;
    }

    const roomName = `game:${game.id}`;
    await socket.join(roomName);

    const socketsInRoom = await io.in(roomName).fetchSockets();

    if (game.status === 'ACTIVE') {
        const player = game.players.find(
            (p) => p.userId === socket.data.userId,
        )!;

        socket.emit('game:your-card', { cardId: player.secretCardId! });

        return;
    }

    if (socketsInRoom.length < 2) {
        return;
    }

    await startGame(io, prisma, game, socketsInRoom, roomName);
}

async function startGame(
    io: GameServer,
    prisma: PrismaClient,
    game: GameSnapshotPayload & { deck: { cards: Card[] } },
    socketsInRoom: GameRemoteSocket[],
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
