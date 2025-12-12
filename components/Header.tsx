import React from 'react';
import { ExternalLinkIcon, RefreshIcon, SettingsIcon } from './Icons';
import { PrinterStatus, User } from '../types';

interface HeaderProps {
    printerStatus: PrinterStatus;
    onRefreshPrinter: () => void;
    onOpenSettings: () => void;
    currentUser: User | null;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({
    printerStatus,
    onRefreshPrinter,
    onOpenSettings,
    currentUser,
    onLogout
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
