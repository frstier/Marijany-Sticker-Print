import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { InventoryService, InventorySession, InventoryItem, InventorySummary } from '../../services/inventoryService';
import { Html5Qrcode } from 'html5-qrcode';

interface InventoryInterfaceProps {
    onBack: () => void;
}

const InventoryInterface: React.FC<InventoryInterfaceProps> = ({ onBack }) => {
    const { currentUser, logout } = useAuth();
    const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
    const [sessions, setSessions] = useState<InventorySession[]>([]);
    const [scannedItems, setScannedItems] = useState<InventoryItem[]>([]);
    const [summary, setSummary] = useState<InventorySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [manualBarcode, setManualBarcode] = useState('');
    const [newSessionName, setNewSessionName] = useState('');
    const [showNewSession, setShowNewSession] = useState(false);
    const [tab, setTab] = useState<'scan' | 'history'>('scan');

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const lastScanned = useRef<string>('');

    useEffect(() => {
        loadData();
        return () => {
            stopScanner();
        };
    }, []);

    const loadData = async () => {
        setLoading(true);
        const active = await InventoryService.getActiveSession();
        setActiveSession(active);
        if (active) {
            const items = await InventoryService.getSessionItems(active.id);
            setScannedItems(items);
        }
        const allSessions = await InventoryService.getSessions();
        setSessions(allSessions);
        setLoading(false);
    };

    const startNewSession = async () => {
        if (!newSessionName.trim()) return;
        setLoading(true);
        const session = await InventoryService.createSession(
            newSessionName.trim(),
            currentUser?.id,
            currentUser?.name
        );
        if (session) {
            setActiveSession(session);
            setScannedItems([]);
            setShowNewSession(false);
            setNewSessionName('');
        }
        setLoading(false);
    };

    const handleScan = async (barcode: string) => {
        if (!activeSession || barcode === lastScanned.current) return;
        lastScanned.current = barcode;

        const item = await InventoryService.scanItem(activeSession.id, barcode);
        if (item) {
            setScannedItems(prev => [item, ...prev]);
            // Update session stats
            const updatedSession = { ...activeSession };
            if (item.status === 'found' || item.status === 'mismatch') {
                updatedSession.totalScanned++;
            } else if (item.status === 'extra') {
                updatedSession.totalExtra++;
            }
            setActiveSession(updatedSession);
        }

        // Reset for next scan
        setTimeout(() => { lastScanned.current = ''; }, 1000);
    };

    const handleManualScan = () => {
        if (manualBarcode.trim()) {
            handleScan(manualBarcode.trim());
            setManualBarcode('');
        }
    };

    const startScanner = async () => {
        try {
            const scanner = new Html5Qrcode('inventory-scanner');
            scannerRef.current = scanner;
            setScanning(true);

            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 100 } },
                (decodedText) => handleScan(decodedText),
                () => { }
            );
        } catch (e) {
            console.error('Scanner error:', e);
            setScanning(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
            } catch (e) { }
            scannerRef.current = null;
        }
        setScanning(false);
    };

    const completeSession = async () => {
        if (!activeSession) return;
        if (!confirm(`Завершити інвентаризацію "${activeSession.name}"?`)) return;

        setLoading(true);
        stopScanner();
        const result = await InventoryService.completeSession(activeSession.id);
        if (result) {
            setSummary(result);
            setActiveSession(null);
        }
        await loadData();
        setLoading(false);
    };

    const cancelSession = async () => {
        if (!activeSession) return;
        if (!confirm('Скасувати поточну інвентаризацію?')) return;

        setLoading(true);
        stopScanner();
        await InventoryService.cancelSession(activeSession.id);
        setActiveSession(null);
        await loadData();
        setLoading(false);
    };

    const getStatusBadge = (status: InventoryItem['status']) => {
        const styles: Record<string, string> = {
            found: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            missing: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            extra: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            mismatch: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
        };
        const labels: Record<string, string> = {
            found: '✓ Знайдено',
            missing: '✗ Відсутній',
            extra: '? Зайвий',
            mismatch: '⚠ Невідповідність'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-2">⏳</div>
                    <div className="text-slate-400">Завантаження...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg">
                            ←
                        </button>
                        <div>
                            <h1 className="text-xl font-bold">📋 Інвентаризація</h1>
                            {currentUser && <div className="text-xs text-slate-400">{currentUser.name}</div>}
                        </div>
                    </div>
                    <button onClick={logout} className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-sm">
                        Вийти
                    </button>
                </div>
            </header>

            <main className="p-4 max-w-4xl mx-auto">
                {/* Summary modal */}
                {summary && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
                            <h2 className="text-xl font-bold mb-4">📊 Результати інвентаризації</h2>
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div className="bg-green-900/30 rounded-xl p-3 text-center">
                                    <div className="text-2xl font-bold text-green-400">{summary.foundItems.length}</div>
                                    <div className="text-xs text-slate-400">Знайдено</div>
                                </div>
                                <div className="bg-red-900/30 rounded-xl p-3 text-center">
                                    <div className="text-2xl font-bold text-red-400">{summary.missingItems.length}</div>
                                    <div className="text-xs text-slate-400">Відсутніх</div>
                                </div>
                                <div className="bg-yellow-900/30 rounded-xl p-3 text-center">
                                    <div className="text-2xl font-bold text-yellow-400">{summary.extraItems.length}</div>
                                    <div className="text-xs text-slate-400">Зайвих</div>
                                </div>
                            </div>

                            {summary.missingItems.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-red-400 mb-2">❌ Відсутні бейли:</h3>
                                    <div className="space-y-1 max-h-32 overflow-auto">
                                        {summary.missingItems.map(i => (
                                            <div key={i.id} className="text-sm bg-red-900/20 px-2 py-1 rounded">
                                                #{i.serialNumber} • {i.productName} • {i.weight}кг
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {summary.extraItems.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-yellow-400 mb-2">⚠️ Зайві бейли:</h3>
                                    <div className="space-y-1 max-h-32 overflow-auto">
                                        {summary.extraItems.map(i => (
                                            <div key={i.id} className="text-sm bg-yellow-900/20 px-2 py-1 rounded">
                                                {i.barcode}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setSummary(null)}
                                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl"
                            >
                                Закрити
                            </button>
                        </div>
                    </div>
                )}

                {/* No active session */}
                {!activeSession && (
                    <div className="space-y-4">
                        {/* New session button */}
                        {!showNewSession ? (
                            <button
                                onClick={() => setShowNewSession(true)}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2"
                            >
                                ➕ Почати нову інвентаризацію
                            </button>
                        ) : (
                            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                                <input
                                    type="text"
                                    value={newSessionName}
                                    onChange={(e) => setNewSessionName(e.target.value)}
                                    placeholder="Назва інвентаризації..."
                                    className="w-full px-4 py-3 bg-slate-700 rounded-lg text-white"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={startNewSession}
                                        disabled={!newSessionName.trim()}
                                        className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg disabled:opacity-50"
                                    >
                                        Створити
                                    </button>
                                    <button
                                        onClick={() => setShowNewSession(false)}
                                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg"
                                    >
                                        Скасувати
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Past sessions */}
                        <div className="bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold mb-3 text-slate-300">📜 Історія</h3>
                            {sessions.length === 0 ? (
                                <div className="text-center py-4 text-slate-500">Немає попередніх інвентаризацій</div>
                            ) : (
                                <div className="space-y-2">
                                    {sessions.slice(0, 10).map(s => (
                                        <div key={s.id} className="bg-slate-700 rounded-lg p-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium">{s.name}</div>
                                                    <div className="text-xs text-slate-400">
                                                        {new Date(s.startedAt).toLocaleDateString('uk-UA')}
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                                                        s.status === 'cancelled' ? 'bg-red-900/30 text-red-400' :
                                                            'bg-blue-900/30 text-blue-400'
                                                    }`}>
                                                    {s.status === 'completed' ? '✓ Завершено' :
                                                        s.status === 'cancelled' ? '✗ Скасовано' : '● Активна'}
                                                </span>
                                            </div>
                                            {s.status === 'completed' && (
                                                <div className="flex gap-3 mt-2 text-xs">
                                                    <span className="text-green-400">✓ {s.totalScanned}</span>
                                                    <span className="text-red-400">✗ {s.totalMissing}</span>
                                                    <span className="text-yellow-400">? {s.totalExtra}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Active session */}
                {activeSession && (
                    <div className="space-y-4">
                        {/* Session info */}
                        <div className="bg-slate-800 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h2 className="font-bold text-lg">{activeSession.name}</h2>
                                    <div className="text-xs text-slate-400">
                                        Очікується: {activeSession.totalExpected} бейлів
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-emerald-400">
                                        {activeSession.totalScanned}/{activeSession.totalExpected}
                                    </div>
                                    <div className="text-xs text-slate-400">просканованo</div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                                    style={{ width: `${Math.min(100, (activeSession.totalScanned / activeSession.totalExpected) * 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Scanner */}
                        <div className="bg-slate-800 rounded-xl p-4">
                            {!scanning ? (
                                <button
                                    onClick={startScanner}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                >
                                    📷 Увімкнути сканер
                                </button>
                            ) : (
                                <div>
                                    <div id="inventory-scanner" className="rounded-lg overflow-hidden mb-3" />
                                    <button
                                        onClick={stopScanner}
                                        className="w-full py-2 bg-slate-700 text-slate-300 rounded-lg"
                                    >
                                        Зупинити сканер
                                    </button>
                                </div>
                            )}

                            {/* Manual input */}
                            <div className="flex gap-2 mt-3">
                                <input
                                    type="text"
                                    value={manualBarcode}
                                    onChange={(e) => setManualBarcode(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
                                    placeholder="Ввести штрих-код..."
                                    className="flex-1 px-3 py-2 bg-slate-700 rounded-lg text-white text-sm"
                                />
                                <button
                                    onClick={handleManualScan}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium"
                                >
                                    ✓
                                </button>
                            </div>
                        </div>

                        {/* Scanned items */}
                        <div className="bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold mb-3">Відскановані ({scannedItems.length})</h3>
                            <div className="space-y-2 max-h-64 overflow-auto">
                                {scannedItems.length === 0 ? (
                                    <div className="text-center py-4 text-slate-500">
                                        Почніть сканувати бейли
                                    </div>
                                ) : (
                                    scannedItems.map(item => (
                                        <div key={item.id} className="bg-slate-700 rounded-lg p-2 flex justify-between items-center">
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {item.productName ? `#${item.serialNumber} • ${item.productName}` : item.barcode}
                                                </div>
                                                {item.weight && (
                                                    <div className="text-xs text-slate-400">{item.weight} кг • {item.sort}</div>
                                                )}
                                            </div>
                                            {getStatusBadge(item.status)}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={cancelSession}
                                className="flex-1 py-3 bg-red-600/20 text-red-400 font-bold rounded-xl"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={completeSession}
                                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl"
                            >
                                ✓ Завершити
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default InventoryInterface;
