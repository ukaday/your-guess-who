import {
    AdminDeleteUserCommand,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorToMessage } from '../utils/error-to-message.js';

export const signUpWithCognito = async (
    cognito: CognitoIdentityProviderClient,
    clientId: string,
    username: string,
    password: string,
): Promise<string> => {
    const { UserSub } = await cognito.send(
        new SignUpCommand({
            ClientId: clientId,
            Username: username,
            Password: password,
        }),
    );

    if (!UserSub) throw new Error('Cognito did not return a user sub');

    return UserSub;
};

export const createDbUser = async (
    prisma: PrismaClient,
    userSub: string,
): Promise<void> => {
    await prisma.user.create({ data: { id: userSub } });
};

export const rollbackCognitoUser = async (
    cognito: CognitoIdentityProviderClient,
    userPoolId: string,
    username: string,
): Promise<void> => {
    await cognito.send(
        new AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: username,
        }),
    );
};

export const authenticateWithCognito = async (
    cognito: CognitoIdentityProviderClient,
    clientId: string,
    username: string,
    password: string,
): Promise<string> => {
    const { AuthenticationResult } = await cognito.send(
        new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: clientId,
            AuthParameters: { USERNAME: username, PASSWORD: password },
        }),
    );

    if (!AuthenticationResult?.AccessToken)
        throw new Error('Cognito did not return an access token');

    return AuthenticationResult.AccessToken;
};

export const createAuthService = (
    prisma: PrismaClient,
    cognito: CognitoIdentityProviderClient,
    clientId: string,
    userPoolId: string,
) => ({
    register: async (username: string, password: string): Promise<void> => {
        const userSub = await signUpWithCognito(
            cognito,
            clientId,
            username,
            password,
        );

        try {
            await createDbUser(prisma, userSub);
        } catch (dbErr) {
            try {
                await rollbackCognitoUser(cognito, userPoolId, username);
            } catch (rollbackErr) {
                throw new Error(
                    `Rollback failed: ${errorToMessage(rollbackErr)}. DB error: ${errorToMessage(dbErr)}`,
                    { cause: rollbackErr },
                );
            }

            throw dbErr;
        }
    },

    login: async (username: string, password: string): Promise<string> => {
        return authenticateWithCognito(cognito, clientId, username, password);
    },
});
