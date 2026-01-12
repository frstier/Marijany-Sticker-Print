import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PalletService } from '../../services/palletService';
import { Batch, BatchItem } from '../../types/pallet';
import { zebraService } from '../../services/zebraService';
import { usePrinter } from '../../hooks/usePrinter';
import Keypad from '../Keypad';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';

// ======================
// TYPES
// ======================
type PalletMode = 'auto' | 'scan' | 'quick' | 'manual';

// Pallet configuration
const PALLET_SIZE = 12; // Exactly 12 bales per pallet

interface PalletBuilderProps {
    onClose: () => void;
    onComplete?: () => void;
}

interface GeneratedPallet {
    id: string;
    product: string;
    sort: string;
    items: ProductionItem[];
    totalWeight: number;
}

// ======================
// MAIN COMPONENT
// ======================
export default function PalletBuilder({ onClose, onComplete }: PalletBuilderProps) {
    // Mode selection
    const [mode, setMode] = useState<PalletMode | null>(null);

    // Common state
    const [availableItems, setAvailableItems] = useState<ProductionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
    const [error, setError] = useState('');

    const [isEditingId, setIsEditingId] = useState(false);
    const [tempId, setTempId] = useState('');
    const [logoZpl, setLogoZpl] = useState<string>('');

    const printerData = usePrinter();

    // Load logo on mount
    useEffect(() => {
        const loadLogo = async () => {
            try {
                const logoPath = import.meta.env.BASE_URL + 'logo_bw.png';
                const zpl = await zebraService.convertImageToZPL(logoPath, { width: 100, height: 100 });
                setLogoZpl(zpl);
                console.log('Pallet logo loaded');
            } catch (e) {
                console.error('Failed to load pallet logo:', e);
            }
        };
        loadLogo();
    }, []);

    // Compute stats unconditionally (hooks must be called in same order)
    const stats = useMemo(() => {
        const grouped: Record<string, { product: string; sort: string; count: number; weight: number }> = {};
        availableItems.forEach(item => {
            const key = `${item.productName}|${item.sort || 'Unknown'}`;
            if (!grouped[key]) {
                grouped[key] = { product: item.productName, sort: item.sort || 'Unknown', count: 0, weight: 0 };
            }
            grouped[key].count++;
            grouped[key].weight += item.weight;
        });
        return Object.values(grouped);
    }, [availableItems]);

    const canAutoPack = stats.some(s => s.count >= PALLET_SIZE);

    // Load available items on mount
    useEffect(() => {
        loadAvailableItems();
    }, []);

    const loadAvailableItems = async () => {
        try {
            setLoading(true);
            const items = await ProductionService.getGradedItems();
            setAvailableItems(items);
        } catch (e) {
            console.error("Failed to load items", e);
        } finally {
            setLoading(false);
        }
    };

    // ======================
    // COMMON FUNCTIONS
    // ======================
    const handleFinish = async (batch: Batch) => {
        if (batch.items.length === 0) {
            if (confirm("Палета порожня. Видалити?")) {
                onClose();
            }
            return;
        }

        // Update ProductionItems with batchId and status = 'palletized'
        const itemIds = batch.items
            .map(i => i.productionItemId)
            .filter((id): id is string => !!id);

        if (itemIds.length > 0) {
            await ProductionService.palletizeItems(itemIds, batch.id);
        }

        // Close Batch
        await PalletService.closeBatch(batch.id);

        // Generate ZPL
        const zpl = generatePalletLabelZPL(batch);

        // Print
        if (printerData.printer) {
            await zebraService.print(printerData.printer, zpl);
        } else {
            console.log("--- PALLET MOCK PRINT ---");
            console.log(zpl);
        }

        if (onComplete) {
            onComplete();
        }
        onClose();
    };

    const generatePalletLabelZPL = (batch: Batch) => {
        const toHex = (str: string) => {
            if (!str) return "";
            return Array.from(new TextEncoder().encode(str))
                .map(b => "_" + b.toString(16).toUpperCase().padStart(2, "0"))
                .join("");
        };

        const dateStr = batch.date.includes('T') ? batch.date.split('T')[0] : batch.date;
        const displayId = batch.displayId || batch.id;

        // Get product info from first item
        const firstItem = batch.items[0];
        const productName = firstItem?.productName || 'Продукт';
        const productNameEn = ''; // Can be added later if needed
        const sku = firstItem?.sku || '';

        // Generate items list with barcodes (compact, 2 columns)
        const itemsListZpl = batch.items.map((item, idx) => {
            const col = idx < 10 ? 0 : 1;
            const row = idx % 10;
            const x = 30 + (col * 390);
            const y = 220 + (row * 50);
            // Serial + weight text
            const textLine = `^FO${x},${y}^A0N,20,20^FH^FD${idx + 1}. #${item.serialNumber} ${item.weight.toFixed(1)}kg^FS`;
            // Mini barcode below
            const barcodeLine = `^FO${x},${y + 22}^BY1^BCN,25,N,N,N^FD${item.barcode || item.serialNumber}^FS`;
            return textLine + '\n' + barcodeLine;
        }).join('\n');

        return `^XA
^PW800
^LL800
^CI28

^FO30,15^A0N,32,32^FDMARIJANY HEMP^FS
^FO30,50^A0N,18,18^FH^FD${toHex('Дата:')}^FS
^FO100,50^A0N,22,22^FH^FD${dateStr}^FS
^FO30,80^A0N,28,28^FH^FD${toHex(productName)}^FS
^FO30,110^A0N,18,18^FH^FD${productNameEn}^FS
^FO500,15^A0N,24,24^FDPALLET^FS
^FO500,45^A0N,16,16^FDSKU: ${sku}^FS
^FO680,10${logoZpl}^FS

^FO20,140^GB760,2,2^FS

^FO30,150^A0N,20,20^FH^FD${toHex('ID Палети:')}^FS
^FO180,145^A0N,36,36^FH^FD${toHex(displayId)}^FS
^FO500,150^A0N,18,18^FH^FD${toHex('Сорт:')}^FS
^FO580,145^A0N,28,28^FH^FD${toHex(batch.sort)}^FS

^FO20,190^GB760,2,2^FS

${itemsListZpl}

^FO20,720^GB760,2,2^FS

^FO30,730^A0N,22,22^FH^FD${toHex('К-сть:')}^FS
^FO130,725^A0N,32,32^FH^FD${batch.items.length} ${toHex('шт')}^FS
^FO300,730^A0N,22,22^FH^FD${toHex('Вага:')}^FS
^FO400,720^A0N,40,40^FH^FD${batch.totalWeight.toFixed(1)} kg^FS

^FO180,760^BY2
^BCN,30,Y,N,N
^FD${batch.id}^FS

^XZ`;
    };

    // ======================
    // RENDER: Loading
    // ======================
    if (loading) {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-auto text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-slate-500">Завантаження даних...</p>
            </div>
        );
    }

    // ======================
    // RENDER: Mode Selection
    // ======================
    if (!mode) {

        return (
            <div className="bg-white p-6 rounded-2xl shadow-xl max-w-2xl w-full mx-auto animate-fade-in">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-2xl font-bold text-slate-800">🚛 Формування Палети</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
                </div>

                {/* Stats */}
                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                    <div className="text-sm font-bold text-slate-600 mb-2">📦 Доступні бейли для палетизації:</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {stats.length === 0 && <div className="text-slate-400 col-span-2">Немає зградованих бейлів</div>}
                        {stats.map((s, i) => (
                            <div key={i} className="bg-white p-2 rounded-lg border border-slate-200 text-sm">
                                <span className="font-bold">{s.product}</span> / <span className="text-purple-600">{s.sort}</span>
                                <div className="text-xs text-slate-500">{s.count} шт • {s.weight.toFixed(1)} кг</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mode Buttons */}
                <div className="text-sm font-bold text-slate-700 mb-3">Оберіть режим формування:</div>
                <div className="grid grid-cols-2 gap-4">
                    {/* Auto-Pack */}
                    <button
                        onClick={() => setMode('auto')}
                        disabled={!canAutoPack}
                        className={`p-4 rounded-xl text-left transition-all border-2 ${canAutoPack
                            ? 'border-green-200 bg-green-50 hover:border-green-400 hover:shadow-lg'
                            : 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'}`}
                    >
                        <div className="text-2xl mb-2">🤖</div>
                        <div className="font-bold text-slate-800">Auto-Pack</div>
                        <div className="text-xs text-slate-500">Автоматичне групування бейлів по {PALLET_SIZE} шт</div>
                        {!canAutoPack && <div className="text-xs text-orange-500 mt-1">⚠️ Потрібно мін. {PALLET_SIZE} бейлів</div>}
                    </button>

                    {/* Scan-First */}
                    <button
                        onClick={() => setMode('scan')}
                        className="p-4 rounded-xl text-left border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-lg transition-all"
                    >
                        <div className="text-2xl mb-2">📱</div>
                        <div className="font-bold text-slate-800">Scan-First</div>
                        <div className="text-xs text-slate-500">Сканування штрих-кодів для додавання</div>
                    </button>

                    {/* Quick-Add */}
                    <button
                        onClick={() => setMode('quick')}
                        disabled={availableItems.length < PALLET_SIZE}
                        className={`p-4 rounded-xl text-left transition-all border-2 ${availableItems.length >= PALLET_SIZE
                            ? 'border-purple-200 bg-purple-50 hover:border-purple-400 hover:shadow-lg'
                            : 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'}`}
                    >
                        <div className="text-2xl mb-2">⚡</div>
                        <div className="font-bold text-slate-800">Quick-Add</div>
                        <div className="text-xs text-slate-500">Швидке заповнення за критеріями</div>
                        {availableItems.length < PALLET_SIZE && <div className="text-xs text-orange-500 mt-1">⚠️ Потрібно мін. {PALLET_SIZE} бейлів</div>}
                    </button>

                    {/* Manual */}
                    <button
                        onClick={() => setMode('manual')}
                        className="p-4 rounded-xl text-left border-2 border-amber-200 bg-amber-50 hover:border-amber-400 hover:shadow-lg transition-all"
                    >
                        <div className="text-2xl mb-2">✋</div>
                        <div className="font-bold text-slate-800">Manual</div>
                        <div className="text-xs text-slate-500">Ручний режим з Drag & Drop</div>
                    </button>
                </div>
            </div>
        );
    }

    // ======================
    // RENDER: Modes
    // ======================
    return (
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-auto overflow-hidden animate-fade-in">
            {/* Mode Header */}
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                <button onClick={() => setMode(null)} className="text-slate-300 hover:text-white flex items-center gap-2">
                    <span>←</span>
                    <span>Назад</span>
                </button>
                <div className="font-bold">
                    {mode === 'auto' && '🤖 Auto-Pack'}
                    {mode === 'scan' && '📱 Scan-First'}
                    {mode === 'quick' && '⚡ Quick-Add'}
                    {mode === 'manual' && '✋ Manual Mode'}
                </div>
                <button onClick={onClose} className="text-slate-300 hover:text-white text-xl">✕</button>
            </div>

            {/* Mode Content */}
            <div className="p-6">
                {mode === 'auto' && (
                    <AutoPackMode
                        availableItems={availableItems}
                        onFinish={handleFinish}
                        onClose={() => setMode(null)}
                        generateZPL={generatePalletLabelZPL}
                        printer={printerData.printer}
                    />
                )}
                {mode === 'scan' && (
                    <ScanFirstMode
                        availableItems={availableItems}
                        setAvailableItems={setAvailableItems}
                        onFinish={handleFinish}
                        onClose={() => setMode(null)}
                    />
                )}
                {mode === 'quick' && (
                    <QuickAddMode
                        availableItems={availableItems}
                        onFinish={handleFinish}
                        onClose={() => setMode(null)}
                    />
                )}
                {mode === 'manual' && (
                    <ManualMode
                        availableItems={availableItems}
                        setAvailableItems={setAvailableItems}
                        onFinish={handleFinish}
                        onClose={() => setMode(null)}
                    />
                )}
            </div>
        </div>
    );
}

// ======================
// AUTO-PACK MODE
// ======================
interface AutoPackModeProps {
    availableItems: ProductionItem[];
    onFinish: (batch: Batch) => Promise<void>;
    onClose: () => void;
    generateZPL: (batch: Batch) => string;
    printer: any;
}

function AutoPackMode({ availableItems, onFinish, onClose, generateZPL, printer }: AutoPackModeProps) {
    const [generatedPallets, setGeneratedPallets] = useState<GeneratedPallet[]>([]);
    const [selectedPallet, setSelectedPallet] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        generatePallets();
    }, []);

    const generatePallets = () => {
        // Group items by product + sort
        const grouped: Record<string, ProductionItem[]> = {};
        availableItems.forEach(item => {
            const key = `${item.productName}|${item.sort || 'Unknown'}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        const pallets: GeneratedPallet[] = [];
        let palletCounter = 1;

        Object.entries(grouped).forEach(([key, items]) => {
            const [product, sort] = key.split('|');

            // Sort by weight for optimal distribution
            const sorted = [...items].sort((a, b) => b.weight - a.weight);

            // Create pallets of exactly PALLET_SIZE items
            while (sorted.length >= PALLET_SIZE) {
                const palletItems = sorted.splice(0, PALLET_SIZE);
                const totalWeight = palletItems.reduce((sum, i) => sum + i.weight, 0);

                pallets.push({
                    id: `P-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(palletCounter++).padStart(3, '0')}`,
                    product,
                    sort,
                    items: palletItems,
                    totalWeight
                });
            }
        });

        setGeneratedPallets(pallets);
    };

    const handleConfirmPallet = async (palletIndex: number) => {
        setProcessing(true);
        const pallet = generatedPallets[palletIndex];

        try {
            // Create Batch with custom ID from pallet
            let currentBatch = await PalletService.createBatch(pallet.sort, pallet.id);

            for (const item of pallet.items) {
                const batchItem: BatchItem = {
                    serialNumber: item.serialNumber,
                    weight: item.weight,
                    productName: item.productName,
                    sort: item.sort || 'Unknown',
                    date: item.date,
                    productionItemId: item.id
                };
                // Update currentBatch with the returned value
                currentBatch = await PalletService.addItemToBatch(currentBatch.id, batchItem);
            }
            // Pass the fully updated batch to onFinish
            await onFinish(currentBatch);
        } catch (e) {
            console.error("AutoPack Failed", e);
            alert("Помилка авто-формування: " + (e instanceof Error ? e.message : "Unknown"));
        }

        finally {
            setProcessing(false);
        }
    };

    if (generatedPallets.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-slate-500">Недостатньо бейлів для автоматичного формування.</p>
                <p className="text-sm text-slate-400">Потрібно мінімум 12 бейлів одного сорту.</p>
                <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-200 rounded-lg">Назад</button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="text-sm text-slate-500 mb-4">
                ✅ Система автоматично згрупувала бейли в {generatedPallets.length} палет(и). Оберіть палету для підтвердження:
            </div>

            <div className="grid gap-4">
                {generatedPallets.map((pallet, idx) => (
                    <div
                        key={pallet.id}
                        onClick={() => setSelectedPallet(selectedPallet === idx ? null : idx)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPallet === idx
                            ? 'border-green-500 bg-green-50 shadow-lg'
                            : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="font-bold text-lg">{pallet.product} / {pallet.sort}</div>
                                <div className="text-sm text-slate-500">ID: {pallet.id}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">{pallet.items.length} шт</div>
                                <div className="text-sm text-slate-500">{pallet.totalWeight.toFixed(2)} кг</div>
                            </div>
                        </div>

                        {selectedPallet === idx && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="text-xs font-bold text-slate-500 mb-2">Бейли в палеті:</div>
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                    {pallet.items.map(item => (
                                        <div key={item.id} className="text-xs bg-white p-2 rounded border">
                                            #{item.serialNumber} • {item.weight} кг
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleConfirmPallet(idx); }}
                                    disabled={processing}
                                    className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold disabled:opacity-50"
                                >
                                    {processing ? '⏳ Обробка...' : '✅ Підтвердити та Друкувати'}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ======================
// SCAN-FIRST MODE
// ======================
interface ScanFirstModeProps {
    availableItems: ProductionItem[];
    setAvailableItems: React.Dispatch<React.SetStateAction<ProductionItem[]>>;
    onFinish: (batch: Batch) => Promise<void>;
    onClose: () => void;
}

function ScanFirstMode({ availableItems, setAvailableItems, onFinish, onClose }: ScanFirstModeProps) {
    const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
    const [scanInput, setScanInput] = useState('');
    const [error, setError] = useState('');
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // ScanFirstMode
    useEffect(() => {
        // Auto-start batch
        const initBatch = async () => {
            const batch = await PalletService.createBatch('Auto');
            setCurrentBatch(batch);
        };
        initBatch();
    }, []);

    // ... (lines 523-527 unchanged)

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentBatch || !scanInput.trim()) return;

        // Parse barcode to find serial number
        const parts = scanInput.split('-');
        const serialNum = parts.length >= 3 ? parseInt(parts[2]) : parseInt(scanInput);

        const item = availableItems.find(i => i.serialNumber === serialNum || i.barcode === scanInput);

        if (!item) {
            setError('❌ Бейл не знайдено');
            playSound('error');
            setTimeout(() => setError(''), 2000);
        } else if (currentBatch.items.some(i => i.serialNumber === item.serialNumber)) {
            setError('⚠️ Вже додано');
            playSound('error');
            setTimeout(() => setError(''), 2000);
        } else if (currentBatch.items.length >= PALLET_SIZE) {
            setError(`⚠️ Палета заповнена (${PALLET_SIZE} бейлів)!`);
            playSound('error');
            setTimeout(() => setError(''), 2000);
        } else if (currentBatch.items.length > 0 && item.sort !== currentBatch.sort) {
            setError(`❌ Сорт "${item.sort}" не збігається з "${currentBatch.sort}"!`);
            playSound('error');
            setTimeout(() => setError(''), 3000);
        } else {
            // Add item
            const batchItem: BatchItem = {
                serialNumber: item.serialNumber,
                weight: item.weight,
                productName: item.productName,
                sort: item.sort || 'Unknown',
                date: item.date,
                productionItemId: item.id
            };

            // Set sort from first item
            if (currentBatch.items.length === 0) {
                currentBatch.sort = item.sort || 'Auto';
            }

            try {
                const updated = await PalletService.addItemToBatch(currentBatch.id, batchItem);
                setCurrentBatch({ ...updated });
                setAvailableItems(prev => prev.filter(i => i.id !== item.id));
                setLastScanned(`✅ #${item.serialNumber} додано`);
                playSound('success');
                setTimeout(() => setLastScanned(null), 1500);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Помилка додавання");
                playSound('error');
            }
        }

        setScanInput('');
    };
    const playSound = (type: 'success' | 'error') => {
        // Simple beep simulation via Web Audio API
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = type === 'success' ? 800 : 300;
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    };

    const handleRemoveItem = (serial: number) => {
        if (!currentBatch) return;
        const item = currentBatch.items.find(i => i.serialNumber === serial);
        if (item) {
            // Return to available
            const returnItem: ProductionItem = {
                id: item.productionItemId || String(serial),
                barcode: '',
                date: item.date,
                productName: item.productName,
                serialNumber: item.serialNumber,
                weight: item.weight,
                status: 'graded',
                sort: item.sort
            };
            setAvailableItems(prev => [...prev, returnItem]);
        }

        const updated = { ...currentBatch };
        updated.items = updated.items.filter(i => i.serialNumber !== serial);
        updated.totalWeight = updated.items.reduce((sum, i) => sum + i.weight, 0);
        setCurrentBatch(updated);
    };

    if (!currentBatch) {
        return <div className="text-center text-slate-500">Завантаження...</div>;
    }

    const canFinish = currentBatch.items.length === PALLET_SIZE;

    return (
        <div className="space-y-4">
            {/* Scanner Input */}
            <form onSubmit={handleScan} className="relative">
                <input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    placeholder="📷 Сканувати штрих-код..."
                    className="w-full p-4 text-xl font-mono border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    autoFocus
                />
                {lastScanned && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 font-bold animate-pulse">
                        {lastScanned}
                    </div>
                )}
            </form>

            {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-xl text-center font-bold animate-shake">
                    {error}
                </div>
            )}

            {/* Stats Bar */}
            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
                <div>
                    <div className="text-sm text-slate-500">Сорт</div>
                    <div className="font-bold text-lg">{currentBatch.sort}</div>
                </div>
                <div className="text-center">
                    <div className="text-sm text-slate-500">Бейлів</div>
                    <div className={`text-3xl font-bold ${currentBatch.items.length === PALLET_SIZE ? 'text-green-600' : 'text-orange-500'}`}>
                        {currentBatch.items.length}/{PALLET_SIZE}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-500">Вага</div>
                    <div className="font-bold text-lg">{currentBatch.totalWeight.toFixed(2)} кг</div>
                </div>
            </div>

            {/* Items List */}
            <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-xl">
                {currentBatch.items.length === 0 && (
                    <div className="text-center text-slate-400 py-8">
                        👆 Скануйте бейли для додавання
                    </div>
                )}
                {currentBatch.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center font-bold">
                                {idx + 1}
                            </span>
                            <div>
                                <div className="font-bold">#{item.serialNumber}</div>
                                <div className="text-xs text-slate-500">{item.productName}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-mono font-bold">{item.weight.toFixed(1)} кг</span>
                            <button
                                onClick={() => handleRemoveItem(item.serialNumber)}
                                className="text-red-400 hover:text-red-600 p-1"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-medium">
                    Скасувати
                </button>
                <button
                    onClick={() => onFinish(currentBatch)}
                    disabled={!canFinish}
                    className={`flex-2 py-3 px-6 rounded-xl font-bold ${canFinish
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    {canFinish ? '✅ Завершити та Друкувати' : `⚠️ Потрібно ${PALLET_SIZE} бейлів (${currentBatch.items.length}/${PALLET_SIZE})`}
                </button>
            </div>
        </div>
    );
}

// ======================
// QUICK-ADD MODE
// ======================
interface QuickAddModeProps {
    availableItems: ProductionItem[];
    onFinish: (batch: Batch) => Promise<void>;
    onClose: () => void;
}

function QuickAddMode({ availableItems, onFinish, onClose }: QuickAddModeProps) {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedSort, setSelectedSort] = useState('');
    const [quantity, setQuantity] = useState(PALLET_SIZE);
    const [preview, setPreview] = useState<ProductionItem[]>([]);
    const [confirmed, setConfirmed] = useState(false);

    const uniqueProducts = [...new Set(availableItems.map(i => i.productName))];
    const uniqueSorts = [...new Set(availableItems.filter(i => !selectedProduct || i.productName === selectedProduct).map(i => i.sort).filter(Boolean))];

    const filteredItems = availableItems.filter(item => {
        if (selectedProduct && item.productName !== selectedProduct) return false;
        if (selectedSort && item.sort !== selectedSort) return false;
        return true;
    });

    const handleGenerate = () => {
        const selected = filteredItems.slice(0, PALLET_SIZE);
        setPreview(selected);
        setConfirmed(true);
    };

    const handleConfirm = async () => {
        if (preview.length !== PALLET_SIZE) return;

        try {
            let currentBatch = await PalletService.createBatch(selectedSort || 'Auto');

            for (const item of preview) {
                const batchItem: BatchItem = {
                    serialNumber: item.serialNumber,
                    weight: item.weight,
                    productName: item.productName,
                    sort: item.sort || 'Unknown',
                    date: item.date,
                    productionItemId: item.id
                };
                currentBatch = await PalletService.addItemToBatch(currentBatch.id, batchItem);
            }

            await onFinish(currentBatch);
        } catch (e) {
            console.error("QuickAdd Failed", e);
            alert("Помилка при створенні палети: " + (e instanceof Error ? e.message : "Unknown"));
        }
    };

    if (!confirmed) {
        return (
            <div className="space-y-6">
                <div className="text-sm text-slate-500">
                    ⚡ Швидко заповніть палету обравши продукт, сорт та кількість:
                </div>

                {/* Product */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">1. Продукт</label>
                    <div className="flex flex-wrap gap-2">
                        {uniqueProducts.map(p => (
                            <button
                                key={p}
                                onClick={() => { setSelectedProduct(p); setSelectedSort(''); }}
                                className={`px-4 py-2 rounded-lg ${selectedProduct === p
                                    ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sort */}
                {selectedProduct && (
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">2. Сорт</label>
                        <div className="flex flex-wrap gap-2">
                            {uniqueSorts.map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSelectedSort(s || '')}
                                    className={`px-4 py-2 rounded-lg ${selectedSort === s
                                        ? 'bg-purple-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quantity */}
                {selectedSort && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="text-center">
                            <div className="text-sm text-slate-500 mb-1">Кількість бейлів на палету</div>
                            <div className="text-4xl font-bold text-blue-600">{PALLET_SIZE}</div>
                            <div className="text-xs text-slate-400 mt-1">Доступно: {filteredItems.length} бейлів</div>
                        </div>
                    </div>
                )}

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={!selectedProduct || !selectedSort || filteredItems.length < PALLET_SIZE}
                    className={`w-full py-4 rounded-xl font-bold text-lg ${selectedProduct && selectedSort && filteredItems.length >= PALLET_SIZE
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    Згенерувати Палету
                </button>
            </div>
        );
    }

    // Preview
    const totalWeight = preview.reduce((sum, i) => sum + i.weight, 0);

    return (
        <div className="space-y-4">
            <div className="text-sm text-slate-500">
                ✅ Підготовлено палету з {preview.length} бейлів. Перегляньте та підтвердіть:
            </div>

            <div className="flex justify-between items-center bg-green-50 border border-green-200 p-4 rounded-xl">
                <div>
                    <div className="font-bold text-lg">{selectedProduct} / {selectedSort}</div>
                    <div className="text-sm text-slate-500">{preview.length} бейлів</div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{totalWeight.toFixed(2)} кг</div>
                </div>
            </div>

            <div className="max-h-48 overflow-y-auto grid grid-cols-4 gap-2">
                {preview.map(item => (
                    <div key={item.id} className="text-xs bg-white p-2 rounded border border-slate-200">
                        #{item.serialNumber} • {item.weight} кг
                    </div>
                ))}
            </div>

            <div className="flex gap-3">
                <button onClick={() => setConfirmed(false)} className="flex-1 py-3 text-slate-500 font-medium">
                    ← Назад
                </button>
                <button
                    onClick={handleConfirm}
                    className="flex-2 py-3 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"
                >
                    ✅ Підтвердити та Друкувати
                </button>
            </div>
        </div>
    );
}

// ======================
// MANUAL MODE (Original)
// ======================
interface ManualModeProps {
    availableItems: ProductionItem[];
    setAvailableItems: React.Dispatch<React.SetStateAction<ProductionItem[]>>;
    onFinish: (batch: Batch) => Promise<void>;
    onClose: () => void;
}

function ManualMode({ availableItems, setAvailableItems, onFinish, onClose }: ManualModeProps) {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedSort, setSelectedSort] = useState('');
    const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
    const [error, setError] = useState('');

    const uniqueProducts = [...new Set(availableItems.map(i => i.productName))];
    const uniqueSorts = [...new Set(availableItems.map(i => i.sort).filter(Boolean))];

    const filteredItems = availableItems.filter(item => {
        if (selectedProduct && item.productName !== selectedProduct) return false;
        if (selectedSort && item.sort !== selectedSort) return false;
        return true;
    });

    const handleStartBatch = async () => {
        const batch = await PalletService.createBatch(selectedSort || 'Auto');
        setCurrentBatch(batch);
    };

    const handleAddItem = async (item: ProductionItem) => {
        if (!currentBatch) return;
        if (currentBatch.items.length >= PALLET_SIZE) {
            setError(`Палета заповнена (${PALLET_SIZE} бейлів)!`);
            return;
        }

        // Validate sort - all items must be same sort
        if (currentBatch.items.length > 0 && item.sort !== currentBatch.sort) {
            setError(`Сорт "${item.sort}" не збігається з "${currentBatch.sort}"!`);
            return;
        }

        const batchItem: BatchItem = {
            serialNumber: item.serialNumber,
            weight: item.weight,
            productName: item.productName,
            sort: item.sort || 'Unknown',
            date: item.date,
            productionItemId: item.id
        };

        try {
            const updated = await PalletService.addItemToBatch(currentBatch.id, batchItem);
            if (updated && updated.items) {
                setCurrentBatch({ ...updated });
                setAvailableItems(prev => prev.filter(i => i.id !== item.id));
            } else {
                setError("Помилка оновлення палети. Спробуйте ще раз.");
            }
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Критична помилка додавання");
        }
    };

    const handleRemoveItem = (serial: number) => {
        if (!currentBatch) return;
        const item = currentBatch.items.find(i => i.serialNumber === serial);
        if (item) {
            const returnItem: ProductionItem = {
                id: item.productionItemId || String(serial),
                barcode: '',
                date: item.date,
                productName: item.productName,
                serialNumber: item.serialNumber,
                weight: item.weight,
                status: 'graded',
                sort: item.sort
            };
            setAvailableItems(prev => [...prev, returnItem]);
        }

        const updated = { ...currentBatch };
        updated.items = updated.items.filter(i => i.serialNumber !== serial);
        updated.totalWeight = updated.items.reduce((sum, i) => sum + i.weight, 0);
        setCurrentBatch(updated);
    };

    const handleDragStart = (e: React.DragEvent, item: ProductionItem) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('application/json');
        if (data) {
            const item = JSON.parse(data) as ProductionItem;
            handleAddItem(item);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Before batch started
    if (!currentBatch) {
        const canStart = selectedProduct && selectedSort && filteredItems.length >= 12;

        return (
            <div className="space-y-4">
                <div className="text-sm text-slate-500">
                    ✋ Виберіть продукт та сорт, потім перетягуйте бейли вручну:
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Продукт</label>
                        <select
                            value={selectedProduct}
                            onChange={e => setSelectedProduct(e.target.value)}
                            className="w-full p-3 border rounded-lg"
                        >
                            <option value="">Оберіть...</option>
                            {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Сорт</label>
                        <select
                            value={selectedSort}
                            onChange={e => setSelectedSort(e.target.value)}
                            className="w-full p-3 border rounded-lg"
                        >
                            <option value="">Оберіть...</option>
                            {uniqueSorts.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl">
                    <span className="text-sm text-slate-500">Доступно: </span>
                    <span className={`font-bold ${filteredItems.length >= 12 ? 'text-green-600' : 'text-orange-500'}`}>
                        {filteredItems.length} бейлів
                    </span>
                </div>

                <button
                    onClick={handleStartBatch}
                    disabled={!canStart}
                    className={`w-full py-4 rounded-xl font-bold ${canStart
                        ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    Розпочати формування
                </button>
            </div>
        );
    }

    // Drag and Drop UI
    return (
        <div className="space-y-4">
            {error && <div className="p-2 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-2 gap-4 h-80">
                {/* Drop Zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-blue-300 rounded-xl p-4 bg-blue-50 overflow-y-auto"
                >
                    <div className="text-sm font-bold text-blue-600 mb-2">
                        🎯 Палета ({currentBatch.items.length}/20)
                    </div>
                    {currentBatch.items.length === 0 && (
                        <div className="text-center text-slate-400 py-10">
                            Перетягніть бейли сюди →
                        </div>
                    )}
                    {currentBatch.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-white rounded mb-1">
                            <span className="text-sm font-bold">#{item.serialNumber}</span>
                            <span className="text-xs text-slate-500">{item.weight} кг</span>
                            <button onClick={() => handleRemoveItem(item.serialNumber)} className="text-red-400 hover:text-red-600">✕</button>
                        </div>
                    ))}
                </div>

                {/* Available Items */}
                <div className="border rounded-xl p-4 bg-slate-50 overflow-y-auto">
                    <div className="text-sm font-bold text-slate-600 mb-2">
                        📦 Доступні ({filteredItems.length})
                    </div>
                    {filteredItems.map(item => (
                        <div
                            key={item.id}
                            draggable
                            onDragStart={e => handleDragStart(e, item)}
                            onClick={() => handleAddItem(item)}
                            className="flex justify-between items-center p-2 bg-white rounded mb-1 cursor-grab hover:bg-slate-100"
                        >
                            <span className="text-sm font-bold">#{item.serialNumber}</span>
                            <span className="text-xs text-slate-500">{item.weight} кг</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
                <div>
                    <span className="text-sm text-slate-500">Вага: </span>
                    <span className="font-bold text-lg">{currentBatch.totalWeight.toFixed(2)} кг</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500">Скасувати</button>
                    <button
                        onClick={() => onFinish(currentBatch)}
                        disabled={currentBatch.items.length < 12}
                        className={`px-6 py-2 rounded-xl font-bold ${currentBatch.items.length >= 12
                            ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        Завершити
                    </button>
                </div>
            </div>
        </div>
    );
}
