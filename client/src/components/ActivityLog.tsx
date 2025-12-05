import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw, Mail, Video, AlertCircle } from 'lucide-react';

interface Notification {
    id: number;
    feed_id: number;
    feed_name: string;
    type: string;
    message: string;
    created_at: string;
}

export function ActivityLog() {
    const [logs, setLogs] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 20; // Increased limit since items are smaller

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await api.get(`/notifications?page=${page}&limit=${limit}`);
            setLogs(data.logs);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error('Failed to fetch activity log', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, [page]);

    const handlePrev = () => setPage(p => Math.max(1, p - 1));
    const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

    const getIcon = (type: string) => {
        switch (type) {
            case 'email': return <Mail size={12} className="text-blue-400" />;
            case 'motion': return <Video size={12} className="text-yellow-400" />;
            case 'error': return <AlertCircle size={12} className="text-red-400" />;
            default: return <Video size={12} className="text-gray-400" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'email': return 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20';
            case 'motion': return 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20';
            case 'error': return 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20';
            default: return 'bg-white/5 border-white/10 hover:bg-white/10';
        }
    };

    return (
        <div className="glass-panel h-full flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Activity Log</h2>
                <button
                    onClick={fetchLogs}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    title="Refresh"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-white/40 text-xs">
                        No recent activity
                    </div>
                ) : (
                    logs.map((log) => (
                        <div
                            key={log.id}
                            className={`rounded px-3 py-2 transition-colors border flex items-center gap-3 ${getTypeColor(log.type)}`}
                        >
                            <div className="shrink-0 mt-0.5">
                                {getIcon(log.type)}
                            </div>

                            <div className="flex-1 min-w-0 flex items-center gap-2 text-xs">
                                <span className="text-white/50 whitespace-nowrap font-mono">
                                    {new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-white/30">•</span>
                                <span className="font-medium text-white/90 truncate">
                                    {log.feed_name || 'System'}
                                </span>
                                <span className="text-white/30">•</span>
                                <span className="text-white/70 truncate">
                                    {log.message.includes('Motion detected') ? 'Motion' : log.message}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="p-2 border-t border-white/10 flex justify-between items-center text-[10px] text-white/50">
                    <span>Page {page}</span>
                    <div className="flex gap-1">
                        <button
                            onClick={handlePrev}
                            disabled={page === 1}
                            className="px-2 py-1 bg-white/5 rounded hover:bg-white/10 disabled:opacity-30"
                        >
                            Prev
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={page === totalPages}
                            className="px-2 py-1 bg-white/5 rounded hover:bg-white/10 disabled:opacity-30"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
