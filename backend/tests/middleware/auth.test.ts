import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createAuthMiddleware, getAuthToken } from '../../src/middleware/auth.js'

const mockVerify = vi.hoisted(() => vi.fn())

vi.mock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
        create: () => ({ verify: mockVerify }),
    },
}))

const makeReqResNext = (authHeader?: string) => {
    const req = { headers: { authorization: authHeader } } as unknown as Request
    const status = vi.fn().mockReturnThis()
    const json = vi.fn()
    const res = { status, json } as unknown as Response
    const next = vi.fn() as unknown as NextFunction
    return { req, res, next, status, json }
}

describe('getAuthToken', () => {
    it('returns token from Authorization header', () => {
        const req = { headers: { authorization: 'Bearer mytoken' } } as unknown as Request

        const token = getAuthToken(req)

        expect(token).toBe('mytoken')
    })

    it('returns undefined when Authorization header missing', () => {
        const req = { headers: {} } as unknown as Request

        const token = getAuthToken(req)

        expect(token).toBeUndefined()
    })
})

describe('createAuthMiddleware', () => {
    const middleware = createAuthMiddleware('pool-id', 'client-id')

    beforeEach(() => {
        mockVerify.mockReset()
    })

    it('sets req.userId to sub from verified token', async () => {
        const { req, res, next } = makeReqResNext('Bearer valid-token')
        mockVerify.mockResolvedValueOnce({ sub: 'user-123' })

        await middleware(req, res, next)

        expect(req.userId).toBe('user-123')
    })

    it('calls next when token valid', async () => {
        const { req, res, next } = makeReqResNext('Bearer valid-token')
        mockVerify.mockResolvedValueOnce({ sub: 'user-123' })

        await middleware(req, res, next)

        expect(next).toHaveBeenCalled()
    })

    it('sends 401 when Authorization header missing', async () => {
        const { req, res, next, status } = makeReqResNext()

        await middleware(req, res, next)

        expect(status).toHaveBeenCalledWith(401)
    })

    it('sends missing token error when Authorization header missing', async () => {
        const { req, res, next, json } = makeReqResNext()

        await middleware(req, res, next)

        expect(json).toHaveBeenCalledWith({ error: 'Missing token' })
    })

    it('does not call next when Authorization header missing', async () => {
        const { req, res, next } = makeReqResNext()

        await middleware(req, res, next)

        expect(next).not.toHaveBeenCalled()
    })

    it('sends 401 when token invalid', async () => {
        const { req, res, next, status } = makeReqResNext('Bearer bad-token')
        mockVerify.mockRejectedValueOnce(new Error('invalid'))

        await middleware(req, res, next)

        expect(status).toHaveBeenCalledWith(401)
    })

    it('sends invalid token error when token fails verification', async () => {
        const { req, res, next, json } = makeReqResNext('Bearer bad-token')
        mockVerify.mockRejectedValueOnce(new Error('invalid'))

        await middleware(req, res, next)

        expect(json).toHaveBeenCalledWith({ error: 'Invalid or expired token' })
    })

    it('does not call next when token invalid', async () => {
        const { req, res, next } = makeReqResNext('Bearer bad-token')
        mockVerify.mockRejectedValueOnce(new Error('invalid'))

        await middleware(req, res, next)

        expect(next).not.toHaveBeenCalled()
    })
})
