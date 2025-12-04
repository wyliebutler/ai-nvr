import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw } from 'lucide-react';

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
    const limit = 10;

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
    }, [page]); // Re-fetch when page changes

    const handlePrev = () => setPage(p => Math.max(1, p - 1));
    const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

    return (
        <div className="glass-panel h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                <button
                    onClick={fetchLogs}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-white/40 text-sm">
                        No recent activity
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="bg-white/5 rounded p-3 hover:bg-white/10 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-medium text-white truncate pr-2">
                                    {log.feed_name || 'System'}
                                </span>
                                <span className="text-xs text-white/50 whitespace-nowrap">
                                    {new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-xs text-white/70 mb-2 line-clamp-2">
                                {log.message}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${log.type === 'email'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                    }`}>
                                    {log.type}
                                </span>
                                <span className="text-[10px] text-white/30">
                                    {new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="p-3 border-t border-white/10 flex justify-between items-center text-xs text-white/50">
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
