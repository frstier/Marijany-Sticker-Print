import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';

export default function LabInterface() {
    const { logout, currentUser } = useAuth();

    // State
    const [pendingItems, setPendingItems] = useState<ProductionItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null);
    const [selectedSort, setSelectedSort] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Mock Sorts -> Now Dynamic
    // const sorts = ['1 Сорт', '2 Сорт', '3 Сорт', 'Нестандарт', 'Сміття'];

    // Dynamic Sorts based on Product
    const getSortsForProduct = (productName: string) => {
        // Simple mapping based on known names
        if (productName.includes('Костра калібрована') || productName.includes('Hurds Calibrated')) {
            return ['-5.0 +1.5', '-5.0 +0.8', '-1.5 +1.0', '-1.5 +0.8', '-0.8 +0.25', '-1.0', '-0.8', '-0.25', 'Нестандарт'];
        }
        // Fibers (LF, SF)
        if (productName.includes('волокно') || productName.includes('Fiber')) {
            return ['1', '2', '3', '4', 'Нестандарт'];
        }
        // Default / Fallback
        return ['1', '2', '3', 'Нестандарт'];
    };

    const currentSorts = selectedItem ? getSortsForProduct(selectedItem.productName) : [];

    // Load Data
    const loadData = async () => {
        try {
            const items = await ProductionService.getPendingItems();
            setPendingItems(items);
            // If selected item is no longer pending, deselect
            if (selectedItem && !items.find(i => i.id === selectedItem.id)) {
                setSelectedItem(null);
                setSelectedSort('');
            }
        } catch (e) {
            console.error("Failed to load lab items", e);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Handlers
    const handleGrade = async () => {
        if (!selectedItem || !selectedSort) return;
        try {
            await ProductionService.gradeItem(selectedItem.id, selectedSort, currentUser?.id || 'unknown');
            // Refresh list
            loadData();
            setSelectedSort('');
        } catch (e) {
            console.error(e);
            alert("Помилка збереження");
        }
    };

    const filteredItems = pendingItems.filter(item =>
        item.serialNumber.toString().includes(searchQuery) ||
        item.barcode.includes(searchQuery)
    );

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* Header */}
            <div className="bg-purple-900 text-white p-3 md:p-4 flex justify-between items-center shadow-lg shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">L</div>
                    <div>
                        <div className="font-bold text-lg leading-tight">ЛАБОРАТОРІЯ</div>
                        <div className="text-[10px] text-purple-200 tracking-wider">MARIJANY QC</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="opacity-80 text-sm hidden md:inline">{currentUser?.name}</span>
                    <button
                        onClick={logout}
                        className="bg-purple-800 hover:bg-purple-700 px-4 py-2 rounded text-sm transition-colors border border-purple-600"
                    >
                        Вийти
                    </button>
                </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: List */}
                <div className="w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">На Перевірку <span className="text-purple-600">({pendingItems.length})</span></h2>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Пошук по №..."
                            className="w-full p-2 rounded-lg border border-slate-300 focus:border-purple-500 text-sm"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredItems.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Список порожній</div>
                        ) : (
                            filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedItem?.id === item.id ? 'bg-purple-50 border-l-4 border-l-purple-600' : ''}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="font-bold text-slate-800">№ {item.serialNumber}</div>
                                        <div className="text-xs font-mono text-slate-500 bg-slate-100 px-2 rounded">{item.weight} кг</div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-xs text-slate-500">{item.productName} | {item.date}</div>
                                        <div className="text-[10px] uppercase text-purple-400 font-bold tracking-wider">Pending</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Detail & Action */}
                <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-6">
                    {!selectedItem ? (
                        <div className="text-center text-slate-400 max-w-sm">
                            <div className="text-6xl mb-4">👈</div>
                            <h3 className="text-xl font-bold mb-2">Оберіть тюк зі списку</h3>
                            <p>Натисніть на запис зліва, щоб провести експертизу та присвоїти сорт.</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
                            <div className="bg-purple-50 p-6 border-b border-purple-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs font-bold text-purple-600 uppercase mb-1">Обраний Тюк</div>
                                        <div className="text-3xl font-bold text-slate-800">№ {selectedItem.serialNumber}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-4xl font-bold text-slate-800">{selectedItem.weight} <span className="text-lg text-slate-400 font-normal">кг</span></div>
                                    </div>
                                </div>

                                {/* Product Description Block */}
                                <div className="mt-4 bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
                                    <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Продукт</div>
                                    <div className="text-xl font-bold text-slate-800 leading-none">{selectedItem.productName}</div>
                                    {/* Try to find English name from constants if possible, logic or lookup needed if we only have name */}
                                    {/* Ideally we'd map it. Since we don't have direct access here easily without import... let's trust the name is good enough or import PRODUCTS */}
                                </div>

                                <div className="mt-2 text-[10px] font-mono text-slate-400 text-center">
                                    {selectedItem.barcode}
                                </div>
                            </div>

                            <div className="p-8">
                                <label className="block text-center text-sm font-bold text-slate-500 mb-4 uppercase tracking-widest">Оберіть Якість</label>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                    {currentSorts.map(sort => (
                                        <button
                                            key={sort}
                                            onClick={() => setSelectedSort(sort)}
                                            className={`p-4 rounded-xl font-bold transition-all text-sm md:text-base ${selectedSort === sort
                                                ? 'bg-purple-600 text-white shadow-lg scale-105'
                                                : 'bg-white border-2 border-slate-100 text-slate-600 hover:border-purple-300'
                                                }`}
                                        >
                                            {sort}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleGrade}
                                    disabled={!selectedSort}
                                    className={`w-full py-4 rounded-xl font-bold text-xl shadow-xl transition-all flex items-center justify-center gap-3 ${selectedSort
                                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20 active:scale-95'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <span>ПІДТВЕРДИТИ</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
