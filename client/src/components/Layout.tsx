import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Video, Film, LogOut, Settings, Users, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout() {
    const { logout, user } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const closeMenu = () => setIsMobileMenuOpen(false);

    return (
        <div className="flex h-screen bg-primary text-text-primary transition-colors duration-300 overflow-hidden">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-secondary border-b border-border flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2 font-bold text-lg">
                    <Video className="w-6 h-6 text-accent" />
                    AI NVR
                </div>
                <button onClick={toggleMenu} className="p-2 text-text-secondary hover:text-text-primary">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={closeMenu}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-secondary border-r border-border flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 border-b border-border hidden lg:block">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-text-primary">
                        <Video className="w-6 h-6 text-accent" />
                        AI NVR
                    </h1>
                </div>

                <div className="p-4 border-b border-border lg:hidden flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-text-primary">
                        <Video className="w-6 h-6 text-accent" />
                        Menu
                    </h1>
                    <button onClick={closeMenu} className="p-1">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <NavLink
                        to="/"
                        end
                        onClick={closeMenu}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                            }`
                        }
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </NavLink>
                    <NavLink
                        to="/feeds"
                        onClick={closeMenu}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                            }`
                        }
                    >
                        <Video className="w-5 h-5" />
                        Feeds
                    </NavLink>
                    <NavLink
                        to="/recordings"
                        onClick={closeMenu}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                            }`
                        }
                    >
                        <Film className="w-5 h-5" />
                        Recordings
                    </NavLink>
                    <NavLink
                        to="/settings"
                        onClick={closeMenu}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                            }`
                        }
                    >
                        <Settings className="w-5 h-5" />
                        Settings
                    </NavLink>
                    {user?.role === 'admin' && (
                        <NavLink
                            to="/users"
                            onClick={closeMenu}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                                }`
                            }
                        >
                            <Users className="w-5 h-5" />
                            Users
                        </NavLink>
                    )}
                </nav>

                <div className="p-4 border-t border-border mt-auto">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-white">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate text-text-primary">{user?.username}</div>
                            <div className="text-xs text-text-secondary capitalize">{user?.role}</div>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-primary rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-primary transition-colors duration-300 pt-16 lg:pt-0">
                <div className="p-4 lg:p-8 h-full">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
