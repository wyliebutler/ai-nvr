import ffmpeg from 'fluent-ffmpeg';
import { FeedModel } from './feeds';
import { SettingsModel } from './settings';
import { NotificationModel } from './notifications';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export class DetectorManager {
    private static instance: DetectorManager;
    private activeDetectors: Map<number, ffmpeg.FfmpegCommand> = new Map();
    private lastNotification: Map<number, number> = new Map();

    private constructor() {
        this.startDetectionAllFeeds();
        setInterval(() => this.syncDetectors(), 60000);
    }

    public static getInstance(): DetectorManager {
        if (!DetectorManager.instance) {
            DetectorManager.instance = new DetectorManager();
        }
        return DetectorManager.instance;
    }

    public async refresh() {
        console.log('Refreshing detectors...');
        await this.syncDetectors();
    }

    private async startDetectionAllFeeds() {
        const feeds = await FeedModel.getAllFeeds();
        for (const feed of feeds) {
            this.startDetection(feed);
        }
    }

    private async syncDetectors() {
        const feeds = await FeedModel.getAllFeeds();
        const feedIds = new Set(feeds.map(f => f.id));

        for (const [id, command] of this.activeDetectors) {
            if (!feedIds.has(id)) {
                command.kill('SIGKILL');
                this.activeDetectors.delete(id);
            }
        }

        for (const feed of feeds) {
            if (!this.activeDetectors.has(feed.id)) {
                this.startDetection(feed);
            }
        }
    }

    private async startDetection(feed: any) {
        console.log(`Starting detection for feed ${feed.name}`);

        const settings = await SettingsModel.getAllSettings();
        const sensitivity = settings.motion_sensitivity || 'medium';
        let threshold = 0.015; // Default (medium)

        switch (sensitivity) {
            case 'high':
                threshold = 0.002;
                break;
            case 'low':
                threshold = 0.05; // Increased from 0.025 (less sensitive)
                break;
            case 'very_low':
                threshold = 0.15; // Increased from 0.075 (much less sensitive)
                break;
            case 'medium':
            default:
                threshold = 0.015;
                break;
        }

        console.log(`Using sensitivity: ${sensitivity} (threshold: ${threshold})`);

        // Lightweight detection:
        // 1. Force TCP for reliability (if RTSP)
        // 2. Low framerate (1 fps) to reduce CPU usage
        // 3. Use select filter to detect scene changes > threshold
        // 4. Output metadata to pipe:1 (stdout)
        const url = feed.rtsp_url.startsWith('file://') ? feed.rtsp_url.replace('file:///', '').replace('file://', '') : feed.rtsp_url;
        const isRtsp = url.startsWith('rtsp');
        const inputOptions = isRtsp ? ['-rtsp_transport tcp', '-r 1'] : ['-stream_loop -1', '-re', '-r 1'];

        const command = ffmpeg(url)
            .inputOptions(inputOptions)
            .outputOptions([
                `-vf select=gt(scene\\,${threshold}),showinfo`,
                '-f null',
            ])
            .output('/dev/null')
            .on('start', (cmdLine) => {
                console.log(`Detection started for ${feed.name}:`, cmdLine);
            })
            .on('stderr', (line) => {
                // Log everything for debugging
                console.log(`[Detector ${feed.name}] ${line}`);

                // showinfo logs to stderr with "n:..." or "pts_time:..."
                if (line.includes('pts_time')) {
                    console.log(`[Motion Debug] Scene change detected on ${feed.name}: ${line}`);
                    this.handleMotion(feed);
                }
            })
            .on('error', (err) => {
                console.error(`Detection error for ${feed.name}:`, err.message);
                // Simple retry logic: remove from active so it gets restarted by sync
                this.activeDetectors.delete(feed.id);
            });

        command.run();
        this.activeDetectors.set(feed.id, command);
    }

    private async handleMotion(feed: any) {
        const now = Date.now();
        const last = this.lastNotification.get(feed.id) || 0;

        const settings = await SettingsModel.getAllSettings();
        // Default to 15 minutes if not set
        const intervalMinutes = parseInt(settings.notification_interval || '15', 10);
        const cooldownMs = intervalMinutes * 60 * 1000;

        if (now - last > cooldownMs) {
            console.log(`Motion detected on ${feed.name}! Sending notification...`);
            this.lastNotification.set(feed.id, now);

            const snapshotPath = await this.captureSnapshot(feed);
            await this.sendNotification(feed, snapshotPath);

            if (snapshotPath && fs.existsSync(snapshotPath)) {
                fs.unlinkSync(snapshotPath);
            }
        }
    }

    private captureSnapshot(feed: any): Promise<string | null> {
        return new Promise((resolve) => {
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const filename = `snapshot-${feed.id}-${Date.now()}.jpg`;
            const outputPath = path.join(tempDir, filename);

            const url = feed.rtsp_url.startsWith('file://') ? feed.rtsp_url.replace('file:///', '').replace('file://', '') : feed.rtsp_url;
            const isRtsp = url.startsWith('rtsp');

            // Capture a single frame
            ffmpeg(url)
                .inputOptions(isRtsp ? ['-rtsp_transport tcp'] : [])
                .outputOptions(['-vframes 1', '-f image2'])
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err) => {
                    console.error(`Snapshot capture failed for ${feed.name}:`, err.message);
                    resolve(null);
                })
                .run();
        });
    }

    private async sendNotification(feed: any, snapshotPath: string | null) {
        const settings = await SettingsModel.getAllSettings();

        // Check Home/Away mode
        if (settings.system_mode === 'home') {
            console.log('System is in Home mode, skipping email notification.');
            await NotificationModel.create(feed.id, 'motion', 'Motion');
            return;
        }

        if (!settings.smtp_host || !settings.notification_email) {
            console.log('SMTP settings not configured, skipping email.');
            await NotificationModel.create(feed.id, 'motion', 'Motion');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: Number(settings.smtp_port) || 587,
            secure: false,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass,
            },
        });

        try {
            const mailOptions: any = {
                from: '"NVR System" <no-reply@nvr.local>',
                to: settings.notification_email,
                subject: `Motion Detected: ${feed.name}`,
                text: `Motion was detected on camera ${feed.name} at ${new Date().toLocaleString('en-US', { timeZone: 'America/St_Johns', dateStyle: 'full', timeStyle: 'medium' })}.`,
                attachments: []
            };

            if (snapshotPath) {
                mailOptions.attachments.push({
                    filename: 'snapshot.jpg',
                    path: snapshotPath
                });
            }

            await transporter.sendMail(mailOptions);
            console.log('Notification sent.');
            await NotificationModel.create(feed.id, 'email', 'Motion');
        } catch (error) {
            console.error('Failed to send notification:', error);
            await NotificationModel.create(feed.id, 'error', 'Email failed');
        }
    }
}
