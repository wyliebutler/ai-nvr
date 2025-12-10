import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Feed } from '../lib/types';
import { LivePlayer } from '../components/LivePlayer';
import { AlertCircle } from 'lucide-react';

export function Dashboard() {
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFeeds();
    }, []);

    async function loadFeeds() {
        try {
            // TODO: Get token from auth context
            const token = localStorage.getItem('token');
            const data = await api.get('/feeds', token || undefined);
            setFeeds(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8 text-center">Loading feeds...</div>;

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
            <h1 className="text-2xl font-bold mb-6">Live Dashboard v2</h1>

            {feeds.length === 0 ? (
                <div className="aspect-video bg-gray-800 rounded-lg flex flex-col items-center justify-center border border-gray-700 p-8 text-gray-500">
                    <p>No feeds active</p>
                    <p className="text-sm mt-2">Go to Feeds page to add a camera.</p>
                </div>
            ) : (
                <div className={`grid grid-cols-1 ${feeds.length > 1 ? 'lg:grid-cols-2' : ''} gap-6`}>
                    {feeds.map(feed => (
                        <div key={feed.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium truncate">{feed.name}</h3>
                                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                    ID: {feed.id}
                                </span>
                            </div>
                            <LivePlayer
                                url={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/stream?url=${encodeURIComponent(feed.rtsp_url)}`}
                                className="aspect-video shadow-lg"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
