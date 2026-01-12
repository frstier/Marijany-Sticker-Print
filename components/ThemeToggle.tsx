import React from 'react';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
    className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`
                relative w-14 h-7 rounded-full transition-all duration-300 ease-in-out
                flex items-center px-1
                ${isDark
                    ? 'bg-slate-700 border border-slate-600'
                    : 'bg-amber-100 border border-amber-200'
                }
                ${className}
            `}
            title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {/* Sun icon */}
            <span className={`
                absolute left-1 text-sm transition-all duration-300
                ${isDark ? 'opacity-30' : 'opacity-100'}
            `}>
                ☀️
            </span>

            {/* Moon icon */}
            <span className={`
                absolute right-1 text-sm transition-all duration-300
                ${isDark ? 'opacity-100' : 'opacity-30'}
            `}>
                🌙
            </span>

            {/* Toggle circle */}
            <span className={`
                absolute w-5 h-5 rounded-full shadow-md transition-all duration-300 ease-in-out
                flex items-center justify-center text-xs
                ${isDark
                    ? 'right-1 bg-slate-800 text-white'
                    : 'left-1 bg-white text-amber-500'
                }
            `}>
            </span>
        </button>
    );
}
