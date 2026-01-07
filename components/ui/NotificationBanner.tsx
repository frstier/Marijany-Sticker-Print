import React, { useState } from 'react';

interface NotificationBannerProps {
    count: number;
    message?: string;
    onDismiss?: () => void;
}

export default function NotificationBanner({ count, message, onDismiss }: NotificationBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();
    };

    const defaultMessage = `Є ${count} неоприходуваних бейлів — перевірте кабінет`;

    return (
        <div className="bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-between gap-3 shadow-lg animate-pulse-slow">
            <div className="flex items-center gap-3 font-medium">
                <span className="text-xl">⚠️</span>
                <span>{message || defaultMessage}</span>
            </div>
            <button
                onClick={handleDismiss}
                className="text-amber-800 hover:text-amber-950 transition-colors p-1 rounded-lg hover:bg-amber-400"
                aria-label="Закрити"
            >
                ✕
            </button>
        </div>
    );
}
