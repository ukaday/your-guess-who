import { describe, it, expectTypeOf } from 'vitest';
import type { GameStartedPayload } from '../../src/types/socket.js';

describe('GameStartedPayload', function () {
    it('declares no secretCardId on a player', function () {
        expectTypeOf<
            GameStartedPayload['players'][number]
        >().not.toHaveProperty('secretCardId');
    });

    it('declares only the player fields the board needs', function () {
        expectTypeOf<
            keyof GameStartedPayload['players'][number]
        >().toEqualTypeOf<'userId'>();
    });
});
