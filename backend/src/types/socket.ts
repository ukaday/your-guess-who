import type { RemoteSocket, Server, Socket } from 'socket.io';
import type { Game, GamePlayer } from '../generated/prisma/client.js';

export type SocketData = { userId: string };

export type EmptyEvents = Record<string, never>;

export type ClientEvents = {
    'game:join': (payload: GameJoinPayload) => void;
};

export type ServerEvents = {
    'game:started': (state: GameSnapshotPayload) => void;
    'game:error': (payload: GameErrorPayload) => void;
    'game:your-card': (payload: GameYourCardPayload) => void;
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
