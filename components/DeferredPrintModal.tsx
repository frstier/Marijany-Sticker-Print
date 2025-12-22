import React, { useState } from 'react';
import { CloseIcon, PrinterIcon, TrashIcon } from './Icons';
import { LabelData } from '../types';

interface DeferredPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    queue: LabelData[];
    onRemove: (index: number) => void;
    onClear: () => void;
    onClearForce?: () => void;
    onPrintItem: (item: LabelData, copies: number) => Promise<boolean>;
    printerName?: string;
}

const DeferredPrintModal: React.FC<DeferredPrintModalProps> = ({
    isOpen,
    onClose,
    queue,
    onRemove,
    onClear,
    onClearForce,
    onPrintItem,
    printerName
}) => {
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);

    if (!isOpen) return null;

    const handlePrint = async (index: number, item: LabelData) => {
        setProcessingIndex(index);
        const success = await onPrintItem(item, 1); // Default 1 copy for now
        setProcessingIndex(null);
        if (success) {
            onRemove(index);
        }
    };

    const handlePrintAll = async () => {
        if (!window.confirm(`Надрукувати всі? (${queue.length} шт.)`)) return;

        // Process sequentially
        for (let i = 0; i < queue.length; i++) {
            setProcessingIndex(i);
            const success = await onPrintItem(queue[i], 1);
            if (!success) {
                alert(`Помилка друку на елементі ${i + 1}. Зупинка.`);
                setProcessingIndex(null);
                return;
            }
        }
        setProcessingIndex(null);
        setProcessingIndex(null);
        if (onClearForce) {
            onClearForce();
        } else {
            onClear();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="bg-orange-100 text-orange-600 p-1.5 rounded-lg">
                            <PrinterIcon />
                        </span>
                        Черга друку
                        <span className="bg-slate-200 text-slate-600 text-sm px-2 py-0.5 rounded-full">
                            {queue.length}
                        </span>
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                        <CloseIcon />
                    </button>
                </div>

                <div className="p-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 text-center">
                    Принтер: <b>{printerName || 'Не підключено'}</b>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                    {queue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 opacity-50">
                            <PrinterIcon />
                            <p className="mt-2 font-medium">Черга порожня</p>
                        </div>
                    ) : (
                        queue.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800">{item.product?.name}</span>
                                        <span className="text-xs bg-slate-100 px-1.5 rounded text-slate-500">{item.product?.sku}</span>
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1 flex gap-3">
                                        <span>Вага: <b>{item.weight}</b> кг</span>
                                        <span>S/N: <b>{item.serialNumber}</b></span>
                                        <span>{item.date}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePrint(idx, item)}
                                        disabled={processingIndex !== null}
                                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 border border-green-200 disabled:opacity-50"
                                        title="Друкувати цей"
                                    >
                                        {processingIndex === idx ? (
                                            <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full" />
                                        ) : (
                                            <PrinterIcon />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => onRemove(idx)}
                                        disabled={processingIndex !== null}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg hover:text-red-600 disabled:opacity-50"
                                        title="Видалити"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-white flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                    <button
                        onClick={onClear}
                        disabled={queue.length === 0 || processingIndex !== null}
                        className="text-red-500 text-sm font-medium hover:underline disabled:opacity-50 w-full sm:w-auto text-center"
                    >
                        Очистити все
                    </button>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-3 sm:py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg w-full sm:w-auto"
                        >
                            Закрити
                        </button>
                        <button
                            onClick={handlePrintAll}
                            disabled={queue.length === 0 || processingIndex !== null}
                            className="px-6 py-3 sm:py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                            <PrinterIcon />
                            Надрукувати Всі
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeferredPrintModal;
