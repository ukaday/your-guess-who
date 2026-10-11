import { describe, it, expect } from 'vitest';
import {
    toCreatedGameView,
    toJoinedGameView,
} from '../../src/payloads/lobby-payloads.js';

describe('toCreatedGameView', function () {
    it('carries only what the creator needs to share the invite', function () {
        const view = toCreatedGameView({
            id: 'game-1',
            inviteCode: 'ABC123',
            status: 'LOBBY',
            deckId: 'deck-1',
            activePlayerId: null,
            winnerId: null,
            createdAt: new Date('2026-10-10T00:00:00Z'),
        });

        expect(view).toStrictEqual({
            id: 'game-1',
            inviteCode: 'ABC123',
            status: 'LOBBY',
        });
    });
});

describe('toJoinedGameView', function () {
    it('carries only the id of the game the player joined', function () {
        const view = toJoinedGameView({
            gameId: 'game-1',
            userId: 'user-2',
            secretCardId: null,
        });

        expect(view).toStrictEqual({ gameId: 'game-1' });
    });
});
