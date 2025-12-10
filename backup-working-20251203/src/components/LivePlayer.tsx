import { useEffect, useRef } from 'react';

interface LivePlayerProps {
    url: string;
    className?: string;
}

export function LivePlayer({ url, className }: LivePlayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playerRef = useRef<any>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        let mounted = true;
        let player: any = null;

        const initPlayer = () => {
            if (!mounted) return;

            // Initialize JSMpeg player from global window object (loaded via CDN)
            // @ts-ignore
            const Player = window.JSMpeg?.Player;

            if (!Player) {
                console.error('JSMpeg Player not found on window. Make sure jsmpeg.min.js is loaded.');
                return;
            }

            console.log('Initializing JSMpeg player with URL:', url);

            try {
                player = new Player(url, {
                    canvas: canvasRef.current,
                    autoplay: true,
                    audio: false, // Mute audio for now
                    videoBufferSize: 1024 * 1024, // 1MB buffer for smooth playback
                    onSourceEstablished: () => {
                        console.log('JSMpeg source established');
                    },
                    onSourceCompleted: () => {
                        console.log('JSMpeg source completed');
                    }
                });
                playerRef.current = player;
            } catch (e) {
                console.error('Failed to initialize JSMpeg player:', e);
            }
        };

        // Small delay to prevent race conditions in Strict Mode
        const timeoutId = setTimeout(initPlayer, 100);

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            if (playerRef.current) {
                try {
                    console.log('Destroying JSMpeg player');
                    playerRef.current.destroy();
                    playerRef.current = null;
                } catch (e) {
                    console.error('Error destroying player:', e);
                }
            }
        };
    }, [url]);

    return (
        <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs text-white">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                LIVE
            </div>
        </div>
    );
}
