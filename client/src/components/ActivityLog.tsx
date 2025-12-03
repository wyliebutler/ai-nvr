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
        <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Activity Log</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchLogs}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-white/50 border-b border-white/10">
                            <th className="pb-2">Time</th>
                            <th className="pb-2">Camera</th>
                            <th className="pb-2">Event</th>
                            <th className="pb-2">Message</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-4 text-center text-white/50">
                                    No activity recorded yet.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 text-sm text-white/70">
                                        {new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                                    </td>
                                    <td className="py-3 text-sm font-medium text-white">
                                        {log.feed_name || 'Unknown Camera'}
                                    </td>
                                    <td className="py-3 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${log.type === 'email'
                                            ? 'bg-blue-500/20 text-blue-300'
                                            : 'bg-emerald-500/20 text-emerald-300'
                                            }`}>
                                            {log.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 text-sm text-white/70">
                                        {log.message}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 text-sm text-white/70">
                    <div>Page {page} of {totalPages}</div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrev}
                            disabled={page === 1}
                            className="px-3 py-1 bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={page === totalPages}
                            className="px-3 py-1 bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
