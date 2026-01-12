import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ExcelImportModal from '../modals/ExcelImportModal';
import PrintHubModal from '../modals/PrintHubModal';
import ThemeToggle from '../ThemeToggle';

export default function ReceivingInterface() {
    const { logout, currentUser } = useAuth();
    const [logoutConfirm, setLogoutConfirm] = useState(false);

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
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Header - Corporate Green */}
            <header className="text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50" style={{ backgroundColor: 'var(--header-bg)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/10 rounded-lg text-2xl">📦</div>
                    <div>
                        <h1 className="text-xl font-bold leading-none">Приймання</h1>
                        <p className="text-xs opacity-70">Склад & Імпорт</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold">{currentUser?.name}</div>
                        <div className="text-xs uppercase tracking-wider opacity-70">{currentUser?.role}</div>
                    </div>
                    <button
                        onClick={handleLogoutClick}
                        className={`transition-all px-6 py-2 rounded-lg text-sm font-bold shadow-lg ${logoutConfirm
                            ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-300'
                            : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    >
                        {logoutConfirm ? 'Підтвердити?' : 'Вихід'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 max-w-7xl mx-auto w-full">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* CARD 1: EXCEL IMPORT */}
                    <div
                        onClick={() => setExcelImportOpen(true)}
                        className="rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer border-2 border-transparent group relative overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="text-9xl">📊</span>
                        </div>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: 'var(--accent-secondary)', opacity: 0.9 }}>
                            📥
                        </div>
                        <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Excel Імпорт</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Завантаження нових партій товару з файлів Excel (.xlsx).</p>
                        <div className="mt-8 flex items-center font-bold group-hover:translate-x-2 transition-transform" style={{ color: 'var(--accent-primary)' }}>
                            Завантажити файл <span className="ml-2">→</span>
                        </div>
                    </div>

                    {/* CARD 2: PRINT HUB */}
                    <div
                        onClick={() => setPrintHubOpen(true)}
                        className="rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer border-2 border-transparent group relative overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="text-9xl">🖨️</span>
                        </div>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>
                            ⚙️
                        </div>
                        <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Print Hub</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Керування чергою друку та масовий друк стікерів для партій.</p>
                        <div className="mt-8 flex items-center font-bold group-hover:translate-x-2 transition-transform" style={{ color: 'var(--accent-primary)' }}>
                            Відкрити менеджер <span className="ml-2">→</span>
                        </div>
                    </div>

                    {/* CARD 3: SHIPPING (PLACEHOLDER) */}
                    <div className="bg-slate-50 rounded-2xl p-8 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center opacity-70">
                        <div className="text-4xl mb-4 grayscale">🚚</div>
                        <h3 className="text-xl font-bold text-slate-400 mb-1">Відвантаження</h3>
                        <p className="text-sm text-slate-400">Цей модуль знаходиться в розробці</p>
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
