import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSocketAuthMiddleware } from '../../src/middleware/socket-auth.js';
import { GameSocket } from '../../src/types/socket.js';

const mockVerify = vi.fn();

vi.mock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
        create: () => ({ verify: mockVerify }),
    },
}));

describe('createSocketAuthMiddleware', () => {
    const middleware = createSocketAuthMiddleware('pool-id', 'client-id');

    beforeEach(() => {
        mockVerify.mockReset();
    });

    it('calls next() with no args on valid token', async () => {
        mockVerify.mockResolvedValueOnce({ sub: 'user-abc' });
        const socket = {
            handshake: { auth: { token: 'valid-token' } },
            data: {},
        } as unknown as GameSocket;
        const next = vi.fn();

        await middleware(socket, next);

        expect(next).toHaveBeenCalledWith();
    });

    it('sets socket.data.userId on valid token', async () => {
        mockVerify.mockResolvedValueOnce({ sub: 'user-abc' });
        const socket = {
            handshake: { auth: { token: 'valid-token' } },
            data: {},
        } as unknown as GameSocket;
        const next = vi.fn();

        await middleware(socket, next);

        expect(socket.data.userId).toBe('user-abc');
    });

    it('calls next(error) with no token', async () => {
        const socket = {
            handshake: { auth: {} },
            data: {},
        } as unknown as GameSocket;
        const next = vi.fn();

        await middleware(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not set socket.data.userId with no token', async () => {
        const socket = {
            handshake: { auth: {} },
            data: {},
        } as unknown as GameSocket;
        const next = vi.fn();

        await middleware(socket, next);

        expect(socket.data.userId).toBeUndefined();
    });

    it('calls next(error) with invalid token', async () => {
        mockVerify.mockRejectedValueOnce(new Error('invalid'));
        const socket = {
            handshake: { auth: { token: 'invalid-token' } },
            data: {},
        } as unknown as GameSocket;
        const next = vi.fn();

        await middleware(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not set socket.data.userId with invalid token', async () => {
        mockVerify.mockRejectedValueOnce(new Error('invalid'));
        const socket = {
            handshake: { auth: { token: 'invalid-token' } },
            data: {},
        } as unknown as GameSocket;
        const next = vi.fn();

        await middleware(socket, next);

        expect(socket.data.userId).toBeUndefined();
    });
});
