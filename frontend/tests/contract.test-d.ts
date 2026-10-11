import { describe, it, expectTypeOf } from 'vitest';
import type { ClientEvents, GameView } from '@your-guess-who/contract';

describe('contract', function () {
    it('resolves by package name under bundler resolution', function () {
        expectTypeOf<keyof ClientEvents>().toEqualTypeOf<
            'game:join' | 'game:end-turn' | 'game:guess'
        >();
    });

    it('carries the requesting player their own secret card', function () {
        expectTypeOf<GameView['yourSecretCardId']>().toEqualTypeOf<
            string | null
        >();
    });
});
