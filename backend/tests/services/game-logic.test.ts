import { describe, it, expect } from 'vitest';
import type { Card } from '../../src/generated/prisma/client.js';
import {
    selectSecretCards,
    pickFirstPlayer,
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
