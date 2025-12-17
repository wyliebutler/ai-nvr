import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { FeedModel } from './feeds';
import { MediaProxyService } from './media-proxy';
import { SettingsModel } from './settings';

const RECORDINGS_DIR = path.resolve(__dirname, '../recordings');

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

export class RecorderManager {
    private static instance: RecorderManager;
    private activeRecordings: Map<number, ffmpeg.FfmpegCommand> = new Map();
    private lastStartAttempt: Map<number, number> = new Map();

    private constructor() {
        this.startRecordingAllFeeds();
        // Check for new feeds or changes every minute (simplified)
        setInterval(() => this.syncRecordings(), 60000);
        // Cleanup old files every hour
        setInterval(() => this.cleanupOldRecordings(), 3600 * 1000);
    }

    public static getInstance(): RecorderManager {
        if (!RecorderManager.instance) {
            RecorderManager.instance = new RecorderManager();
        }
        return RecorderManager.instance;
    }

    public async refresh() {
        console.log('Refreshing recordings...');
        await this.syncRecordings();
    }

    private async startRecordingAllFeeds() {
        const feeds = await FeedModel.getAllFeeds();
        for (const feed of feeds) {
            this.startRecording(feed);
        }
    }

    private async syncRecordings() {
        const feeds = await FeedModel.getAllFeeds();
        const feedIds = new Set(feeds.map(f => f.id));

        // Stop removed feeds
        for (const [id, command] of this.activeRecordings) {
            if (!feedIds.has(id)) {
                console.log(`Stopping recording for feed ${id} gracefully...`);

                // Allow some time for ffmpeg to finish its buffer and write trailer
                command.kill('SIGTERM');

                // Set a timeout to force kill if it doesn't exit
                setTimeout(() => {
                    // Check if it's still in our map (meaning it hasn't emitted 'end'/'error' yet)
                    if (this.activeRecordings.has(id)) {
                        console.log(`Feed ${id} recording did not exit in time, forcing SIGKILL.`);
                        command.kill('SIGKILL'); // Force kill
                        this.activeRecordings.delete(id); // Clean up map manually if needed
                    }
                }, 5000);

                // We don't delete immediately here, we let the 'end'/'error' handler delete from map
                // But just in case handlers don't fire (unlikely with fluent-ffmpeg), the timeout handles it.
                // However, for syncRecordings loop safely, we might want to mark it as "stopping" if we were tracking state more complexly.
                // For now, removing from map immediately prevents double-killing if sync runs again quickly?
                // Actually, if we remove it from map immediately, the timeout closure still has the reference to 'command' so it works.
                // BUT, 'end' handler tries to delete(id). If we delete here, 'end' handler does nothing (fine).
                // Issue: If we remove from map, next sync cycle sees it's missing (correct) but starts a NEW one?
                // Wait, logic is: "if (!feedIds.has(id))" -> stop it.
                // If we remove from activeRecordings, the start logic "if (!this.activeRecordings.has(feed.id))" will trigger.
                // But feedIds DOES NOT have id (that's why we are stopping). So it won't restart.
                // So it is safe to remove from map immediately?
                // NO. If we remove from map, we lose the reference to the "stopping" process.
                // If we leave it, next sync cycle finds it again and sends SIGTERM again (idempotent, kind of).
                // Let's remove from map immediately to keep state clean, assuming kill() works or timeout works.
                this.activeRecordings.delete(id);
            }
        }

        // Start new feeds
        for (const feed of feeds) {
            if (!this.activeRecordings.has(feed.id)) {
                this.startRecording(feed);
            }
        }
    }

    private startRecording(feed: any) {
        const lastStart = this.lastStartAttempt.get(feed.id) || 0;
        const now = Date.now();
        if (now - lastStart < 10000) { // 10s cooldown
            console.log(`[Recorder] Skipping start for feed ${feed.name} (cooldown active)`);
            return;
        }
        this.lastStartAttempt.set(feed.id, now);

        console.log(`Starting recording for feed ${feed.name} (${feed.id})`);
        const feedDir = path.join(RECORDINGS_DIR, feed.id.toString());

        if (!fs.existsSync(feedDir)) {
            fs.mkdirSync(feedDir, { recursive: true });
        }

        // FFmpeg command to segment video
        // FFmpeg command to segment video
        const isRtsp = feed.rtsp_url.startsWith('rtsp');
        const inputOptions = isRtsp ? ['-rtsp_transport tcp'] : ['-stream_loop -1', '-re']; // 20s timeout

        const url = feed.rtsp_url.startsWith('file://')
            ? feed.rtsp_url.replace('file:///', '').replace('file://', '')
            : MediaProxyService.getInstance().getProxyUrl(feed);

        const command = ffmpeg(url)
            .inputOptions(inputOptions)
            .outputOptions([
                '-c:v copy',            // Stream copy (zero CPU usage)
                '-an',                  // Disable audio (save resources)
                '-movflags +faststart', // Essential for web playback start

                '-f segment',
                '-segment_time 600',   // 10 minutes
                '-segment_format mp4',
                '-reset_timestamps 1',
                '-strftime 1',
            ])
            .output(path.join(feedDir, '%Y-%m-%d_%H-%M-%S.mp4'))
            .on('start', (cmdLine) => {
                console.log(`Recording started for ${feed.name}:`, cmdLine);

                // EXPLICIT PID TRACKING
                const pid = (command as any).ffmpegProc.pid;
                console.log(`[Recorder] Started FFmpeg process for ${feed.name} (PID: ${pid})`);

                // Monkey-patch kill to ensure we use process.kill
                const originalKill = command.kill.bind(command);
                command.kill = (signal = 'SIGKILL') => {
                    console.log(`[Recorder] Force killing FFmpeg PID: ${pid}`);
                    try {
                        if (pid) process.kill(pid, 'SIGKILL');
                    } catch (e: any) {
                        if (e.code !== 'ESRCH') {
                            console.error(`[Recorder] Failed to kill process ${pid}:`, e);
                        }
                    }
                    return originalKill(signal);
                };
            })
            .on('stderr', (line) => {
                // console.log(`Recording stderr: ${line}`);
            })
            .on('error', (err) => {
                console.error(`Recording error for ${feed.name}:`, err.message);
                // CRITICAL FIX: Force kill to cleanup
                command.kill('SIGKILL');
                this.activeRecordings.delete(feed.id);
            })
            .on('end', () => {
                console.log(`Recording ended for ${feed.name}`);
                this.activeRecordings.delete(feed.id);
            });

        command.run();


        this.activeRecordings.set(feed.id, command);
    }

    private async cleanupOldRecordings() {
        console.log('Running cleanup job...');
        const now = Date.now();

        // Default 24 hours
        let maxAge = 24 * 60 * 60 * 1000;

        try {
            // Lazy load SettingsModel to avoid circular dependencies if any
            // (Though importing at top level is usually fine in this project structure)
            const settings = await SettingsModel.getAllSettings();
            if (settings.recording_retention) {
                const hours = settings.recording_retention;
                if (hours > 0) {
                    maxAge = hours * 60 * 60 * 1000;
                    console.log(`Using configured retention: ${hours} hours`);
                }
            }
        } catch (err) {
            console.error('Failed to load retention settings, using default:', err);
        }

        const processDir = (dir: string) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    processDir(filePath);
                } else {
                    if (now - stat.mtimeMs > maxAge) {
                        console.log(`Deleting old file: ${filePath}`);
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
            const files = await fs.promises.readdir(feedDir);
            return files
                .filter(f => f.endsWith('.mp4'))
                .map(f => ({
                    filename: f,
                    url: `/recordings/${feedId}/${f}`,
                    timestamp: f.replace('.mp4', '') // Simple timestamp parsing
                }))
                .sort((a, b) => b.filename.localeCompare(a.filename));
        } catch (error) {
            return [];
        }
    }
}
