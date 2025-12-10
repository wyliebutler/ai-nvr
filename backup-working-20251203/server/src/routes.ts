import express from 'express';
import { AuthModel, UserSchema } from './auth';
import { FeedModel, FeedSchema } from './feeds';
import { SettingsModel } from './settings';
import jwt from 'jsonwebtoken';
import path from 'path';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Middleware to check auth
const requireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware to check admin
const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

// --- Auth & Setup ---

router.get('/setup-status', async (req, res) => {
    try {
        const count = await AuthModel.countUsers();
        res.json({ requiresSetup: count === 0 });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/setup', async (req, res) => {
    try {
        const count = await AuthModel.countUsers();
        if (count > 0) {
            return res.status(403).json({ error: 'Setup already completed' });
        }

        const data = UserSchema.parse({ ...req.body, role: 'admin' });
        const user = await AuthModel.createUser(data);
        res.json(user);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await AuthModel.login(username, password);
        if (!result) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const data = UserSchema.parse(req.body);
        const user = await AuthModel.createUser(data);
        res.json(user);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// --- Feeds ---

router.get('/feeds', requireAuth, async (req, res) => {
    try {
        const feeds = await FeedModel.getAllFeeds();
        res.json(feeds);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch feeds' });
    }
});

router.post('/feeds', requireAuth, requireAdmin, async (req, res) => {
    try {
        const data = FeedSchema.parse(req.body);
        const feed = await FeedModel.createFeed(data);
        res.json(feed);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/feeds/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        await FeedModel.deleteFeed(Number(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete feed' });
    }
});

router.put('/feeds/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const data = FeedSchema.parse(req.body);
        const feed = await FeedModel.updateFeed(Number(req.params.id), data);
        res.json(feed);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/feeds/:id/recordings', requireAuth, async (req, res) => {
    try {
        // TODO: Ideally we should use dependency injection or a singleton for RecorderManager
        // For now, we'll instantiate a temporary one or move the logic to a static method/helper
        // But RecorderManager is stateful.
        // Let's export the instance from index.ts or make it a singleton.
        // Or just use fs directly here for simplicity since we just list files.

        const feedId = req.params.id;
        const recordingsDir = path.join(process.cwd(), 'recordings', feedId);

        try {
            const fs = require('fs');
            if (!fs.existsSync(recordingsDir)) {
                return res.json([]);
            }

            const files = await fs.promises.readdir(recordingsDir);
            const recordings = files
                .filter((f: string) => f.endsWith('.mp4'))
                .map((f: string) => ({
                    filename: f,
                    url: `/recordings/${feedId}/${f}`,
                    timestamp: f.replace('.mp4', '')
                }))
                .sort((a: any, b: any) => b.filename.localeCompare(a.filename));

            res.json(recordings);
        } catch (err) {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

// --- Settings ---

router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await SettingsModel.getAllSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

router.post('/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await SettingsModel.updateSettings(req.body);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
