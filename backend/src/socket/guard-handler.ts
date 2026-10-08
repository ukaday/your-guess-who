import type { GameSocket } from '../types/socket.js';

export type ErrorLogger = (err: unknown) => void;

export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

export function createHandlerGuard(socket: GameSocket, logger: ErrorLogger) {
    return async function guard(
        handler: () => Promise<void>,
        ack?: () => void,
    ) {
        try {
            await handler();
        } catch (err) {
            logger(err);

            socket.emit('game:error', { message: INTERNAL_ERROR_MESSAGE });
        } finally {
            ack?.();
        }
    };
}
