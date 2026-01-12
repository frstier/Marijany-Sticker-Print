import React from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Підтвердити',
    cancelText = 'Скасувати',
    variant = 'danger',
    onConfirm,
    onCancel
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: '⚠️',
            confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
            iconBg: 'bg-red-100 text-red-600'
        },
        warning: {
            icon: '⚡',
            confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
            iconBg: 'bg-amber-100 text-amber-600'
        },
        info: {
            icon: 'ℹ️',
            confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
            iconBg: 'bg-blue-100 text-blue-600'
        }
    };

    const style = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center text-2xl shrink-0`}>
                            {style.icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                            <p className="text-slate-600 mt-1">{message}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 pt-2 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all shadow-lg ${style.confirmBtn}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
