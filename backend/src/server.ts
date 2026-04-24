import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { prisma } from './db.js';
import { createApp } from './app.js';
import { env } from './env.js';

const app = createApp(prisma, env.FRONTEND_ORIGIN);
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN },
});

io.on('connection', (socket) => {
    console.log('client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id);
    });
});

httpServer.listen(env.PORT, () => {
    console.log(`server running on port ${env.PORT}`);
});
