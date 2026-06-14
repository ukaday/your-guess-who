import { describe, it, expect } from 'vitest';
import type { Card } from '../../src/generated/prisma/client.js';
import { GameStatus } from '../../src/generated/prisma/client.js';
import {
    selectSecretCards,
    pickFirstPlayer,
    decideJoinOutcome,
    decideEliminateOutcome,
    decideGuessOutcome,
    type EliminateDecisionGame,
    type GuessDecisionGame,
} from '../../src/services/game-logic.js';

describe('selectSecretCards', () => {
    it('returns two cards', () => {
        const cards = [
            { id: 'card1', name: 'Alice', imageKey: 'img/1', deckId: 'deck-1' },
            { id: 'card2', name: 'Bob', imageKey: 'img/2', deckId: 'deck-1' },
            { id: 'card3', name: 'Carol', imageKey: 'img/3', deckId: 'deck-1' },
        ] as Card[];

        const result = selectSecretCards(cards);

        expect(result.length).toBe(2);
    });

    it('returns cards from the input list', () => {
        const cards = [
            { id: 'card1', name: 'Alice', imageKey: 'img/1', deckId: 'deck-1' },
            { id: 'card2', name: 'Bob', imageKey: 'img/2', deckId: 'deck-1' },
            { id: 'card3', name: 'Carol', imageKey: 'img/3', deckId: 'deck-1' },
        ] as Card[];

        const result = selectSecretCards(cards);

        expect(cards).toContain(result[0]);
        expect(cards).toContain(result[1]);
    });

    it('returns distinct cards', () => {
        const cards = [
            { id: 'card1', name: 'Alice', imageKey: 'img/1', deckId: 'deck-1' },
            { id: 'card2', name: 'Bob', imageKey: 'img/2', deckId: 'deck-1' },
            { id: 'card3', name: 'Carol', imageKey: 'img/3', deckId: 'deck-1' },
        ] as Card[];

        const result = selectSecretCards(cards);

        expect(result[0]).not.toBe(result[1]);
    });

    it('throws if fewer than 2 cards', () => {
        const cards = [
            { id: 'card1', name: 'Alice', imageKey: 'img/1', deckId: 'deck-1' },
        ] as Card[];

        expect(() => selectSecretCards(cards)).toThrow(
            'Input card list contains less than two cards',
        );
    });
});

describe('pickFirstPlayer', () => {
    it('returns a player', () => {
        const players = ['player-1', 'player-2'];

        const result = pickFirstPlayer(players);

        expect(players).toContain(result);
    });

    it('throws if player list is empty', () => {
        const players: string[] = [];

        expect(() => pickFirstPlayer(players)).toThrow(
            'Input player list is empty',
        );
    });
});

describe('decideJoinOutcome', () => {
    const lobbyGame = {
        status: 'LOBBY' as const,
        players: [
            { userId: 'player-1', secretCardId: null },
            { userId: 'player-2', secretCardId: null },
        ],
    };

    it('rejects when the user is not a player in the game', () => {
        const result = decideJoinOutcome(lobbyGame, 'stranger', []);

        expect(result).toEqual({ type: 'REJECT', message: 'Game not found' });
    });

    it('rejects when the user is already connected from another client', () => {
        const result = decideJoinOutcome(lobbyGame, 'player-1', ['player-1']);

        expect(result).toEqual({
            type: 'REJECT',
            message: 'Already connected to this game',
        });
    });

    it('reveals the secret card when the game is ACTIVE', () => {
        const activeGame = {
            status: 'ACTIVE' as const,
            players: [
                { userId: 'player-1', secretCardId: 'card-1' },
                { userId: 'player-2', secretCardId: 'card-2' },
            ],
        };

        const result = decideJoinOutcome(activeGame, 'player-1', []);

        expect(result).toEqual({ type: 'REVEAL_CARD', cardId: 'card-1' });
    });

    it('waits when the joining player is the only one in the room', () => {
        const result = decideJoinOutcome(lobbyGame, 'player-1', []);

        expect(result).toEqual({ type: 'WAIT' });
    });

    it('starts when a second unique player joins a LOBBY game', () => {
        const result = decideJoinOutcome(lobbyGame, 'player-2', ['player-1']);

        expect(result).toEqual({ type: 'START' });
    });
});

describe('decideEliminateOutcome', function () {
    const game: EliminateDecisionGame = {
        status: GameStatus.ACTIVE,
        activePlayerId: 'player-1',
        players: [{ userId: 'player-1' }, { userId: 'player-2' }],
    };

    it('rejects if player is not active', function () {
        const result = decideEliminateOutcome(game, 'player-2');

        expect(result).toEqual({ type: 'REJECT', message: 'Not your turn' });
    });

    it('rejects if the game is not active', function () {
        const activeGame: EliminateDecisionGame = {
            status: GameStatus.LOBBY,
            activePlayerId: 'player-1',
            players: [{ userId: 'player-1' }, { userId: 'player-2' }],
        };

        const result = decideEliminateOutcome(activeGame, 'player-1');

        expect(result).toEqual({
            type: 'REJECT',
            message: 'Game is not active',
        });
    });

    it('advances turn and returns activePlayerId', function () {
        const result = decideEliminateOutcome(game, 'player-1');

        expect(result).toEqual({
            type: 'ADVANCE_TURN',
            nextActivePlayerId: 'player-2',
        });
    });

    it('advances turn from player-2 to player-1', function () {
        const gameP2Active: EliminateDecisionGame = {
            status: GameStatus.ACTIVE,
            activePlayerId: 'player-2',
            players: [{ userId: 'player-1' }, { userId: 'player-2' }],
        };

        const result = decideEliminateOutcome(gameP2Active, 'player-2');

        expect(result).toEqual({
            type: 'ADVANCE_TURN',
            nextActivePlayerId: 'player-1',
        });
    });
});

describe('decideGuessOutcome', function () {
    const game: GuessDecisionGame = {
        status: GameStatus.ACTIVE,
        activePlayerId: 'player-1',
        players: [
            { userId: 'player-1', secretCardId: 'card-1' },
            { userId: 'player-2', secretCardId: 'card-2' },
        ],
    };

    it('rejects if player is not active', function () {
        const result = decideGuessOutcome(game, 'player-2', 'card-1');

        expect(result).toEqual({ type: 'REJECT', message: 'Not your turn' });
    });

    it('rejects if game is not active', function () {
        const lobbyGame: GuessDecisionGame = {
            status: GameStatus.LOBBY,
            activePlayerId: 'player-1',
            players: [
                { userId: 'player-1', secretCardId: 'card-1' },
                { userId: 'player-2', secretCardId: 'card-2' },
            ],
        };

        const result = decideGuessOutcome(lobbyGame, 'player-1', 'card-2');

        expect(result).toEqual({
            type: 'REJECT',
            message: 'Game is not active',
        });
    });

    it('returns WIN when cardId matches opponent secret', function () {
        const result = decideGuessOutcome(game, 'player-1', 'card-2');

        expect(result).toEqual({ type: 'WIN', winnerId: 'player-1' });
    });

    it('returns WRONG when cardId does not match opponent secret', function () {
        const result = decideGuessOutcome(game, 'player-1', 'card-99');

        expect(result).toEqual({
            type: 'WRONG',
            nextActivePlayerId: 'player-2',
            guessedCardId: 'card-99',
        });
    });

    it('returns WRONG with player-1 as next when player-2 guesses wrong', function () {
        const gameP2Active: GuessDecisionGame = {
            status: GameStatus.ACTIVE,
            activePlayerId: 'player-2',
            players: [
                { userId: 'player-1', secretCardId: 'card-1' },
                { userId: 'player-2', secretCardId: 'card-2' },
            ],
        };

        const result = decideGuessOutcome(gameP2Active, 'player-2', 'card-99');

        expect(result).toEqual({
            type: 'WRONG',
            nextActivePlayerId: 'player-1',
            guessedCardId: 'card-99',
        });
    });
});
