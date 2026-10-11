import { describe, it, expect } from 'vitest';
import { toGameView } from '../../src/payloads/game-view.js';
import type { GameWithPlayersAndDeck } from '../../src/payloads/game-started-payload.js';

const makeActiveGame = (): GameWithPlayersAndDeck => ({
    id: 'game-1',
    inviteCode: 'invite-1',
    status: 'ACTIVE',
    deckId: 'deck-1',
    activePlayerId: 'user-1',
    winnerId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    players: [
        { gameId: 'game-1', userId: 'user-1', secretCardId: 'card-1' },
        { gameId: 'game-1', userId: 'user-2', secretCardId: 'card-2' },
    ],
    deck: {
        cards: [
            {
                id: 'card-1',
                name: 'Alice',
                imageKey: 'img/alice',
                deckId: 'deck-1',
            },
            {
                id: 'card-2',
                name: 'Bob',
                imageKey: 'img/bob',
                deckId: 'deck-1',
            },
        ],
    },
});

describe('toGameView', function () {
    it('carries the requesting player their own secret card', function () {
        const view = toGameView(makeActiveGame(), 'user-1');

        expect(view.yourSecretCardId).toBe('card-1');
    });

    it('carries each player their own secret card, not the opponent’s', function () {
        const view = toGameView(makeActiveGame(), 'user-2');

        expect(view.yourSecretCardId).toBe('card-2');
    });

    it('lists players by userId alone so no secret card rides on them', function () {
        const view = toGameView(makeActiveGame(), 'user-1');

        expect(view.players).toStrictEqual([
            { userId: 'user-1' },
            { userId: 'user-2' },
        ]);
    });

    it('carries no secret card before cards are dealt', function () {
        const game: GameWithPlayersAndDeck = {
            ...makeActiveGame(),
            status: 'LOBBY',
            activePlayerId: null,
            players: [
                { gameId: 'game-1', userId: 'user-1', secretCardId: null },
            ],
        };

        const view = toGameView(game, 'user-1');

        expect(view.yourSecretCardId).toBeNull();
    });

    it('carries only the allow-listed fields', function () {
        const view = toGameView(makeActiveGame(), 'user-1');

        expect(view).toStrictEqual({
            id: 'game-1',
            status: 'ACTIVE',
            activePlayerId: 'user-1',
            players: [{ userId: 'user-1' }, { userId: 'user-2' }],
            deck: {
                cards: [
                    { id: 'card-1', name: 'Alice' },
                    { id: 'card-2', name: 'Bob' },
                ],
            },
            yourSecretCardId: 'card-1',
        });
    });
});
