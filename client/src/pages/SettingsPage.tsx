import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Save, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { useTheme } from '../context/ThemeContext';

interface Feed {
    id: number;
    name: string;
    rtsp_url: string;
}

interface Settings {
    smtp_host?: string;
    smtp_port?: string;
    smtp_user?: string;
    smtp_pass?: string;
    notification_email?: string;
    recording_retention?: string;
    motion_sensitivity?: string;
    notification_interval?: string;
    theme?: string;
}

export function SettingsPage() {
    const { user } = useAuth();
    const { setTheme } = useTheme();
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [settings, setSettings] = useState<Settings>({});
    const [newFeed, setNewFeed] = useState({ name: '', rtsp_url: '' });
    const [pruneHours, setPruneHours] = useState('168'); // Default 1 week
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    if (user?.role !== 'admin') {
        return <Navigate to="/" />;
    }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setError(null);
            const [feedsData, settingsData] = await Promise.all([
                api.get('/feeds'),
                api.get('/settings')
            ]);
            setFeeds(feedsData);
            setSettings(settingsData);
        } catch (error: any) {
            console.error('Failed to load data', error);
            setError(error.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/settings', settings);
            setMessage('Settings saved successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Failed to save settings', error);
        }
    };

    const handleTestEmail = async () => {
        try {
            setMessage('Sending test email...');
            await api.post('/test-email', settings);
            setMessage('Test email sent successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            console.error('Failed to send test email', error);
            setMessage(`Failed to send test email: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleAddFeed = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/feeds', newFeed);
            setNewFeed({ name: '', rtsp_url: '' });
            loadData();
        } catch (error) {
            console.error('Failed to add feed', error);
        }
    };

    const handleDeleteFeed = async (id: number) => {
        if (!confirm('Are you sure you want to delete this feed?')) return;
        try {
            await api.delete(`/feeds/${id}`);
            loadData();
        } catch (error) {
            console.error('Failed to delete feed', error);
        }
    };

    const handleClearLogs = async () => {
        if (!confirm('Are you sure you want to delete ALL detection logs? This cannot be undone.')) return;
        try {
            await api.delete('/notifications');
            setMessage('All logs cleared successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Failed to clear logs', error);
            setMessage('Failed to clear logs');
        }
    };

    const handlePruneLogs = async () => {
        try {
            const hours = parseInt(pruneHours, 10);
            await api.post('/notifications/prune', { hours });
            setMessage(`Logs older than ${hours} hours pruned successfully`);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Failed to prune logs', error);
            setMessage('Failed to prune logs');
        }
    };

    return (
        <div className="min-h-screen p-6 max-w-4xl mx-auto">
            <header className="flex items-center gap-4 mb-8">
                <Link to="/" className="btn glass-panel hover:bg-white/10">
                    <ArrowLeft size={20} />
                    Back
                </Link>
                <h1 className="text-3xl font-bold text-text-primary">System Settings</h1>
            </header>



            {loading && (
                <div className="text-center py-12 text-text-primary/60">
                    Loading settings...
                </div>
            )}

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded mb-6">
                    <h3 className="font-bold mb-1">Error loading settings</h3>
                    <p>{error}</p>
                    <button onClick={loadData} className="btn btn-primary mt-4">Retry</button>
                </div>
            )}

            {!loading && !error && (
                <>
                    {message && (
                        <div className="bg-green-500/20 border border-green-500/50 text-green-200 p-3 rounded mb-6 animate-fade-in">
                            {message}
                        </div>
                    )}

                    <div className="grid gap-8">
                        {/* Feeds Section */}
                        <section className="glass-panel p-6">
                            <h2 className="text-xl font-bold mb-4 text-text-primary">Camera Feeds</h2>

                            <div className="space-y-4 mb-6">
                                {feeds.map((feed) => (
                                    <div key={feed.id} className="flex items-center justify-between bg-black/20 p-4 rounded">
                                        <div>
                                            <h3 className="font-semibold text-text-primary">{feed.name}</h3>
                                            <p className="text-sm text-gray-400 truncate max-w-md">{feed.rtsp_url}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteFeed(feed.id)}
                                            className="btn btn-danger p-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleAddFeed} className="flex gap-4 items-end border-t border-white/10 pt-4">
                                <div className="flex-1">
                                    <label className="label">Camera Name</label>
                                    <input
                                        type="text"
                                        className="input-field w-full"
                                        value={newFeed.name}
                                        onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                                        required
                                        placeholder="e.g. Front Door"
                                    />
                                </div>
                                <div className="flex-[2]">
                                    <label className="label">RTSP URL</label>
                                    <input
                                        type="url"
                                        className="input-field w-full"
                                        value={newFeed.rtsp_url}
                                        onChange={(e) => setNewFeed({ ...newFeed, rtsp_url: e.target.value })}
                                        required
                                        placeholder="rtsp://user:pass@ip:port/stream"
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary mb-[1px]">
                                    <Plus size={20} />
                                    Add
                                </button>
                            </form>
                        </section>

                        {/* System Configuration */}
                        <section className="glass-panel p-6">
                            <h2 className="text-xl font-bold mb-4 text-text-primary">Configuration</h2>
                            <form onSubmit={handleSaveSettings} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">SMTP Host</label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            value={settings.smtp_host || ''}
                                            onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                                            placeholder="smtp.gmail.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">SMTP Port</label>
                                        <input
                                            type="number"
                                            className="input-field w-full"
                                            value={settings.smtp_port || ''}
                                            onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                                            placeholder="587"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">SMTP User</label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            value={settings.smtp_user || ''}
                                            onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">SMTP Password</label>
                                        <input
                                            type="password"
                                            className="input-field w-full"
                                            value={settings.smtp_pass || ''}
                                            onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Theme</label>
                                    <select
                                        className="input-field w-full"
                                        value={settings.theme || 'default'}
                                        onChange={(e) => {
                                            const newTheme = e.target.value;
                                            console.log('SettingsPage: theme changed to', newTheme);
                                            setSettings({ ...settings, theme: newTheme });
                                            setTheme(newTheme as any);
                                        }}
                                    >
                                        <option value="default">Midnight (Default)</option>
                                        <option value="light">Daylight (Light)</option>
                                        <option value="cyberpunk">Cyberpunk</option>
                                        <option value="forest">Forest</option>
                                        <option value="ocean">Ocean</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Motion Sensitivity</label>
                                    <select
                                        className="input-field w-full"
                                        value={settings.motion_sensitivity || 'medium'}
                                        onChange={(e) => setSettings({ ...settings, motion_sensitivity: e.target.value })}
                                    >
                                        <option value="very_low">Very Low (Least Sensitive)</option>
                                        <option value="low">Low (Less Sensitive)</option>
                                        <option value="medium">Medium (Default)</option>
                                        <option value="high">High (More Sensitive)</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Adjust how much motion is required to trigger an alert.
                                        "Low" helps reduce false alarms.
                                    </p>
                                </div>

                                <div>
                                    <label className="label">Notification Interval (Minutes)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="input-field w-full"
                                        value={settings.notification_interval || '15'}
                                        onChange={(e) => setSettings({ ...settings, notification_interval: e.target.value })}
                                        placeholder="15"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Minimum time between email notifications for the same camera.
                                    </p>
                                </div>

                                <div>
                                    <label className="label">Recording Retention (Hours)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="input-field w-full"
                                        value={settings.recording_retention || '24'}
                                        onChange={(e) => setSettings({ ...settings, recording_retention: e.target.value })}
                                        placeholder="24"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Hours to keep recordings before auto-deletion. Default is 24 hours.
                                    </p>
                                </div>

                                <div>
                                    <label className="label">Notification Email</label>
                                    <input
                                        type="email"
                                        className="input-field w-full"
                                        value={settings.notification_email || ''}
                                        onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                                        placeholder="alerts@example.com"
                                    />
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button type="submit" className="btn btn-primary">
                                        <Save size={20} />
                                        Save Configuration
                                    </button>
                                    <button type="button" onClick={handleTestEmail} className="btn glass-panel hover:bg-white/10">
                                        Test Email
                                    </button>
                                </div>
                            </form>
                        </section>

                        {/* Logs & Maintenance */}
                        <section className="glass-panel p-6">
                            <h2 className="text-xl font-bold mb-4 text-text-primary flex items-center gap-2">
                                <Clock size={24} />
                                Logs & Maintenance
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-text-primary">Prune Old Logs</h3>
                                    <p className="text-sm text-gray-400">
                                        Remove detection logs older than a specific timeframe to save space.
                                    </p>
                                    <div className="flex gap-4">
                                        <select
                                            className="input-field flex-1"
                                            value={pruneHours}
                                            onChange={(e) => setPruneHours(e.target.value)}
                                        >
                                            <option value="24">Older than 24 Hours</option>
                                            <option value="72">Older than 3 Days</option>
                                            <option value="168">Older than 1 Week</option>
                                            <option value="336">Older than 2 Weeks</option>
                                            <option value="720">Older than 1 Month</option>
                                        </select>
                                        <button
                                            onClick={handlePruneLogs}
                                            className="btn btn-secondary whitespace-nowrap"
                                        >
                                            Prune Logs
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 border-l border-white/10 pl-0 md:pl-8">
                                    <h3 className="font-semibold text-red-400 flex items-center gap-2">
                                        <AlertTriangle size={18} />
                                        Danger Zone
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        Irreversibly delete all detection logs from the database.
                                    </p>
                                    <button
                                        onClick={handleClearLogs}
                                        className="btn btn-danger w-full justify-center"
                                    >
                                        <Trash2 size={18} />
                                        Clear All Logs
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
