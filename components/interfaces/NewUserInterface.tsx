import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import PalletBuilder from '../pallet/PalletBuilder';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';

export default function NewUserInterface() {
    const { logout, currentUser } = useAuth();
    const [mode, setMode] = useState<'dashboard' | 'palletizing'>('dashboard');
    const [warehouseItems, setWarehouseItems] = useState<ProductionItem[]>([]);

    useEffect(() => {
        // Load items for dashboard view
        const load = async () => {
            const items = await ProductionService.getGradedItems();
            setWarehouseItems(items);
        };
        load();
    }, [mode]); // Refresh when changing modes or mounting

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* Simple Header for logout */}
            <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center shadow-md shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white">A</div>
                    <div>
                        <div className="font-bold text-lg leading-tight">ОБЛІКОВЕЦЬ</div>
                        <div className="text-[10px] text-blue-300 tracking-wider">MARIJANY HEMP SYS</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="opacity-70 text-sm hidden md:inline">{currentUser?.name}</span>
                    <button
                        onClick={logout}
                        className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm transition-colors border border-slate-600"
                    >
                        Вийти
                    </button>
                </div>
            </div>

            {/* Modal Overlay for Pallet Builder */}
            {mode === 'palletizing' && (
                <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <PalletBuilder onClose={() => setMode('dashboard')} />
                </div>
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
                                Сканування готових тюків, формування партії та друк етикетки на палету.
                            </p>
                        </button>

                        {/* Card: History (Placeholder) */}
                        <button
                            disabled
                            className="bg-slate-50 p-8 rounded-2xl shadow-sm border border-slate-200 opacity-60 cursor-not-allowed text-left relative overflow-hidden"
                        >
                            <div className="absolute top-4 right-4 text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded">СКОРО</div>
                            <div className="w-14 h-14 bg-slate-200 text-slate-400 rounded-xl flex items-center justify-center mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Історія Партій</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Перегляд раніше відвантажених палет та ре-друк етикеток.
                            </p>
                        </button>
                    </div>


                    {/* Warehouse Stock View */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex justify-between items-center">
                            <span>Готова Продукція (На складі)</span>
                            <span className="text-sm font-normal text-slate-500 bg-white px-3 py-1 rounded-full border">
                                Доступно: {warehouseItems.length}
                            </span>
                        </h2>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-800 font-bold uppercase text-xs border-b border-slate-200">
                                        <tr>
                                            <th className="p-4">№</th>
                                            <th className="p-4">Дата</th>
                                            <th className="p-4">Продукт</th>
                                            <th className="p-4">Сорт</th>
                                            <th className="p-4 text-right">Вага</th>
                                            <th className="p-4 text-center">Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {warehouseItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400">Склад порожній або немає перевірених тюків.</td>
                                            </tr>
                                        ) : (
                                            warehouseItems.map(item => (
                                                <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                                                    <td className="p-4 font-mono font-bold">#{item.serialNumber}</td>
                                                    <td className="p-4">{item.date}</td>
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
