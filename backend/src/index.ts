import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173' }
})
const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] })
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
})

io.on('connection', (socket) => {
    console.log('client connected:', socket.id)

    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id)
    })
})

const PORT = process.env.PORT ?? 3000
httpServer.listen(PORT, () => {
    console.log(`server running on port ${PORT}`)
})
