import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Feed, Recording } from '../lib/types';
import { Play, Film, RefreshCw } from 'lucide-react';

export function Recordings() {
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadFeeds();
    }, []);

    useEffect(() => {
        if (selectedFeedId) {
            loadRecordings(selectedFeedId);
        } else {
            setRecordings([]);
        }
    }, [selectedFeedId]);

    async function loadFeeds() {
        try {
            const token = localStorage.getItem('token');
            const data = await api.get('/feeds', token || undefined);
            setFeeds(data);
            if (data.length > 0 && !selectedFeedId) {
                setSelectedFeedId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load feeds:', err);
        }
    }

    async function loadRecordings(feedId: number) {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const data = await api.get(`/feeds/${feedId}/recordings`, token || undefined);
            setRecordings(data);
        } catch (err) {
            console.error('Failed to load recordings:', err);
        } finally {
            setLoading(false);
        }
    }

    function handleRefresh() {
        if (selectedFeedId) {
            loadRecordings(selectedFeedId);
        }
    }

    function formatTimestamp(filenameTimestamp: string) {
        try {
            // Format: YYYY-MM-DD_HH-mm-ss
            // Example: 2025-12-03_15-50-41
            const [datePart, timePart] = filenameTimestamp.split('_');
            const [year, month, day] = datePart.split('-');
            const [hour, minute, second] = timePart.split('-');

            // Construct UTC ISO string: YYYY-MM-DDTHH:mm:ssZ
            const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;

            // Convert to local time (browser's timezone, e.g., Newfoundland)
            return new Date(isoString).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'medium'
            });
        } catch (e) {
            return filenameTimestamp;
        }
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-text-primary">Recordings</h1>
                <button
                    onClick={handleRefresh}
                    className="btn glass-panel hover:bg-white/10 p-2"
                    title="Refresh List"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Sidebar: Feeds & Recordings List */}
                <div className="w-80 flex flex-col gap-4 bg-secondary rounded-lg border border-border overflow-hidden">
                    <div className="p-4 border-b border-border">
                        <label className="block text-sm font-medium text-text-secondary mb-2">Select Camera</label>
                        <select
                            value={selectedFeedId || ''}
                            onChange={(e) => setSelectedFeedId(Number(e.target.value))}
                            className="w-full bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                        >
                            {feeds.map(feed => (
                                <option key={feed.id} value={feed.id}>{feed.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="text-center text-text-secondary py-4">Loading...</div>
                        ) : recordings.length === 0 ? (
                            <div className="text-center text-text-secondary py-4">No recordings found</div>
                        ) : (
                            recordings.map(rec => (
                                <button
                                    key={rec.filename}
                                    onClick={() => setSelectedRecording(rec)}
                                    className={`w-full text-left px-3 py-3 rounded flex items-center gap-3 transition-colors ${selectedRecording?.filename === rec.filename
                                        ? 'bg-accent text-white'
                                        : 'text-text-secondary hover:bg-primary'
                                        }`}
                                >
                                    <Film className="w-4 h-4 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{formatTimestamp(rec.timestamp)}</div>
                                        <div className="text-xs opacity-75 truncate">{rec.filename}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main: Video Player */}
                <div className="flex-1 bg-black rounded-lg border border-border flex items-center justify-center overflow-hidden relative">
                    {selectedRecording ? (
                        <div className="w-full h-full flex flex-col">
                            <video
                                src={selectedRecording.url}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                                <h2 className="text-lg font-medium text-white">{formatTimestamp(selectedRecording.timestamp)}</h2>
                            </div>
                        </div>
                    ) : (
                        <div className="text-text-secondary flex flex-col items-center gap-2">
                            <Play className="w-12 h-12 opacity-50" />
                            <p>Select a recording to play</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
