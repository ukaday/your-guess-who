import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173' }
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => {
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
