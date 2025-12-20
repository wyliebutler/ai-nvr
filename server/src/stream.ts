import ffmpeg from 'fluent-ffmpeg';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { MediaProxyService } from './media-proxy';

interface StreamSession {
    ffmpegCommand: ffmpeg.FfmpegCommand;
    clients: Set<WebSocket>;
    pid?: number;
}

export class StreamManager {
    private static instance: StreamManager;
    private sessions: Map<string, StreamSession> = new Map();
    private lastStartAttempt: Map<string, number> = new Map();
    private wss: WebSocketServer;

    private constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.wss.on('connection', this.handleConnection.bind(this));
    }

    public static getInstance(wss?: WebSocketServer): StreamManager {
        if (!StreamManager.instance) {
            if (!wss) {
                throw new Error('StreamManager must be initialized with WebSocketServer first');
            }
            StreamManager.instance = new StreamManager(wss);
        }
        return StreamManager.instance;
    }

    public getActivePids(): number[] {
        const pids: number[] = [];
        for (const session of this.sessions.values()) {
            if (session.pid) {
                pids.push(session.pid);
            }
        }
        return pids;
    }

    private handleConnection(ws: WebSocket, req: IncomingMessage) {
        console.log(`Incoming WS connection: ${req.url}`);
        const url = req.url; // e.g., /stream?url=rtsp://...
        if (!url) {
            ws.close();
            return;
        }

        const params = new URLSearchParams(url.split('?')[1]);
        const rtspUrl = params.get('url');

        if (!rtspUrl) {
            ws.close();
            return;
        }

        console.log(`Client connected to stream: ${rtspUrl}`);
        this.addClientToStream(rtspUrl, ws);

        ws.on('close', () => {
            console.log(`Client disconnected from stream: ${rtspUrl}`);
            this.removeClientFromStream(rtspUrl, ws);
        });
    }

    private addClientToStream(rtspUrl: string, ws: WebSocket) {
        let session = this.sessions.get(rtspUrl);

        if (!session) {
            session = this.startStream(rtspUrl);
            this.sessions.set(rtspUrl, session);
        }

        session.clients.add(ws);
    }

    public async stop() {
        console.log('Stopping all streams...');
        const promises = [];
        for (const [url, session] of this.sessions) {
            promises.push(new Promise<void>((resolve) => {
                // Set a timeout to force resolve if ffmpeg hangs
                const timeout = setTimeout(() => {
                    console.log(`Stream ${url} stop timed out, forcing kill.`);
                    try {
                        session.ffmpegCommand.kill('SIGKILL');
                    } catch (e) { /* ignore if already dead */ }
                    resolve();
                }, 2000);

                session.ffmpegCommand.on('end', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                session.ffmpegCommand.on('error', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                try {
                    session.ffmpegCommand.kill('SIGINT');
                } catch (e) {
                    clearTimeout(timeout);
                    resolve();
                }
            }));
            this.closeAllClientsForUrl(url);
        }
        await Promise.all(promises);
        this.sessions.clear();
        console.log('All streams stopped.');
    }

    private removeClientFromStream(rtspUrl: string, ws: WebSocket) {
        const session = this.sessions.get(rtspUrl);
        if (!session) return;

        session.clients.delete(ws);

        if (session.clients.size === 0) {
            console.log(`No clients left for ${rtspUrl}, stopping stream.`);
            session.ffmpegCommand.kill('SIGKILL');
            this.sessions.delete(rtspUrl);
        }
    }

    private closeAllClientsForUrl(rtspUrl: string) {
        const session = this.sessions.get(rtspUrl);
        if (session) {
            for (const client of session.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.close(1000, 'Stream Stopped'); // Normal closure
                }
            }
            session.clients.clear();
        }
    }

    private startStream(rtspUrl: string): StreamSession {
        const lastStart = this.lastStartAttempt.get(rtspUrl) || 0;
        const now = Date.now();
        // For streams, we want faster retry but still stopped from looping tight
        if (now - lastStart < 3000) { // 3s cooldown for streams
            console.log(`[Stream] Throttling start for ${rtspUrl}`);
            // We still proceed? No, return dummy or error?
            // If we return undefined, addClientToStream fails. 
            // We must throw or handle it.
            // Since this returns StreamSession, we can't easily skip. 
            // We will just log ensuring we don't start NEW ffmpeg command if one is starting...
            // But this method creates a new one.
            // Let's THROW to prevent creation.
            throw new Error('Stream start throttled');
        }
        this.lastStartAttempt.set(rtspUrl, now);

        console.log(`Starting ffmpeg for ${rtspUrl}`);

        // This is a simplified MSE stream setup. 
        // In a real scenario, we might use jsmpeg-compatible MPEG-TS or fragmented MP4.
        // For this implementation, we'll output MPEG-TS which is easy to handle over WS.

        // Resolve Proxy URL
        let streamSource = rtspUrl.startsWith('file://') ? rtspUrl.replace('file:///', '').replace('file://', '') : rtspUrl;
        const isRtsp = streamSource.startsWith('rtsp');

        if (isRtsp) {
            // Bypass proxy for now as it is causing 404s
            /*
            const proxyUrl = MediaProxyService.getInstance().getProxyUrlByOriginal(rtspUrl);
            if (proxyUrl) {
                console.log(`[Stream] Switching ${rtspUrl} to proxy: ${proxyUrl}`);
                streamSource = proxyUrl;
            }
            */
            console.log(`[Stream] Direct connection to ${rtspUrl} (Proxy bypassed)`);
        }

        // Remove -re for RTSP to process as fast as possible (reduce latency)
        // Remove -re for RTSP to process as fast as possible (reduce latency)
        const inputOptions = isRtsp
            ? [
                '-hwaccel auto',           // Use GPU for decoding
                '-rtsp_transport tcp',
                '-analyzeduration 100000', // Reduced to 100ms for faster startup
                '-probesize 1000000',      // Increased to 1MB (from 100KB)
                '-fflags nobuffer',        // Discard buffered data
                '-flags low_delay',        // Force low delay
                '-strict experimental'     // Allow experimental features
            ]
            : ['-hwaccel auto', '-stream_loop -1', '-re'];

        // Create the session object first so we can refer to it in events
        const session: StreamSession = {
            ffmpegCommand: null as any, // Will set immediately below
            clients: new Set(),
        };

        const command = ffmpeg(streamSource)
            .inputOptions(inputOptions)
            .outputOptions([
                '-f mpegts',             // Output format
                '-codec:v mpeg1video',   // MPEG-1 for JSMpeg compatibility
                '-b:v 2000k',            // Higher bitrate (original working value)
                '-r 25',                 // 25fps (original working value)
                '-bf 0',                 // No B-frames
                // Removed performance flags to rule them out
            ])
            .on('start', (cmdLine) => {
                console.log('FFmpeg started:', cmdLine);

                // EXPLICIT PID TRACKING
                const pid = (command as any).ffmpegProc.pid;
                session.pid = pid; // Store PID in session
                console.log(`[Stream] Started FFmpeg process for ${rtspUrl} (PID: ${pid})`);

                // Monkey-patch kill to ensure we use process.kill
                const originalKill = command.kill.bind(command);
                command.kill = (signal = 'SIGKILL') => {
                    console.log(`[Stream] Force killing FFmpeg PID: ${pid}`);
                    try {
                        if (pid) process.kill(pid, 'SIGKILL');
                    } catch (e: any) {
                        if (e.code !== 'ESRCH') {
                            console.error(`[Stream] Failed to kill process ${pid}:`, e);
                        }
                    }
                    return originalKill(signal);
                };
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err.message);
                // Force kill on error to prevent zombies
                command.kill('SIGKILL');
                this.closeAllClientsForUrl(rtspUrl);
                this.sessions.delete(rtspUrl);
            })
            .on('stderr', (line) => {
                // console.log(`Stream FFmpeg stderr: ${line}`);
            })
            .on('end', () => {
                console.log('FFmpeg process ended');
                this.closeAllClientsForUrl(rtspUrl);
                this.sessions.delete(rtspUrl);
            });

        session.ffmpegCommand = command;

        const stream = command.pipe();

        stream.on('data', (chunk: Buffer) => {
            // console.log(`Received stream chunk: ${chunk.length} bytes`);

            // Re-fetch session to be safe, though usage of 'session' variable captured in closure is also fine
            // provided the session reference doesn't change.
            const currentSession = this.sessions.get(rtspUrl);
            if (currentSession) {
                for (const client of currentSession.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(chunk);
                    }
                }
            }
        });

        return session;
    }
}
