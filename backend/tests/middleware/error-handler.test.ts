import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createErrorHandler } from '../../src/middleware/error-handler.js';
import { HttpError } from '../../src/utils/http-error.js';

const makeReqResNext = (headersSent = false) => {
    const req = {} as unknown as Request;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json, headersSent } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    return { req, res, next, status, json };
};

describe('createErrorHandler', () => {
    it('sends 500 when error is not an HttpError', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next, status } = makeReqResNext();

        middleware(new Error('prisma detail'), req, res, next);

        expect(status).toHaveBeenCalledWith(500);
    });

    it('sends generic message when error is not an HttpError', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next, json } = makeReqResNext();

        middleware(new Error('prisma detail'), req, res, next);

        expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('logs the real error when error is not an HttpError', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next } = makeReqResNext();
        const error = new Error('prisma detail');

        middleware(error, req, res, next);

        expect(logger).toHaveBeenCalledWith(error);
    });

    it('sends the HttpError status when error is an HttpError', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next, status } = makeReqResNext();

        middleware(
            new HttpError(409, 'Username already taken'),
            req,
            res,
            next,
        );

        expect(status).toHaveBeenCalledWith(409);
    });

    it('sends the HttpError message when error is an HttpError', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next, json } = makeReqResNext();

        middleware(
            new HttpError(409, 'Username already taken'),
            req,
            res,
            next,
        );

        expect(json).toHaveBeenCalledWith({ error: 'Username already taken' });
    });

    it('does not log when error is an HttpError', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next } = makeReqResNext();

        middleware(
            new HttpError(409, 'Username already taken'),
            req,
            res,
            next,
        );

        expect(logger).not.toHaveBeenCalled();
    });

    it('forwards to next when headers already sent', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next } = makeReqResNext(true);
        const error = new Error('prisma detail');

        middleware(error, req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('does not send a response when headers already sent', () => {
        const logger = vi.fn();
        const middleware = createErrorHandler(logger);
        const { req, res, next, status } = makeReqResNext(true);

        middleware(new Error('prisma detail'), req, res, next);

        expect(status).not.toHaveBeenCalled();
    });
});
