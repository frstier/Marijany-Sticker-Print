import React, { useState, useEffect, useCallback } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
}

const typeStyles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
};

const typeIcons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
};

function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className={`${typeStyles[type]} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in`}>
            <span className="text-xl font-bold">{typeIcons[type]}</span>
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">✕</button>
        </div>
    );
}

// Toast Container & Context
interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    let toastId = 0;

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-24 right-4 z-[200] flex flex-col gap-2">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
