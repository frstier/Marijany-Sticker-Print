import React, { useState, useEffect } from 'react';
import { auditLog, AuditLogEntry, AuditAction } from '../services/auditLogService';

interface AuditLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    entityType?: string;
    entityId?: string;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ isOpen, onClose, entityType, entityId }) => {
    const [filter, setFilter] = useState<AuditAction | 'all'>('all');
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadLogs();
        }
    }, [isOpen, entityType, entityId]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            let data: AuditLogEntry[];
            if (entityType && entityId) {
                data = await auditLog.getEntityHistory(entityType, entityId);
            } else {
                data = await auditLog.getRecentFromSupabase(100);
            }
            setLogs(data);
        } catch (e) {
            console.error('Failed to load logs:', e);
            setLogs(auditLog.getRecent(100));
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(l => l.action === filter);

    if (!isOpen) return null;

    // Group actions for filter tabs
    const actionGroups = [
        { key: 'all', label: 'Всі', icon: '📋' },
        { key: 'graded', label: 'Сортування', icon: '✅' },
        { key: 'palletized', label: 'Палетизація', icon: '📦' },
        { key: 'shipped', label: 'Відвантаження', icon: '🚛' },
        { key: 'location_assigned', label: 'Локації', icon: '📍' },
        { key: 'print', label: 'Друк', icon: '🖨️' },
        { key: 'login', label: 'Входи', icon: '🔐' },
    ];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
                    <div className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📋 Журнал дій
                        {entityType && entityId && (
                            <span className="text-sm font-normal text-[var(--text-muted)]">
                                ({entityType} #{entityId.slice(0, 8)})
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadLogs}
                            className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors"
                            title="Оновити"
                        >
                            🔄
                        </button>
                        <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] shrink-0">
                    <div className="flex gap-2 overflow-x-auto">
                        {actionGroups.map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key as AuditAction | 'all')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === key
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                    }`}
                            >
                                {icon} {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin text-3xl mb-2">⏳</div>
                            <div className="text-[var(--text-muted)]">Завантаження...</div>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-muted)]">
                            <div className="text-4xl mb-2">📭</div>
                            Немає записів
                        </div>
                    ) : (
                        filteredLogs.map(entry => (
                            <div
                                key={entry.id}
                                className="bg-[var(--bg-tertiary)] rounded-xl p-3 flex items-start gap-3 hover:shadow-sm transition-shadow"
                            >
                                <div className="text-2xl shrink-0">
                                    {auditLog.getActionLabel(entry.action).split(' ')[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-semibold text-[var(--text-primary)]">
                                            {auditLog.getActionLabel(entry.action).split(' ').slice(1).join(' ') || entry.action}
                                        </span>
                                        {entry.entityId && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                                #{entry.entityId.slice(0, 8)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-[var(--text-secondary)]">
                                        {entry.details}
                                    </div>
                                    {/* Show value changes */}
                                    {(entry.oldValue || entry.newValue) && (
                                        <div className="flex gap-2 mt-1.5 text-xs flex-wrap">
                                            {entry.oldValue && (
                                                <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">
                                                    {typeof entry.oldValue === 'object' ? JSON.stringify(entry.oldValue) : String(entry.oldValue)}
                                                </span>
                                            )}
                                            {entry.oldValue && entry.newValue && <span className="text-[var(--text-muted)]">→</span>}
                                            {entry.newValue && (
                                                <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                                                    {typeof entry.newValue === 'object' ? JSON.stringify(entry.newValue) : String(entry.newValue)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-xs text-[var(--text-muted)]">
                                            {new Date(entry.timestamp).toLocaleString('uk-UA', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                            {entry.userName}
                                        </span>
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
