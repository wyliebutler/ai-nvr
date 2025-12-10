import express from 'express';
import { AuthModel, UserSchema } from './auth';
import { FeedModel, FeedSchema } from './feeds';
import { SettingsModel } from './settings';
import { NotificationModel } from './notifications';
import { DetectorManager } from './detector';
import { RecorderManager } from './recorder';
import { MediaProxyService } from './media-proxy';
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

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await AuthModel.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        await AuthModel.deleteUser(Number(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
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

        // Refresh managers immediately
        await DetectorManager.getInstance().refresh();
        await RecorderManager.getInstance().refresh();

        // Update MediaMTX Config
        MediaProxyService.getInstance().registerFeedInConfig(feed);

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
                    url: `/vod/${feedId}/${f}`,
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
        console.log('Fetching settings:', settings);
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

router.post('/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await SettingsModel.updateSettings(req.body);

        // Restart detectors to apply new sensitivity settings
        await DetectorManager.getInstance().restartAll();

        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

router.post('/test-email', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { smtp_host, smtp_port, smtp_user, smtp_pass, notification_email } = req.body;

        console.log('Test email request:', {
            smtp_host,
            smtp_port,
            smtp_user,
            notification_email,
            has_pass: !!smtp_pass
        });

        if (!smtp_host || !notification_email) {
            return res.status(400).json({ error: 'Missing SMTP host or notification email' });
        }

        // Dynamic import to avoid top-level dependency if not used elsewhere (though it is used in detector.ts)
        // or just use the one we'll import at the top.
        // Since detector.ts uses it, it's already in package.json.
        const nodemailer = require('nodemailer');

        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: Number(smtp_port) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: smtp_user,
                pass: smtp_pass,
            },
        });

        await transporter.sendMail({
            from: '"NVR System" <no-reply@nvr.local>',
            to: notification_email,
            subject: 'Test Notification - AI NVR',
            text: 'This is a test email from your AI NVR system. If you received this, your email settings are correct.',
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Test email failed:', error);
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const result = await NotificationModel.getRecent(page, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

export default router;
