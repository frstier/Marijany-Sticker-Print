import React, { useState, useEffect, useRef, memo } from 'react';
import { PalletService } from '../../services/palletService';
import { Batch, BatchItem } from '../../types/pallet';
import { zebraService } from '../../services/zebraService';
import { usePrinter } from '../../hooks/usePrinter';
import Keypad from '../Keypad';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';
import { PRODUCTS } from '../../constants';

interface PalletBuilderProps {
    onClose: () => void;
}

export default function PalletBuilder({ onClose }: PalletBuilderProps) {
    const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
    const [scanInput, setScanInput] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [availableItems, setAvailableItems] = useState<ProductionItem[]>([]);

    // ID Editing State
    const [isEditingId, setIsEditingId] = useState(false);
    const [tempId, setTempId] = useState('');

    // Filters for pallet formation
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [selectedSort, setSelectedSort] = useState<string>('');

    const scanInputRef = useRef<HTMLInputElement>(null);
    const printerData = usePrinter();

    // Load available items on mount
    useEffect(() => {
        loadAvailableItems();
    }, []);

    const loadAvailableItems = async () => {
        try {
            const items = await ProductionService.getGradedItems();
            setAvailableItems(items);
        } catch (e) {
            console.error("Failed to load items", e);
        }
    };

    // Auto-focus scanner input
    useEffect(() => {
        if (currentBatch && scanInputRef.current) {
            scanInputRef.current.focus();
        }
    }, [currentBatch]);

    const handleStartBatch = () => {
        // Start batch with selected sort
        const newBatch = PalletService.createBatch(selectedSort || "Auto");
        setCurrentBatch(newBatch);
        setError('');
    };

    const handleAddFromStock = (item: ProductionItem) => {
        if (!currentBatch) return;

        // Enforce 20-item limit
        const MAX_ITEMS = 20;
        if (currentBatch.items.length >= MAX_ITEMS) {
            setError(`Максимум ${MAX_ITEMS} бейлів на палету!`);
            return;
        }

        try {
            // Check duplicates in current batch (though UI should prevent it by removing from list)
            if (currentBatch.items.some(i => i.serialNumber === item.serialNumber)) {
                return;
            }

            const batchItem: BatchItem = {
                serialNumber: item.serialNumber,
                weight: item.weight,
                productName: item.productName,
                sort: item.sort || 'Unknown',
                date: item.date,
                productionItemId: item.id // Link to ProductionItem for status updates
            };

            const updated = PalletService.addItemToBatch(currentBatch.id, batchItem);
            setCurrentBatch({ ...updated });

            // Remove from local "Available" list
            setAvailableItems(prev => prev.filter(i => i.id !== item.id));
        } catch (e: any) {
            setError(e.message);
        }
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, item: ProductionItem) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('application/json');
        if (data) {
            try {
                const item = JSON.parse(data);
                handleAddFromStock(item);
            } catch (err) {
                console.error("Drop Error", err);
            }
        }
    };

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanInput || !currentBatch) return;

        // cleanup input
        const rawCode = scanInput.trim();

        // Parse
        const parsedItem = PalletService.parseBarcode(rawCode);

        if (!parsedItem) {
            setError("Невірний формат штрих-коду. Очікується: DATE-SKU-SERIAL-WEIGHT");
            setScanInput('');
            return;
        }

        try {
            const updatedBatch = PalletService.addItemToBatch(currentBatch.id, parsedItem);
            setCurrentBatch({ ...updatedBatch });
            setError('');
        } catch (err: any) {
            setError(err.message || "Помилка додавання.");
        }

        setScanInput('');
    };

    const handleRemoveItem = (serial: number) => {
        if (!currentBatch) return;
        try {
            const updated = PalletService.removeItemFromBatch(currentBatch.id, serial);
            setCurrentBatch({ ...updated });
            // Reload list to get the item back into "Available" if needed
            loadAvailableItems();
        } catch (e) {
            console.error(e);
        }
    };

    // --- ID Edit Handlers ---
    const handleEditIdClick = () => {
        if (!currentBatch) return;
        setTempId(currentBatch.id);
        setIsEditingId(true);
    };

    const handleKeypadPress = (key: string) => {
        setTempId(prev => prev + key);
    };

    const handleKeypadBackspace = () => {
        setTempId(prev => prev.slice(0, -1));
    };

    const handleKeypadClear = () => {
        setTempId('');
    };

    const saveNewId = () => {
        if (!tempId || !currentBatch) return;
        try {
            const updated = PalletService.updateBatchId(currentBatch.id, tempId);
            setCurrentBatch(updated);
            setIsEditingId(false);
        } catch (e: any) {
            alert(e.message);
        }
    };


    const handleFinish = async () => {
        if (!currentBatch) return;

        if (currentBatch.items.length === 0) {
            if (confirm("Палета порожня. Видалити?")) {
                onClose();
            }
            return;
        }

        // Update ProductionItems with batchId and status = 'palletized'
        const itemIds = currentBatch.items
            .map(i => i.productionItemId)
            .filter((id): id is string => !!id);

        if (itemIds.length > 0) {
            await ProductionService.palletizeItems(itemIds, currentBatch.id);
        }

        // Close Batch
        PalletService.closeBatch(currentBatch.id);

        // Generate ZPL
        const zpl = generatePalletLabelZPL(currentBatch);

        // Print
        if (printerData.printer) {
            await zebraService.print(printerData.printer, zpl);
        } else {
            console.log("--- PALLET MOCK PRINT ---");
            console.log(zpl);
            alert(`Палета ${currentBatch.id} сформована! Друк...`);
        }

        onClose();
    };

    // --- ZPL Generator (Local for now) ---
    const generatePalletLabelZPL = (batch: Batch) => {
        return `
^XA
^FO50,50^ADN,36,20^FDMARIJANY HEMP^FS
^FO50,100^ADN,36,20^FDPALLET ID: ${batch.id}^FS
^FO50,150^ADN,36,20^FDSORT: ${batch.sort}^FS
^FO50,200^ADN,36,20^FDDate: ${batch.date.slice(0, 10)}^FS
^FO50,300^GB700,3,3^FS
^FO50,350^ADN,36,20^FDITEMS: ${batch.items.length}^FS
^FO400,350^ADN,36,20^FDTOTAL WEIGHT: ${batch.totalWeight.toFixed(2)} kg^FS
^FO50,450^BCN,100,Y,N,N
^FD${batch.id}^FS
^XZ
        `;
    };

    // --- Render ---

    // RENDER: ID Editing Modal
    if (isEditingId) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full mx-auto animate-fade-in flex flex-col items-center">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Редагування Номеру Палети</h3>
                <div className="w-full bg-slate-100 p-4 rounded-xl text-center text-4xl font-mono font-bold text-blue-800 mb-4 h-20 flex items-center justify-center border-2 border-blue-200">
                    {tempId || <span className="opacity-30">...</span>}
                </div>

                <div className="w-full">
                    <Keypad
                        onKeyPress={handleKeypadPress}
                        onBackspace={handleKeypadBackspace}
                        onClear={handleKeypadClear}
                    />
                </div>

                <div className="flex w-full gap-3 mt-6">
                    <button
                        onClick={() => setIsEditingId(false)}
                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-lg"
                    >
                        Скасувати
                    </button>
                    <button
                        onClick={saveNewId}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg"
                    >
                        Зберегти
                    </button>
                </div>
            </div>
        );
    }

    if (!currentBatch) {
        const nextId = PalletService.getNextBatchNumber();
        const MIN_ITEMS = 12;
        const MAX_ITEMS = 20;

        // Get unique products and sorts from available items
        const uniqueProducts = [...new Set(availableItems.map(i => i.productName))];
        const uniqueSorts = [...new Set(availableItems.map(i => i.sort).filter(Boolean))];

        // Filter items based on selection
        const filteredItems = availableItems.filter(item => {
            if (selectedProduct && item.productName !== selectedProduct) return false;
            if (selectedSort && item.sort !== selectedSort) return false;
            return true;
        });

        const canStart = selectedProduct && selectedSort &&
            filteredItems.length >= MIN_ITEMS && filteredItems.length <= MAX_ITEMS;

        return (
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full mx-auto space-y-6 animate-fade-in max-h-[80vh] flex flex-col overflow-auto">
                <div className="flex justify-between items-center border-b pb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Формування Палети</h2>
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 uppercase">Наступний Номер</span>
                        <span className="text-4xl font-mono font-bold text-blue-600">#{nextId}</span>
                    </div>
                </div>

                {/* Product Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">1. Виберіть Продукцію</label>
                    <div className="grid grid-cols-3 gap-2">
                        {uniqueProducts.map(product => (
                            <button
                                key={product}
                                onClick={() => setSelectedProduct(product)}
                                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${selectedProduct === product
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {product}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sort Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">2. Виберіть Сорт</label>
                    <div className="grid grid-cols-3 gap-2">
                        {uniqueSorts.map(sort => (
                            <button
                                key={sort}
                                onClick={() => setSelectedSort(sort || '')}
                                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${selectedSort === sort
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {sort}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-slate-500">Обрано:</p>
                            <p className="font-bold text-slate-800">
                                {selectedProduct || '—'} / {selectedSort || '—'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Доступно бейлів:</p>
                            <p className={`text-2xl font-bold ${filteredItems.length >= MIN_ITEMS && filteredItems.length <= MAX_ITEMS
                                ? 'text-green-600'
                                : 'text-orange-500'
                                }`}>
                                {filteredItems.length}
                            </p>
                        </div>
                    </div>
                    {selectedProduct && selectedSort && (filteredItems.length < MIN_ITEMS || filteredItems.length > MAX_ITEMS) && (
                        <p className="text-xs text-orange-500 mt-2">
                            ⚠️ Потрібно від {MIN_ITEMS} до {MAX_ITEMS} бейлів ({filteredItems.length} доступно)
                        </p>
                    )}
                </div>

                {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

                <div className="flex gap-3 pt-4">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-medium">Скасувати</button>
                    <button
                        onClick={handleStartBatch}
                        disabled={!canStart}
                        className={`flex-2 w-2/3 py-3 rounded-xl font-bold shadow-lg text-xl transition-all ${canStart
                            ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-900/20'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            }`}
                    >
                        РОЗПОЧАТИ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl max-w-[95vw] w-full mx-auto flex flex-col h-[90vh] animate-fade-in overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                <div
                    onClick={handleEditIdClick}
                    className="cursor-pointer group relative pl-3 border-l-4 border-blue-500 hover:bg-slate-700 rounded-r pr-3 py-1 transition-all"
                >
                    <div className="text-xs opacity-50 uppercase tracking-widest group-hover:text-blue-200">Pallet ID (Edit)</div>
                    <div className="text-3xl font-mono font-bold text-white group-hover:text-blue-300">#{currentBatch.id}</div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-xs">✏️</div>
                </div>
                <div className="text-center flex-1">
                    <span className="text-sm opacity-50 block">DRAG & DROP БЕЙЛИ 👇</span>
                </div>
                <div className="text-right">
                    <div className="text-xs opacity-50 uppercase tracking-widest">Статус</div>
                    <div className="font-bold text-green-400">OPEN</div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Scan & Info (25%) */}
                <div className="w-1/4 bg-slate-50 p-4 border-r border-slate-200 flex flex-col gap-4 z-10 shadow-lg">

                    {/* Scanner Input */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200">
                        <label className="text-xs font-bold text-blue-800 uppercase mb-2 block">Сканер</label>
                        <form onSubmit={handleScan}>
                            <input
                                ref={scanInputRef}
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                placeholder="Scan..."
                                className="w-full bg-slate-100 border-2 border-slate-300 focus:border-blue-500 rounded-lg p-2 font-mono text-lg"
                                autoFocus
                            />
                        </form>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 text-red-800 rounded-xl text-xs border border-red-200 animate-pulse">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Totals */}
                    <div className="mt-auto space-y-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="text-sm text-slate-500">Бейлів</div>
                            <div className="text-3xl font-bold text-slate-800">{currentBatch.items.length}</div>
                        </div>
                        <div className="bg-blue-600 p-4 rounded-xl text-white shadow-lg">
                            <div className="text-sm opacity-80">Вага (кг)</div>
                            <div className="text-4xl font-bold">{currentBatch.totalWeight.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* Center: Drop Zone (45%) */}
                <div
                    className="flex-1 flex flex-col bg-white overflow-hidden relative"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="p-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between shadow-sm z-10">
                        <span>Паллета №{currentBatch.id}</span>
                        <span>{currentBatch.items.length} шт</span>
                    </div>

                    {/* Drop Target Visual */}
                    {currentBatch.items.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-50">
                            <div className="text-6xl mb-4 animate-bounce">⬇️</div>
                            <div className="text-slate-400 font-bold text-xl border-dashed border-4 border-slate-200 p-8 rounded-3xl">
                                Перетягніть бейли сюди
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {currentBatch.items.map((item, idx) => (
                            <div key={idx} className="flex items-center p-2 bg-blue-50 border border-blue-100 rounded-lg shadow-sm hover:border-blue-300 transition-all animate-fade-in group">
                                <div className="w-8 font-mono text-blue-400 text-sm font-bold">{idx + 1}</div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800 text-sm">№ {item.serialNumber}</div>
                                    <div className="text-[10px] text-slate-500">{item.productName}</div>
                                    <div className="text-[9px] font-mono text-slate-400">{item.barcode}</div>
                                </div>
                                <div className="text-right font-mono font-bold text-slate-700 text-sm">
                                    {item.weight.toFixed(1)}
                                </div>
                                <button
                                    onClick={() => handleRemoveItem(item.serialNumber)}
                                    className="ml-2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Stock Source (30%) */}
                <div className="w-1/3 bg-slate-50 flex flex-col border-l border-slate-200">
                    <div className="p-3 bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase flex justify-between items-center shadow-sm z-10">
                        <span>{selectedProduct} / {selectedSort}</span>
                        <span className="bg-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                            {availableItems.filter(i =>
                                (!selectedProduct || i.productName === selectedProduct) &&
                                (!selectedSort || i.sort === selectedSort)
                            ).length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {availableItems
                            .filter(item =>
                                (!selectedProduct || item.productName === selectedProduct) &&
                                (!selectedSort || item.sort === selectedSort)
                            )
                            .map(item => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item)}
                                    className="w-full text-left bg-white p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing transition-all flex justify-between items-center group select-none"
                                >
                                    <div className="pointer-events-none">
                                        <div className="font-bold text-xs text-slate-700">№ {item.serialNumber}</div>
                                        <div className="text-[10px] text-slate-500">{item.productName} ({item.sort})</div>
                                        <div className="text-[9px] font-mono text-slate-400">{item.barcode}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold pointer-events-none">{item.weight}</span>
                                        <button
                                            onClick={() => handleAddFromStock(item)}
                                            className="bg-green-100 hover:bg-green-200 text-green-700 p-1.5 rounded-md transition-colors"
                                            title="Додати до палети"
                                        >
                                            ➕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        {availableItems.filter(i =>
                            (!selectedProduct || i.productName === selectedProduct) &&
                            (!selectedSort || i.sort === selectedSort)
                        ).length === 0 && (
                                <div className="text-center p-4 text-xs text-slate-400">
                                    Немає доступних бейлів
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0 z-20 shadow-[-10px_0_20px_rgba(0,0,0,0.1)]">
                <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors">
                    Скасувати
                </button>

                <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-slate-500 mr-4 hidden md:block">
                        Перевірте вагу та кількість <br /> перед друком
                    </div>
                    <button
                        onClick={handleFinish}
                        disabled={currentBatch.items.length === 0}
                        className={`px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentBatch.items.length === 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-900/20 active:scale-95'
                            }`}
                    >
                        <span>ЗАВЕРШИТИ ТА ДРУКУВАТИ</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
