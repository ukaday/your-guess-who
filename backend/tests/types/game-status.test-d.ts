import { describe, it, expectTypeOf } from 'vitest';
import type { GameStatus as ContractGameStatus } from '@your-guess-who/contract';
import type { GameStatus as PrismaGameStatus } from '../../src/generated/prisma/client.js';

describe('GameStatus', function () {
    it('matches the status the database stores', function () {
        expectTypeOf<ContractGameStatus>().toEqualTypeOf<PrismaGameStatus>();
    });
});
