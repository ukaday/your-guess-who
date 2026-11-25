import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@your-guess-who/contract';

export type SocketData = { userId: string; gameId?: string };

export type EmptyEvents = Record<string, never>;

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
