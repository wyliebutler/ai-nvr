import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Trash2, UserPlus, Shield, User as UserIcon } from 'lucide-react';
import type { User } from '../context/AuthContext';

export function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        try {
            const data = await api.get('/users');
            setUsers(data);
        } catch (err: any) {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        try {
            const user = await api.post('/users', newUser);
            setUsers([...users, user]);
            setNewUser({ username: '', password: '', role: 'viewer' });
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to create user');
        }
    }

    async function handleDeleteUser(id: number) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (err: any) {
            setError('Failed to delete user');
        }
    }

    if (loading) return <div className="p-8 text-center text-white">Loading users...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-white">User Management</h1>

            <div className="glass-panel p-6 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <UserPlus size={20} />
                    Add New User
                </h2>
                <form onSubmit={handleCreateUser} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-white/70 mb-1">Username</label>
                        <input
                            type="text"
                            value={newUser.username}
                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                            className="input-field w-full"
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
                        <input
                            type="password"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            className="input-field w-full"
                            required
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium text-white/70 mb-1">Role</label>
                        <select
                            value={newUser.role}
                            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                            className="input-field w-full"
                        >
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary">
                        Add User
                    </button>
                </form>
                {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
            </div>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="p-4 text-white/70 font-medium">Username</th>
                            <th className="p-4 text-white/70 font-medium">Role</th>
                            <th className="p-4 text-white/70 font-medium">Created At</th>
                            <th className="p-4 text-white/70 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-white/5">
                                <td className="p-4 text-white font-medium flex items-center gap-2">
                                    <UserIcon size={16} className="text-white/50" />
                                    {user.username}
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${user.role === 'admin'
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : 'bg-blue-500/20 text-blue-300'
                                        }`}>
                                        {user.role === 'admin' && <Shield size={12} />}
                                        {user.role.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-white/60 text-sm">
                                    {new Date(user.created_at || Date.now()).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded transition-colors"
                                        title="Delete User"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
