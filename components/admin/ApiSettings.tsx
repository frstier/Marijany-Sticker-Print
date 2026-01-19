import React, { useState, useEffect } from 'react';
import { ApiService, ApiKey, Webhook, WebhookEvent, WebhookLog } from '../../services/apiService';

interface ApiSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'logs'>('keys');

    // API Keys state
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    // Webhooks state
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: [] as WebhookEvent[] });
    const [showWebhookForm, setShowWebhookForm] = useState(false);

    // Logs state
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [selectedWebhookForLogs, setSelectedWebhookForLogs] = useState<string>('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        const [keys, hooks, logData] = await Promise.all([
            ApiService.getApiKeys(),
            ApiService.getWebhooks(),
            ApiService.getWebhookLogs()
        ]);
        setApiKeys(keys);
        setWebhooks(hooks);
        setLogs(logData);
        setLoading(false);
    };

    // API Key handlers
    const handleGenerateKey = async () => {
        if (!newKeyName.trim()) return;

        setLoading(true);
        const result = await ApiService.generateApiKey(newKeyName, newKeyScopes);
        if (result) {
            setGeneratedKey(result.apiKey);
            setNewKeyName('');
            loadData();
        }
        setLoading(false);
    };

    const handleRevokeKey = async (keyId: string) => {
        if (!confirm('Ви впевнені що хочете деактивувати цей ключ?')) return;

        await ApiService.revokeApiKey(keyId);
        loadData();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Скопійовано!');
    };

    // Webhook handlers
    const handleCreateWebhook = async () => {
        if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) return;

        setLoading(true);
        await ApiService.createWebhook(newWebhook.name, newWebhook.url, newWebhook.events);
        setNewWebhook({ name: '', url: '', events: [] });
        setShowWebhookForm(false);
        loadData();
        setLoading(false);
    };

    const handleToggleWebhook = async (id: string, isActive: boolean) => {
        await ApiService.updateWebhook(id, { isActive: !isActive });
        loadData();
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!confirm('Видалити цей webhook?')) return;

        await ApiService.deleteWebhook(id);
        loadData();
    };

    const toggleEvent = (event: WebhookEvent) => {
        setNewWebhook(prev => ({
            ...prev,
            events: prev.events.includes(event)
                ? prev.events.filter(e => e !== event)
                : [...prev.events, event]
        }));
    };

    if (!isOpen) return null;

    const allEvents = ApiService.getAllWebhookEvents();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">🔌 API Інтеграція</h2>
                        <p className="text-sm text-[var(--text-muted)]">Налаштування для Microsoft Dynamics</p>
                    </div>
                    <button onClick={onClose} className="text-3xl text-[var(--text-muted)] hover:text-[var(--text-primary)]">×</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border-color)]">
                    {[
                        { id: 'keys', label: '🔑 API Ключі' },
                        { id: 'webhooks', label: '🔔 Webhooks' },
                        { id: 'logs', label: '📋 Логи' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === tab.id
                                    ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--bg-tertiary)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    ) : (
                        <>
                            {/* API Keys Tab */}
                            {activeTab === 'keys' && (
                                <div className="space-y-6">
                                    {/* Generated Key Alert */}
                                    {generatedKey && (
                                        <div className="bg-green-500/20 border border-green-500 rounded-xl p-4">
                                            <div className="text-green-400 font-bold mb-2">✅ Новий API ключ згенеровано!</div>
                                            <div className="text-xs text-green-300 mb-2">Збережіть цей ключ зараз — він більше не буде показаний!</div>
                                            <div className="flex gap-2">
                                                <code className="flex-1 bg-black/30 p-2 rounded font-mono text-sm text-white break-all">
                                                    {generatedKey}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(generatedKey)}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => setGeneratedKey(null)}
                                                className="mt-2 text-sm text-green-400 underline"
                                            >
                                                Закрити
                                            </button>
                                        </div>
                                    )}

                                    {/* Create New Key */}
                                    <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                        <h3 className="font-bold text-[var(--text-primary)] mb-3">Створити новий ключ</h3>
                                        <div className="flex gap-3 flex-wrap">
                                            <input
                                                type="text"
                                                value={newKeyName}
                                                onChange={e => setNewKeyName(e.target.value)}
                                                placeholder="Назва (напр. 'Dynamics Production')"
                                                className="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                            />
                                            <select
                                                value={newKeyScopes.join(',')}
                                                onChange={e => setNewKeyScopes(e.target.value.split(','))}
                                                className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                            >
                                                <option value="read">Тільки читання</option>
                                                <option value="read,write">Читання + Запис</option>
                                                <option value="read,write,webhook">Повний доступ</option>
                                            </select>
                                            <button
                                                onClick={handleGenerateKey}
                                                disabled={!newKeyName.trim()}
                                                className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                                            >
                                                Згенерувати
                                            </button>
                                        </div>
                                    </div>

                                    {/* Keys List */}
                                    <div className="space-y-3">
                                        {apiKeys.length === 0 ? (
                                            <div className="text-center py-8 text-[var(--text-muted)]">
                                                Немає створених API ключів
                                            </div>
                                        ) : (
                                            apiKeys.map(key => (
                                                <div
                                                    key={key.id}
                                                    className={`p-4 rounded-xl border ${key.isActive
                                                            ? 'bg-[var(--bg-card)] border-[var(--border-color)]'
                                                            : 'bg-red-500/10 border-red-500/30 opacity-60'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-bold text-[var(--text-primary)]">{key.name}</div>
                                                            <div className="text-sm text-[var(--text-muted)]">
                                                                <code>{key.prefix}••••••••</code>
                                                                {' • '}
                                                                {key.scopes.join(', ')}
                                                                {key.lastUsedAt && (
                                                                    <span> • Останнє використання: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {key.isActive && (
                                                            <button
                                                                onClick={() => handleRevokeKey(key.id)}
                                                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                                                            >
                                                                Деактивувати
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Webhooks Tab */}
                            {activeTab === 'webhooks' && (
                                <div className="space-y-6">
                                    {/* Create Webhook Button */}
                                    {!showWebhookForm && (
                                        <button
                                            onClick={() => setShowWebhookForm(true)}
                                            className="w-full py-3 border-2 border-dashed border-[var(--border-color)] rounded-xl text-[var(--text-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
                                        >
                                            + Додати Webhook
                                        </button>
                                    )}

                                    {/* Create Webhook Form */}
                                    {showWebhookForm && (
                                        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 space-y-4">
                                            <h3 className="font-bold text-[var(--text-primary)]">Новий Webhook</h3>

                                            <input
                                                type="text"
                                                value={newWebhook.name}
                                                onChange={e => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="Назва (напр. 'Dynamics Integration')"
                                                className="w-full px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                            />

                                            <input
                                                type="url"
                                                value={newWebhook.url}
                                                onChange={e => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                                                placeholder="URL (https://your-dynamics-instance.com/api/webhook)"
                                                className="w-full px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                            />

                                            <div>
                                                <label className="block text-sm font-bold text-[var(--text-muted)] mb-2">Events:</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {allEvents.map(event => (
                                                        <button
                                                            key={event.value}
                                                            onClick={() => toggleEvent(event.value)}
                                                            className={`px-3 py-1 rounded-full text-sm transition-colors ${newWebhook.events.includes(event.value)
                                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
                                                                }`}
                                                        >
                                                            {event.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleCreateWebhook}
                                                    disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                                                    className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                                                >
                                                    Створити
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowWebhookForm(false);
                                                        setNewWebhook({ name: '', url: '', events: [] });
                                                    }}
                                                    className="px-6 py-2 bg-[var(--bg-card)] text-[var(--text-muted)] rounded-lg border border-[var(--border-color)]"
                                                >
                                                    Скасувати
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Webhooks List */}
                                    <div className="space-y-3">
                                        {webhooks.length === 0 ? (
                                            <div className="text-center py-8 text-[var(--text-muted)]">
                                                Немає налаштованих webhooks
                                            </div>
                                        ) : (
                                            webhooks.map(webhook => (
                                                <div
                                                    key={webhook.id}
                                                    className={`p-4 rounded-xl border ${webhook.isActive
                                                            ? 'bg-[var(--bg-card)] border-[var(--border-color)]'
                                                            : 'bg-yellow-500/10 border-yellow-500/30'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${webhook.isActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                                <span className="font-bold text-[var(--text-primary)]">{webhook.name}</span>
                                                            </div>
                                                            <div className="text-sm text-[var(--text-muted)] mt-1 break-all">{webhook.url}</div>
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {webhook.events.map(event => (
                                                                    <span key={event} className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)]">
                                                                        {event}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {webhook.lastTriggeredAt && (
                                                                <div className={`text-xs mt-2 ${webhook.lastStatus && webhook.lastStatus >= 400 ? 'text-red-400' : 'text-green-400'}`}>
                                                                    Останній виклик: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                                                                    {webhook.lastStatus && ` (${webhook.lastStatus})`}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleToggleWebhook(webhook.id, webhook.isActive)}
                                                                className={`px-3 py-1 rounded-lg text-sm ${webhook.isActive
                                                                        ? 'bg-yellow-600 text-white'
                                                                        : 'bg-green-600 text-white'
                                                                    }`}
                                                            >
                                                                {webhook.isActive ? 'Пауза' : 'Активувати'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteWebhook(webhook.id)}
                                                                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Logs Tab */}
                            {activeTab === 'logs' && (
                                <div className="space-y-4">
                                    {/* Filter */}
                                    <select
                                        value={selectedWebhookForLogs}
                                        onChange={e => {
                                            setSelectedWebhookForLogs(e.target.value);
                                            ApiService.getWebhookLogs(e.target.value || undefined).then(setLogs);
                                        }}
                                        className="w-full max-w-xs px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                    >
                                        <option value="">Всі webhooks</option>
                                        {webhooks.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>

                                    {/* Logs List */}
                                    <div className="space-y-2">
                                        {logs.length === 0 ? (
                                            <div className="text-center py-8 text-[var(--text-muted)]">
                                                Немає записів
                                            </div>
                                        ) : (
                                            logs.map(log => (
                                                <div
                                                    key={log.id}
                                                    className={`p-3 rounded-lg border ${log.success
                                                            ? 'bg-green-500/10 border-green-500/30'
                                                            : 'bg-red-500/10 border-red-500/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span>{log.success ? '✅' : '❌'}</span>
                                                            <span className="font-mono text-[var(--text-primary)]">{log.event}</span>
                                                            {log.responseStatus && (
                                                                <span className={`px-2 py-0.5 rounded text-xs ${log.responseStatus < 400 ? 'bg-green-600' : 'bg-red-600'
                                                                    } text-white`}>
                                                                    {log.responseStatus}
                                                                </span>
                                                            )}
                                                            {log.durationMs && (
                                                                <span className="text-[var(--text-muted)]">{log.durationMs}ms</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[var(--text-muted)]">
                                                            {new Date(log.createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {log.error && (
                                                        <div className="mt-1 text-xs text-red-400">{log.error}</div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApiSettings;
