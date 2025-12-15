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

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdminMode: boolean;
    // Printer Props
    agentIp: string;
    onAgentIpChange: (val: string) => void;
    onSaveAgentIp: () => void;
    onFixSsl: () => void;
    isSearchingPrinters: boolean;
    onSearchPrinters: () => void;
    discoveredPrinters: ZebraDevice[];
    printer: ZebraDevice | null;
    onSelectPrinter: (device: ZebraDevice) => void;
    // Label Props
    selectedLabelSize: LabelSizeConfig;
    onSelectLabelSize: (size: LabelSizeConfig) => void;
    // History Props
    historyCount: number;
    onExportHistory: () => void;
    onSendEmail: () => void;
    onClearHistory: () => void;
    // Database Props (Admin)
    dataSource: 'sqlite' | 'supabase';
    onChangeDataSource: (source: 'sqlite' | 'supabase') => void;
    // Email Props
    reportEmail: string;
    onReportEmailChange: (val: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    isAdminMode,
    agentIp,
    onAgentIpChange,
    onSaveAgentIp,
    onFixSsl,
    isSearchingPrinters,
    onSearchPrinters,
    discoveredPrinters,
    printer,
    onSelectPrinter,
    selectedLabelSize,
    onSelectLabelSize,
    historyCount,
    onExportHistory,
    onSendEmail,
    onClearHistory,
    dataSource,
    onChangeDataSource,
    reportEmail,
    onReportEmailChange
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
                    <div
                        className="text-xl font-bold text-slate-800 flex items-center gap-2 select-none"
                    >
                        <SettingsIcon />
                        Налаштування
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <CloseIcon />
                    </button>
                </div>

                <div className="p-6 space-y-8">

                    {/* Section: Printer Connection (ADMIN ONLY) */}
                    {isAdminMode && (
                        <section className="animate-fade-in bg-amber-50 p-4 rounded-xl border border-amber-200">
                            <h4 className="font-semibold text-amber-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                <LockClosedIcon />
                                Адміністрування принтера
                            </h4>

                            <div className="mb-4 bg-white p-3 rounded border border-amber-100 text-xs text-amber-800">
                                <p className="font-bold mb-1">Діагностика:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>У вас встановлена програма <b>Zebra Browser Print</b>?</li>
                                    <li>Якщо ви в хмарі/preview, відкрийте сайт в <b>новій вкладці</b>.</li>
                                    <li>Якщо ви з телефону, вкажіть IP комп'ютера з принтером нижче.</li>
                                </ul>
                                <a href="https://www.zebra.com/us/en/support-downloads/software-utilities/browser-print.html" target="_blank" className="text-blue-600 underline mt-2 block flex items-center gap-1">
                                    <DownloadIcon /> Завантажити драйвер Zebra
                                </a>
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-amber-800 uppercase">IP Агента Zebra:</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={agentIp}
                                            onChange={(e) => onAgentIpChange(e.target.value)}
                                            className="border border-amber-300 rounded px-2 py-1 text-sm flex-1"
                                            placeholder="127.0.0.1"
                                        />
                                        <button onClick={onSaveAgentIp} className="text-xs bg-amber-200 px-2 rounded hover:bg-amber-300">Зберегти</button>
                                    </div>
                                    <p className="text-[10px] text-amber-600">За замовчуванням: 127.0.0.1 (цей комп'ютер)</p>
                                </div>

                                <button
                                    onClick={onFixSsl}
                                    className="w-full bg-white text-amber-700 border border-amber-300 p-2 rounded-lg hover:bg-amber-50 flex items-center justify-center gap-2 text-sm font-semibold"
                                >
                                    <ShieldCheckIcon />
                                    Виправити SSL ({agentIp})
                                </button>

                                <div className="flex gap-2 border-t border-amber-200 pt-3">
                                    <button
                                        onClick={onSearchPrinters}
                                        disabled={isSearchingPrinters}
                                        className="w-full bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                                    >
                                        {isSearchingPrinters ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <SearchIcon />}
                                        {isSearchingPrinters ? 'Пошук...' : 'Знайти всі принтери'}
                                    </button>
                                </div>

                                {discoveredPrinters.length > 0 && (
                                    <div className="space-y-2 mt-2 max-h-40 overflow-y-auto custom-scrollbar bg-white rounded border border-amber-100 p-1">
                                        {discoveredPrinters.map(dev => (
                                            <button
                                                key={dev.uid}
                                                onClick={() => onSelectPrinter(dev)}
                                                className={`w-full text-left p-3 rounded-lg text-sm border flex items-center justify-between transition-colors ${printer?.uid === dev.uid
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 ring-1 ring-emerald-200'
                                                    : 'bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200'
                                                    }`}
                                            >
                                                <div className="truncate">
                                                    <div className="font-bold">{dev.name}</div>
                                                    <div className="text-xs text-slate-500 truncate mt-0.5">{dev.deviceType} ({dev.connection})</div>
                                                </div>
                                                {printer?.uid === dev.uid && <div className="text-emerald-500 font-bold px-2">✓</div>}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {printer && (
                                    <div className="pt-3 mt-2 border-t border-amber-200/50">
                                        <p className="text-xs text-amber-700">Обраний принтер:</p>
                                        <p className="text-sm font-medium text-amber-900">{printer.name} ({printer.connection})</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Section: Database Configuration (ADMIN ONLY) */}
                    {isAdminMode && (
                        <section className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <h4 className="font-semibold text-blue-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                <SettingsIcon />
                                База Даних
                            </h4>
                            <div className="flex bg-white rounded-lg p-1 border border-blue-200">
                                <button
                                    onClick={() => onChangeDataSource('sqlite')}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${dataSource === 'sqlite'
                                        ? 'bg-blue-100 text-blue-800 shadow-sm'
                                        : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    Local (SQLite)
                                </button>
                                <button
                                    onClick={() => onChangeDataSource('supabase')}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${dataSource === 'supabase'
                                        ? 'bg-blue-100 text-blue-800 shadow-sm'
                                        : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    Cloud (Supabase)
                                </button>
                            </div>
                            <p className="text-[10px] text-blue-600 mt-2 text-center">
                                Увага: Зміна джерела перезавантажить сторінку.
                            </p>
                        </section>
                    )}

                    {/* Section: Label Size */}
                    <section>
                        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Розмір етикетки</h4>
                        <div className="space-y-3">
                            {LABEL_SIZES.map(size => (
                                <label
                                    key={size.id}
                                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedLabelSize.id === size.id
                                        ? 'border-[#115740] bg-green-50 ring-1 ring-[#115740]'
                                        : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="labelSize"
                                        value={size.id}
                                        checked={selectedLabelSize.id === size.id}
                                        onChange={() => onSelectLabelSize(size)}
                                        className="w-5 h-5 text-[#115740] focus:ring-[#115740] border-gray-300"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-slate-900 font-medium">{size.name}</span>
                                        <span className="block text-slate-500 text-sm">{size.widthMm} x {size.heightMm} мм</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Section: Data & Export */}
                    <section className="pt-4 border-t border-slate-100">
                        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider flex justify-between">
                            Архів даних
                            <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs lowercase font-mono">
                                {historyCount} rec
                            </span>
                        </h4>

                        {/* Email Config */}
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email для звітів</label>
                            <div className="flex gap-2">
                                <span className="p-2 bg-slate-100 rounded-lg text-slate-400 border border-slate-200">
                                    <MailIcon />
                                </span>
                                <input
                                    type="email"
                                    value={reportEmail}
                                    onChange={(e) => onReportEmailChange(e.target.value)}
                                    placeholder="boss@factory.com"
                                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={onExportHistory}
                                disabled={historyCount === 0}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors border ${historyCount === 0
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                    }`}
                            >
                                <DownloadIcon />
                                <span className="text-sm">Скачати CSV</span>
                            </button>

                            <button
                                onClick={onSendEmail}
                                disabled={historyCount === 0}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors border ${historyCount === 0
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                    }`}
                            >
                                <MailIcon />
                                <span className="text-sm">Відправити</span>
                            </button>
                        </div>

                        {historyCount > 0 && (
                            <button
                                onClick={onClearHistory}
                                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 text-sm font-medium transition-colors border border-transparent hover:border-red-100"
                            >
                                <TrashIcon />
                                Очистити пам'ять пристрою
                            </button>
                        )}
                    </section>
                </div>

                <div className="p-4 border-t bg-slate-50 text-right sticky bottom-0 z-10">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#115740] text-white font-medium rounded-lg hover:bg-[#0d4633] shadow-sm"
                    >
                        Закрити
                    </button>
                </div>
            </div>
        </div >
    );
};

export default SettingsModal;
