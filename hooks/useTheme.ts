import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hemp_theme_preference';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        // Check localStorage first
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch (e) {
            console.error('Failed to read theme from localStorage', e);
        }
        // Fall back to system preference
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-light', 'theme-dark');
        root.classList.add(`theme-${theme}`);

        // Also set data attribute for compatibility
        root.setAttribute('data-theme', theme);

        // Save to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            console.error('Failed to save theme to localStorage', e);
        }
    }, [theme]);

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            // Only auto-switch if user hasn't explicitly set a preference
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    }, []);

    const isDark = theme === 'dark';

    return { theme, setTheme, toggleTheme, isDark };
}
