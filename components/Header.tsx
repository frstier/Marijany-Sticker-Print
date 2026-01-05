import React from 'react';
import { ExternalLinkIcon, SettingsIcon, QueueListIcon } from './Icons';
import { PrinterStatus, User } from '../types';

interface HeaderProps {
    currentUser: User | null;
    onLogout: () => void;
    // New Props from App.tsx
    onSettingsClick: () => void;
    onQueueClick?: () => void; // Optional: If provided, show Queue button
    // New Props for Shift
    activeShift?: { startTime: number; printCount: number } | null;
    onShiftClose?: () => void;
    printerData: any; // Contains printerStatus
}

const Header: React.FC<HeaderProps> = ({
    currentUser,
    onLogout,
    onSettingsClick,
    onQueueClick,
    activeShift,
    onShiftClose,
    printerData
}) => {
    // Logout Confirmation State
    const [logoutConfirm, setLogoutConfirm] = React.useState(false);

    const handleLogoutClick = () => {
        if (logoutConfirm) {
            onLogout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    // Extract status from data object
    const printerStatus = printerData?.printerStatus || PrinterStatus.DISCONNECTED;

    return (
        <header className="bg-[#115740] border-b border-[#0f4433] sticky top-0 z-30 shadow-md" style={{ paddingTop: 'var(--safe-area-top, 0px)' }}>
            <div className="max-w-7xl mx-auto px-3 h-14 md:h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl shadow-sm flex items-center justify-center p-2">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-white leading-none tracking-tight">HeMP</h1>
                        <p className="text-[10px] text-emerald-200 font-medium tracking-widest opacity-80 leading-none mt-0.5">HEIGHT MAIN PROGRAM</p>
                        <div className="flex items-center gap-1">
                            {/* New Window Warning Hint */}
                            {typeof window !== 'undefined' && window.self !== window.top && (
                                <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white font-bold bg-white/20 px-1 rounded flex items-center gap-0.5 hover:bg-white/30" title="Відкрити в новому вікні">
                                    <ExternalLinkIcon /> New Window
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Logout Button */}
                    <button
                        onClick={handleLogoutClick}
                        className={`text-xs font-medium transition-all px-3 py-1 rounded-lg ${logoutConfirm
                            ? 'bg-red-500 text-white animate-pulse font-bold'
                            : 'text-white/60 hover:text-white'}`}
                    >
                        {logoutConfirm ? 'Підтвердити?' : 'Вихід'}
                    </button>

                    {/* Active Shift Indicator */}
                    {activeShift && onShiftClose && (
                        <button
                            onClick={onShiftClose}
                            className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-100 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-all font-mono text-xs"
                            title="Закрити зміну"
                        >
                            <span>🕒 {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="bg-emerald-500 text-white px-1.5 rounded-md font-bold">{activeShift.printCount}</span>
                        </button>
                    )}

                    {/* Status Indicator (Bulb) */}
                    <div
                        className={`w-3 h-3 md:w-4 md:h-4 rounded-full shadow-lg transition-colors duration-300 border-2 border-white/20 ${printerStatus === PrinterStatus.CONNECTED ? 'bg-emerald-400 shadow-emerald-900' :
                            printerStatus === PrinterStatus.CONNECTING ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-red-900'
                            }`}
                        title={printerStatus === PrinterStatus.CONNECTED ? "Підключено" : "Немає з'єднання"}
                    />

                    {/* Queue Button (if handler provided) */}
                    {onQueueClick && (
                        <button
                            onClick={onQueueClick}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all active:scale-95 border border-white/10 relative"
                            title="Черга друку"
                        >
                            <QueueListIcon />
                        </button>
                    )}

                    {/* Settings Button */}
                    <button
                        onClick={onSettingsClick}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all active:scale-95 border border-white/10"
                        title="Налаштування"
                    >
                        <SettingsIcon />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
