import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Pause, Play } from 'lucide-react';
import { api } from '../lib/api';

interface LogEntry {
    level: number;
    time: number;
    msg: string;
    [key: string]: any;
}

export function SystemLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isPlaying, setIsPlaying] = useState(true);
    const [filter, setFilter] = useState<'all' | 'error' | 'warn'>('all');
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const data = await api.get('/logs');
            setLogs(data);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(() => {
            if (isPlaying) fetchLogs();
        }, 2000);
        return () => clearInterval(interval);
    }, [isPlaying]);

    const getLevelColor = (level: number) => {
        if (level >= 50) return 'text-red-500'; // Error
        if (level >= 40) return 'text-yellow-500'; // Warn
        return 'text-green-400'; // Info/Debug
    };



    const getLevelName = (level: number) => {
        if (level >= 60) return 'FATAL';
        if (level >= 50) return 'ERROR';
        if (level >= 40) return 'WARN';
        if (level >= 30) return 'INFO';
        if (level >= 20) return 'DEBUG';
        return 'TRACE';
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'error') return log.level >= 50;
        if (filter === 'warn') return log.level >= 40;
        return true;
    });

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Terminal className="w-8 h-8 text-accent" />
                    System Logs
                </h1>
                <div className="flex items-center gap-2">
                    <select
                        className="bg-secondary text-text-primary border-none rounded-lg px-3 py-2 text-sm"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                    >
                        <option value="all">All Levels</option>
                        <option value="warn">Warnings & Errors</option>
                        <option value="error">Errors Only</option>
                    </select>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        title={isPlaying ? "Pause Auto-refresh" : "Resume Auto-refresh"}
                    >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => fetchLogs()}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        title="Refresh Now"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-black/80 rounded-lg border border-border overflow-hidden font-mono text-sm relative">
                <div className="absolute inset-0 overflow-auto p-4 space-y-1" ref={scrollRef}>
                    {filteredLogs.length === 0 && (
                        <div className="text-text-secondary text-center py-10 opacity-50">No logs found...</div>
                    )}
                    {filteredLogs.map((log, i) => (
                        <div key={i} className="flex gap-3 hover:bg-white/5 p-1 rounded">
                            <span className="text-text-secondary min-w-[150px]">
                                {new Date(log.time).toLocaleTimeString()}
                            </span>
                            <span className={`font-bold min-w-[60px] ${getLevelColor(log.level)}`}>
                                {getLevelName(log.level)}
                            </span>
                            <span className="flex-1 text-gray-300 break-all">
                                {log.msg}
                                {Object.keys(log).length > 3 && (
                                    <span className="opacity-50 ml-2 text-xs">
                                        {JSON.stringify(
                                            Object.fromEntries(
                                                Object.entries(log).filter(([k]) => !['level', 'time', 'msg'].includes(k))
                                            )
                                        )}
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
