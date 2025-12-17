import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Video, LogOut, Settings, Users, Menu, X, Home, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export function Layout() {
    const { logout, user } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [systemMode, setSystemMode] = useState<'home' | 'away'>('away');

    useEffect(() => {
        // Fetch initial system mode
        api.get('/settings').then(settings => {
            if (settings.system_mode) {
                setSystemMode(settings.system_mode);
            }
        }).catch(console.error);
    }, []);

    const toggleSystemMode = async () => {
        const newMode = systemMode === 'home' ? 'away' : 'home';
        try {
            await api.post('/settings', { system_mode: newMode });
            setSystemMode(newMode);
        } catch (error) {
            console.error('Failed to update system mode:', error);
        }
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Video, label: 'Cameras', path: '/feeds' },
        { icon: Video, label: 'Recordings', path: '/recordings' },
        { icon: Settings, label: 'Settings', path: '/settings' },
        { icon: AlertCircle, label: 'Logs', path: '/logs', adminOnly: true },
        { icon: Users, label: 'Users', path: '/users', adminOnly: true },
    ];

    const handleLogout = () => {
        logout();
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-primary text-text-primary flex">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-primary border-b border-border z-50 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <Video className="w-6 h-6 text-accent" />
                    <span className="font-bold text-xl">AI NVR</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50 w-64 bg-primary border-r border-border flex flex-col
                transform transition-transform duration-200 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6 flex items-center gap-3 border-b border-border hidden lg:flex">
                    <Video className="w-8 h-8 text-accent" />
                    <span className="font-bold text-xl">AI NVR</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        (!item.adminOnly || user?.role === 'admin') && (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                        ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                        : 'text-text-secondary hover:bg-secondary hover:text-text-primary'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </NavLink>
                        )
                    ))}
                </nav>

                <div className="p-4 border-t border-border space-y-2">
                    {/* Home/Away Toggle */}
                    <button
                        onClick={toggleSystemMode}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors border ${systemMode === 'home'
                            ? 'bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50'
                            : 'bg-yellow-900/30 border-yellow-800 text-yellow-400 hover:bg-yellow-900/50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            {systemMode === 'home' ? <Home className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                            <span className="font-medium">{systemMode === 'home' ? 'Home' : 'Away'}</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${systemMode === 'home' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    </button>

                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <span className="font-bold text-sm">
                                {user?.username?.[0]?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.username}</p>
                            <p className="text-xs text-text-secondary capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mt-2"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-primary transition-colors duration-300 pt-16 lg:pt-0">
                <div className="p-4 lg:p-8 h-full">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
