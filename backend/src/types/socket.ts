import type { RemoteSocket, Server, Socket } from 'socket.io';

export type SocketData = { userId: string };

type EmptyEvents = Record<string, never>;

export type GameServer = Server<
    EmptyEvents,
    EmptyEvents,
    EmptyEvents,
    SocketData
>;
export type GameSocket = Socket<
    EmptyEvents,
    EmptyEvents,
    EmptyEvents,
    SocketData
>;
export type GameRemoteSocket = RemoteSocket<EmptyEvents, SocketData>;
