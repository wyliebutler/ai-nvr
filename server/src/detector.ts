import ffmpeg from 'fluent-ffmpeg';
import { FeedModel } from './feeds';
import { SettingsModel } from './settings';
import { NotificationModel } from './notifications';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { MediaProxyService } from './media-proxy';
// import { logger } from './utils/logger';


export class DetectorManager {
    private static instance: DetectorManager;
    private activeDetectors: Map<number, ffmpeg.FfmpegCommand> = new Map();
    private lastNotification: Map<number, number> = new Map();
    private lastActive: Map<number, number> = new Map();
    private lastStartAttempt: Map<number, number> = new Map();
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
        // logger call commented out
        // info('Refreshing detectors...');
        await this.syncDetectors();
    }

    public async stop() {
        // logger call commented out
        // info('Stopping all detectors...');
        const promises = [];
        for (const [id, command] of this.activeDetectors) {
            promises.push(new Promise<void>((resolve) => {
                // Set a timeout to force resolve if ffmpeg hangs
                const timeout = setTimeout(() => {
                    // logger call commented out
                    // warn({ feedId: id }, `Detector stop timed out, forcing kill.`);
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
        const now = Date.now();

        // Check for removed feeds OR stuck feeds
        for (const [id, command] of this.activeDetectors) {
            if (!feedIds.has(id)) {
                console.log(`Removing detector for feed ${id}`);
                command.kill('SIGTERM');
                this.activeDetectors.delete(id);
                this.lastActive.delete(id);
                continue;
            }

            // Check for stuck process (no output for 2 minutes)
            const last = this.lastActive.get(id) || 0;
            // Allow a grace period for startup (if lastActive is 0 or close to start time)
            // But we initialize lastActive to Date.now() on start, so it should be fine.
            if (now - last > 120000) { // 2 minutes
                console.log(`Detector for feed ${id} appears stuck (no activity for 2m). Restarting...`);
                command.kill('SIGKILL');
                this.activeDetectors.delete(id);
                this.lastActive.delete(id);
                // It will be restarted in the next loop below
            }
        }

        for (const feed of feeds) {
            if (!this.activeDetectors.has(feed.id)) {
                this.startDetection(feed);
            }
        }
    }

    protected resolveUrl(feed: any): string {
        const rawUrl = feed.rtsp_url.startsWith('file://') ? feed.rtsp_url.replace('file:///', '').replace('file://', '') : feed.rtsp_url;
        const isRtsp = rawUrl.startsWith('rtsp');
        // Use proxy for RTSP
        return isRtsp ? MediaProxyService.getInstance().getProxyUrl(feed) : rawUrl;
    }

    private async startDetection(feed: any) {
        const lastStart = this.lastStartAttempt.get(feed.id) || 0;
        const now = Date.now();
        if (now - lastStart < 10000) { // 10s cooldown
            // logger call commented out
            // debug({ feedId: feed.id, name: feed.name }, 'Skipping start (cooldown active)');
            return;
        }
        this.lastStartAttempt.set(feed.id, now);

        // logger call commented out
        // info({ feedId: feed.id, name: feed.name }, 'Starting detection');

        const settings = await SettingsModel.getAllSettings();
        const sensitivity = settings.motion_sensitivity; // Schema defaults to 'medium'
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

        // Log sensitivity



        const url = this.resolveUrl(feed);
        const isRtsp = url.startsWith('rtsp');



        // Decrease frame rate to 2fps for lower CPU usage
        // Add hardware acceleration (auto) to use mapped /dev/dri if available
        const inputOptions = isRtsp
            ? ['-hwaccel auto', '-rtsp_transport tcp', '-r 2']
            : ['-hwaccel auto', '-stream_loop -1', '-re', '-r 2'];

        const command = ffmpeg(url)
            .inputOptions(inputOptions)
            .outputOptions([
                `-vf scale=320:-1,select=gt(scene\\,${threshold}),showinfo`,
                '-f null',
            ])
            .output('/dev/null')
            .on('start', (cmdLine) => {
                // logger call commented out
                // info({ feedId: feed.id, cmd: cmdLine }, 'Detection started');

                // EXPLICIT PID TRACKING
                const pid = (command as any).ffmpegProc.pid;
                console.log(`[Detector] Started FFmpeg process for ${feed.name} (PID: ${pid})`);

                // Monkey-patch kill to ensure we use process.kill
                const originalKill = command.kill.bind(command);
                command.kill = (signal = 'SIGKILL') => {
                    console.log(`[Detector] Force killing FFmpeg PID: ${pid}`);
                    try {
                        if (pid) process.kill(pid, 'SIGKILL');
                    } catch (e: any) {
                        if (e.code !== 'ESRCH') {
                            console.error(`[Detector] Failed to kill process ${pid}:`, e);
                        }
                    }
                    return originalKill(signal);
                };
            })
            .on('stderr', (line) => {
                // Update last active time
                this.lastActive.set(feed.id, Date.now());

                if (line.includes('pts_time')) {
                    // Verbose motion log - useful for calibration but spammy in prod
                    // // logger call commented out
                    // trace({ feedId: feed.id, line }, 'Motion debug');
                    this.handleMotion(feed);
                }
            })
            .on('error', (err) => {
                // logger call commented out
                // error({ feedId: feed.id, err }, 'Detection error');
                // CRITICAL FIX: Force kill the process to prevent zombies when error occurs but process hangs
                command.kill('SIGKILL');
                this.activeDetectors.delete(feed.id);
            })
            .on('end', () => {
                // logger call commented out
                // info({ feedId: feed.id }, 'Detection process ended');
                this.activeDetectors.delete(feed.id);
            });

        command.run();



        this.activeDetectors.set(feed.id, command);
        this.lastActive.set(feed.id, Date.now()); // Initialize timestamp


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
        const intervalMinutes = settings.notification_interval ?? 15;
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
