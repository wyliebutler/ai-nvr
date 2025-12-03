import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Feed } from '../lib/types';
import { FeedDialog } from '../components/FeedDialog';
import { Edit2, Trash2, Plus, Video } from 'lucide-react';

export function Feeds() {
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingFeed, setEditingFeed] = useState<Feed | undefined>(undefined);

    useEffect(() => {
        loadFeeds();
    }, []);

    async function loadFeeds() {
        try {
            const token = localStorage.getItem('token');
            const data = await api.get('/feeds', token || undefined);
            setFeeds(data);
        } catch (err) {
            console.error('Failed to load feeds:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(feedData: Partial<Feed>) {
        const token = localStorage.getItem('token');
        if (editingFeed) {
            await api.put(`/feeds/${editingFeed.id}`, feedData, token || undefined);
        } else {
            await api.post('/feeds', feedData, token || undefined);
        }
        await loadFeeds();
    }

    async function handleDelete(id: number) {
        if (!confirm('Are you sure you want to delete this feed?')) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/feeds/${id}`, token || undefined);
            await loadFeeds();
        } catch (err) {
            console.error('Failed to delete feed:', err);
            alert('Failed to delete feed');
        }
    }

    function openAddDialog() {
        setEditingFeed(undefined);
        setIsDialogOpen(true);
    }

    function openEditDialog(feed: Feed) {
        setEditingFeed(feed);
        setIsDialogOpen(true);
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Camera Feeds</h1>
                <button
                    onClick={openAddDialog}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Feed
                </button>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">RTSP URL</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feeds.length === 0 ? (
                            <tr>
                                <td className="p-8 text-center text-gray-500" colSpan={4}>
                                    No feeds configured. Click "Add Feed" to get started.
                                </td>
                            </tr>
                        ) : (
                            feeds.map(feed => (
                                <tr key={feed.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                                    <td className="p-4 font-medium flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-blue-500">
                                            <Video className="w-4 h-4" />
                                        </div>
                                        {feed.name}
                                    </td>
                                    <td className="p-4 text-gray-400 font-mono text-sm truncate max-w-xs">
                                        {feed.rtsp_url}
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                            Active
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditDialog(feed)}
                                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(feed.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <FeedDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSave={handleSave}
                feed={editingFeed}
            />
        </div>
    );
}
