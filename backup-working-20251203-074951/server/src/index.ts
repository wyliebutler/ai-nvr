import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDB } from './db';
import routes from './routes';
import { StreamManager } from './stream';
import { RecorderManager } from './recorder';
import { DetectorManager } from './detector';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);
app.use('/recordings', express.static('recordings'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

async function startServer() {
    try {
        await initDB();

        const server = http.createServer(app);
        const wss = new WebSocketServer({ server });
        new StreamManager(wss);
        new RecorderManager();
        new DetectorManager();

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

