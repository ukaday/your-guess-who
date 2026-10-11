import type { PrismaClient } from '../generated/prisma/client.js';
import { randomUUID } from 'crypto';
import { toGameView } from '../payloads/game-view.js';
import {
    toCreatedGameView,
    toJoinedGameView,
} from '../payloads/lobby-payloads.js';

const INVITE_CODE_LENGTH = 6;

const generateInviteCode = () =>
    randomUUID().replace(/-/g, '').slice(0, INVITE_CODE_LENGTH).toUpperCase();

export const createGame = async (
    prisma: PrismaClient,
    userId: string,
    deckId: string,
) => {
    const deck = await prisma.deck.findFirst({
        where: { id: deckId, ownerId: userId },
    });

    if (!deck) return null;

    const game = await prisma.game.create({
        data: {
            inviteCode: generateInviteCode(),
            status: 'LOBBY',
            deckId,
            players: { create: { userId } },
        },
    });

    return toCreatedGameView(game);
};

export const joinGame = async (
    prisma: PrismaClient,
    userId: string,
    inviteCode: string,
) => {
    const game = await prisma.game.findFirst({
        where: { inviteCode, status: 'LOBBY' },
        include: { players: true },
    });

    if (!game) return null;

    const alreadyJoined = game.players.some((p) => p.userId === userId);

    if (alreadyJoined || game.players.length >= 2) return null;

    const player = await prisma.gamePlayer.create({
        data: { gameId: game.id, userId },
    });

    return toJoinedGameView(player);
};

export const getGame = async (
    prisma: PrismaClient,
    userId: string,
    gameId: string,
) => {
    const game = await prisma.game.findFirst({
        where: { id: gameId, players: { some: { userId } } },
        include: { players: true, deck: { include: { cards: true } } },
    });

    if (!game) return null;

    return toGameView(game, userId);
};

export const createGameService = (prisma: PrismaClient) => ({
    createGame: (userId: string, deckId: string) =>
        createGame(prisma, userId, deckId),
    joinGame: (userId: string, inviteCode: string) =>
        joinGame(prisma, userId, inviteCode),
    getGame: (userId: string, gameId: string) =>
        getGame(prisma, userId, gameId),
});
