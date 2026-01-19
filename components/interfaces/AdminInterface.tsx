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
import LabelDesigner from '../LabelDesigner';
import ConfirmDialog from '../ConfirmDialog';
import LocationSearch from '../warehouse/LocationSearch';
// import ExcelImportModal from '../modals/ExcelImportModal'; // MOVED TO RECEIVING
// import PrintHubModal from '../modals/PrintHubModal'; // MOVED TO RECEIVING

export default function AdminInterface() {
    const { logout, currentUser } = useAuth();
    const printerData = usePrinter();
    const historyData = useHistory();
    const [activeTab, setActiveTab] = useState<'printer' | 'database' | 'reports' | 'system' | 'users'>('printer');

    // Users State
    const [usersList, setUsersList] = useState<User[]>([]);

    React.useEffect(() => {
        UserService.getUsers().then(setUsersList);
    }, []);

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
    const [showLabelDesigner, setShowLabelDesigner] = useState(false);

    // Delete User Confirmation Dialog State
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });

    // const [excelImportOpen, setExcelImportOpen] = useState(false); // MOVED
    // const [printHubOpen, setPrintHubOpen] = useState(false); // MOVED

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

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Не вдалося відкрити вікно друку. Перевірте налаштування браузера.');
            return;
        }

        const items = historyData.reportData;

        // Generate Table Rows
        const rows = items.map(item => `
            <tr>
                <td>${item.date ? new Date(item.date).toLocaleDateString('uk-UA') : ''}</td>
                <td style="font-family: monospace;">${item.barcode || ''}</td>
                <td>${item.serialNumber}</td>
                <td>${item.product?.name || ''}</td>
                <td style="text-align: right;">${item.weight} кг</td>
                <td>${item.sortLabel || item.sortValue || '-'}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
            <head>
                <title>Звіт лабораторії</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; font-size: 24px; margin-bottom: 20px; text-transform: uppercase; }
                    .meta { text-align: center; font-size: 14px; margin-bottom: 30px; color: #555; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
                    @media print {
                        .no-print { display: none; }
                        @page { margin: 10mm; }
                    }
                </style>
            </head>
            <body>
                <h1>Звіт Лабораторії</h1>
                <div class="meta">за ${startDate} ${startDate !== endDate ? ' - ' + endDate : ''}</div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>UID</th>
                            <th>№</th>
                            <th>Продукт</th>
                            <th>Вага (кг)</th>
                            <th>Сорт</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <div style="margin-top: 20px; font-size: 12px; text-align: right;">
                    Всього: <strong>${historyData.reportSummary.count}</strong> шт. | Вага: <strong>${historyData.reportSummary.totalWeight.toFixed(2)}</strong> кг
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
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
                <aside className="w-64 bg-[var(--bg-card)] rounded-2xl shadow-sm flex flex-col overflow-hidden shrink-0">
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
                        <div className="border-t border-slate-200 my-3" />
                        <button
                            onClick={() => setShowLabelDesigner(true)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 hover:border-purple-300 transition-all"
                        >
                            <span className="text-xl">🎨</span>
                            <span className="font-medium text-purple-700">Редактор Етикеток</span>
                        </button>
                    </nav>
                    <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-color)] text-xs text-[var(--text-muted)] text-center">
                        v0.9 beta
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 bg-[var(--bg-card)] rounded-2xl shadow-sm overflow-y-auto p-6 relative">

                    {/* PRINTER TAB */}
                    {activeTab === 'printer' && (
                        <div className="space-y-6 max-w-3xl">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4 mb-6">Налаштування Друку</h2>

                            {/* Current Status */}
                            <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-color)]">
                                <div className="text-sm text-[var(--text-muted)] uppercase font-bold mb-2">Активний принтер</div>
                                {printerData?.printer ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                                        <div>
                                            <div className="font-bold text-lg text-[var(--text-primary)]">{printerData.printer.name}</div>
                                            <div className="text-sm text-[var(--text-secondary)] font-mono">{printerData.printer.uid} ({printerData.printer.connection})</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-[var(--text-muted)]">
                                        <div className="w-4 h-4 rounded-full bg-[var(--text-muted)]"></div>
                                        <span className="font-medium">Принтер не підключено</span>
                                    </div>
                                )}
                            </div>

                            {/* Discovery */}
                            <section>
                                <h3 className="font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                                    <SearchIcon /> Пошук Принтерів (Browser Print)
                                </h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        className="border-2 border-[var(--border-color)] bg-[var(--bg-input)] rounded-lg px-3 py-2 text-sm flex-1 focus:border-blue-500 outline-none text-[var(--text-primary)]"
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
                                            className="bg-[var(--bg-card)] p-3 border border-[var(--border-color)] rounded-xl flex justify-between items-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm"
                                        >
                                            <div>
                                                <div className="font-bold text-[var(--text-primary)]">{device.name}</div>
                                                <div className="text-xs text-[var(--text-muted)] font-mono">{device.uid}</div>
                                            </div>
                                            <div className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase">Вибрати</div>
                                        </div>
                                    ))}
                                    {discoveredPrinters.length === 0 && !isSearchingPrinters && (
                                        <div className="text-[var(--text-muted)] text-center py-4 border-2 border-dashed border-[var(--border-color)] rounded-xl">
                                            Принтерів не знайдено. Перевірте Zebra Browser Print.
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Manual LAN */}
                            <section className="pt-6 border-t border-[var(--border-color)]">
                                <h3 className="font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                                    <LockClosedIcon /> Ручне підключення (LAN Direct)
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        id="manual-ip-input"
                                        className="border-2 border-[var(--border-color)] bg-[var(--bg-input)] rounded-lg px-3 py-2 text-sm flex-1 font-mono focus:border-[var(--text-secondary)] outline-none text-[var(--text-primary)]"
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

                            {/* Office Printer for Reports */}
                            <section className="pt-6 border-t border-[var(--border-color)]">
                                <h3 className="font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                                    🖨️ Офісний Принтер (для звітів)
                                </h3>
                                <p className="text-sm text-[var(--text-muted)] mb-3">
                                    Назва та IP офісного принтера для друку звітів
                                </p>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            id="office-printer-name"
                                            className="border-2 border-[var(--border-color)] bg-[var(--bg-input)] rounded-lg px-3 py-2 text-sm flex-1 focus:border-[var(--text-secondary)] outline-none text-[var(--text-primary)]"
                                            placeholder="Назва: Kyocera TasKalfa 3252ci"
                                            defaultValue={localStorage.getItem('office_printer_name') || ''}
                                        />
                                        <input
                                            type="text"
                                            id="office-printer-ip"
                                            className="border-2 border-[var(--border-color)] bg-[var(--bg-input)] rounded-lg px-3 py-2 text-sm w-40 font-mono focus:border-[var(--text-secondary)] outline-none text-[var(--text-primary)]"
                                            placeholder="IP: 10.10.10.50"
                                            defaultValue={localStorage.getItem('office_printer_ip') || ''}
                                        />
                                        <button
                                            onClick={() => {
                                                const nameInput = document.getElementById('office-printer-name') as HTMLInputElement;
                                                const ipInput = document.getElementById('office-printer-ip') as HTMLInputElement;
                                                const name = nameInput.value.trim();
                                                const ip = ipInput.value.trim();

                                                if (name || ip) {
                                                    localStorage.setItem('office_printer_name', name);
                                                    localStorage.setItem('office_printer_ip', ip);
                                                    alert(`Офісний принтер збережено:\n${name}${ip ? ` (${ip})` : ''}`);
                                                } else {
                                                    localStorage.removeItem('office_printer_name');
                                                    localStorage.removeItem('office_printer_ip');
                                                    alert('Налаштування офісного принтера видалено');
                                                }
                                            }}
                                            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-bold transition-colors"
                                        >
                                            Зберегти
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-[var(--text-muted)]">
                                    💡 Користувачі побачать підказку перед друком: "Виберіть принтер: Kyocera TasKalfa (10.10.10.50)"
                                </div>
                            </section>
                        </div>
                    )}

                    {/* DATABASE TAB */}
                    {activeTab === 'database' && (
                        <div className="space-y-8 max-w-3xl">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4 mb-6">База Даних</h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div
                                    onClick={() => { DataManager.setDataSource('sqlite'); setDataSource('sqlite'); }}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${dataSource === 'sqlite' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200' : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'}`}
                                >
                                    <div className="text-xl font-bold mb-2 text-[var(--text-primary)]">Local SQLite</div>
                                    <p className="text-sm text-[var(--text-secondary)]">Локальна база даних на пристрої. Працює офлайн.</p>
                                </div>
                                <div
                                    onClick={() => { DataManager.setDataSource('supabase'); setDataSource('supabase'); }}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${dataSource === 'supabase' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-200' : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'}`}
                                >
                                    <div className="text-xl font-bold mb-2 text-[var(--text-primary)]">Cloud Supabase</div>
                                    <p className="text-sm text-[var(--text-secondary)]">Хмарна синхронізація. Потребує інтернет.</p>
                                </div>
                                <div
                                    onClick={() => { DataManager.setDataSource('postgres'); setDataSource('postgres'); }}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${dataSource === 'postgres' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-200' : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'}`}
                                >
                                    <div className="text-xl font-bold mb-2 text-[var(--text-primary)]">PostgreSQL (API)</div>
                                    <p className="text-sm text-[var(--text-secondary)]">Підключення через API сервер (Node.js).</p>
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
                                <div className="bg-[var(--bg-tertiary)] p-6 rounded-2xl border border-[var(--border-color)]">
                                    <h3 className="font-bold text-[var(--text-secondary)] mb-4">Резервне копіювання та Відновлення</h3>

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

                                        {/* Import DB */}
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

                                    <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
                                        Формат файлу: JSON. Імпорт повністю замінює дані.
                                    </p>
                                </div>
                            )}

                            {/* DANGER ZONE */}
                            <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 mt-8">
                                <h3 className="text-red-800 font-bold mb-4 flex items-center gap-2">
                                    <span>☢️</span> НЕБЕЗПЕЧНА ЗОНА
                                </h3>
                                <p className="text-red-700 text-sm mb-4">
                                    Ці дії призводять до повного видалення даних. Будьте обережні.
                                </p>
                                <button
                                    onClick={async () => {
                                        if (confirm("ВИ ВПЕВНЕНІ?\n\nЦе видалить ВСІ дані (історію, палети, бейли) з цього пристрою і з хмари (якщо підключено).\n\nЦю дію неможливо відмінити!")) {
                                            if (confirm("Точно видалити все?")) {
                                                // 1. Wipe Supabase if active
                                                if (dataSource === 'supabase') {
                                                    try {
                                                        const { error: e1 } = await SupabaseService.client.from('production_items').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
                                                        const { error: e2 } = await SupabaseService.client.from('batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

                                                        if (e1 || e2) throw new Error("Cloud delete failed");
                                                        alert("Хмарні дані (Supabase) очищено.");
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert("Помилка очищення хмари. Перевірте з'єднання.");
                                                    }
                                                }

                                                // 2. Wipe Local Storage
                                                localStorage.removeItem('zebra_items_v1');
                                                localStorage.removeItem('zebra_batches_v1');
                                                localStorage.removeItem('zebra_batch_date_v1');
                                                localStorage.removeItem('zebra_batch_seq_v1');
                                                // Keep settings, users, etc.

                                                alert("Виробничі дані очищено. Сторінка буде перезавантажена.");
                                                window.location.reload();
                                            }
                                        }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-red-500/30 w-full flex items-center justify-center gap-2"
                                >
                                    🗑️ ПОВНЕ ОЧИЩЕННЯ (Бейли та Палети)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* REPORTS TAB */}
                    {
                        activeTab === 'reports' && (
                            <div className="space-y-6 max-w-4xl">
                                <h2 className="text-2xl font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4 mb-6">Звіти та Експорт</h2>

                                {/* Controls */}
                                <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-color)] flex flex-wrap gap-4 items-end">
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Від</label>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm text-[var(--text-primary)]" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">До</label>
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm text-[var(--text-primary)]" />
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
                                    <div className="space-y-4">
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

                                        {/* Detailed Aggregation Table */}
                                        {historyData.reportAggregation && historyData.reportAggregation.length > 0 && (
                                            <div className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-bold uppercase text-xs">
                                                        <tr>
                                                            <th className="p-3 text-left">Продукт</th>
                                                            <th className="p-3 text-center">Кількість (шт)</th>
                                                            <th className="p-3 text-right">Вага (кг)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[var(--border-color)]">
                                                        {historyData.reportAggregation.map((item: any) => (
                                                            <tr key={item.name} className="hover:bg-[var(--bg-tertiary)]">
                                                                <td className="p-3 font-medium text-[var(--text-primary)]">{item.name}</td>
                                                                <td className="p-3 text-center text-[var(--text-secondary)]">{item.count}</td>
                                                                <td className="p-3 text-right font-bold text-[var(--text-primary)]">{item.weight.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={handlePrint}
                                        disabled={historyData.reportData.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg hover:bg-slate-800 disabled:opacity-50 font-bold shadow-sm"
                                    >
                                        🖨️ Друк (PDF)
                                    </button>
                                    <button
                                        onClick={() => historyData.exportCsv(historyData.reportData)}
                                        disabled={historyData.reportData.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 text-[var(--text-secondary)]"
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
                                <div className="pt-8 border-t border-[var(--border-color)]">
                                    <h3 className="font-bold text-[var(--text-secondary)] mb-4 mt-8">📧 Email Отримувачі (за ролями)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Оператор (Зміни)</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                placeholder="shifto@example.com"
                                                defaultValue={localStorage.getItem('email_recipient_operator') || ''}
                                                onChange={e => localStorage.setItem('email_recipient_operator', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Лабораторія</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                placeholder="lab@example.com"
                                                defaultValue={localStorage.getItem('email_recipient_lab') || ''}
                                                onChange={e => localStorage.setItem('email_recipient_lab', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Обліковець</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                placeholder="accountant@example.com"
                                                defaultValue={localStorage.getItem('email_recipient_accountant') || ''}
                                                onChange={e => localStorage.setItem('email_recipient_accountant', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-[var(--text-secondary)] mb-4">⚙️ EmailJS Configuration (Технічні)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Service ID</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('emailjs_service_id') || ''}
                                                onChange={e => localStorage.setItem('emailjs_service_id', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Template ID</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('emailjs_template_id') || ''}
                                                onChange={e => localStorage.setItem('emailjs_template_id', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Public Key</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('emailjs_public_key') || ''}
                                                onChange={e => localStorage.setItem('emailjs_public_key', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }


                    {/* USERS TAB */}
                    {
                        activeTab === 'users' && (
                            <div className="space-y-6 max-w-3xl">
                                <h2 className="text-2xl font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4 mb-6">Користувачі</h2>

                                {/* User List */}
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs uppercase font-bold">
                                            <tr>
                                                <th className="p-4">Ім'я</th>
                                                <th className="p-4">Роль</th>
                                                <th className="p-4">PIN</th>
                                                <th className="p-4 text-right">Дії</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-color)]">
                                            {usersList.map((u: User) => (
                                                <tr key={u.id} className="hover:bg-[var(--bg-tertiary)]">
                                                    <td className="p-4 font-bold text-[var(--text-primary)]">{u.name}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                            u.role === 'operator' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                                                                'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                                            }`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-mono text-[var(--text-muted)]">****</td>
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
                                                                onClick={() => setDeleteConfirm({ isOpen: true, user: u })}
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
                                <div className="bg-[var(--bg-tertiary)] p-6 rounded-xl border border-[var(--border-color)]">
                                    <h3 className="font-bold text-[var(--text-secondary)] mb-4">{newUser.id ? 'Редагувати користувача' : 'Додати користувача'}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Ім'я</label>
                                            <input
                                                value={newUser.name}
                                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm text-[var(--text-primary)]"
                                                placeholder="ex. Іван Петренко"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Роль</label>
                                            <select
                                                value={newUser.role}
                                                onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm text-[var(--text-primary)]"
                                            >
                                                {UserService.getRoles().map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">PIN (4 цифри)</label>
                                            <input
                                                value={newUser.pin}
                                                maxLength={4}
                                                onChange={e => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm font-mono text-[var(--text-primary)]"
                                                placeholder="0000"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={async () => {
                                                if (newUser.name && newUser.pin.length === 4) {
                                                    try {
                                                        let updatedList;
                                                        if (newUser.id) {
                                                            // Update existing
                                                            updatedList = await UserService.updateUser(newUser);
                                                            alert('Дані оновлено!');
                                                        } else {
                                                            // Create new with UUID
                                                            const created = { ...newUser, id: crypto.randomUUID() };
                                                            updatedList = await UserService.addUser(created);
                                                            alert('Користувача додано!');
                                                        }
                                                        setUsersList(updatedList);
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
                                                className="px-6 py-2 rounded-lg font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] bg-[var(--bg-card)] border border-[var(--border-color)] transition-colors"
                                            >
                                                Скасувати
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* SYSTEM TAB */}
                    {
                        activeTab === 'system' && (
                            <div className="space-y-6 max-w-3xl">
                                <h2 className="text-2xl font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4 mb-6">Системні Налаштування</h2>

                                <div className="bg-[var(--bg-tertiary)] p-6 rounded-xl border border-dashed border-[var(--border-color)]">
                                    <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">🏷️ Barcode Template</h3>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase">Pattern / Шаблон</label>
                                        <input
                                            value={barcodePattern}
                                            onChange={(e) => {
                                                setBarcodePattern(e.target.value);
                                                localStorage.setItem('zebra_barcode_pattern_v1', e.target.value);
                                            }}
                                            className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm font-mono text-[var(--text-primary)]"
                                        />
                                        <p className="text-xs text-[var(--text-muted)]">Available: {'{sku}, {date}, {weight}, {serialNumber}'}</p>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    {/* Dummy Data Generator Removed for Stability */}
                                </div>

                                {/* Email Settings */}
                                <div className="pt-6 border-t border-[var(--border-color)]">
                                    <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">📧 Налаштування Email (Звіти)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">ID Сервісу (Service ID)</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('emailjs_service_id') || ''}
                                                onChange={e => localStorage.setItem('emailjs_service_id', e.target.value)}
                                                placeholder="service_..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">ID Шаблону (Template ID)</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('emailjs_template_id') || ''}
                                                onChange={e => localStorage.setItem('emailjs_template_id', e.target.value)}
                                                placeholder="template_..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Публічний ключ (Public Key)</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('emailjs_public_key') || ''}
                                                onChange={e => localStorage.setItem('emailjs_public_key', e.target.value)}
                                                placeholder="public_key"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Email Отримувача (За замовчуванням)</label>
                                            <input
                                                className="w-full border border-[var(--border-color)] bg-[var(--bg-input)] rounded px-3 py-2 text-sm mt-1 text-[var(--text-primary)]"
                                                defaultValue={localStorage.getItem('zebra_report_email_v1') || ''}
                                                onChange={e => localStorage.setItem('zebra_report_email_v1', e.target.value)}
                                                placeholder="report@example.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Admin Tools */}
                                <div className="pt-6 border-t border-[var(--border-color)]">
                                    <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">🛠️ Інструменти</h3>
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

                                {/* DANGER ZONE */}
                                <div className="pt-6 border-t-2 border-red-200">
                                    <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        ⚠️ НЕБЕЗПЕЧНА ЗОНА
                                    </h3>
                                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                                        <div className="mb-4">
                                            <div className="font-bold text-red-800 mb-2">Повне очищення бази даних</div>
                                            <p className="text-sm text-red-700">
                                                Видалить ВСІ виробничі дані та палети з Supabase і localStorage.
                                                <strong> Цю дію НЕ МОЖНА скасувати!</strong>
                                            </p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm('⚠️ УВАГА!\n\nВи збираєтесь видалити ВСІ дані:\n• Всі бейли (production_items)\n• Всі палети (batches)\n• Всю історію\n\nПродовжити?')) {
                                                    return;
                                                }

                                                if (!confirm('⛔ ОСТАННЄ ПОПЕРЕДЖЕННЯ!\n\nВи ВПЕВНЕНІ що хочете видалити ВСЮ базу даних?\n\nНатисніть OK щоб НАЗАВЖДИ видалити всі дані.')) {
                                                    return;
                                                }

                                                const btn = event?.target as HTMLButtonElement;
                                                if (btn) btn.disabled = true;

                                                try {
                                                    // Clear Supabase tables
                                                    const { error: itemsError } = await SupabaseService.client
                                                        .from('production_items')
                                                        .delete()
                                                        .neq('id', '00000000-0000-0000-0000-000000000000');

                                                    if (itemsError) throw itemsError;

                                                    const { error: batchesError } = await SupabaseService.client
                                                        .from('batches')
                                                        .delete()
                                                        .neq('id', '00000000-0000-0000-0000-000000000000');

                                                    if (batchesError) throw batchesError;

                                                    // Clear localStorage (preserve settings)
                                                    const keysToPreserve = [
                                                        'zebra_printer_v1',
                                                        'zebra_barcode_pattern_v1',
                                                        'office_printer_name',
                                                        'office_printer_ip',
                                                        'emailjs_service_id',
                                                        'emailjs_template_id',
                                                        'emailjs_public_key',
                                                        'zebra_report_email_v1',
                                                        'theme'
                                                    ];

                                                    const preserved: Record<string, string> = {};
                                                    keysToPreserve.forEach(key => {
                                                        const val = localStorage.getItem(key);
                                                        if (val) preserved[key] = val;
                                                    });

                                                    localStorage.clear();

                                                    Object.entries(preserved).forEach(([key, val]) => {
                                                        localStorage.setItem(key, val);
                                                    });

                                                    alert('✅ База даних повністю очищена!\n\nВсі виробничі дані видалено.\nНалаштування збережено.');
                                                    window.location.reload();
                                                } catch (e: any) {
                                                    alert(`❌ Помилка очищення:\n${e.message}\n\nМожливо, потрібно виконати SQL скрипт вручну в Supabase.`);
                                                    if (btn) btn.disabled = false;
                                                }
                                            }}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
                                        >
                                            🗑️ ВИДАЛИТИ ВСЮ БАЗУ ДАНИХ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                </main >
            </div >

            {/* Feature Modals */}
            < AnalyticsDashboard
                printHistory={historyData.history || []}
                onClose={() => setShowAnalytics(false)
                }
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
            {
                showLabelDesigner && (
                    <LabelDesigner onClose={() => setShowLabelDesigner(false)} printer={printerData.printer} />
                )
            }

            {/* Delete User Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Видалити користувача?"
                message={`Ви впевнені, що хочете видалити користувача "${deleteConfirm.user?.name}"? Цю дію неможливо скасувати.`}
                confirmText="Видалити"
                cancelText="Скасувати"
                variant="danger"
                onCancel={() => setDeleteConfirm({ isOpen: false, user: null })}
                onConfirm={async () => {
                    if (deleteConfirm.user) {
                        try {
                            const updated = await UserService.deleteUser(deleteConfirm.user.id);
                            setUsersList(updated);
                            if (newUser.id === deleteConfirm.user.id) {
                                setNewUser({ id: '', name: '', role: 'operator', pin: '' });
                            }
                        } catch (e: any) {
                            alert('Помилка видалення: ' + e.message);
                        }
                    }
                    setDeleteConfirm({ isOpen: false, user: null });
                }}
            />
        </div >

    );
}

function NavButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${active ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-emerald-900/20' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
        >
            <div className={`w-6 h-6 ${active ? 'text-emerald-200' : 'text-[var(--text-muted)]'}`}>{icon}</div>
            <span>{label}</span>
        </button>
    )
}

