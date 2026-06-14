import type { RemoteSocket, Server, Socket } from 'socket.io';
import type { Game, GamePlayer } from '../generated/prisma/client.js';

export type SocketData = { userId: string; gameId?: string };

export type EmptyEvents = Record<string, never>;

export type ClientEvents = {
    'game:join': (payload: GameJoinPayload, ack?: () => void) => void;
    'game:eliminate': () => void;
    'game:guess': (payload: GameGuessPayload) => void;
};

export type ServerEvents = {
    'game:started': (state: GameSnapshotPayload) => void;
    'game:error': (payload: GameErrorPayload) => void;
    'game:your-card': (payload: GameYourCardPayload) => void;
    'game:active-player-changed': (
        payload: GameActivePlayerChangedPayload,
    ) => void;
    'game:guess-wrong': (payload: GameGuessWrongPayload) => void;
    'game:over': (payload: GameOverPayload) => void;
};

export type GameServer = Server<
    ClientEvents,
    ServerEvents,
    EmptyEvents,
    SocketData
>;

export type GameSocket = Socket<
    ClientEvents,
    ServerEvents,
    EmptyEvents,
    SocketData
>;

export type GameRemoteSocket = RemoteSocket<ServerEvents, SocketData>;

export type GameJoinPayload = { gameId: string };
export type GameSnapshotPayload = Game & { players: GamePlayer[] };
export type GameErrorPayload = { message: string };
export type GameYourCardPayload = { cardId: string };
export type GameActivePlayerChangedPayload = { activePlayerId: string };
export type GameGuessPayload = { cardId: string };
export type GameGuessWrongPayload = {
    activePlayerId: string;
    guessedCardId: string;
};
export type GameOverPayload = { winnerId: string };
