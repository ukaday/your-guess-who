import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { handleError } from '../../src/utils/handle-error.js';

const makeReqRes = () => {
    const req = {} as Request;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json } as unknown as Response;
    return { req, res, status, json };
};

describe('handleError', () => {
    it('calls handler with req and res', async () => {
        const { req, res } = makeReqRes();
        const asyncHandler = vi.fn().mockResolvedValue(undefined);

        await handleError(asyncHandler)(req, res);

        expect(asyncHandler).toHaveBeenCalledWith(req, res);
    });

    it('sends 500 with error message when handler throws Error', async () => {
        const { req, res, status, json } = makeReqRes();
        const asyncHandler = vi.fn().mockRejectedValue(new Error('boom'));

        await handleError(asyncHandler)(req, res);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({ error: 'boom' });
    });

    it('sends 500 with string representation when handler throws non-Error', async () => {
        const { req, res, status, json } = makeReqRes();
        const asyncHandler = vi.fn().mockRejectedValue('raw error');

        await handleError(asyncHandler)(req, res);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({ error: 'raw error' });
    });
});
