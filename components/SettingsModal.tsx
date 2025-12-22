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
}) => {
    // Destructure Printer Data
    const {
        agentIp,
        setAgentIp,
        saveAgentIp,
        fixSsl,
        isSearchingPrinters,
        searchPrinters,
        discoveredPrinters,
        printer,
        selectPrinter
    } = printerData || {};

    // Destructure History Data
    const {
        history = [],
        exportCsv,
        sendEmail,
        clearHistory
    } = historyData || {};

    const historyCount = history.length;

    // Supabase State - Lazy Init for safety
    const [sbUrl, setSbUrl] = React.useState(() => {
        try { return localStorage.getItem('zebra_supabase_url') || ''; } catch { return ''; }
    });
    const [sbKey, setSbKey] = React.useState(() => {
        try { return localStorage.getItem('zebra_supabase_key') || ''; } catch { return ''; }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
                    <div className="text-xl font-bold text-slate-800 flex items-center gap-2 select-none">
                        <SettingsIcon />
                        Налаштування
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Section: Printer Connection (ADMIN ONLY) */}
                    {isAdmin && (
                        <section className="animate-fade-in bg-amber-50 p-3 rounded-xl border border-amber-200">
                            <h4 className="font-semibold text-amber-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                <LockClosedIcon /> Адміністрування принтера
                            </h4>
                            <div className="mb-4 bg-white p-3 rounded border border-amber-100 text-xs text-amber-800">
                                <p className="font-bold mb-1">Діагностика:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>У вас встановлена програма <b>Zebra Browser Print</b>?</li>
                                    <li>Якщо ви в хмарі/preview, відкрийте сайт в <b>новій вкладці</b>.</li>
                                    <li>За замовчуванням: 127.0.0.1 (цей комп'ютер)</li>
                                </ul>
                                <a href="https://www.zebra.com/us/en/support-downloads/software-utilities/browser-print.html" target="_blank" className="text-blue-600 underline mt-2 block flex items-center gap-1">
                                    <DownloadIcon /> Завантажити драйвер Zebra
                                </a>
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-amber-800 uppercase">IP Агента Zebra:</label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input type="text" value={agentIp} onChange={(e) => setAgentIp(e.target.value)} className="border border-amber-300 rounded px-2 py-2 text-sm flex-1" placeholder="127.0.0.1" />
                                        <button onClick={saveAgentIp} className="text-xs bg-amber-200 px-3 py-2 rounded hover:bg-amber-300 font-bold text-amber-800">Зберегти</button>
                                    </div>
                                </div>
                                <button onClick={fixSsl} className="w-full bg-white text-amber-700 border border-amber-300 p-2 rounded-lg hover:bg-amber-50 flex items-center justify-center gap-2 text-sm font-semibold">
                                    <ShieldCheckIcon /> Виправити SSL ({agentIp})
                                </button>
                                <div className="flex gap-2 border-t border-amber-200 pt-3">
                                    <button onClick={searchPrinters} disabled={isSearchingPrinters} className="w-full bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium whitespace-normal text-center h-auto min-h-[44px]">
                                        {isSearchingPrinters ? 'Пошук...' : (Capacitor.isNativePlatform() ? 'Знайти всі принтери (вкл. BT)' : 'Знайти всі принтери')}
                                    </button>
                                </div>
                                {/* Web Bluetooth Button - Chrome Only, Not for Native App */}
                                {!Capacitor.isNativePlatform() && (
                                    <div className="mt-2">
                                        <button onClick={printerData.connectBluetooth} className="w-full bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 font-medium">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                            Знайти Bluetooth
                                        </button>
                                        <p className="text-[10px] text-slate-400 mt-1 text-center">Chrome Only. Потрібен HTTPS. (Experimental)</p>
                                    </div>
                                )}
                                {discoveredPrinters?.length > 0 && (
                                    <div className="space-y-2 mt-2 max-h-40 overflow-y-auto custom-scrollbar bg-white rounded border border-amber-100 p-1">
                                        {discoveredPrinters.map((dev: any) => (
                                            <button key={dev.uid} onClick={() => selectPrinter(dev)} className={`w-full text-left p-3 rounded-lg text-sm border flex items-center justify-between transition-colors ${printer?.uid === dev.uid ? 'bg-emerald-50 border-emerald-200 text-emerald-800 ring-1 ring-emerald-200' : 'bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200'}`}>
                                                <div className="truncate"><div className="font-bold">{dev.name}</div><div className="text-xs text-slate-500 truncate mt-0.5">{dev.deviceType} ({dev.connection})</div></div>
                                                {printer?.uid === dev.uid && <div className="text-emerald-500 font-bold px-2">✓</div>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {/* Manual IP Entry - Direct LAN (Native & Web) */}
                                <div className="mb-4 pt-4 border-t border-amber-200">
                                    <label className="text-xs font-bold text-amber-800 uppercase block mb-1">Пряме підключення (LAN IP):</label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            id="manual-ip-input"
                                            className="border border-amber-300 rounded px-2 py-2 text-sm flex-1"
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
                                            className="text-xs bg-amber-600 text-white px-4 py-3 rounded hover:bg-amber-700 font-bold uppercase tracking-wider"
                                        >
                                            Додати
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-amber-600 mt-1">Використовуйте для Android або якщо автопошук не працює. (Порт 9100)</p>
                                </div>

                            </div>
                        </section>
                    )}

                    {/* Section: Database (ADMIN ONLY) */}
                    {isAdmin && (
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
                                    <input value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="Project URL" className="w-full border border-blue-300 rounded px-2 py-1 text-sm" />
                                    <input value={sbKey} onChange={e => setSbKey(e.target.value)} type="password" placeholder="Anon Key" className="w-full border border-blue-300 rounded px-2 py-1 text-sm" />
                                    <button onClick={() => SupabaseService.updateCredentials(sbUrl, sbKey)} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm font-bold">Зберегти та Підключити</button>
                                </div>
                            )}
                            {dataSource === 'sqlite' && (
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <button onClick={async () => { try { const file = await DatabaseService.backupDatabase(); alert(`✅ Резервна копія успішно створена!\n📁 Файл: ${file}\n📂 Папка: Documents`); } catch (e) { alert('❌ Помилка створення копії.'); } }} className="w-full bg-slate-600 text-white p-2 rounded hover:bg-slate-700 text-sm font-bold">Зробити Backup</button>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Barcode Settings (ADMIN ONLY) */}
                    {isAdmin && (
                        <div className="mb-0 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
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
                    )}

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

                    {/* Section: History/Export */}
                    <section className="pt-4 border-t border-slate-100">
                        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider flex justify-between">
                            Архів даних
                            <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs lowercase font-mono">{historyCount} rec</span>
                        </h4>
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email для звітів</label>
                            <input type="email" value={reportEmail} onChange={(e) => onReportEmailChange(e.target.value)} placeholder="boss@factory.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button onClick={exportCsv} disabled={historyCount === 0} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors border ${historyCount === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}><DownloadIcon /> <span className="text-sm">CSV</span></button>
                            <button onClick={sendEmail} disabled={historyCount === 0} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors border ${historyCount === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}><MailIcon /> <span className="text-sm">Email</span></button>
                        </div>
                        {historyCount > 0 && <button onClick={clearHistory} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 text-sm font-medium">Очистити пам'ять</button>}
                    </section>
                </div>

                <div className="p-4 border-t bg-slate-50 text-right sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-6 py-2 bg-[#115740] text-white font-medium rounded-lg hover:bg-[#0d4633]">Закрити</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
