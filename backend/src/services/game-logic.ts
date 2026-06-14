import { Card, GameStatus } from '../generated/prisma/client.js';

export type JoinOutcome =
    | { type: 'REJECT'; message: string }
    | { type: 'REVEAL_CARD'; cardId: string }
    | { type: 'WAIT' }
    | { type: 'START' };

type JoinDecisionGame = {
    status: GameStatus;
    players: { userId: string; secretCardId: string | null }[];
};

export type EliminateOutcome =
    | { type: 'REJECT'; message: string }
    | { type: 'ADVANCE_TURN'; nextActivePlayerId: string };

export type EliminateDecisionGame = {
    status: GameStatus;
    activePlayerId: string | null;
    players: [{ userId: string }, { userId: string }];
};

export type GuessOutcome =
    | { type: 'REJECT'; message: string }
    | { type: 'WIN'; winnerId: string }
    | { type: 'WRONG'; nextActivePlayerId: string; guessedCardId: string };

export type GuessDecisionGame = {
    status: GameStatus;
    activePlayerId: string | null;
    players: [
        { userId: string; secretCardId: string | null },
        { userId: string; secretCardId: string | null },
    ];
};

export const selectSecretCards = (cards: Card[]): [Card, Card] => {
    if (cards.length < 2) {
        throw new Error('Input card list contains less than two cards');
    }

    const shuffled = [...cards].sort(() => Math.random() - 0.5);

    return [shuffled[0]!, shuffled[1]!];
};

export const pickFirstPlayer = (players: string[]): string => {
    if (players.length === 0) {
        throw new Error('Input player list is empty');
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5);

    return shuffled[0]!;
};

export const decideJoinOutcome = (
    game: JoinDecisionGame,
    userId: string,
    userIdsInRoom: string[],
): JoinOutcome => {
    const player = game.players.find((p) => p.userId === userId);

    if (!player) {
        return { type: 'REJECT', message: 'Game not found' };
    }

    if (game.status === 'ACTIVE') {
        return { type: 'REVEAL_CARD', cardId: player.secretCardId! };
    }

    if (userIdsInRoom.includes(userId)) {
        return { type: 'REJECT', message: 'Already connected to this game' };
    }

    const uniquePlayersAfterJoin = new Set([...userIdsInRoom, userId]).size;

    if (uniquePlayersAfterJoin < 2) {
        return { type: 'WAIT' };
    }

    return { type: 'START' };
};

export function decideEliminateOutcome(
    game: EliminateDecisionGame,
    userId: string,
): EliminateOutcome {
    if (game.activePlayerId !== userId) {
        return { type: 'REJECT', message: 'Not your turn' };
    }

    if (game.status !== GameStatus.ACTIVE) {
        return { type: 'REJECT', message: 'Game is not active' };
    }

    const newActivePlayerId =
        game.players[0].userId === userId
            ? game.players[1].userId
            : game.players[0].userId;

    return { type: 'ADVANCE_TURN', nextActivePlayerId: newActivePlayerId };
}

export function decideGuessOutcome(
    game: GuessDecisionGame,
    userId: string,
    cardId: string,
): GuessOutcome {
    if (game.activePlayerId !== userId) {
        return { type: 'REJECT', message: 'Not your turn' };
    }

    if (game.status !== GameStatus.ACTIVE) {
        return { type: 'REJECT', message: 'Game is not active' };
    }

    const [p1, p2] = game.players;
    const opponent = p1.userId === userId ? p2 : p1;

    if (opponent.secretCardId === cardId) {
        return { type: 'WIN', winnerId: userId };
    }

    return {
        type: 'WRONG',
        nextActivePlayerId: opponent.userId,
        guessedCardId: cardId,
    };
}
