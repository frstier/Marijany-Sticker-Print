import React, { useState, useEffect } from 'react';
import { ProductionItem } from '../../types/production';
import { ProductionService } from '../../services/productionService';
import { zebraService } from '../../services/zebraService';
import { usePrinter } from '../../hooks/usePrinter';
import { LABEL_SIZES, ZPL_100x100_OFFSET } from '../../constants';
import { getEffectiveTemplate } from '../../utils/templateManager';
import ConfirmDialog from '../ConfirmDialog';

interface PrintHubModalProps {
    onClose: () => void;
}

interface ImportBatch {
    id: string;
    date: string;
    totalCount: number;
    printedCount: number;
    items: ProductionItem[];
}

export default function PrintHubModal({ onClose }: PrintHubModalProps) {
    const [batches, setBatches] = useState<ImportBatch[]>([]);
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Print Queue - items selected for printing
    const [printQueue, setPrintQueue] = useState<ProductionItem[]>([]);

    // Printing State
    const [isPrinting, setIsPrinting] = useState(false);
    const [stopSignal, setStopSignal] = useState(false);
    const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });

    // Dialog states
    const [printConfirm, setPrintConfirm] = useState<{ isOpen: boolean; count: number }>({ isOpen: false, count: 0 });
    const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

    // Drag state
    const [draggedItem, setDraggedItem] = useState<ProductionItem | null>(null);

    const { printer } = usePrinter();

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setIsLoading(true);
        try {
            const allItems = await ProductionService.getAllItems();
            const groups: Record<string, ProductionItem[]> = {};
            allItems.forEach(item => {
                // Only include graded items (passed lab check) with importBatchId
                // Created items are still in Lab, don't show them here
                if (item.importBatchId && (item.status === 'graded' || item.status === 'palletized')) {
                    if (!groups[item.importBatchId]) groups[item.importBatchId] = [];
                    groups[item.importBatchId].push(item);
                }
            });

            const batchList: ImportBatch[] = Object.keys(groups).map(batchId => {
                const items = groups[batchId];
                const datePart = batchId.replace('import_', '');
                const formattedDate = `${datePart.substring(6, 8)}.${datePart.substring(4, 6)}.${datePart.substring(0, 4)} ${datePart.substring(9, 11)}:${datePart.substring(11, 13)}`;

                return {
                    id: batchId,
                    date: formattedDate,
                    totalCount: items.length,
                    printedCount: items.filter(i => i.printedAt).length,
                    items: items.sort((a, b) => a.serialNumber - b.serialNumber)
                };
            });

            setBatches(batchList.sort((a, b) => b.id.localeCompare(a.id)));
            if (batchList.length > 0 && !selectedBatchId) {
                setSelectedBatchId(batchList[0].id);
            }
        } catch (e) {
            console.error("Failed to load batches", e);
        } finally {
            setIsLoading(false);
        }
    };

    const getSelectedBatch = () => batches.find(b => b.id === selectedBatchId);

    // Add item to print queue (click or drop)
    const addToQueue = (item: ProductionItem) => {
        if (item.printedAt) return; // Don't add already printed
        if (printQueue.find(q => q.id === item.id)) return; // Already in queue
        setPrintQueue(prev => [...prev, item]);
    };

    // Remove from queue
    const removeFromQueue = (itemId: string) => {
        setPrintQueue(prev => prev.filter(i => i.id !== itemId));
    };

    // Clear queue
    const clearQueue = () => {
        setPrintQueue([]);
    };

    // Add all unprinted to queue
    const addAllToQueue = () => {
        const batch = getSelectedBatch();
        if (!batch) return;
        const unprinted = batch.items.filter(i => !i.printedAt && !printQueue.find(q => q.id === i.id));
        setPrintQueue(prev => [...prev, ...unprinted]);
    };

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, item: ProductionItem) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedItem) {
            addToQueue(draggedItem);
            setDraggedItem(null);
        }
    };

    // Print Queue
    const requestPrintQueue = () => {
        if (printQueue.length === 0) {
            setAlertDialog({ isOpen: true, message: "Черга друку порожня! Додайте елементи кліком або перетягуванням." });
            return;
        }
        if (!printer) {
            setAlertDialog({ isOpen: true, message: "Принтер не підключений!" });
            return;
        }
        setPrintConfirm({ isOpen: true, count: printQueue.length });
    };

    const handlePrintQueue = async () => {
        setPrintConfirm({ isOpen: false, count: 0 });
        if (!printer || printQueue.length === 0) return;

        setIsPrinting(true);
        setStopSignal(false);
        setPrintProgress({ current: 0, total: printQueue.length });

        const logoPath = import.meta.env.BASE_URL + 'logo_bw.png';
        let logoZpl = '';
        try {
            logoZpl = await zebraService.convertImageToZPL(logoPath, { width: 200, height: 240 });
        } catch (e) { console.warn("Logo load failed", e); }

        const pattern = localStorage.getItem('zebra_barcode_pattern_v1') || '{date}-{sku}-{serialNumber}-{weight}';
        // 'receiving' role is generally used here (Accountant/Receiver)
        let template = await getEffectiveTemplate('100x100', 'receiving');

        let count = 0;
        const printedIds: string[] = [];

        for (const item of printQueue) {
            if (stopSignal) break;

            try {
                const zpl = zebraService.generateZPL(template, {
                    date: item.date,
                    productName: item.productName || 'Product',
                    productNameEn: item.productNameEn,
                    sku: item.barcode?.split('-')[1] || 'SKU',
                    weight: item.weight.toFixed(2),
                    serialNumber: item.serialNumber.toString(),
                    sortLabel: 'Сорт',
                    sortValue: item.sort || '',
                    quantity: 1,
                    logoZpl: logoZpl,
                    barcodePattern: pattern
                });

                const success = await zebraService.print(printer, zpl);

                if (!success) {
                    throw new Error("Printer reported failure");
                }

                const now = new Date().toISOString();
                await ProductionService.setPrintedStatus(item.id, now);
                printedIds.push(item.id);

                // Update batches state
                setBatches(prev => prev.map(b => ({
                    ...b,
                    printedCount: b.items.filter(i => i.printedAt || printedIds.includes(i.id)).length,
                    items: b.items.map(i => i.id === item.id ? { ...i, printedAt: now } : i)
                })));

                count++;
                setPrintProgress({ current: count, total: printQueue.length });

                await new Promise(r => setTimeout(r, 600));
            } catch (e) {
                console.error("Print Error", e);
                // Stop on error to prevent data inconsistency
                setStopSignal(true);
                setAlertDialog({
                    isOpen: true,
                    message: `Помилка друку! Зупинено на елементі #${item.serialNumber}. Перевірте принтер.`
                });
                break;
            }
        }

        // Remove printed items from queue
        setPrintQueue(prev => prev.filter(i => !printedIds.includes(i.id)));
        setIsPrinting(false);
    };

    const batch = getSelectedBatch();
    const availableItems = batch?.items.filter(i => !i.printedAt && !printQueue.find(q => q.id === i.id)) || [];

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full flex flex-col h-[85vh] overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                        <span className="text-2xl text-purple-600">🖨️</span>
                        <div>
                            <div>Менеджер Друку</div>
                            <div className="text-xs text-slate-500 font-normal">Перетягніть або клікніть для додавання до черги</div>
                        </div>
                    </h2>
                    <div className="flex items-center gap-3">
                        {/* Printer Status */}
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${printer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {printer ? `✅ ${printer.name}` : '⚠️ Немає принтера'}
                        </div>
                        <button onClick={onClose} disabled={isPrinting} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500 font-bold">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT: Batch List */}
                    <div className="w-56 border-r bg-slate-50 overflow-y-auto shrink-0">
                        <div className="p-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Імпорт</h3>
                            {isLoading ? (
                                <div className="text-center p-4 text-slate-400 text-sm">...</div>
                            ) : (
                                <div className="space-y-1">
                                    {batches.map(b => (
                                        <div
                                            key={b.id}
                                            onClick={() => !isPrinting && setSelectedBatchId(b.id)}
                                            className={`p-2 rounded-lg cursor-pointer border text-xs transition-all ${selectedBatchId === b.id
                                                ? 'bg-white border-purple-400 shadow-sm'
                                                : 'bg-white border-slate-200 hover:border-purple-200'}`}
                                        >
                                            <div className="font-bold text-slate-700">{b.date}</div>
                                            <div className="text-slate-500 flex justify-between mt-1">
                                                <span>{b.totalCount} шт</span>
                                                <span className={b.printedCount === b.totalCount ? 'text-green-600' : 'text-yellow-600'}>
                                                    {b.printedCount}/{b.totalCount}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {batches.length === 0 && <div className="text-slate-400 text-xs py-2">Немає даних</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CENTER: Available Items */}
                    <div className="flex-1 flex flex-col bg-white border-r">
                        <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-700">Доступні для друку</h3>
                                <p className="text-xs text-slate-500">{availableItems.length} елементів</p>
                            </div>
                            <button
                                onClick={addAllToQueue}
                                disabled={availableItems.length === 0}
                                className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Додати всі →
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-3">
                            <div className="grid grid-cols-3 gap-2">
                                {availableItems.map(item => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item)}
                                        onClick={() => addToQueue(item)}
                                        className="p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-purple-400 hover:shadow-sm transition-all text-xs active:scale-95"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-800">#{item.serialNumber}</span>
                                            <span className="text-slate-400">{item.weight}кг</span>
                                        </div>
                                        <div className="text-slate-500 truncate">{item.productName}</div>
                                    </div>
                                ))}
                                {availableItems.length === 0 && batch && (
                                    <div className="col-span-3 text-center text-slate-400 py-8">
                                        {batch.items.every(i => i.printedAt) ? '✅ Все роздруковано!' : 'Всі в черзі'}
                                    </div>
                                )}
                            </div>
                            {/* Already printed */}
                            {batch && batch.items.some(i => i.printedAt) && (
                                <div className="mt-4 pt-4 border-t">
                                    <h4 className="text-xs font-bold text-slate-400 mb-2">Вже роздруковані</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {batch.items.filter(i => i.printedAt).map(item => (
                                            <span key={item.id} className="px-2 py-1 bg-green-50 text-green-700 rounded text-[10px] font-bold">
                                                #{item.serialNumber} ✓
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Print Queue */}
                    <div
                        className={`w-72 flex flex-col bg-purple-50 shrink-0 transition-all ${draggedItem ? 'ring-2 ring-purple-400 ring-inset' : ''}`}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <div className="p-3 bg-purple-100 border-b border-purple-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-purple-800">🖨️ Черга Друку</h3>
                                <p className="text-xs text-purple-600">{printQueue.length} елементів</p>
                            </div>
                            {printQueue.length > 0 && (
                                <button
                                    onClick={clearQueue}
                                    className="px-2 py-1 bg-purple-200 text-purple-700 rounded text-xs font-bold hover:bg-purple-300"
                                >
                                    Очистити
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto p-3">
                            {printQueue.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-purple-400 text-sm">
                                    <div className="text-4xl mb-2">📥</div>
                                    <p>Перетягніть сюди</p>
                                    <p className="text-xs">або клікніть на елемент</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {printQueue.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            className="p-2 bg-white rounded-lg border border-purple-200 flex justify-between items-center text-xs shadow-sm"
                                        >
                                            <div>
                                                <span className="text-purple-400 mr-1">{idx + 1}.</span>
                                                <span className="font-bold text-slate-800">#{item.serialNumber}</span>
                                                <span className="text-slate-400 ml-2">{item.weight}кг</span>
                                            </div>
                                            <button
                                                onClick={() => removeFromQueue(item.id)}
                                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-red-500"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Print Button */}
                        <div className="p-3 bg-purple-100 border-t border-purple-200">
                            <button
                                onClick={requestPrintQueue}
                                disabled={isPrinting || printQueue.length === 0}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95
                                    ${isPrinting || printQueue.length === 0
                                        ? 'bg-slate-400 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700'}`}
                            >
                                🖨️ Друкувати ({printQueue.length})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Printing Overlay */}
                {isPrinting && (
                    <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center backdrop-blur-md">
                        <div className="w-24 h-24 mb-6 relative animate-pulse">
                            <div className="absolute inset-0 border-8 border-slate-100 rounded-full"></div>
                            <div className="absolute inset-0 border-8 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-3xl">🖨️</div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Друк...</h3>
                        <div className="text-3xl font-mono text-purple-600 mb-6 font-bold">
                            {printProgress.current} / {printProgress.total}
                        </div>
                        <button
                            onClick={() => { setStopSignal(true); setIsPrinting(false); }}
                            className="bg-red-500 text-white px-8 py-3 rounded-full font-bold hover:bg-red-600 transition-colors shadow-lg active:scale-95"
                        >
                            ⛔️ СТОП
                        </button>
                    </div>
                )}

                {/* Print Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={printConfirm.isOpen}
                    title="Розпочати друк?"
                    message={`Ви збираєтесь надрукувати ${printConfirm.count} стікерів.`}
                    confirmText="Друкувати"
                    cancelText="Скасувати"
                    variant="info"
                    onCancel={() => setPrintConfirm({ isOpen: false, count: 0 })}
                    onConfirm={handlePrintQueue}
                />

                {/* Alert Dialog */}
                <ConfirmDialog
                    isOpen={alertDialog.isOpen}
                    title="Увага"
                    message={alertDialog.message}
                    confirmText="OK"
                    cancelText=""
                    variant="warning"
                    onCancel={() => setAlertDialog({ isOpen: false, message: '' })}
                    onConfirm={() => setAlertDialog({ isOpen: false, message: '' })}
                />
            </div>
        </div>
    );
}
