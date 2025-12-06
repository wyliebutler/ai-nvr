import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Feed } from '../lib/types';
import { LivePlayer } from '../components/LivePlayer';
import { ActivityLog } from '../components/ActivityLog';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
    const { user } = useAuth();
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [expandedFeed, setExpandedFeed] = useState<Feed | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadFeeds();
    }, []);

    async function loadFeeds() {
        try {
            const data = await api.get('/feeds');
            setFeeds(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-text-primary">Loading feeds...</div>;

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-red-500">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg font-semibold">Failed to load feeds</p>
                <p className="text-sm opacity-75">{error}</p>
                <button
                    onClick={loadFeeds}
                    className="mt-4 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 text-text-primary transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6 text-text-primary">Live Dashboard</h1>

            {feeds.length === 0 ? (
                <div className="text-center py-12 glass-panel">
                    <h3 className="text-xl text-text-primary mb-2">No cameras configured</h3>
                    <p className="text-text-primary/60 mb-6">Add your first camera feed to get started.</p>
                    {user?.role === 'admin' && (
                        <button onClick={() => navigate('/settings')} className="btn btn-primary">
                            Go to Settings
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-140px)]">
                    {/* Main Feed Area */}
                    <div className="flex-1 lg:overflow-y-auto pr-2">
                        <div className={`grid grid-cols-1 ${feeds.length > 1 ? 'lg:grid-cols-2' : ''} gap-6`}>
                            {feeds.map(feed => (
                                <div key={feed.id} className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium truncate text-text-primary">{feed.name}</h3>
                                        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                                            ID: {feed.id}
                                        </span>
                                    </div>
                                    <div
                                        className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
                                        onClick={() => setExpandedFeed(feed)}
                                        title="Click to expand"
                                    >
                                        <LivePlayer
                                            url={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/stream?url=${encodeURIComponent(feed.rtsp_url)}`}
                                            className="aspect-video shadow-lg rounded-lg overflow-hidden bg-black ring-2 ring-transparent group-hover:ring-accent transition-all"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="w-full lg:w-80 flex-shrink-0 h-96 lg:h-full overflow-hidden">
                        <ActivityLog />
                    </div>
                </div>
            )}

            {/* Expanded Feed Modal */}
            {expandedFeed && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="relative w-full max-w-6xl aspect-video bg-black rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setExpandedFeed(null)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <LivePlayer
                            url={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/stream?url=${encodeURIComponent(expandedFeed.rtsp_url)}`}
                            className="w-full h-full"
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                            <h2 className="text-white text-xl font-bold">{expandedFeed.name}</h2>
                            <p className="text-white/70 text-sm font-mono">{expandedFeed.rtsp_url}</p>
                        </div>
                    </div>
                    {/* Backdrop click to close */}
                    <div
                        className="absolute inset-0 -z-10"
                        onClick={() => setExpandedFeed(null)}
                    />
                </div>
            )}
        </div>
    );
}
