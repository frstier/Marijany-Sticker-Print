import React, { useState } from 'react';
import {
    CloseIcon,
    SettingsIcon,
    PrinterIcon
} from './Icons';
import { ZebraDevice, LabelSizeConfig, LabelData } from '../types';
import { LABEL_SIZES } from '../constants';

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-white shrink-0">
                    <div className="text-xl font-bold text-slate-800 flex items-center gap-2 select-none">
                        <SettingsIcon />
                        Меню
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 bg-white space-y-6">

                    {/* Printer Status (Read Only) */}
                    <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                            <PrinterIcon /> Статус Принтера
                        </h4>
                        {printer ? (
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                                <div>
                                    <div className="font-bold text-slate-800">{printer.name}</div>
                                    <div className="text-xs text-slate-500">{printer.uid}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-slate-400">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="font-medium">Не підключено</span>
                            </div>
                        )}
                        <div className="mt-3 text-[10px] text-slate-400 leading-tight">
                            Для налаштування принтера зверніться до адміністратора.
                        </div>
                    </section>

                    {/* Label Size Selection */}
                    <section>
                        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Розмір етикетки</h4>
                        <div className="space-y-3">
                            {LABEL_SIZES.map(size => (
                                <label key={size.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedLabelSize.id === size.id ? 'border-[#115740] bg-green-50 ring-1 ring-[#115740]' : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'}`}>
                                    <input type="radio" name="labelSize" value={size.id} checked={selectedLabelSize.id === size.id} onChange={() => onLabelSizeChange(size)} className="w-4 h-4 text-[#115740] focus:ring-[#115740] border-gray-300" />
                                    <div className="ml-3">
                                        <span className="block text-slate-900 font-bold text-sm">{size.name}</span>
                                        <span className="block text-slate-500 text-xs">{size.widthMm} x {size.heightMm} мм</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                </div>

                <div className="p-4 border-t bg-slate-50 text-right shrink-0">
                    <button onClick={onClose} className="w-full px-6 py-3 bg-[#115740] text-white font-bold rounded-xl hover:bg-[#0d4633] transition-colors">Закрити</button>
                </div>
            </div >
        </div >
    );
};

export default SettingsModal;
