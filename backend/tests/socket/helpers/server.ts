import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { prisma } from '../../../src/lib/db.js';
import { registerGameHandlers } from '../../../src/socket/game-handler.js';
import type {
    ClientEvents,
    ServerEvents,
    EmptyEvents,
    SocketData,
} from '../../../src/types/socket.js';

export const startTestServer = function (): Promise<{
    port: number;
    close: () => Promise<void>;
}> {
    const httpServer = createServer();
    const io = new Server<ClientEvents, ServerEvents, EmptyEvents, SocketData>(
        httpServer,
    );

    io.use(function (socket, next) {
        socket.data.userId = socket.handshake.auth.token as string;
        next();
    });

    io.on('connection', function (socket) {
        registerGameHandlers(io, socket, prisma);
    });

    return new Promise(function (resolve) {
        httpServer.listen(0, function () {
            const { port } = httpServer.address() as AddressInfo;

            resolve({
                port,
                close: function () {
                    return io.close();
                },
            });
        });
    });
};
