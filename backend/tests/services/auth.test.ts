import { describe, expect, it, vi } from 'vitest';
import {
    authenticateWithCognito,
    createAuthService,
    createDbUser,
    rollbackCognitoUser,
    signUpWithCognito,
} from '../../src/services/auth.js';
import { HttpError } from '../../src/utils/http-error.js';

const CLIENT_ID = 'client-id';
const USER_POOL_ID = 'pool-id';

const makeCognito = () => ({ send: vi.fn() });
const makePrisma = () => ({ user: { create: vi.fn() } });
const cognitoError = (name: string) =>
    Object.assign(new Error('cognito internal detail'), { name });

const captureLoginError = (
    cognito: ReturnType<typeof makeCognito>,
    username: string,
    password: string,
) =>
    createAuthService(
        makePrisma() as never,
        cognito as never,
        CLIENT_ID,
        USER_POOL_ID,
    )
        .login(username, password)
        .then(
            () => null,
            (err: unknown) =>
                err instanceof HttpError
                    ? { status: err.status, message: err.message }
                    : null,
        );

describe('signUpWithCognito', () => {
    it('returns user sub on success', async () => {
        const cognito = makeCognito();
        cognito.send.mockResolvedValueOnce({ UserSub: 'sub-123' });

        const result = await signUpWithCognito(
            cognito as never,
            CLIENT_ID,
            'alice',
            'Password1',
        );

        expect(result).toBe('sub-123');
    });

    it('throws when cognito returns no user sub', async () => {
        const cognito = makeCognito();
        cognito.send.mockResolvedValueOnce({});

        await expect(
            signUpWithCognito(
                cognito as never,
                CLIENT_ID,
                'alice',
                'Password1',
            ),
        ).rejects.toThrow('Cognito did not return a user sub');
    });

    it('bubbles cognito error', async () => {
        const cognito = makeCognito();
        cognito.send.mockRejectedValueOnce(new Error('cognito unavailable'));

        await expect(
            signUpWithCognito(
                cognito as never,
                CLIENT_ID,
                'alice',
                'Password1',
            ),
        ).rejects.toThrow('cognito unavailable');
    });
});

describe('createDbUser', () => {
    it('creates user with correct id', async () => {
        const prisma = makePrisma();
        prisma.user.create.mockResolvedValueOnce({});

        await createDbUser(prisma as never, 'sub-123');

        expect(prisma.user.create).toHaveBeenCalledWith({
            data: { id: 'sub-123' },
        });
    });

    it('bubbles db error', async () => {
        const prisma = makePrisma();
        prisma.user.create.mockRejectedValueOnce(new Error('db error'));

        await expect(createDbUser(prisma as never, 'sub-123')).rejects.toThrow(
            'db error',
        );
    });
});

describe('rollbackCognitoUser', () => {
    it('sends delete command', async () => {
        const cognito = makeCognito();
        cognito.send.mockResolvedValueOnce({});

        await rollbackCognitoUser(cognito as never, USER_POOL_ID, 'alice');

        expect(cognito.send).toHaveBeenCalledTimes(1);
    });

    it('bubbles cognito error', async () => {
        const cognito = makeCognito();
        cognito.send.mockRejectedValueOnce(new Error('delete failed'));

        await expect(
            rollbackCognitoUser(cognito as never, USER_POOL_ID, 'alice'),
        ).rejects.toThrow('delete failed');
    });
});

describe('authenticateWithCognito', () => {
    it('returns access token on success', async () => {
        const cognito = makeCognito();
        cognito.send.mockResolvedValueOnce({
            AuthenticationResult: { AccessToken: 'token-abc' },
        });

        const token = await authenticateWithCognito(
            cognito as never,
            CLIENT_ID,
            'alice',
            'Password1',
        );

        expect(token).toBe('token-abc');
    });

    it('throws when no access token returned', async () => {
        const cognito = makeCognito();
        cognito.send.mockResolvedValueOnce({ AuthenticationResult: {} });

        await expect(
            authenticateWithCognito(
                cognito as never,
                CLIENT_ID,
                'alice',
                'Password1',
            ),
        ).rejects.toThrow('Cognito did not return an access token');
    });

    it('bubbles cognito error', async () => {
        const cognito = makeCognito();
        cognito.send.mockRejectedValueOnce(new Error('auth failed'));

        await expect(
            authenticateWithCognito(
                cognito as never,
                CLIENT_ID,
                'alice',
                'Password1',
            ),
        ).rejects.toThrow('auth failed');
    });
});

describe('register', () => {
    it('creates cognito user then db user', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockResolvedValueOnce({ UserSub: 'sub-123' });
        prisma.user.create.mockResolvedValueOnce({});

        await createAuthService(
            prisma as never,
            cognito as never,
            CLIENT_ID,
            USER_POOL_ID,
        ).register('alice', 'Password1');

        expect(prisma.user.create).toHaveBeenCalledWith({
            data: { id: 'sub-123' },
        });
    });

    it('rolls back cognito user when db write fails', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockResolvedValueOnce({ UserSub: 'sub-123' });
        prisma.user.create.mockRejectedValueOnce(new Error('db error'));
        cognito.send.mockResolvedValueOnce({});

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).register('alice', 'Password1'),
        ).rejects.toThrow('db error');

        expect(cognito.send).toHaveBeenCalledTimes(2);
    });

    it('throws 409 when username already taken', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce(
            cognitoError('UsernameExistsException'),
        );

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).register('alice', 'Password1'),
        ).rejects.toMatchObject({
            status: 409,
            message: 'Username already taken',
        });
    });

    it('throws 400 when password rejected by cognito', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce(
            cognitoError('InvalidPasswordException'),
        );

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).register('alice', 'weak'),
        ).rejects.toMatchObject({
            status: 400,
            message: 'Password does not meet requirements',
        });
    });

    it('throws combined error when rollback also fails', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockResolvedValueOnce({ UserSub: 'sub-123' });
        prisma.user.create.mockRejectedValueOnce(new Error('db error'));
        cognito.send.mockRejectedValueOnce(new Error('rollback failed'));

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).register('alice', 'Password1'),
        ).rejects.toThrow(
            'Rollback failed: rollback failed. DB error: db error',
        );
    });
});

describe('login', () => {
    it('returns access token on success', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockResolvedValueOnce({
            AuthenticationResult: { AccessToken: 'token-abc' },
        });

        const token = await createAuthService(
            prisma as never,
            cognito as never,
            CLIENT_ID,
            USER_POOL_ID,
        ).login('alice', 'Password1');

        expect(token).toBe('token-abc');
    });

    it('throws when cognito returns no token', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockResolvedValueOnce({ AuthenticationResult: {} });

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).login('alice', 'Password1'),
        ).rejects.toThrow('Cognito did not return an access token');
    });

    it('bubbles cognito error', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce(new Error('auth failed'));

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).login('alice', 'Password1'),
        ).rejects.toThrow('auth failed');
    });

    it('throws 401 when password incorrect', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce(
            cognitoError('NotAuthorizedException'),
        );

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).login('alice', 'WrongPassword'),
        ).rejects.toMatchObject({
            status: 401,
            message: 'Incorrect username or password',
        });
    });

    it('throws 401 when user does not exist', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce(
            cognitoError('UserNotFoundException'),
        );

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).login('nobody', 'Password1'),
        ).rejects.toMatchObject({
            status: 401,
            message: 'Incorrect username or password',
        });
    });

    it('gives identical response for wrong password and unknown user', async () => {
        const wrongPassword = makeCognito();
        const unknownUser = makeCognito();
        wrongPassword.send.mockRejectedValueOnce(
            cognitoError('NotAuthorizedException'),
        );
        unknownUser.send.mockRejectedValueOnce(
            cognitoError('UserNotFoundException'),
        );

        const wrongPasswordResponse = await captureLoginError(
            wrongPassword,
            'alice',
            'WrongPassword',
        );

        expect(wrongPasswordResponse).toEqual(
            await captureLoginError(unknownUser, 'nobody', 'Password1'),
        );
    });

    it('bubbles a non-Error rejection unchanged', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce('cognito exploded');

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).login('alice', 'Password1'),
        ).rejects.toBe('cognito exploded');
    });

    it('does not leak the cognito message on auth failure', async () => {
        const cognito = makeCognito();
        const prisma = makePrisma();
        cognito.send.mockRejectedValueOnce(
            cognitoError('NotAuthorizedException'),
        );

        await expect(
            createAuthService(
                prisma as never,
                cognito as never,
                CLIENT_ID,
                USER_POOL_ID,
            ).login('alice', 'WrongPassword'),
        ).rejects.not.toThrow('cognito internal detail');
    });
});
