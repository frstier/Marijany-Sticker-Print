import React from 'react';
import { ExternalLinkIcon, RefreshIcon, SettingsIcon } from './Icons';
import { PrinterStatus, User } from '../types';

interface HeaderProps {
    printerStatus: PrinterStatus;
    onRefreshPrinter: () => void;
    onOpenSettings: () => void;
    currentUser: User | null;
    onLogout: () => void;
    queueCount?: number;
    onOpenQueue?: () => void;
}

const Header: React.FC<HeaderProps> = ({
    printerStatus,
    onRefreshPrinter,
    onOpenSettings,
    currentUser,
    onLogout,
    queueCount = 0,
    onOpenQueue
}) => {
    return (
        <header className="bg-[#115740] border-b border-[#0f4433] sticky top-0 z-30 shadow-md">
            <div className="max-w-7xl mx-auto px-3 h-14 md:h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl shadow-sm flex items-center justify-center p-2">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-white leading-none tracking-tight">Marijany Sticker Print</h1>
                        <div className="flex items-center gap-1">
                            <p className="text-[10px] md:text-xs text-white/60">Лінія №1</p>
                            {/* New Window Warning Hint */}
                            {typeof window !== 'undefined' && window.self !== window.top && (
                                <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white font-bold bg-white/20 px-1 rounded flex items-center gap-0.5 hover:bg-white/30 ml-2" title="Відкрити в новому вікні">
                                    <ExternalLinkIcon /> New Window
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Logout Button */}
                    <button
                        onClick={onLogout}
                        className="text-white/60 hover:text-white text-xs font-medium transition-colors"
                    >
                        Вийти
                    </button>

                    {/* Status Indicator (Bulb) */}
                    <div
                        className={`w-3 h-3 md:w-4 md:h-4 rounded-full shadow-lg transition-colors duration-300 border-2 border-white/20 ${printerStatus === PrinterStatus.CONNECTED ? 'bg-emerald-400 shadow-emerald-900' :
                            printerStatus === PrinterStatus.CONNECTING ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-red-900'
                            }`}
                        title={printerStatus === PrinterStatus.CONNECTED ? "Підключено" : "Немає з'єднання"}
                    />

                    {/* Refresh Button */}
                    <button
                        onClick={onRefreshPrinter}
                        className="p-2 bg-[#16664c] hover:bg-[#0d4633] text-white rounded-lg shadow-sm transition-all active:scale-95 border border-[#1a7a5b]"
                        title="З'єднатися з принтером"
                    >
                        <RefreshIcon />
                    </button>

                    {/* Queue Button (Restricted) */}
                    {onOpenQueue && (
                        <button
                            onClick={onOpenQueue}
                            className={`p-2 relative rounded-lg transition-all active:scale-95 border border-white/10 ${queueCount > 0 ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Відкладений друк"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {queueCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[#115740]">
                                    {queueCount}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Settings Button */}
                    <button
                        onClick={onOpenSettings}
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
