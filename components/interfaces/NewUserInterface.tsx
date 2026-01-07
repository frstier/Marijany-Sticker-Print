import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import PalletBuilder from '../pallet/PalletBuilder';
import ProductionJournal from '../production/ProductionJournal';
import PalletReport from '../reports/PalletReport';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';
import { PalletService } from '../../services/palletService';
import { Batch } from '../../types/pallet';
import { zebraService } from '../../services/zebraService';
import { usePrinter } from '../../hooks/usePrinter';
import NotificationBanner from '../ui/NotificationBanner';
import { NotificationService, NOTIFICATION_THRESHOLD } from '../../services/notificationService';

type ViewMode = 'stock' | 'pallets' | 'journal';

export default function NewUserInterface() {
    const { logout, currentUser } = useAuth();
    const printerData = usePrinter();

    // Navigation
    const [activeView, setActiveView] = useState<ViewMode>('stock');
    const [showPalletBuilder, setShowPalletBuilder] = useState(false);

    // Data
    const [warehouseItems, setWarehouseItems] = useState<ProductionItem[]>([]);
    const [pallets, setPallets] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [writeOffConfirm, setWriteOffConfirm] = useState(false);
    const [showJournal, setShowJournal] = useState(false);
    const [showReports, setShowReports] = useState(false);

    // Notification state
    const [pendingCount, setPendingCount] = useState(0);
    const [showNotification, setShowNotification] = useState(true);

    // Load data
    useEffect(() => {
        loadData();
        // Check pending count for notification
        NotificationService.getPendingCountForAccountant().then(count => {
            setPendingCount(count);
        });
    }, [activeView]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeView === 'stock') {
                const items = await ProductionService.getGradedItems();
                setWarehouseItems(items);
            } else if (activeView === 'pallets') {
                const allPallets = PalletService.getBatches();
                setPallets(allPallets.filter(p => p.status === 'closed'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const totalWeight = warehouseItems.reduce((sum, i) => sum + i.weight, 0);
        const bySort: Record<string, number> = {};
        warehouseItems.forEach(i => {
            bySort[i.sort || 'Unknown'] = (bySort[i.sort || 'Unknown'] || 0) + 1;
        });
        return { totalWeight, bySort, count: warehouseItems.length };
    }, [warehouseItems]);

    // Handlers
    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === warehouseItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(warehouseItems.map(i => i.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleWriteOff = () => {
        if (selectedIds.size === 0) return;
        setWriteOffConfirm(true);
    };

    const confirmWriteOff = async () => {
        setWriteOffConfirm(false);
        try {
            await ProductionService.shipItems(Array.from(selectedIds));
            await loadData();
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
        }
    };

    // Print pallet label
    const printPalletLabel = async (batch: Batch) => {
        const zpl = generatePalletZPL(batch);
        if (printerData.printer) {
            await zebraService.print(printerData.printer, zpl);
        } else {
            console.log("--- PALLET MOCK PRINT ---");
            console.log(zpl);
            alert(`Друк палети ${batch.id}`);
        }
    };

    const generatePalletZPL = (batch: Batch) => {
        const toHex = (str: string) => {
            if (!str) return "";
            return Array.from(new TextEncoder().encode(str))
                .map(b => "_" + b.toString(16).toUpperCase().padStart(2, "0"))
                .join("");
        };
        const dateStr = batch.date.includes('T') ? batch.date.split('T')[0] : batch.date;
        const itemsListZpl = batch.items.map((item, idx) => {
            const col = idx < 10 ? 0 : 1;
            const row = idx % 10;
            const x = 50 + (col * 380);
            const y = 280 + (row * 35);
            return `^FO${x},${y}^A0N,28,28^FH^FD${idx + 1}. #${item.serialNumber} - ${item.weight.toFixed(1)} kg^FS`;
        }).join('\n');

        return `^XA
^PW800
^LL800
^CI28
^FO50,40^A0N,40,40^FB700,1,0,C^FDMARIJANY HEMP^FS
^FO50,90^GB700,3,3^FS
^FO50,110^A0N,30,30^FDID:^FS
^FO100,110^A0N,50,50^FH^FD#${batch.id}^FS
^FO450,110^A0N,30,30^FD${dateStr}^FS
^FO50,180^A0N,28,28^FH^FD${toHex(batch.sort)}^FS
^FO50,220^GB700,2,2^FS
${itemsListZpl}
^FO50,630^GB700,2,2^FS
^FO50,660^A0N,35,35^FH^FD${batch.items.length} шт / ${batch.totalWeight.toFixed(1)} кг^FS
^FO200,720^BY2^BCN,50,Y,N,N^FD${batch.id}^FS
^XZ`;
    };

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
                {/* Logo */}
                <div className="p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
                            H
                        </div>
                        <div>
                            <div className="font-bold text-lg">HeMP</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Облік</div>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    <button
                        onClick={() => setActiveView('stock')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'stock' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                        <span className="text-xl">📦</span>
                        <span className="font-medium">Склад</span>
                        <span className="ml-auto bg-slate-700 text-xs px-2 py-0.5 rounded-full">{stats.count}</span>
                    </button>

                    <button
                        onClick={() => setActiveView('pallets')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'pallets' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                        <span className="text-xl">🚛</span>
                        <span className="font-medium">Палети</span>
                        <span className="ml-auto bg-slate-700 text-xs px-2 py-0.5 rounded-full">{pallets.length}</span>
                    </button>

                    <div className="border-t border-slate-700 my-4" />

                    <button
                        onClick={() => setShowJournal(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-all text-left"
                    >
                        <span className="text-xl">📋</span>
                        <span className="font-medium">Журнал</span>
                    </button>

                    <button
                        onClick={() => setShowReports(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-all text-left"
                    >
                        <span className="text-xl">📊</span>
                        <span className="font-medium">Звіти</span>
                    </button>
                </nav>

                {/* Quick Stats */}
                <div className="p-4 border-t border-slate-700">
                    <div className="text-xs text-slate-500 uppercase mb-2">На складі</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(stats.bySort).slice(0, 4).map(([sort, count]) => (
                            <div key={sort} className="bg-slate-800 rounded px-2 py-1">
                                <span className="text-slate-400">{sort}:</span> <span className="font-bold">{count}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-lg font-bold text-blue-400">{stats.totalWeight.toFixed(1)} кг</div>
                </div>

                {/* User & Logout */}
                <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{currentUser?.name}</div>
                            <div className="text-xs text-slate-500">Обліковець</div>
                        </div>
                        <button
                            onClick={handleLogoutClick}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${logoutConfirm ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            {logoutConfirm ? '?' : '🚪'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {activeView === 'stock' && 'Склад готової продукції'}
                            {activeView === 'pallets' && 'Сформовані палети'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {activeView === 'stock' && 'Виберіть бейли для формування палети або списання'}
                            {activeView === 'pallets' && 'Перегляд та друк етикеток'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Printer Status */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${printerData.printer ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500'}`}>
                            <span>{printerData.printer ? '🖨️' : '⚠️'}</span>
                            <span>{printerData.printer?.name || 'Принтер не підключено'}</span>
                        </div>

                        {activeView === 'stock' && (
                            <button
                                onClick={() => setShowPalletBuilder(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
                            >
                                <span>➕</span>
                                <span>Нова палета</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Notification Banner */}
                {showNotification && NotificationService.shouldShowNotification(pendingCount) && (
                    <NotificationBanner
                        count={pendingCount}
                        message={`Є ${pendingCount} неоприходуваних бейлів — необхідно формувати палети!`}
                        onDismiss={() => setShowNotification(false)}
                    />
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    ) : activeView === 'stock' ? (
                        /* Stock View */
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Toolbar */}
                            {selectedIds.size > 0 && (
                                <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
                                    <span className="text-blue-700 font-medium">Вибрано: {selectedIds.size}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedIds(new Set())}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm transition-all"
                                        >
                                            Скасувати
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={warehouseItems.length > 0 && selectedIds.size === warehouseItems.length}
                                                    onChange={toggleSelectAll}
                                                    className="rounded border-slate-300 text-blue-600 w-4 h-4"
                                                />
                                            </th>
                                            <th className="p-3 text-left font-bold text-slate-700">№</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Дата</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Продукт</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Сорт</th>
                                            <th className="p-3 text-right font-bold text-slate-700">Вага</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {warehouseItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-12 text-center text-slate-400">
                                                    <div className="text-4xl mb-2">📭</div>
                                                    Склад порожній
                                                </td>
                                            </tr>
                                        ) : (
                                            warehouseItems.map(item => (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => toggleSelect(item.id)}
                                                    className={`cursor-pointer transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(item.id)}
                                                            onChange={() => { }}
                                                            className="rounded border-slate-300 text-blue-600 w-4 h-4 pointer-events-none"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-slate-800">#{item.serialNumber}</td>
                                                    <td className="p-3 text-slate-600">{item.date}</td>
                                                    <td className="p-3 text-slate-800">{item.productName}</td>
                                                    <td className="p-3">
                                                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
                                                            {item.sort}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-slate-800">{item.weight} кг</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* Pallets View */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pallets.length === 0 ? (
                                <div className="col-span-full text-center py-16 text-slate-400">
                                    <div className="text-5xl mb-4">🚛</div>
                                    <p>Немає сформованих палет</p>
                                </div>
                            ) : (
                                pallets.map(pallet => (
                                    <div key={pallet.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                                        <div className="bg-slate-800 text-white p-4">
                                            <div className="font-mono font-bold text-xl">#{pallet.id}</div>
                                            <div className="text-slate-400 text-sm">{pallet.date}</div>
                                        </div>
                                        <div className="p-4">
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <div className="text-xs text-slate-500">Кількість</div>
                                                    <div className="text-lg font-bold">{pallet.items.length} шт</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500">Вага</div>
                                                    <div className="text-lg font-bold text-blue-600">{pallet.totalWeight.toFixed(1)} кг</div>
                                                </div>
                                            </div>
                                            <div className="mb-4">
                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                                                    {pallet.sort}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => printPalletLabel(pallet)}
                                                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                                            >
                                                <span>🖨️</span>
                                                <span>Друкувати етикетку</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Modals */}
            {showPalletBuilder && (
                <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <PalletBuilder
                        onClose={() => { setShowPalletBuilder(false); loadData(); }}
                        onComplete={() => {
                            setActiveView('pallets');
                            // loadData will be called by useEffect when activeView changes
                        }}
                    />
                </div>
            )}

            {showJournal && (
                <ProductionJournal onClose={() => setShowJournal(false)} />
            )}

            {showReports && (
                <PalletReport onClose={() => setShowReports(false)} />
            )}

            {/* Write-off Modal */}
            {writeOffConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">📤 Списання товару</h3>
                        <p className="text-slate-600 mb-6">
                            Списати <strong>{selectedIds.size}</strong> елементів?
                            <br />
                            <span className="text-sm text-slate-400">Статус зміниться на "Відвантажено"</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setWriteOffConfirm(false)}
                                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-lg font-medium transition-colors"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={confirmWriteOff}
                                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors"
                            >
                                Списати
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
