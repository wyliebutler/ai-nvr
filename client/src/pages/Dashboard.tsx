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

    if (loading) return <div className="p-8 text-center text-white">Loading feeds...</div>;

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-red-500">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg font-semibold">Failed to load feeds</p>
                <p className="text-sm opacity-75">{error}</p>
                <button
                    onClick={loadFeeds}
                    className="mt-4 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 text-white transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6 text-white">Live Dashboard</h1>

            {feeds.length === 0 ? (
                <div className="text-center py-12 glass-panel">
                    <h3 className="text-xl text-white mb-2">No cameras configured</h3>
                    <p className="text-white/60 mb-6">Add your first camera feed to get started.</p>
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
                                <div key={feed.id} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium truncate text-white">{feed.name}</h3>
                                        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                                            ID: {feed.id}
                                        </span>
                                    </div>
                                    <LivePlayer
                                        url={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/stream?url=${encodeURIComponent(feed.rtsp_url)}`}
                                        className="aspect-video shadow-lg rounded-lg overflow-hidden bg-black"
                                    />
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
        </div>
    );
}
