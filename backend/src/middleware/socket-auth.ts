import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { GameSocket } from '../types/socket.js';

export const createSocketAuthMiddleware = (
    userPoolId: string,
    clientId: string,
) => {
    const verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
    });

    return (gameSocket: GameSocket, next: (err?: Error) => void) => {
        if (!gameSocket.handshake.auth.token) {
            next(new Error('Missing token'));

            return;
        }

        return verifier
            .verify(gameSocket.handshake.auth.token as string)
            .then((payload) => {
                gameSocket.data.userId = payload.sub;

                next();
            })
            .catch(() => next(new Error('Invalid or expired token')));
    };
};
