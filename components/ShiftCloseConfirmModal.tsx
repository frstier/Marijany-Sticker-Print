import React from 'react';
import { Shift, ShiftSummary } from '../services/shiftService';

interface ShiftCloseConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    currentShift: Shift | null;
}

const ShiftCloseConfirmModal: React.FC<ShiftCloseConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentShift
}) => {
    if (!isOpen || !currentShift) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                <div className="bg-red-500 p-6 text-white text-center">
                    <div className="text-4xl mb-2">⚠️</div>
                    <h2 className="text-2xl font-bold">Закрити зміну?</h2>
                    <p className="opacity-90">Ви не зможете додавати нові друки до цієї зміни після її закриття.</p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border">
                            <div className="text-xs text-slate-500 uppercase font-bold text-center">Друків</div>
                            <div className="font-mono font-bold text-2xl text-center text-slate-800">{currentShift.printCount}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border">
                            <div className="text-xs text-slate-500 uppercase font-bold text-center">Початок</div>
                            <div className="font-mono font-bold text-lg text-center text-slate-800">
                                {new Date(currentShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Скасувати
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-[2] py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                        >
                            Так, закрити зміну
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShiftCloseConfirmModal;
