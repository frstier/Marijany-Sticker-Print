import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePrinter } from '../../hooks/usePrinter';
import { useHistory } from '../../hooks/useHistory';
import { DataManager } from '../../services/dataManager';
import { DatabaseService } from '../../services/db';
import { SupabaseService } from '../../services/supabase';
import { ZebraDevice, LabelSizeConfig } from '../../types';
import { LABEL_SIZES } from '../../constants';
import {
    SettingsIcon,
    PrinterIcon,
    SearchIcon,
    LockClosedIcon,
    DownloadIcon,
    MailIcon,
} from '../Icons';

import { UserService } from '../../services/userService';
import { Product, User } from '../../types';

// New Features
import AnalyticsDashboard from '../AnalyticsDashboard';
import AuditLogViewer from '../AuditLogViewer';
import QRScanner from '../QRScanner';

export default function AdminInterface() {
    const { logout, currentUser } = useAuth();
    const printerData = usePrinter();
    const historyData = useHistory();
    const [activeTab, setActiveTab] = useState<'printer' | 'database' | 'reports' | 'system' | 'users'>('printer');

    // Users State
    const [usersList, setUsersList] = useState<User[]>(() => UserService.getUsers());
    const [newUser, setNewUser] = useState<User>({ id: '', name: '', role: 'operator', pin: '' });

    // State for local settings (mirrored from SettingsModal logic)
    const [dataSource, setDataSource] = useState<'sqlite' | 'supabase'>(DataManager.getDataSource());
    const [sbUrl, setSbUrl] = useState(() => localStorage.getItem('zebra_supabase_url') || '');
    const [sbKey, setSbKey] = useState(() => localStorage.getItem('zebra_supabase_key') || '');
    const [barcodePattern, setBarcodePattern] = useState(() => localStorage.getItem('zebra_barcode_pattern_v1') || '{date}-{sku}-{serialNumber}-{weight}');

    // Printer State
    const { selectPrinter, discoveredPrinters, searchPrinters, isSearchingPrinters, agentIp, setAgentIp } = printerData;

    // Reports State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const [logoutConfirm, setLogoutConfirm] = useState(false);

    // New Feature Modals
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);

    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            // Reset confirmation after 3 seconds
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    const handleSaveSupabase = () => {
        SupabaseService.updateCredentials(sbUrl, sbKey);
        DataManager.setDataSource('supabase');
        setDataSource('supabase'); // Force update UI
        alert("Налаштування Supabase збережено!");
    };

    const handleBackup = async () => {
        try {
            const file = await DatabaseService.backupDatabase();
            alert(`✅ Резервна копія успішно створена!\n📁 Файл: ${file}\n📂 Папка: Documents`);
        } catch (e) {
            alert('❌ Помилка створення копії.');
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        await historyData.generateReport(start, end);
        setIsGeneratingReport(false);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Top Bar */}
            <header className="bg-[#115740] text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <SettingsIcon />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold leading-none">Адміністратор</h1>
                        <p className="text-xs text-emerald-200 opacity-80">Центр керування</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold">{currentUser?.name}</div>
                        <div className="text-xs text-emerald-200">Role: {currentUser?.role}</div>
                    </div>
                    <button
                        onClick={handleLogoutClick}
                        className={`transition-all px-4 py-2 rounded-lg text-sm font-bold ${logoutConfirm
                            ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-300'
                            : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    >
                        {logoutConfirm ? 'Підтвердити?' : 'Вихід'}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full p-4 gap-6">

                {/* Sidebar Navigation */}
                <aside className="w-64 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden shrink-0">
                    <nav className="flex-1 p-4 space-y-2">
                        <NavButton
                            active={activeTab === 'printer'}
                            onClick={() => setActiveTab('printer')}
                            label="Принтери"
                            icon={<PrinterIcon />}
                        />
                        <NavButton
                            active={activeTab === 'database'}
                            onClick={() => setActiveTab('database')}
                            label="База Даних"
                            icon={<div className="w-6 h-6 flex items-center justify-center font-bold">DB</div>}
                        />
                        <NavButton
                            active={activeTab === 'reports'}
                            onClick={() => setActiveTab('reports')}
                            label="Звіти & Історія"
                            icon={<div className="w-6 h-6 flex items-center justify-center font-bold">📊</div>}
                        />
                        <NavButton
                            active={activeTab === 'users'}
                            onClick={() => setActiveTab('users')}
                            label="Користувачі"
                            icon={<div className="w-6 h-6 flex items-center justify-center font-bold">👥</div>}
                        />
                        <NavButton
                            active={activeTab === 'system'}
                            onClick={() => setActiveTab('system')}
                            label="Система"
                            icon={<SettingsIcon />}
                        />
                    </nav>
                    <div className="p-4 bg-slate-50 border-t text-xs text-slate-400 text-center">
                        v0.9 beta
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 bg-white rounded-2xl shadow-sm overflow-y-auto p-6 relative">

                    {/* PRINTER TAB */}
                    {activeTab === 'printer' && (
                        <div className="space-y-6 max-w-3xl">
                            <h2 className="text-2xl font-bold text-slate-800 border-b pb-4 mb-6">Налаштування Друку</h2>

                            {/* Current Status */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="text-sm text-slate-500 uppercase font-bold mb-2">Активний принтер</div>
                                {printerData?.printer ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                                        <div>
                                            <div className="font-bold text-lg text-slate-800">{printerData.printer.name}</div>
                                            <div className="text-sm text-slate-500 font-mono">{printerData.printer.uid} ({printerData.printer.connection})</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <div className="w-4 h-4 rounded-full bg-slate-300"></div>
                                        <span className="font-medium">Принтер не підключено</span>
                                    </div>
                                )}
                            </div>

                            {/* Discovery */}
                            <section>
                                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <SearchIcon /> Пошук Принтерів (Browser Print)
                                </h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 focus:border-blue-500 outline-none"
                                        value={agentIp || '127.0.0.1'}
                                        onChange={(e) => setAgentIp(e.target.value)}
                                        placeholder="IP агента (127.0.0.1)"
                                    />
                                    <button
                                        onClick={searchPrinters}
                                        disabled={isSearchingPrinters}
                                        className="bg-blue-600 text-white px-6 rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors"
                                    >
                                        {isSearchingPrinters ? 'Пошук...' : 'Пошук'}
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {discoveredPrinters.map((device: ZebraDevice) => (
                                        <div
                                            key={device.uid}
                                            onClick={() => selectPrinter(device)}
                                            className="bg-white p-3 border border-slate-200 rounded-xl flex justify-between items-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800">{device.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{device.uid}</div>
                                            </div>
                                            <div className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase">Вибрати</div>
                                        </div>
                                    ))}
                                    {discoveredPrinters.length === 0 && !isSearchingPrinters && (
                                        <div className="text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">
                                            Принтерів не знайдено. Перевірте Zebra Browser Print.
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Manual LAN */}
                            <section className="pt-6 border-t border-slate-100">
                                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <LockClosedIcon /> Ручне підключення (LAN Direct)
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        id="manual-ip-input"
                                        className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 font-mono focus:border-slate-500 outline-none"
                                        placeholder="192.168.1.xxx"
                                        defaultValue="10.10.10.163"
                                    />
                                    <button
                                        onClick={() => {
                                            const ipInput = document.getElementById('manual-ip-input') as HTMLInputElement;
                                            const ip = ipInput.value.trim();
                                            if (!ip) return;
                                            const manualDevice: ZebraDevice = {
                                                uid: ip,
                                                name: `LAN Printer (${ip})`,
                                                connection: 'net',
                                                deviceType: 'printer',
                                                manufacturer: 'Zebra',
                                                provider: 'Manual',
                                                version: '1.0'
                                            };
                                            selectPrinter(manualDevice);
                                            alert(`Принтер ${ip} додано!`);
                                        }}
                                        className="bg-slate-700 text-white px-6 py-2 rounded-lg hover:bg-slate-800 font-bold transition-colors"
                                    >
                                        Додати
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* DATABASE TAB */}
                    {activeTab === 'database' && (
                        <div className="space-y-8 max-w-3xl">
                            <h2 className="text-2xl font-bold text-slate-800 border-b pb-4 mb-6">База Даних</h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div
                                    onClick={() => { DataManager.setDataSource('sqlite'); setDataSource('sqlite'); }}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${dataSource === 'sqlite' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="text-xl font-bold mb-2">Local SQLite</div>
                                    <p className="text-sm text-slate-500">Локальна база даних на пристрої. Працює офлайн.</p>
                                </div>
                                <div
                                    onClick={() => { DataManager.setDataSource('supabase'); setDataSource('supabase'); }}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${dataSource === 'supabase' ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="text-xl font-bold mb-2">Cloud Supabase</div>
                                    <p className="text-sm text-slate-500">Хмарна синхронізація. Потребує інтернет.</p>
                                </div>
                                <div
                                    onClick={() => { DataManager.setDataSource('postgres'); setDataSource('postgres'); }}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${dataSource === 'postgres' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="text-xl font-bold mb-2">PostgreSQL (API)</div>
                                    <p className="text-sm text-slate-500">Підключення через API сервер (Node.js).</p>
                                </div>
                            </div>

                            {dataSource === 'supabase' && (
                                <div className="bg-green-50 p-6 rounded-2xl border border-green-200 space-y-4">
                                    <h3 className="font-bold text-green-800">Налаштування Supabase</h3>
                                    <div>
                                        <label className="block text-xs font-bold text-green-700 uppercase mb-1">Project URL</label>
                                        <input value={sbUrl} onChange={e => setSbUrl(e.target.value)} className="w-full border border-green-300 rounded px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-green-700 uppercase mb-1">Anon Key</label>
                                        <input type="password" value={sbKey} onChange={e => setSbKey(e.target.value)} className="w-full border border-green-300 rounded px-3 py-2 text-sm" />
                                    </div>
                                    <button onClick={handleSaveSupabase} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">
                                        Зберегти
                                    </button>
                                </div>
                            )}

                            {dataSource === 'postgres' && (
                                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-200 space-y-4">
                                    <h3 className="font-bold text-indigo-800">Налаштування PostgreSQL API</h3>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">Server API URL</label>
                                        <input
                                            defaultValue={localStorage.getItem('zebra_api_url') || 'http://localhost:3000'}
                                            onChange={e => localStorage.setItem('zebra_api_url', e.target.value)}
                                            className="w-full border border-indigo-300 rounded px-3 py-2 text-sm font-mono"
                                            placeholder="http://localhost:3000"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700"
                                        >
                                            Зберегти та Оновити
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const url = localStorage.getItem('zebra_api_url') || 'http://localhost:3000';
                                                try {
                                                    const res = await fetch(`${url}/api/health`);
                                                    const data = await res.json();
                                                    if (data.status === 'ok') {
                                                        alert(`✅ Успішно! DB Connected.\nTime: ${data.timestamp}`);
                                                    } else {
                                                        alert(`❌ Помилка API: ${data.error}`);
                                                    }
                                                } catch (e) {
                                                    alert(`❌ Помилка з'єднання: ${e}`);
                                                }
                                            }}
                                            className="bg-white text-indigo-700 border border-indigo-300 px-6 py-2 rounded-lg font-bold hover:bg-indigo-50"
                                        >
                                            Test Connection
                                        </button>
                                    </div>
                                </div>
                            )}

                            {dataSource === 'sqlite' && (
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                    <h3 className="font-bold text-slate-700 mb-4">Резервне копіювання та Відновлення</h3>

                                    <div className="flex flex-col md:flex-row gap-4">
                                        {/* Export */}
                                        <button
                                            onClick={handleBackup}
                                            className="flex-1 bg-[#115740] text-white px-6 py-4 rounded-xl font-bold hover:bg-[#0d4633] flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-95 transition-all"
                                        >
                                            <div className="bg-white/20 p-2 rounded-lg">
                                                <DownloadIcon />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm opacity-80 font-normal">Експорт</div>
                                                <div>Зберегти Backup</div>
                                            </div>
                                        </button>

                                        {/* Import */}
                                        <div className="flex-1 relative">
                                            <input
                                                type="file"
                                                accept=".json"
                                                id="import-db-file"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    if (!window.confirm(`⚠️ УВАГА!\n\nЦе перезапише ВСІ дані (історію, користувачів) даними з файлу.\n\nПродовжити?`)) {
                                                        e.target.value = ''; // Reset
                                                        return;
                                                    }

                                                    const reader = new FileReader();
                                                    reader.onload = async (ev) => {
                                                        try {
                                                            const json = ev.target?.result as string;
                                                            await DatabaseService.importDatabase(json);
                                                            alert('✅ База даних успішно відновлена!');
                                                            window.location.reload();
                                                        } catch (err) {
                                                            alert('❌ Помилка імпорту: ' + err);
                                                        }
                                                    };
                                                    reader.readAsText(file);
                                                }}
                                            />
                                            <label
                                                htmlFor="import-db-file"
                                                className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 active:scale-95 transition-all cursor-pointer"
                                            >
                                                <div className="bg-white/20 p-2 rounded-lg">
                                                    <div className="w-6 h-6 flex items-center justify-center font-bold text-xl">📂</div>
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm opacity-80 font-normal">Імпорт</div>
                                                    <div>Відновити з файлу</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-4 text-center">
                                        Формат файлу: JSON. Імпорт повністю замінює дані.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REPORTS TAB */}
                    {activeTab === 'reports' && (
                        <div className="space-y-6 max-w-4xl">
                            <h2 className="text-2xl font-bold text-slate-800 border-b pb-4 mb-6">Звіти та Експорт</h2>

                            {/* Controls */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 items-end">
                                <div className="flex gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Від</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">До</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm" />
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerateReport}
                                    disabled={isGeneratingReport}
                                    className="bg-[#115740] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0d4633] mb-[1px]"
                                >
                                    {isGeneratingReport ? 'Завантаження...' : 'Сформувати'}
                                </button>
                            </div>

                            {/* Summary */}
                            {historyData.reportData.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <div className="text-xs text-blue-600 font-bold uppercase">Всього етикеток</div>
                                        <div className="text-3xl font-bold text-blue-900">{historyData.reportSummary.count}</div>
                                    </div>
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <div className="text-xs text-emerald-600 font-bold uppercase">Загальна вага</div>
                                        <div className="text-3xl font-bold text-emerald-900">{historyData.reportSummary.totalWeight.toFixed(2)} <span className="text-sm font-normal text-emerald-700">кг</span></div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => historyData.exportCsv(historyData.reportData)}
                                    disabled={historyData.reportData.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <DownloadIcon /> CSV
                                </button>
                                <button
                                    onClick={() => historyData.exportXlsx(historyData.reportData)}
                                    disabled={historyData.reportData.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 font-bold"
                                >
                                    📊 Excel (XLSX)
                                </button>
                                <button
                                    onClick={() => historyData.sendEmail(historyData.reportData)}
                                    disabled={historyData.reportData.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 font-bold"
                                >
                                    <MailIcon /> Send Email
                                </button>
                            </div>

                            {/* Email Settings */}
                            <div className="pt-8 border-t">
                                <h3 className="font-bold text-slate-700 mb-4">EmailJS Configuration</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Service ID</label>
                                        <input
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm mt-1"
                                            defaultValue={localStorage.getItem('emailjs_service_id') || ''}
                                            onChange={e => localStorage.setItem('emailjs_service_id', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Template ID</label>
                                        <input
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm mt-1"
                                            defaultValue={localStorage.getItem('emailjs_template_id') || ''}
                                            onChange={e => localStorage.setItem('emailjs_template_id', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Public Key</label>
                                        <input
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm mt-1"
                                            defaultValue={localStorage.getItem('emailjs_public_key') || ''}
                                            onChange={e => localStorage.setItem('emailjs_public_key', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="space-y-6 max-w-3xl">
                            <h2 className="text-2xl font-bold text-slate-800 border-b pb-4 mb-6">Користувачі</h2>

                            {/* User List */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="p-4">Ім'я</th>
                                            <th className="p-4">Роль</th>
                                            <th className="p-4">PIN</th>
                                            <th className="p-4 text-right">Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {usersList.map((u: User) => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-bold text-slate-800">{u.name}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                        u.role === 'operator' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-slate-500">****</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setNewUser(u);
                                                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                                            }}
                                                            className="text-blue-500 hover:text-blue-700 font-bold text-sm bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                                                        >
                                                            ✏️ Ред.
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`Видалити користувача ${u.name}?`)) {
                                                                    setUsersList(UserService.deleteUser(u.id));
                                                                    if (newUser.id === u.id) {
                                                                        setNewUser({ id: '', name: '', role: 'operator', pin: '' });
                                                                    }
                                                                }
                                                            }}
                                                            disabled={u.role === 'admin' && usersList.filter(x => x.role === 'admin').length === 1}
                                                            className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            Видалити
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Add/Edit User Form */}
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-700 mb-4">{newUser.id ? 'Редагувати користувача' : 'Додати користувача'}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ім'я</label>
                                        <input
                                            value={newUser.name}
                                            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                                            placeholder="ex. Іван Петренко"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Роль</label>
                                        <select
                                            value={newUser.role}
                                            onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                                        >
                                            {UserService.getRoles().map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PIN (4 цифри)</label>
                                        <input
                                            value={newUser.pin}
                                            maxLength={4}
                                            onChange={e => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono"
                                            placeholder="0000"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            if (newUser.name && newUser.pin.length === 4) {
                                                try {
                                                    if (newUser.id) {
                                                        // Update existing
                                                        setUsersList(UserService.updateUser(newUser));
                                                        alert('Дані оновлено!');
                                                    } else {
                                                        // Create new
                                                        const created = { ...newUser, id: Date.now().toString() };
                                                        setUsersList(UserService.addUser(created));
                                                        alert('Користувача додано!');
                                                    }
                                                    setNewUser({ id: '', name: '', role: 'operator', pin: '' });
                                                } catch (e: any) {
                                                    alert(e.message);
                                                }
                                            } else {
                                                alert('Заповніть всі поля коректно (PIN має бути 4 цифри)');
                                            }
                                        }}
                                        className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${newUser.id ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#115740] hover:bg-[#0d4633]'}`}
                                    >
                                        {newUser.id ? '💾 Зберегти зміни' : '+ Створити'}
                                    </button>

                                    {newUser.id && (
                                        <button
                                            onClick={() => setNewUser({ id: '', name: '', role: 'operator', pin: '' })}
                                            className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 transition-colors"
                                        >
                                            Скасувати
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SYSTEM TAB */}
                    {activeTab === 'system' && (
                        <div className="space-y-6 max-w-3xl">
                            <h2 className="text-2xl font-bold text-slate-800 border-b pb-4 mb-6">Системні Налаштування</h2>

                            <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">🏷️ Barcode Template</h3>
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase">Pattern / Шаблон</label>
                                    <input
                                        value={barcodePattern}
                                        onChange={(e) => {
                                            setBarcodePattern(e.target.value);
                                            localStorage.setItem('zebra_barcode_pattern_v1', e.target.value);
                                        }}
                                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono"
                                    />
                                    <p className="text-xs text-slate-400">Available: {'{sku}, {date}, {weight}, {serialNumber}'}</p>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={() => historyData.addDummyData?.()}
                                    className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg border border-red-200 transition-colors text-sm dashed"
                                >
                                    + Generate Dummy Data (Test)
                                </button>
                            </div>

                            {/* Admin Tools */}
                            <div className="pt-6 border-t">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">🛠️ Інструменти</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <button
                                        onClick={() => setShowAnalytics(true)}
                                        className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                    >
                                        <span className="text-2xl">📊</span>
                                        <div className="text-left">
                                            <div className="text-sm opacity-80">Аналітика</div>
                                            <div>Dashboard</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowAuditLog(true)}
                                        className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                    >
                                        <span className="text-2xl">📋</span>
                                        <div className="text-left">
                                            <div className="text-sm opacity-80">Журнал</div>
                                            <div>Audit Log</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowQRScanner(true)}
                                        className="flex items-center gap-3 p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                    >
                                        <span className="text-2xl">📷</span>
                                        <div className="text-left">
                                            <div className="text-sm opacity-80">Сканер</div>
                                            <div>QR/Barcode</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* Feature Modals */}
            <AnalyticsDashboard
                printHistory={historyData.history || []}
                onClose={() => setShowAnalytics(false)}
                isOpen={showAnalytics}
            />
            <AuditLogViewer
                isOpen={showAuditLog}
                onClose={() => setShowAuditLog(false)}
            />
            <QRScanner
                isOpen={showQRScanner}
                onClose={() => setShowQRScanner(false)}
                onScan={(code) => {
                    alert(`Scanned: ${code}`);
                    setShowQRScanner(false);
                }}
            />
        </div>
    );
}

function NavButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${active ? 'bg-[#115740] text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
        >
            <div className={`w-6 h-6 ${active ? 'text-emerald-200' : 'text-slate-400'}`}>{icon}</div>
            <span>{label}</span>
        </button>
    )
}
