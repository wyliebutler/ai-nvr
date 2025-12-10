import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
import { JSMpegPlayer } from '../components/JSMpegPlayer';

interface Feed {
    id: number;
    name: string;
    rtsp_url: string;
}

export function SingleFeedView() {
    const { id } = useParams();
    const [feed, setFeed] = useState<Feed | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (id) {
            api.get('/feeds').then(feeds => {
                const found = feeds.find((f: Feed) => f.id === Number(id));
                setFeed(found || null);
            });
        }
    }, [id]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    if (!feed) return <div className="p-8 text-center">Loading...</div>;

    // Construct WebSocket URL for the stream
    // Assuming the server is on the same host/port as the API, but we need the WS port (usually same as HTTP server in this setup)
    // In dev, Vite is 3000, Server is 7000.
    // We need to point to the server's port.
    // Use the same host/port as the page (proxied by Nginx)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Includes port if not 80/443
    const wsUrl = `${protocol}//${host}/stream?url=${encodeURIComponent(feed.rtsp_url)}`;

    return (
        <div className={`min-h-screen flex flex-col ${isFullscreen ? 'bg-black' : 'p-6'}`}>
            {!isFullscreen && (
                <header className="flex items-center gap-4 mb-6">
                    <Link to="/" className="btn glass-panel hover:bg-white/10">
                        <ArrowLeft size={20} />
                        Back
                    </Link>
                    <h1 className="text-2xl font-bold">{feed.name}</h1>
                </header>
            )}

            <div className={`flex-1 relative flex items-center justify-center overflow-hidden ${!isFullscreen && 'glass-panel'}`}>
                {/* Transparent click overlay for zoom */}
                <div
                    className={`absolute inset-0 z-10 ${zoom === 1 ? 'cursor-zoom-in' : 'cursor-zoom-out'}`}
                    onClick={() => setZoom(z => z === 1 ? 2.5 : 1)}
                />

                <div
                    className="transition-transform duration-200 ease-out w-full h-full flex items-center justify-center"
                    style={{ transform: `scale(${zoom})` }}
                >
                    <JSMpegPlayer url={wsUrl} />
                </div>

                {/* Controls Overlay */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 p-2 rounded-full backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity z-20">
                    <button
                        className="p-2 hover:bg-white/20 rounded-full text-white"
                        onClick={() => setZoom((z: number) => Math.max(1, z - 0.5))}
                    >
                        <ZoomOut size={24} />
                    </button>
                    <span className="flex items-center text-sm font-mono w-12 justify-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        className="p-2 hover:bg-white/20 rounded-full text-white"
                        onClick={() => setZoom(z => Math.min(3, z + 0.5))}
                    >
                        <ZoomIn size={24} />
                    </button>
                    <div className="w-px bg-white/20 mx-2" />
                    <button
                        className="p-2 hover:bg-white/20 rounded-full text-white"
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
