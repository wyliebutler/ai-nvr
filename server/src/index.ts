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
import { NotificationModel } from './notifications';
import { AuthModel } from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);
app.use('/vod', express.static('recordings'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

async function startServer() {
    try {
        await initDB();

        // Check for default admin
        const userCount = await AuthModel.countUsers();
        if (userCount === 0) {
            console.log('No users found. Creating default admin account...');
            await AuthModel.createUser({
                username: 'admin',
                password: 'admin123',
                role: 'admin'
            });
            console.log('Default admin created: admin / admin123');
        }

        const server = http.createServer(app);
        const wss = new WebSocketServer({ server });
        new StreamManager(wss);
        new RecorderManager();
        new DetectorManager();

        // Schedule log cleanup every hour
        setInterval(() => {
            console.log('Running log cleanup...');
            NotificationModel.cleanupOldLogs(24).catch(err => console.error('Cleanup failed:', err));
        }, 60 * 60 * 1000);

        // Run once on startup
        NotificationModel.cleanupOldLogs(24).catch(err => console.error('Startup cleanup failed:', err));

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

