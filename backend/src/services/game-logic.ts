import { Card, GameStatus } from '../generated/prisma/client.js';

const PLAYERS_PER_GAME = 2;

export type JoinOutcome =
    { type: 'REJECT'; message: string } | { type: 'JOIN' };

type JoinDecisionGame = {
    status: GameStatus;
    players: { userId: string }[];
};

export type EndTurnOutcome =
    | { type: 'REJECT'; message: string }
    | { type: 'ADVANCE_TURN'; nextActivePlayerId: string };

export type EndTurnDecisionGame = {
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
): JoinOutcome => {
    const isPlayer = game.players.some((p) => p.userId === userId);

    if (!isPlayer) {
        return { type: 'REJECT', message: 'Game not found' };
    }

    return { type: 'JOIN' };
};

export function decideEndTurnOutcome(
    game: EndTurnDecisionGame,
    userId: string,
): EndTurnOutcome {
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

export const shouldStartGame = (
    game: JoinDecisionGame,
    userIdsInRoom: string[],
): boolean => {
    if (game.status !== 'LOBBY') {
        return false;
    }

    if (game.players.length !== PLAYERS_PER_GAME) {
        return false;
    }

    return game.players.every((p) => userIdsInRoom.includes(p.userId));
};
