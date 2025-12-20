import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { FeedModel } from './feeds';
import { MediaProxyService } from './media-proxy';
import { SettingsModel } from './settings';
import { logger } from './utils/logger';
import { EventBus } from './utils/event-bus';

const recorderLogger = logger.child({ module: 'recorder' });

const RECORDINGS_DIR = path.resolve(__dirname, '../recordings');

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

interface ActiveRecording {
    command: ffmpeg.FfmpegCommand;
    timeout: NodeJS.Timeout;
    feedId: number;
    startTime: number;
}

export class RecorderManager {
    private static instance: RecorderManager;
    private activeRecordings: Map<number, ActiveRecording> = new Map();
    // Default recording duration after last motion
    private readonly RECORDING_TIMEOUT_MS = 60 * 1000;

    private constructor() {
        // this.wipeRecordings(); // Removed: Manual wipe only to prevent data loss on restart
        this.setupEventListeners();

        // Cleanup old files every hour
        setInterval(() => this.cleanupOldRecordings(), 3600 * 1000);
    }

    public static getInstance(): RecorderManager {
        if (!RecorderManager.instance) {
            RecorderManager.instance = new RecorderManager();
        }
        return RecorderManager.instance;
    }

    public getActivePids(): number[] {
        const pids: number[] = [];
        for (const session of this.activeRecordings.values()) {
            const pid = (session.command as any).ffmpegProc?.pid;
            if (pid) pids.push(pid);
        }
        return pids;
    }

    private wipeRecordings() {
        recorderLogger.warn('Wiping all existing recordings as per configuration/deployment...');
        try {
            // Helper to recursively delete
            const deleteFolderRecursive = (directoryPath: string) => {
                if (fs.existsSync(directoryPath)) {
                    fs.readdirSync(directoryPath).forEach((file, index) => {
                        const curPath = path.join(directoryPath, file);
                        if (fs.lstatSync(curPath).isDirectory()) { // recurse
                            deleteFolderRecursive(curPath);
                        } else { // delete file
                            fs.unlinkSync(curPath);
                        }
                    });
                    // Don't remove the root recordings dir itself, just contents, or remove and recreate
                }
            };

            // Delete content of RECORDINGS_DIR
            const files = fs.readdirSync(RECORDINGS_DIR);
            for (const file of files) {
                const curPath = path.join(RECORDINGS_DIR, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    deleteFolderRecursive(curPath);
                    fs.rmdirSync(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            }
            recorderLogger.info('Recordings wiped successfully.');
        } catch (err) {
            recorderLogger.error({ err }, 'Failed to wipe recordings');
        }
    }

    private setupEventListeners() {
        EventBus.getInstance().on('motion:detected', (data: { feedId: number }) => {
            this.handleMotion(data.feedId);
        });
    }

    private async handleMotion(feedId: number) {
        if (this.activeRecordings.has(feedId)) {
            // Extend recording
            recorderLogger.debug({ feedId }, 'Motion continues, extending recording timeout');
            const session = this.activeRecordings.get(feedId)!;
            clearTimeout(session.timeout);
            session.timeout = setTimeout(() => this.stopRecording(feedId), this.RECORDING_TIMEOUT_MS);
        } else {
            // Start new recording
            recorderLogger.info({ feedId }, 'Motion detected, starting recording');
            try {
                const feed = await FeedModel.getFeedById(feedId);
                if (feed) {
                    this.startRecording(feed);
                }
            } catch (err) {
                recorderLogger.error({ err, feedId }, 'Failed to start recording');
            }
        }
    }

    private startRecording(feed: any) {
        const feedDir = path.join(RECORDINGS_DIR, feed.id.toString());
        if (!fs.existsSync(feedDir)) {
            fs.mkdirSync(feedDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}.mp4`;
        const filePath = path.join(feedDir, filename);

        // ALWAYS use the proxy for stability
        const url = MediaProxyService.getInstance().getProxyUrl(feed);
        const isRtsp = url.startsWith('rtsp');

        const inputOptions = isRtsp ? ['-rtsp_transport tcp'] : [];

        const command = ffmpeg(url)
            .inputOptions(inputOptions)
            .outputOptions([
                '-c:v copy',            // Stream copy (zero CPU)
                '-an',                  // No audio
                '-movflags +faststart', // Web playback friendly
            ])
            .output(filePath)
            .on('start', (cmdLine) => {
                recorderLogger.info({ feedId: feed.id, file: filename }, 'Recording started');
            })
            .on('error', (err) => {
                recorderLogger.error({ err, feedId: feed.id }, 'Recording error');
                this.stopRecording(feed.id, true);
            })
            .on('end', () => {
                recorderLogger.info({ feedId: feed.id }, 'Recording file closed');
            });

        command.run();

        const timeout = setTimeout(() => this.stopRecording(feed.id), this.RECORDING_TIMEOUT_MS);

        this.activeRecordings.set(feed.id, {
            command,
            timeout,
            feedId: feed.id,
            startTime: Date.now()
        });
    }

    private stopRecording(feedId: number, force = false) {
        const session = this.activeRecordings.get(feedId);
        if (!session) return;

        recorderLogger.info({ feedId }, 'Stopping recording (timeout or force)');

        clearTimeout(session.timeout);

        // Gentle stop first
        if (!force) {
            session.command.kill('SIGTERM');

            // Force kill watchdog
            setTimeout(() => {
                // If it's still running (we can't easily check state on fluent-ffmpeg object, 
                // but if we wanted to be robust we'd track PID). 
                // For now, valid fire-and-forget kill logic:
                try {
                    session.command.kill('SIGKILL');
                } catch (e) { }
            }, 2000);
        } else {
            session.command.kill('SIGKILL');
        }

        this.activeRecordings.delete(feedId);
    }

    public async refresh() {
        recorderLogger.info('Refreshing recordings (No-op in event driven mode)');
    }

    public async stop() {
        recorderLogger.info('Stopping all active recordings...');
        for (const [id, session] of this.activeRecordings) {
            clearTimeout(session.timeout);
            session.command.kill('SIGKILL');
        }
        this.activeRecordings.clear();
    }

    // Reuse existing logic for cleaning old files
    private async cleanupOldRecordings() {
        recorderLogger.info('Running cleanup job...');
        const now = Date.now();
        let maxAge = 24 * 60 * 60 * 1000; // Default 24h

        try {
            const settings = await SettingsModel.getAllSettings();
            if (settings.recording_retention && settings.recording_retention > 0) {
                maxAge = settings.recording_retention * 60 * 60 * 1000;
            }
        } catch (err) { /* ignore */ }

        const processDir = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    processDir(filePath);
                } else {
                    if (now - stat.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        };

        processDir(RECORDINGS_DIR);
    }

    async getRecordings(feedId: number) {
        const feedDir = path.join(RECORDINGS_DIR, feedId.toString());
        try {
            if (!fs.existsSync(feedDir)) return [];

            const files = await fs.promises.readdir(feedDir);
            return files
                .filter(f => f.endsWith('.mp4'))
                .map(f => ({
                    filename: f,
                    url: `/recordings/${feedId}/${f}`,
                    timestamp: f.replace('.mp4', '')
                }))
                .sort((a, b) => b.filename.localeCompare(a.filename));
        } catch (error) {
            return [];
        }
    }
}
