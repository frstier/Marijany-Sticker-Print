import React from 'react';
import {
    CloseIcon,
    SettingsIcon,
    LockClosedIcon,
    DownloadIcon,
    ShieldCheckIcon,
    SearchIcon,
    MailIcon,
    TrashIcon
} from './Icons';
import { ZebraDevice, LabelSizeConfig, LabelData } from '../types';
import { LABEL_SIZES } from '../constants';
import { DatabaseService } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { Capacitor } from '@capacitor/core';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
    currentUser: any;
    // Data Objects
    printerData: any;
    historyData: any;
    // Props
    selectedLabelSize: LabelSizeConfig;
    onLabelSizeChange: (size: LabelSizeConfig) => void;
    reportEmail: string;
    onReportEmailChange: (val: string) => void;
    dataSource: 'sqlite' | 'supabase';
    onChangeDataSource: (source: 'sqlite' | 'supabase') => void;
    barcodePattern?: string;
    onBarcodePatternChange?: (val: string) => void;
    onReprint: (item: LabelData) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    isAdmin,
    printerData,
    historyData,
    selectedLabelSize,
    onLabelSizeChange,
    reportEmail,
    onReportEmailChange,
    dataSource,
    onChangeDataSource,
    barcodePattern,
    onBarcodePatternChange,
    onReprint
}) => {
    // Destructure Printer Data
    const {
        selectPrinter
    } = printerData || {};

    const [activeTab, setActiveTab] = React.useState<'printer' | 'reports' | 'system' | 'shift'>('printer');

    // Supabase State - Lazy Init for safety
    const [sbUrl, setSbUrl] = React.useState(() => {
        try { return localStorage.getItem('zebra_supabase_url') || ''; } catch { return ''; }
    });
    const [sbKey, setSbKey] = React.useState(() => {
        try { return localStorage.getItem('zebra_supabase_key') || ''; } catch { return ''; }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-white shrink-0">
                    <div className="text-xl font-bold text-slate-800 flex items-center gap-2 select-none">
                        <SettingsIcon />
                        Налаштування
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('printer')}
                        className={`flex-1 py-3 text-sm font-bold uppercase transition-colors border-b-2 ${activeTab === 'printer' ? 'text-[#115740] border-[#115740] bg-green-50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                    >
                        Принтер
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex-1 py-3 text-sm font-bold uppercase transition-colors border-b-2 ${activeTab === 'reports' ? 'text-blue-800 border-blue-600 bg-blue-50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                    >
                        Звіти
                    </button>
                    <button
                        onClick={() => setActiveTab('shift')}
                        className={`flex-1 py-3 text-sm font-bold uppercase transition-colors border-b-2 ${activeTab === 'shift' ? 'text-red-800 border-red-600 bg-red-50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                    >
                        Зміна
                    </button>
                    {(isAdmin) && (
                        <button
                            onClick={() => setActiveTab('system')}
                            className={`flex-1 py-3 text-sm font-bold uppercase transition-colors border-b-2 ${activeTab === 'system' ? 'text-amber-800 border-amber-600 bg-amber-50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                        >
                            Система
                        </button>
                    )}
                </div>

                {/* Content - Scrollable */}
                <div className="p-4 overflow-y-auto flex-1 bg-white">

                    {/* TAB: PRINTER */}
                    {activeTab === 'printer' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Section: Label Size */}
                            <section>
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Розмір етикетки</h4>
                                <div className="space-y-3">
                                    {LABEL_SIZES.map(size => (
                                        <label key={size.id} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedLabelSize.id === size.id ? 'border-[#115740] bg-green-50 ring-1 ring-[#115740]' : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'}`}>
                                            <input type="radio" name="labelSize" value={size.id} checked={selectedLabelSize.id === size.id} onChange={() => onLabelSizeChange(size)} className="w-5 h-5 text-[#115740] focus:ring-[#115740] border-gray-300" />
                                            <div className="ml-3"><span className="block text-slate-900 font-medium">{size.name}</span><span className="block text-slate-500 text-sm">{size.widthMm} x {size.heightMm} мм</span></div>
                                        </label>
                                    ))}
                                </div>
                            </section>

                            {/* Manual IP Entry - Direct LAN (ADMIN/ALL) */}
                            {isAdmin && (
                                <section className="pt-4 border-t border-slate-100">
                                    <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                        <LockClosedIcon /> Адміністрування (LAN)
                                    </h4>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Ручне підключення (IP):</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                id="manual-ip-input"
                                                className="border border-slate-300 rounded px-2 py-2 text-sm flex-1"
                                                placeholder="10.10.10.163"
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
                                                        connection: 'net', // Important: 'net' for network
                                                        deviceType: 'printer',
                                                        manufacturer: 'Zebra',
                                                        provider: 'Manual',
                                                        version: '1.0'
                                                    };
                                                    selectPrinter(manualDevice);
                                                    alert(`Принтер ${ip} додано та вибрано!`);
                                                }}
                                                className="text-xs bg-slate-600 text-white px-4 py-3 rounded hover:bg-slate-700 font-bold uppercase tracking-wider"
                                            >
                                                Додати
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* TAB: REPORTS */}
                    {activeTab === 'reports' && (
                        <div className="animate-fade-in">
                            <ReportsSection historyData={historyData} />
                        </div>
                    )}

                    {/* TAB: SYSTEM */}
                    {activeTab === 'system' && isAdmin && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Section: Database */}
                            <section className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                <h4 className="font-semibold text-blue-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                    <SettingsIcon /> База Даних
                                </h4>
                                <div className="flex bg-white rounded-lg p-1 border border-blue-200">
                                    <button onClick={() => onChangeDataSource('sqlite')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${dataSource === 'sqlite' ? 'bg-blue-100 text-blue-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Local (SQLite)</button>
                                    <button onClick={() => onChangeDataSource('supabase')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${dataSource === 'supabase' ? 'bg-blue-100 text-blue-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Cloud (Supabase)</button>
                                </div>
                                {dataSource === 'supabase' && (
                                    <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
                                        <input value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="Project URL" className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" />
                                        <input value={sbKey} onChange={e => setSbKey(e.target.value)} type="password" placeholder="Anon Key" className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" />
                                        <button onClick={() => SupabaseService.updateCredentials(sbUrl, sbKey)} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm font-bold">Зберегти та Підключити</button>
                                    </div>
                                )}
                                {dataSource === 'sqlite' && (
                                    <div className="mt-4 pt-4 border-t border-blue-200">
                                        <button onClick={async () => { try { const file = await DatabaseService.backupDatabase(); alert(`✅ Резервна копія успішно створена!\n📁 Файл: ${file}\n📂 Папка: Documents`); } catch (e) { alert('❌ Помилка створення копії.'); } }} className="w-full bg-slate-600 text-white p-2 rounded hover:bg-slate-700 text-sm font-bold">Зробити Backup</button>
                                    </div>
                                )}
                            </section>

                            {/* Barcode Settings */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">🏷️ Config: Barcode Data</h3>
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase">Pattern / Шаблон</label>
                                    <input value={barcodePattern || ''} onChange={(e) => onBarcodePatternChange?.(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono" placeholder="{date}-{sku}-{serialNumber}-{weight}" />
                                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 mt-1">
                                        <code className="bg-white px-1 border rounded">{'{sku}'}</code>
                                        <code className="bg-white px-1 border rounded">{'{date}'}</code>
                                        <code className="bg-white px-1 border rounded">{'{weight}'}</code>
                                        <code className="bg-white px-1 border rounded">{'{serialNumber}'}</code>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                    📧 EmailJS Configuration
                                </h4>
                                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Service ID</label>
                                        <input
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                            id="emailjs_service_id"
                                            placeholder="service_xxxxx"
                                            defaultValue={localStorage.getItem('emailjs_service_id') || ''}
                                            onChange={e => localStorage.setItem('emailjs_service_id', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Template ID</label>
                                        <input
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                            id="emailjs_template_id"
                                            placeholder="template_xxxxx"
                                            defaultValue={localStorage.getItem('emailjs_template_id') || ''}
                                            onChange={e => localStorage.setItem('emailjs_template_id', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Public Key</label>
                                        <input
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                            id="emailjs_public_key"
                                            placeholder="user_xxxxx"
                                            defaultValue={localStorage.getItem('emailjs_public_key') || ''}
                                            onChange={e => localStorage.setItem('emailjs_public_key', e.target.value)}
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        Налаштування зберігаються автоматично. <a href="https://dashboard.emailjs.com/admin" target="_blank" rel="noopener" className="underline text-blue-600">Отримати ключі</a>
                                    </div>
                                </div>
                            </div>

                            {/* Debug Tools */}
                            <div className="pt-4 border-t border-slate-200">
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                    🛠️ Тестування
                                </h4>
                                <button
                                    onClick={() => historyData.addDummyData?.()}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 transition-colors text-sm"
                                >
                                    + Додати 5 тестових записів (Сьогодні)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB: SHIFT (Updated: Moved here) */}
                    {activeTab === 'shift' && (
                        <div className="space-y-6 animate-fade-in">
                            <section className="bg-red-50 p-4 rounded-xl border border-red-200">
                                <h4 className="font-semibold text-red-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                    🛑 Керування зміною
                                </h4>
                                <p className="text-sm text-red-700 mb-4">
                                    Натисніть кнопку нижче, щоб автоматично сформувати звіт за <b>сьогоднішню зміну</b> (з 00:00 до поточного моменту) та відправити його керівництву.
                                </p>
                                <button
                                    onClick={async () => {
                                        const { generateReport, sendEmail } = historyData;
                                        // 1. Generate Report for Today
                                        const start = new Date();
                                        start.setHours(0, 0, 0, 0);
                                        const end = new Date();
                                        end.setHours(23, 59, 59, 999);

                                        const report = await generateReport(start, end);
                                        if (report.length === 0) {
                                            alert("За цю зміну ще не було друків.");
                                            return;
                                        }

                                        // 2. Confirm Action
                                        if (!confirm(`Зміна містить ${report.length} записів. Сформувати звіт та відправити?`)) return;

                                        // 3. Send Email
                                        await sendEmail(report);
                                        // Optional: Close modal after action?
                                        // onClose();
                                    }}
                                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 transform active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    ЗАКРИТИ ЗМІНУ
                                </button>
                            </section>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 text-right shrink-0">
                    <button onClick={onClose} className="px-6 py-2 bg-[#115740] text-white font-medium rounded-lg hover:bg-[#0d4633]">Закрити</button>
                </div>
            </div >
        </div >
    );
};

// Sub-component for clarity
const ReportsSection = ({ historyData }: { historyData: any }) => {
    const {
        reportSummary,
        reportData,
        generateReport,
        exportCsv,
        exportXlsx,
        sendEmail,
        reportEmail,
        setReportEmail,
        clearHistory
    } = historyData;

    // Default to Today
    const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = React.useState(false);

    // Initial load when component mounts (or when date changes? let's do manual trigger for now, or auto on mount?)
    // Let's do auto-load on first view? No, user might not want reports.

    const handleGenerate = async () => {
        setIsLoading(true);
        // Create Dates from string (Local Time)
        // We want Start of Day and End of Day
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        await generateReport(start, end);
        setIsLoading(false);
    };

    const setPreset = (type: 'today' | 'yesterday' | 'week') => {
        const now = new Date();
        let s = new Date();
        let e = new Date();

        if (type === 'today') {
            // Default
        } else if (type === 'yesterday') {
            s.setDate(now.getDate() - 1);
            e.setDate(now.getDate() - 1);
        } else if (type === 'week') {
            s.setDate(now.getDate() - 7);
        }

        setStartDate(s.toISOString().split('T')[0]);
        setEndDate(e.toISOString().split('T')[0]);
        // Optional: Auto-trigger?
        // setTimeout(handleGenerate, 100);
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                📊 Звіти та Експорт
            </h4>

            {/* Date Controls */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="flex gap-2 text-xs">
                    <button onClick={() => setPreset('today')} className="flex-1 bg-white border border-slate-300 rounded py-1 hover:bg-slate-100">Сьогодні</button>
                    <button onClick={() => setPreset('yesterday')} className="flex-1 bg-white border border-slate-300 rounded py-1 hover:bg-slate-100">Вчора</button>
                    <button onClick={() => setPreset('week')} className="flex-1 bg-white border border-slate-300 rounded py-1 hover:bg-slate-100">Тиждень</button>
                </div>

                <div className="flex items-center gap-2">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm text-center" />
                    <span className="text-slate-400">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm text-center" />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full bg-[#115740] text-white font-bold py-2.5 rounded-lg text-sm hover:bg-[#0d4633] active:scale-[0.98] transition-all"
                >
                    {isLoading ? 'Завантаження...' : 'Сформувати Звіт'}
                </button>
            </div>

            {/* Summary Cards */}
            {reportData.length > 0 && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <div className="text-xs text-blue-600 font-bold uppercase">Всього етикеток</div>
                        <div className="text-2xl font-bold text-blue-900">{reportSummary.count}</div>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <div className="text-xs text-emerald-600 font-bold uppercase">Загальна вага</div>
                        <div className="text-2xl font-bold text-emerald-900">{reportSummary.totalWeight.toFixed(2)} <span className="text-sm font-normal text-emerald-700">кг</span></div>
                    </div>
                </div>
            )}

            {reportData.length === 0 && !isLoading && (
                <div className="text-center text-slate-400 text-sm py-2">
                    Виберіть дату та натисніть "Сформувати"
                </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => exportCsv(reportData)}
                        disabled={reportData.length === 0}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border ${reportData.length === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <DownloadIcon /> <span className="text-xs">CSV</span>
                    </button>

                    <button
                        onClick={() => exportXlsx(reportData)}
                        disabled={reportData.length === 0}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border ${reportData.length === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                    >
                        <span className="text-lg leading-none">📊</span> <span className="text-xs">Excel</span>
                    </button>

                    <button
                        onClick={() => sendEmail(reportData)}
                        disabled={reportData.length === 0}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border ${reportData.length === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                    >
                        <MailIcon /> <span className="text-xs">Email</span>
                    </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-2 border border-slate-200">
                    <MailIcon />
                    <input
                        type="email"
                        value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        placeholder="report-receiver@example.com"
                        className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
                    />
                    <button
                        onClick={() => sendEmail(reportData.length > 0 ? reportData : historyData.history)}
                        className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        title="Відправити зараз"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>

                <button onClick={clearHistory} className="w-full text-xs text-red-400 hover:text-red-600 underline text-center pt-2">
                    Очистити локальний кеш історії
                </button>
            </div>
        </div>
    );
};

export default SettingsModal;
