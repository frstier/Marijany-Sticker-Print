import React from 'react';

interface LoadingSpinnerProps {
    isLoading: boolean;
    text?: string;
}

export default function LoadingSpinner({ isLoading, text = 'Завантаження...' }: LoadingSpinnerProps) {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-600 font-medium">{text}</p>
            </div>
        </div>
    );
}
