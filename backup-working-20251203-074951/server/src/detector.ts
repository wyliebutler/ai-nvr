import ffmpeg from 'fluent-ffmpeg';
import { FeedModel } from './feeds';
import { SettingsModel } from './settings';
import nodemailer from 'nodemailer';

export class DetectorManager {
    private activeDetectors: Map<number, ffmpeg.FfmpegCommand> = new Map();
    private lastNotification: Map<number, number> = new Map();

    constructor() {
        this.startDetectionAllFeeds();
        setInterval(() => this.syncDetectors(), 60000);
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

    private startDetection(feed: any) {
        console.log(`Starting detection for feed ${feed.name}`);

        // Lightweight detection:
        // 1. Force TCP for reliability (if RTSP)
        // 2. Low framerate (1 fps) to reduce CPU usage
        // 3. Use select filter to detect scene changes > 10%
        // 4. Output metadata to pipe:1 (stdout)
        const isRtsp = feed.rtsp_url.startsWith('rtsp');
        const inputOptions = isRtsp ? ['-rtsp_transport tcp', '-r 1'] : ['-stream_loop -1', '-re', '-r 1'];

        const url = feed.rtsp_url.startsWith('file://') ? feed.rtsp_url.replace('file:///', '').replace('file://', '') : feed.rtsp_url;

        const command = ffmpeg(url)
            .inputOptions(inputOptions)
            .outputOptions([
                '-vf select=gt(scene\\,0.1),showinfo',
                '-f null',
            ])
            .output('NUL')
            .on('start', (cmdLine) => {
                console.log(`Detection started for ${feed.name}:`, cmdLine);
            })
            .on('stderr', (line) => {
                // showinfo logs to stderr with "n:..." or "pts_time:..."
                if (line.includes('pts_time')) {
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

        // Cooldown: 5 minutes
        if (now - last > 5 * 60 * 1000) {
            console.log(`Motion detected on ${feed.name}! Sending notification...`);
            this.lastNotification.set(feed.id, now);
            await this.sendNotification(feed);
        }
    }

    private async sendNotification(feed: any) {
        const settings = await SettingsModel.getAllSettings();
        if (!settings.smtp_host || !settings.notification_email) {
            console.log('SMTP settings not configured, skipping email.');
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
            await transporter.sendMail({
                from: '"NVR System" <no-reply@nvr.local>',
                to: settings.notification_email,
                subject: `Motion Detected: ${feed.name}`,
                text: `Motion was detected on camera ${feed.name} at ${new Date().toLocaleString()}.`,
            });
            console.log('Notification sent.');
        } catch (error) {
            console.error('Failed to send notification:', error);
        }
    }
}
