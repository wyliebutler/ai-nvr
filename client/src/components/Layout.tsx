import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Video, Film, LogOut, Settings, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout() {
    const { logout, user } = useAuth();

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-6 border-b border-gray-700">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Video className="w-6 h-6 text-blue-500" />
                        AI NVR
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`
                        }
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </NavLink>
                    <NavLink
                        to="/feeds"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`
                        }
                    >
                        <Video className="w-5 h-5" />
                        Feeds
                    </NavLink>
                    <NavLink
                        to="/recordings"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`
                        }
                    >
                        <Film className="w-5 h-5" />
                        Recordings
                    </NavLink>
                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`
                        }
                    >
                        <Settings className="w-5 h-5" />
                        Settings
                    </NavLink>
                    {user?.role === 'admin' && (
                        <NavLink
                            to="/users"
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`
                            }
                        >
                            <Users className="w-5 h-5" />
                            Users
                        </NavLink>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-700">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{user?.username}</div>
                            <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-8 h-full">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
