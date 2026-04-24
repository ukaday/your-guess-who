import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { prisma } from './db.js';
import { createApp } from './app.js';

const app = createApp(prisma);
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173' },
});

io.on('connection', (socket) => {
    console.log('client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id);
    });
});

const PORT = process.env['PORT'] ?? 3000;
httpServer.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});
