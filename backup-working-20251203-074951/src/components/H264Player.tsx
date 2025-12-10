import { useEffect, useRef } from 'react';

interface H264PlayerProps {
    url: string;
    className?: string;
}

export function H264Player({ url, className = '' }: H264PlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);
    const queueRef = useRef<Uint8Array[]>([]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let mediaSource: MediaSource | null = null;

        // Try to use MSE (Media Source Extensions) for h264
        if ('MediaSource' in window) {
            mediaSource = new MediaSource();
            video.src = URL.createObjectURL(mediaSource);

            mediaSource.addEventListener('sourceopen', () => {
                if (!mediaSource) return;

                try {
                    const sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.42E01E"');
                    sourceBufferRef.current = sourceBuffer;

                    sourceBuffer.addEventListener('updateend', () => {
                        if (queueRef.current.length > 0 && !sourceBuffer.updating) {
                            const data = queueRef.current.shift();
                            if (data) {
                                sourceBuffer.appendBuffer(data.buffer as ArrayBuffer);
                            }
                        }
                    });

                    // Connect WebSocket
                    const ws = new WebSocket(url);
                    ws.binaryType = 'arraybuffer';
                    wsRef.current = ws;

                    ws.onmessage = (event) => {
                        const data = new Uint8Array(event.data as ArrayBuffer);

                        if (sourceBuffer.updating || queueRef.current.length > 0) {
                            queueRef.current.push(data);
                        } else {
                            try {
                                sourceBuffer.appendBuffer(data.buffer as ArrayBuffer);
                            } catch (e) {
                                console.error('Error appending buffer:', e);
                            }
                        }
                    };

                    ws.onerror = (error) => {
                        console.error('WebSocket error:', error);
                    };

                } catch (e) {
                    console.error('Error setting up MediaSource:', e);
                }
            });
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (mediaSource) {
                try {
                    if (mediaSource.readyState === 'open') {
                        mediaSource.endOfStream();
                    }
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
            queueRef.current = [];
        };
    }, [url]);

    return (
        <video
            ref={videoRef}
            className={`w-full bg-black ${className}`}
            autoPlay
            muted
            playsInline
        />
    );
}
