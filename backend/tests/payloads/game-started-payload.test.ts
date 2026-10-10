import { describe, it, expect } from 'vitest';
import { toGameStartedPayload } from '../../src/payloads/game-started-payload.js';
import type { GameWithPlayersAndDeck } from '../../src/payloads/game-started-payload.js';

describe('toGameStartedPayload', function () {
    it('carries only the fields the board needs', function () {
        const game: GameWithPlayersAndDeck = {
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
        };

        const payload = toGameStartedPayload(game);

        expect(payload).toStrictEqual({
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
        });
    });
});
