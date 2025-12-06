import ffmpeg from 'fluent-ffmpeg';
import { FeedModel } from './feeds';
import { SettingsModel } from './settings';
import { NotificationModel } from './notifications';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { MediaProxyService } from './media-proxy';

export class DetectorManager {
    private static instance: DetectorManager;
    private activeDetectors: Map<number, ffmpeg.FfmpegCommand> = new Map();
    private lastNotification: Map<number, number> = new Map();
    private processing: Set<number> = new Set();

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

    public async stop() {
        console.log('Stopping all detectors...');
        const promises = [];
        for (const [id, command] of this.activeDetectors) {
            promises.push(new Promise<void>((resolve) => {
                // Set a timeout to force resolve if ffmpeg hangs
                const timeout = setTimeout(() => {
                    console.log(`Detector ${id} stop timed out, forcing kill.`);
                    command.kill('SIGKILL');
                    resolve();
                }, 2000);

                command.on('end', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                command.on('error', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                command.kill('SIGINT');
            }));
        }
        await Promise.all(promises);
        this.activeDetectors.clear();
        console.log('All detectors stopped.');
    }

    public async restartAll() {
        console.log('Restarting all detectors...');
        await this.stop();
        await this.startDetectionAllFeeds();
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
                command.kill('SIGTERM');
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
                threshold = 0.001; // Was 0.002
                break;
            case 'low':
                threshold = 0.025; // Was 0.05
                break;
            case 'very_low':
                threshold = 0.10; // Was 0.15
                break;
            case 'medium':
            default:
                threshold = 0.008; // Was 0.015
                break;
        }

        console.log(`Using sensitivity: ${sensitivity} (threshold: ${threshold})`);

        const rawUrl = feed.rtsp_url.startsWith('file://') ? feed.rtsp_url.replace('file:///', '').replace('file://', '') : feed.rtsp_url;
        const isRtsp = rawUrl.startsWith('rtsp');
        // Use proxy for RTSP
        const url = isRtsp ? MediaProxyService.getInstance().getProxyUrl(feed) : rawUrl;

        console.log(`[Detector] Source for ${feed.name}: ${url}`);

        // Increase frame rate to 4fps for better responsiveness
        const inputOptions = isRtsp ? ['-rtsp_transport tcp', '-r 4'] : ['-stream_loop -1', '-re', '-r 4'];

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
                // console.log(`[Detector ${feed.name}] ${line}`);

                if (line.includes('pts_time')) {
                    // Extract scene score for debugging: "n:   1 pts:   12800 pts_time:0.1    pos:    22320 fmt:rgb24 sar:1/1 s:640x360 i:P iskey:1 type:I checksum:935F4C75 plane_checksum:[935F4C75] mean:[125] stdev:[12.5]"
                    // The 'scene' score is usually not in showinfo output directly unless using 'select' filter with debug? 
                    // Actually checking showinfo output it just means a frame PASSED the select filter.
                    console.log(`[Motion Debug] Motion detected on ${feed.name}: ${line}`);
                    this.handleMotion(feed);
                }
            })
            .on('error', (err) => {
                console.error(`Detection error for ${feed.name}:`, err.message);
                this.activeDetectors.delete(feed.id);
            });

        command.run();
        this.activeDetectors.set(feed.id, command);
    }

    private async handleMotion(feed: any) {
        // 1. Check if already processing an event for this feed
        if (this.processing.has(feed.id)) {
            console.log(`[Motion] Process lock active for feed ${feed.id}, skipping duplicate event.`);
            return;
        }

        const now = Date.now();
        const last = this.lastNotification.get(feed.id) || 0;

        const settings = await SettingsModel.getAllSettings();
        const intervalMinutes = parseInt(settings.notification_interval || '15', 10);
        const cooldownMs = intervalMinutes * 60 * 1000;

        // 2. Check cooldown BEFORE locking to fail fast
        if (now - last < cooldownMs) {
            // console.log(`[Motion] Cooldown active for feed ${feed.id} (${Math.ceil((cooldownMs - (now - last))/1000)}s remaining)`);
            return;
        }

        // 3. Acquire Lock
        this.processing.add(feed.id);

        try {
            // Double check inside lock (though atomic enough in JS single thread loop, good practice)
            if (now - this.lastNotification.get(feed.id)! < cooldownMs) return;

            console.log(`Motion detected on ${feed.name}! Sending notification...`);
            this.lastNotification.set(feed.id, now);

            const snapshotPath = await this.captureSnapshot(feed);
            await this.sendNotification(feed, snapshotPath);

            if (snapshotPath && fs.existsSync(snapshotPath)) {
                fs.unlinkSync(snapshotPath);
            }
        } catch (err) {
            console.error(`Error handling motion for feed ${feed.id}:`, err);
        } finally {
            // 4. Release Lock
            // Add a small delay to prevent rapid-fire triggers from the same motion event
            setTimeout(() => {
                this.processing.delete(feed.id);
            }, 5000);
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
