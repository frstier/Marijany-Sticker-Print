import React, { useState } from 'react';
import { auditLog, AuditLogEntry } from '../services/auditLogService';

interface AuditLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

const actionIcons: Record<AuditLogEntry['action'], string> = {
    login: '🔓',
    logout: '🔒',
    print: '🖨️',
    settings_change: '⚙️',
    user_create: '👤',
    user_update: '✏️',
    user_delete: '🗑️'
};

const actionLabels: Record<AuditLogEntry['action'], string> = {
    login: 'Вхід',
    logout: 'Вихід',
    print: 'Друк',
    settings_change: 'Налаштування',
    user_create: 'Новий користувач',
    user_update: 'Редагування',
    user_delete: 'Видалення'
};

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ isOpen, onClose }) => {
    const [filter, setFilter] = useState<AuditLogEntry['action'] | 'all'>('all');
    const logs = auditLog.getRecent(100);

    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(l => l.action === filter);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
                    <div className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📋 Журнал дій
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {/* Filter */}
                <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] shrink-0">
                    <div className="flex gap-2 overflow-x-auto">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === 'all'
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                }`}
                        >
                            Всі
                        </button>
                        {Object.entries(actionLabels).map(([action, label]) => (
                            <button
                                key={action}
                                onClick={() => setFilter(action as AuditLogEntry['action'])}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === action
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                    }`}
                            >
                                {actionIcons[action as AuditLogEntry['action']]} {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-muted)]">
                            Немає записів
                        </div>
                    ) : (
                        filteredLogs.map(entry => (
                            <div
                                key={entry.id}
                                className="bg-[var(--bg-tertiary)] rounded-xl p-3 flex items-start gap-3"
                            >
                                <div className="text-2xl">{actionIcons[entry.action]}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-[var(--text-primary)]">
                                            {entry.userName}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                            {entry.userRole}
                                        </span>
                                    </div>
                                    <div className="text-sm text-[var(--text-secondary)] truncate">
                                        {entry.details}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] mt-1">
                                        {new Date(entry.timestamp).toLocaleString('uk-UA')}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] shrink-0">
                    <button onClick={onClose} className="w-full py-3 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-hover)] transition-colors">
                        Закрити
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuditLogViewer;
