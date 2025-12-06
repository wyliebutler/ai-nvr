import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { FeedModel } from './feeds';
import { MediaProxyService } from './media-proxy';

const RECORDINGS_DIR = path.resolve(__dirname, '../recordings');

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

export class RecorderManager {
    private static instance: RecorderManager;
    private activeRecordings: Map<number, ffmpeg.FfmpegCommand> = new Map();

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
                console.log(`Stopping recording for feed ${id}`);
                command.kill('SIGKILL');
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
        console.log(`Starting recording for feed ${feed.name} (${feed.id})`);
        const feedDir = path.join(RECORDINGS_DIR, feed.id.toString());

        if (!fs.existsSync(feedDir)) {
            fs.mkdirSync(feedDir, { recursive: true });
        }

        // FFmpeg command to segment video
        const isRtsp = feed.rtsp_url.startsWith('rtsp');
        const inputOptions = isRtsp ? ['-rtsp_transport tcp'] : ['-stream_loop -1', '-re']; // -re for files to simulate realtime

        const url = feed.rtsp_url.startsWith('file://')
            ? feed.rtsp_url.replace('file:///', '').replace('file://', '')
            : MediaProxyService.getInstance().getProxyUrl(feed);

        const command = ffmpeg(url)
            .inputOptions(inputOptions)
            .outputOptions([
                '-c:v copy',            // Direct stream copy for video
                '-c:a aac',             // Transcode audio to AAC (better compatibility)
                '-f segment',
                '-segment_time 1800',   // 30 minutes
                '-segment_format mp4',
                '-reset_timestamps 1',
                '-strftime 1',
                '-movflags +faststart', // Optimize for web playback
            ])
            .output(path.join(feedDir, '%Y-%m-%d_%H-%M-%S.mp4'))
            .on('start', (cmdLine) => {
                console.log(`Recording started for ${feed.name}:`, cmdLine);
            })
            .on('stderr', (line) => {
                // console.log(`Recording stderr: ${line}`);
            })
            .on('error', (err) => {
                console.error(`Recording error for ${feed.name}:`, err.message);
                // Retry logic could go here
                this.activeRecordings.delete(feed.id);
            })
            .on('end', () => {
                console.log(`Recording ended for ${feed.name}`);
                this.activeRecordings.delete(feed.id);
            });

        command.run();
        this.activeRecordings.set(feed.id, command);
    }

    private cleanupOldRecordings() {
        console.log('Running cleanup job...');
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

        const processDir = (dir: string) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    processDir(filePath);
                } else {
                    if (now - stat.mtimeMs > MAX_AGE) {
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
