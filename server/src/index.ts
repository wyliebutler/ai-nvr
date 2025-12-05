import { app } from './app';
import { StreamManager } from './stream';
import { RecorderManager } from './recorder';
import { DetectorManager } from './detector';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import http from 'http';

import { initDB } from './db';

const PORT = process.env.PORT || 7000;

// Initialize Database
initDB().then(() => {
    console.log('Database initialized');
});

// Create HTTP Server (needed for WS)
const server = http.createServer(app);

// Initialize WS Server
const wss = new WebSocketServer({ server });

// Initialize Managers
const streamManager = new StreamManager(wss);
const recorderManager = new RecorderManager();
const detectorManager = new DetectorManager();

// Create admin user if not exists
import { AuthModel } from './auth';
setTimeout(async () => {
    try {
        const users = await AuthModel.getAllUsers();
        if (users.length === 0) {
            console.log('No users found. Creating default admin...');
            await AuthModel.createUser({
                username: 'admin',
                password: 'admin',
                role: 'admin'
            });
            console.log('Default admin created.');
        }
    } catch (err) {
        console.error('Failed to check/create default admin:', err);
    }
}, 1000);

// Log cleanup interval
const LOGS_DIR = path.resolve(__dirname, '../logs');
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}
function cleanupLogs() {
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    try {
        const files = fs.readdirSync(LOGS_DIR);
        for (const file of files) {
            const filePath = path.join(LOGS_DIR, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > MAX_AGE) {
                fs.unlinkSync(filePath);
            }
        }
    } catch (e) {
        console.error('Log cleanup failed:', e);
    }
}
setInterval(cleanupLogs, 24 * 60 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
