import ffmpeg from 'fluent-ffmpeg';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { MediaProxyService } from './media-proxy';

interface StreamSession {
    ffmpegCommand: ffmpeg.FfmpegCommand;
    clients: Set<WebSocket>;
}

export class StreamManager {
    private sessions: Map<string, StreamSession> = new Map();
    private wss: WebSocketServer;

    constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.wss.on('connection', this.handleConnection.bind(this));
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
            session.ffmpegCommand.kill('SIGINT');
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
        console.log(`Starting ffmpeg for ${rtspUrl}`);

        // This is a simplified MSE stream setup. 
        // In a real scenario, we might use jsmpeg-compatible MPEG-TS or fragmented MP4.
        // For this implementation, we'll output MPEG-TS which is easy to handle over WS.

        // Resolve Proxy URL
        let streamSource = rtspUrl.startsWith('file://') ? rtspUrl.replace('file:///', '').replace('file://', '') : rtspUrl;
        const isRtsp = streamSource.startsWith('rtsp');

        if (isRtsp) {
            const proxyUrl = MediaProxyService.getInstance().getProxyUrlByOriginal(rtspUrl);
            if (proxyUrl) {
                console.log(`[Stream] Switching ${rtspUrl} to proxy: ${proxyUrl}`);
                streamSource = proxyUrl;
            }
        }

        // Remove -re for RTSP to process as fast as possible (reduce latency)
        const inputOptions = isRtsp
            ? [
                '-rtsp_transport tcp',
                '-analyzeduration 1000000', // Increased to 1s (from 100ms) for stability
                '-probesize 1000000',       // Increased to 1MB (from 100KB)
                '-fflags nobuffer',        // Discard buffered data
                '-flags low_delay',        // Force low delay
                '-strict experimental'     // Allow experimental features
            ]
            : ['-stream_loop -1', '-re'];

        const command = ffmpeg(streamSource)
            .inputOptions(inputOptions)
            .outputOptions([
                '-f mpegts',             // Output format
                '-codec:v mpeg1video',   // MPEG-1 for JSMpeg compatibility
                '-b:v 2000k',            // Higher bitrate for better quality
                '-r 25',                 // 25fps
                '-bf 0',                 // No B-frames
                '-q:v 2',                // High quality
                '-tune zerolatency',     // Tune for zero latency
                '-preset ultrafast'      // Encode as fast as possible
            ])
            .on('start', (cmdLine) => {
                console.log('FFmpeg started:', cmdLine);
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err.message);
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

        const stream = command.pipe();

        stream.on('data', (chunk: Buffer) => {
            // console.log(`Received stream chunk: ${chunk.length} bytes`);
            const session = this.sessions.get(rtspUrl);
            if (session) {
                for (const client of session.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(chunk);
                    }
                }
            }
        });

        return {
            ffmpegCommand: command,
            clients: new Set(),
        };
    }
}
