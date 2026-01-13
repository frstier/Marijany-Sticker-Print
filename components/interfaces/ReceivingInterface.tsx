import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ExcelImportModal from '../modals/ExcelImportModal';
import PrintHubModal from '../modals/PrintHubModal';
import ThemeToggle from '../ThemeToggle';

type ViewMode = 'import' | 'printhub';

export default function ReceivingInterface() {
    const { logout, currentUser } = useAuth();
    const [logoutConfirm, setLogoutConfirm] = useState(false);

    // View Mode
    const [activeView, setActiveView] = useState<ViewMode>('import');

    // Feature State
    const [excelImportOpen, setExcelImportOpen] = useState(false);
    const [printHubOpen, setPrintHubOpen] = useState(false);

    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Sidebar */}
            <aside className="w-64 text-white flex flex-col shrink-0" style={{ backgroundColor: 'var(--header-bg)' }}>
                {/* Logo */}
                <div className="p-5 border-b border-white/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--accent-secondary)' }}>
                            📦
                        </div>
                        <div>
                            <div className="font-bold text-lg">HeMP</div>
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Приймання</div>
                        </div>
                        <div className="ml-auto">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    <button
                        onClick={() => setActiveView('import')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'import' ? '' : 'hover:bg-white/10'}`}
                        style={activeView === 'import' ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">📥</span>
                        <span className="font-medium">Excel Імпорт</span>
                    </button>

                    <button
                        onClick={() => setActiveView('printhub')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'printhub' ? '' : 'hover:bg-white/10'}`}
                        style={activeView === 'printhub' ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">🖨️</span>
                        <span className="font-medium">Print Hub</span>
                    </button>

                    <button
                        disabled
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left opacity-40 cursor-not-allowed"
                    >
                        <span className="text-xl grayscale">🚚</span>
                        <span className="font-medium">Відвантаження</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-white/20 rounded">TBD</span>
                    </button>
                </nav>

                {/* User & Logout */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{currentUser?.name}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Приймальник</div>
                        </div>
                        <button
                            onClick={handleLogoutClick}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${logoutConfirm ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        >
                            {logoutConfirm ? '?' : '🚪'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="px-6 py-4 border-b shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {activeView === 'import' ? 'Excel Імпорт' : 'Print Hub'}
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {activeView === 'import'
                            ? 'Завантаження нових партій товару з файлів Excel (.xlsx)'
                            : 'Керування чергою друку та масовий друк стікерів'
                        }
                    </p>
                </header>

                {/* Content */}
                <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div
                        onClick={() => activeView === 'import' ? setExcelImportOpen(true) : setPrintHubOpen(true)}
                        className="max-w-md w-full rounded-2xl p-10 shadow-xl cursor-pointer border-2 hover:shadow-2xl transition-all group"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                        <div className="text-center">
                            <div
                                className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl mb-6 group-hover:scale-110 transition-transform shadow-lg"
                                style={{ backgroundColor: activeView === 'import' ? 'var(--accent-secondary)' : 'var(--accent-primary)' }}
                            >
                                {activeView === 'import' ? '📥' : '🖨️'}
                            </div>
                            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                                {activeView === 'import' ? 'Завантажити Excel файл' : 'Відкрити Print Hub'}
                            </h2>
                            <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
                                {activeView === 'import'
                                    ? 'Оберіть .xlsx файл з даними партії для імпорту в систему'
                                    : 'Друкуйте стікери для всіх бейлів з черги'
                                }
                            </p>
                            <div
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-lg transition-all group-hover:scale-105"
                                style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                            >
                                {activeView === 'import' ? 'Обрати файл' : 'Відкрити'}
                                <span>→</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {excelImportOpen && (
                <ExcelImportModal
                    onClose={() => setExcelImportOpen(false)}
                    currentUser={currentUser}
                />
            )}

            {printHubOpen && (
                <PrintHubModal onClose={() => setPrintHubOpen(false)} />
            )}
        </div>
    );
}
