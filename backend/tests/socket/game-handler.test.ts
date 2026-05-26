import {
    describe,
    it,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from 'vitest';

describe('game:join', function () {
    beforeAll(async function () {});
    afterAll(async function () {});
    beforeEach(async function () {});
    afterEach(async function () {});

    it('emits no event when player joins game with LOBBY status', async function () {});
    it('emits game:started and game:your-card to both when second unique player joins', async function () {});
    it('emits game:error when same user joins from a second client', async function () {});
    it('emits game:your-card with their card when player joins game with ACTIVE status', async function () {});
    it('emits game:error when a non-player joins', async function () {});
    it('emits game:error when the game does not exist', async function () {});
});
