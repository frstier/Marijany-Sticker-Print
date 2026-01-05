import React, { useState } from 'react';
import {
    CloseIcon,
    SettingsIcon,
    PrinterIcon
} from './Icons';
import { ZebraDevice, LabelSizeConfig, LabelData } from '../types';
import { LABEL_SIZES } from '../constants';
import { useTheme } from '../hooks/useTheme';

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
    printerData,
    selectedLabelSize,
    onLabelSizeChange,
    onReprint
}) => {
    // Destructure Printer Data
    const {
        printer
    } = printerData || {};

    const { theme, setTheme } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
                    <div className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 select-none">
                        <SettingsIcon />
                        Меню
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 bg-[var(--bg-card)] space-y-6">

                    {/* Printer Status (Read Only) */}
                    <section className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-color)]">
                        <h4 className="font-semibold text-[var(--text-secondary)] mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                            <PrinterIcon /> Статус Принтера
                        </h4>
                        {printer ? (
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                                <div>
                                    <div className="font-bold text-[var(--text-primary)]">{printer.name}</div>
                                    <div className="text-xs text-[var(--text-muted)]">{printer.uid}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-[var(--text-muted)]">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="font-medium">Не підключено</span>
                            </div>
                        )}
                        <div className="mt-3 text-[10px] text-[var(--text-muted)] leading-tight">
                            Для налаштування принтера зверніться до адміністратора.
                        </div>
                    </section>

                    {/* Label Size Selection */}
                    <section>
                        <h4 className="font-semibold text-[var(--text-secondary)] mb-3 text-sm uppercase tracking-wider">Розмір етикетки</h4>
                        <div className="space-y-3">
                            {LABEL_SIZES.map(size => (
                                <label key={size.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedLabelSize.id === size.id ? 'border-[var(--accent-primary)] bg-green-50 dark:bg-green-900/20 ring-1 ring-[var(--accent-primary)]' : 'border-[var(--border-color)] hover:border-green-300 hover:bg-[var(--bg-tertiary)]'}`}>
                                    <input type="radio" name="labelSize" value={size.id} checked={selectedLabelSize.id === size.id} onChange={() => onLabelSizeChange(size)} className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] border-gray-300" />
                                    <div className="ml-3">
                                        <span className="block text-[var(--text-primary)] font-bold text-sm">{size.name}</span>
                                        <span className="block text-[var(--text-muted)] text-xs">{size.widthMm} x {size.heightMm} мм</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Theme Selection */}
                    <section>
                        <h4 className="font-semibold text-[var(--text-secondary)] mb-3 text-sm uppercase tracking-wider">🎨 Тема</h4>
                        <div className="flex gap-2">
                            {[
                                { value: 'light', label: '☀️ Світла' },
                                { value: 'dark', label: '🌙 Темна' },
                                { value: 'system', label: '💻 Системна' }
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setTheme(opt.value as 'light' | 'dark' | 'system')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${theme === opt.value
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </section>

                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] text-right shrink-0">
                    <button onClick={onClose} className="w-full px-6 py-3 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-hover)] transition-colors">Закрити</button>
                </div>
            </div >
        </div >
    );
};

export default SettingsModal;
