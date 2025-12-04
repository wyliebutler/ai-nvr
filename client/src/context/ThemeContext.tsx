import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

type Theme = 'default' | 'cyberpunk' | 'forest' | 'ocean';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('default');

    useEffect(() => {
        // Load theme from settings on startup
        const loadTheme = async () => {
            try {
                const settings = await api.get('/settings');
                if (settings.theme) {
                    setThemeState(settings.theme as Theme);
                }
            } catch (error) {
                console.error('Failed to load theme settings', error);
            }
        };
        loadTheme();
    }, []);

    useEffect(() => {
        console.log('ThemeContext: applying theme', theme);
        // Apply theme to html element using data-theme attribute
        const root = document.documentElement;
        if (theme === 'default') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        console.log('ThemeContext: setting theme to', newTheme);
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
