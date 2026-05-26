import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { prisma } from './lib/db.js';
import { cognito } from './lib/cognito.js';
import { s3 } from './lib/s3.js';
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { createSocketAuthMiddleware } from './middleware/socket-auth.js';
import { registerGameHandlers } from './socket/game-handler.js';
import type {
    ClientEvents,
    ServerEvents,
    EmptyEvents,
    SocketData,
} from './types/socket.js';

const app = createApp(prisma, cognito, s3, env.S3_BUCKET, env.FRONTEND_ORIGIN);
const httpServer = createServer(app);

const io = new Server<ClientEvents, ServerEvents, EmptyEvents, SocketData>(
    httpServer,
    {
        cors: { origin: env.FRONTEND_ORIGIN },
    },
);

const socketAuth = createSocketAuthMiddleware(
    env.COGNITO_USER_POOL_ID,
    env.COGNITO_CLIENT_ID,
);

io.use((socket, next) => {
    void socketAuth(socket, next);
});

io.on('connection', (socket) => {
    console.log('client connected:', socket.id);

    registerGameHandlers(io, socket, prisma);

    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id);
    });
});

httpServer.listen(env.PORT, () => {
    console.log(`server running on port ${env.PORT}`);
});
