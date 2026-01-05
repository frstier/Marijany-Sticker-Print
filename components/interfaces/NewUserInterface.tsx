import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import PalletBuilder from '../pallet/PalletBuilder';
import ProductionJournal from '../production/ProductionJournal';
import PalletReport from '../reports/PalletReport';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';

export default function NewUserInterface() {
    const { logout, currentUser } = useAuth();
    const [mode, setMode] = useState<'dashboard' | 'palletizing' | 'journal' | 'reports'>('dashboard');
    const [warehouseItems, setWarehouseItems] = useState<ProductionItem[]>([]);

    useEffect(() => {
        // Load items for dashboard view
        const load = async () => {
            const items = await ProductionService.getGradedItems();
            setWarehouseItems(items);
        };
        load();
    }, [mode]); // Refresh when changing modes or mounting

    // Logout State (Local)
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [writeOffConfirm, setWriteOffConfirm] = useState(false);

    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
            // Reload
            const items = await ProductionService.getGradedItems();
            setWarehouseItems(items);
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* Write-off Confirmation Modal */}
            {writeOffConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">📦 Списання товару</h3>
                        <p className="text-slate-600 mb-6">
                            Ви впевнені, що хочете списати <strong>{selectedIds.size}</strong> елементів?
                            <br />
                            Це змінить їх статус на "Відвантажено".
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
                                Так, списати
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Simple Header for logout */}
            <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center shadow-md shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white">A</div>
                    <div>
                        <div className="font-bold text-lg leading-tight">ОБЛІКОВЕЦЬ</div>
                        <div className="text-[10px] text-blue-300 tracking-wider">HeMP SYSTEM</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="opacity-70 text-sm hidden md:inline">{currentUser?.name}</span>
                    <button
                        onClick={handleLogoutClick}
                        className={`px-4 py-2 rounded text-sm transition-all font-bold border ${logoutConfirm
                            ? 'bg-red-500 text-white border-red-400 animate-pulse'
                            : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                    >
                        {logoutConfirm ? 'Підтвердити?' : 'Вийти'}
                    </button>
                </div>
            </div>

            {/* Modal Overlay for Pallet Builder */}
            {mode === 'palletizing' && (
                <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <PalletBuilder onClose={() => setMode('dashboard')} />
                </div>
            )}

            {/* Modal Overlay for Production Journal */}
            {mode === 'journal' && (
                <ProductionJournal onClose={() => setMode('dashboard')} />
            )}

            {/* Modal Overlay for Pallet Report */}
            {mode === 'reports' && (
                <PalletReport onClose={() => setMode('dashboard')} />
            )}

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto">

                    {/* Welcome / Dashboard */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Робочий стіл</h1>
                        <p className="text-slate-500">Оберіть режим роботи для початку зміни.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">

                        {/* Card: New Pallet */}
                        <button
                            onClick={() => setMode('palletizing')}
                            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-400 transition-all text-left group"
                        >
                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-700">Формування Палети</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Сканування готових бейлів, формування партії та друк етикетки на палету.
                            </p>
                        </button>

                        {/* Card: History (Production Journal) */}
                        <button
                            onClick={() => setMode('journal')}
                            className="bg-purple-50 p-8 rounded-2xl shadow-sm border border-purple-200 hover:shadow-xl hover:border-purple-400 transition-all text-left group"
                        >
                            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-purple-700">Журнал Виробництва</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Повний контроль над партіями, редагування, додавання та списання.
                            </p>
                        </button>

                        {/* Card: Pallet Reports */}
                        <button
                            onClick={() => setMode('reports')}
                            className="bg-indigo-50 p-8 rounded-2xl shadow-sm border border-indigo-200 hover:shadow-xl hover:border-indigo-400 transition-all text-left group"
                        >
                            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-700">Звіти по Палетах</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Перегляд сформованих палет, вміст та експорт.
                            </p>
                        </button>
                    </div>


                    {/* Warehouse Stock View */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex justify-between items-center">
                            <span>Готова Продукція (На складі)</span>
                            <div className="flex items-center gap-3">
                                {selectedIds.size > 0 && (
                                    <button
                                        onClick={handleWriteOff}
                                        className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />{/* Simple dash icon or close */}
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Списати ({selectedIds.size})
                                    </button>
                                )}
                                <span className="text-sm font-normal text-slate-500 bg-white px-3 py-1 rounded-full border">
                                    Доступно: {warehouseItems.length}
                                </span>
                            </div>
                        </h2>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-800 font-bold uppercase text-xs border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={warehouseItems.length > 0 && selectedIds.size === warehouseItems.length}
                                                    onChange={toggleSelectAll}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                />
                                            </th>
                                            <th className="p-4">№</th>
                                            <th className="p-4">Дата</th>
                                            <th className="p-4">Палета №</th>
                                            <th className="p-4">Продукт</th>
                                            <th className="p-4">Сорт</th>
                                            <th className="p-4 text-right">Вага</th>
                                            <th className="p-4 text-center">Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {warehouseItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-slate-400">Склад порожній або немає перевірених бейлів.</td>
                                            </tr>
                                        ) : (
                                            warehouseItems.map(item => (
                                                <tr key={item.id} className={`hover:bg-blue-50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="p-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(item.id)}
                                                            onChange={() => toggleSelect(item.id)}
                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                        />
                                                    </td>
                                                    <td className="p-4 font-mono font-bold">#{item.serialNumber}</td>
                                                    <td className="p-4">{item.date}</td>
                                                    <td className="p-4">
                                                        {item.batchId ? (
                                                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                                {item.batchId}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">{item.productName}</td>
                                                    <td className="p-4">
                                                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                                                            {item.sort}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-bold">{item.weight} кг</td>
                                                    <td className="p-4 text-center">
                                                        <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded-full border border-green-200">
                                                            ГОТОВИЙ
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
