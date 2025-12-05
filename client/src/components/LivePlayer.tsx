import { useEffect, useRef, useState } from 'react';

interface LivePlayerProps {
    url: string;
    className?: string;
}

export function LivePlayer({ url, className }: LivePlayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playerRef = useRef<any>(null);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const [isReconnecting, setIsReconnecting] = useState(false);

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
                        if (mounted) setIsReconnecting(false);
                    },
                    onSourceCompleted: () => {
                        console.log('JSMpeg source completed, scheduling reconnect...');
                        if (mounted) {
                            setIsReconnecting(true);
                            // Retry in 3 seconds
                            setTimeout(() => {
                                if (mounted) setRetryTrigger(prev => prev + 1);
                            }, 3000);
                        }
                    }
                });
                playerRef.current = player;
            } catch (e) {
                console.error('Failed to initialize JSMpeg player:', e);
                // Retry on immediate failure too
                if (mounted) {
                    setIsReconnecting(true);
                    setTimeout(() => {
                        if (mounted) setRetryTrigger(prev => prev + 1);
                    }, 3000);
                }
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
    }, [url, retryTrigger]);

    return (
        <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
            <canvas ref={canvasRef} className="w-full h-full block" />

            {isReconnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white z-10">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <span className="text-sm font-medium">Reconnecting live feed...</span>
                    </div>
                </div>
            )}

            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs text-white z-20">
                <div className={`w-2 h-2 rounded-full ${isReconnecting ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                {isReconnecting ? 'OFFLINE' : 'LIVE'}
            </div>
        </div>
    );
}
