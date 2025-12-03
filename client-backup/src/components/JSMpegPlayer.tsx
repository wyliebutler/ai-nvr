import { useEffect, useRef } from 'react';
// @ts-ignore
import JSMpeg from 'jsmpeg';

interface JSMpegPlayerProps {
    url: string;
}

export function JSMpegPlayer({ url }: JSMpegPlayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playerRef = useRef<any>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Cleanup previous instance
        if (playerRef.current) {
            playerRef.current.destroy();
        }

        try {
            playerRef.current = new JSMpeg.Player(url, {
                canvas: canvasRef.current,
                autoplay: true,
                audio: false, // Mute by default for NVR
                videoBufferSize: 1024 * 128, // Low buffer for lower latency
            });
        } catch (e) {
            console.error('Failed to initialize JSMpeg player', e);
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [url]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full object-contain bg-black pointer-events-none"
        />
    );
}
