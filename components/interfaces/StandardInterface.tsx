import React, { useState, useEffect, useRef } from 'react';
import { Product, LabelData, LabelSizeConfig } from '../../types';
import { PRODUCTS, LABEL_SIZES, INITIAL_SERIAL, ZPL_100x100_OFFSET } from '../../constants';
import { zebraService } from '../../services/zebraService';
import { DataManager } from '../../services/dataManager';
import { ProductionService } from '../../services/productionService';

// Components
import Keypad from '../Keypad';
import LabelPreview from '../LabelPreview';
import ProductSelect from '../ProductSelect';
import SortSelect from '../SortSelect';
import Header from '../Header';
import SettingsModal from '../SettingsModal';
import { PrinterIcon, QueueListIcon } from '../Icons';
import DeferredPrintModal from '../DeferredPrintModal';
import ShiftCloseConfirmModal from '../ShiftCloseConfirmModal';
import PrintHistoryModal from '../PrintHistoryModal';

// Hooks
import { usePrinter } from '../../hooks/usePrinter';
import { useHistory } from '../../hooks/useHistory';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useData';
import { useDeferredPrint } from '../../hooks/useDeferredPrint';

// Services
import { shiftService, Shift, ShiftSummary } from '../../services/shiftService';
import { getEffectiveTemplate } from '../../utils/templateManager';

const LOCAL_STORAGE_COUNTERS_KEY = 'zebra_product_counters_v1';

export default function StandardInterface() {
    // --- Auth ---
    const { currentUser, login, logout, isAdmin } = useAuth();

    // --- State ---
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [weight, setWeight] = useState<string>('');
    const [productCounters, setProductCounters] = useState<Record<string, number>>({});

    // Serial Edits
    const [isSerialEditing, setIsSerialEditing] = useState(false);
    const [tempSerialInput, setTempSerialInput] = useState<string>("");

    // Label Size & Settings UI
    const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSizeConfig>(LABEL_SIZES[0]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);

    // Shift Management
    const [activeShift, setActiveShift] = useState<Shift | null>(() => shiftService.getCurrentShift());
    const [showShiftOpenModal, setShowShiftOpenModal] = useState(false);
    const [showShiftConfirmModal, setShowShiftConfirmModal] = useState(false);
    const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [shiftCloseData, setShiftCloseData] = useState<{ shift: Shift; summary: ShiftSummary; emailStatus?: { success: boolean, message: string }, file?: File } | null>(null);

    // Barcode Pattern State (Moved to Top)
    const [barcodePattern, setBarcodePattern] = useState(() => {
        try {
            return localStorage.getItem('zebra_barcode_pattern_v1') || '{date}-{sku}-{serialNumber}-{weight}';
        } catch (e) {
            console.error("LocalStorage error:", e);
            return '{date}-{sku}-{serialNumber}-{weight}';
        }
    });

    // Hooks
    const printerData = usePrinter();
    const historyData = useHistory();
    const deferredData = useDeferredPrint();
    const { products: availableProducts, isLoading: isDataLoading } = useData();

    // Refs
    const lastClickTimeRef = useRef<number>(0);
    const printClickCountRef = useRef(0);
    const printTimerRef = useRef<NodeJS.Timeout | null>(null);

    const today = new Date().toLocaleDateString('uk-UA');

    // --- Derived State: Logos & Sort ---
    const [selectedSort, setSelectedSort] = useState<string>('');
    const [logoZplSmall, setLogoZplSmall] = useState<string>('');
    const [logoZplLarge, setLogoZplLarge] = useState<string>('');

    // --- Effects ---

    // 1. Load Logos
    useEffect(() => {
        const prepareLogos = async () => {
            try {
                const logoPath = import.meta.env.BASE_URL + 'logo_bw.png';
                const small = await zebraService.convertImageToZPL(logoPath, { width: 80, height: 80 });
                setLogoZplSmall(small);
                const large = await zebraService.convertImageToZPL(logoPath, { width: 200, height: 200 }); // Square logo
                setLogoZplLarge(large);
                console.log("Logos converted to ZPL successfully");
            } catch (e) {
                console.error("Failed to convert logos:", e);
            }
        };
        prepareLogos();
    }, []);

    // 2. Sort Default
    useEffect(() => {
        if (selectedProduct?.sorts && selectedProduct.sorts.length > 0) {
            setSelectedSort(selectedProduct.sorts[0]);
        } else {
            setSelectedSort("");
        }
    }, [selectedProduct]);

    // 2.5 Sync Serial from DB on Product Change (for Operator)
    useEffect(() => {
        const syncSerialFromDB = async () => {
            if (!selectedProduct) return;
            // Only sync if current counter equals INITIAL_SERIAL (meaning it wasn't manually set)
            // Or always sync to get the latest max? Let's always sync for consistency.
            try {
                const maxSerial = await ProductionService.getMaxSerialNumber(selectedProduct.name);
                if (maxSerial > 0) {
                    // Set counter to max + 1
                    setProductCounters(prev => {
                        const currentVal = prev[selectedProduct.id] ?? INITIAL_SERIAL;
                        // Only update if DB has higher, don't override manual edits
                        if (maxSerial >= currentVal) {
                            console.log(`🔄 Syncing serial for ${selectedProduct.name}: DB max=${maxSerial}, setting to ${maxSerial + 1}`);
                            return { ...prev, [selectedProduct.id]: maxSerial + 1 };
                        }
                        return prev;
                    });
                }
            } catch (e) {
                console.error("Failed to sync serial from DB", e);
            }
        };
        syncSerialFromDB();
    }, [selectedProduct]);

    // 3. Counters Loading/Sync
    useEffect(() => {
        try {
            const savedCounters = localStorage.getItem(LOCAL_STORAGE_COUNTERS_KEY);
            if (savedCounters) {
                setProductCounters(JSON.parse(savedCounters));
            } else {
                const initial: Record<string, number> = {};
                // Use availableProducts if loaded, otherwise fallback to PRODUCTS constant for safety
                const list = availableProducts.length > 0 ? availableProducts : PRODUCTS;
                list.forEach(p => initial[p.id] = INITIAL_SERIAL);
                setProductCounters(initial);
            }
        } catch (e) { console.error("Failed to load counters", e); }
    }, [availableProducts]);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === LOCAL_STORAGE_COUNTERS_KEY && e.newValue) {
                setProductCounters(JSON.parse(e.newValue));
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_COUNTERS_KEY, JSON.stringify(productCounters));
        } catch (e) { console.error(e); }

    }, [productCounters]);

    // Shift Check on Mount
    useEffect(() => {
        if (!activeShift && currentUser?.role === 'operator') {
            setShowShiftOpenModal(true);
        }
    }, [currentUser, activeShift]);

    // Handlers
    const handleShiftOpen = () => {
        if (currentUser) {
            try {
                const shift = shiftService.openShift(currentUser);
                setActiveShift(shift);
                setShowShiftOpenModal(false);
            } catch (e: any) {
                alert(e.message);
            }
        }
    };

    const handleShiftCloseRequest = () => {
        setShowShiftConfirmModal(true);
    };

    const confirmShiftClose = async () => {
        try {
            const result = shiftService.closeShift();
            setShowShiftConfirmModal(false);

            // Send Email Report and get status
            const emailResult = await historyData.sendEmail(result.shift.prints);

            setShiftCloseData({
                ...result,
                emailStatus: { success: emailResult.success, message: emailResult.message },
                file: emailResult.file
            });
            setActiveShift(null);
            setShowShiftCloseModal(true);
        } catch (e: any) {
            alert(e.message);
        }
    };


    // Derived State for Current Product
    const currentSerialNumber = selectedProduct ? (productCounters[selectedProduct.id] ?? INITIAL_SERIAL) : INITIAL_SERIAL;

    // --- Logic: Preview Restraints ---

    // 1. Sort Logic
    // Default: Show Sort Label, Value is empty
    let previewSortLabel = "Sort";
    let previewSortValue = "____";

    // Logic checks
    const isOperator = currentUser?.role === 'operator';
    const isShiv = selectedProduct?.category === 'shiv';
    const isShivCalibrated = selectedProduct?.id === '3'; // specific check for "Костра калібрована"

    if (selectedProduct) {
        if (isShiv) {
            previewSortLabel = "Fract";
        }

        // Value Logic:
        // Operator: ONLY sees value if it is Shiv Calibrated
        // Others (Lab/Accountant): ALWAYS see value if selected
        let shouldShowSortValue = false;

        if (isOperator) {
            if (isShivCalibrated) {
                shouldShowSortValue = true;
            }
        } else {
            // Admin, Lab, Accountant
            shouldShowSortValue = true;
        }

        if (shouldShowSortValue && selectedSort) {
            previewSortValue = selectedSort;
        }
    }

    const labelData: LabelData = {
        product: selectedProduct,
        weight,
        serialNumber: currentSerialNumber,
        date: today,
        sortLabel: previewSortLabel,
        sortValue: previewSortValue
    };

    // --- Handlers ---

    const handleWeightKeyPress = (key: string) => {
        if (key === '.' && weight.includes('.')) return;
        if (weight.length > 6) return;
        setWeight(prev => prev + key);
    };

    const handleEditIconClick = () => {
        if (!selectedProduct) return;

        // Operator: Double-click protection
        if (currentUser?.role === 'operator') {
            const now = Date.now();
            if (now - lastClickTimeRef.current < 1000) { // 1 second window
                setIsSerialEditing(true);
                setTempSerialInput(currentSerialNumber.toString());
                lastClickTimeRef.current = 0;
            } else {
                lastClickTimeRef.current = now;
            }
            return;
        }

        // Others: Single click
        setIsSerialEditing(true);
        setTempSerialInput(currentSerialNumber.toString());
    };

    const handleSerialBlur = () => {
        if (!selectedProduct) return;
        setIsSerialEditing(false);
        const newVal = parseInt(tempSerialInput);
        if (!Number.isNaN(newVal) && newVal >= 1) {
            setProductCounters(prev => ({
                ...prev,
                [selectedProduct.id]: newVal
            }));
        }
    };

    // --- Print Execution ---
    const executePrint = async (copies: number) => {
        if (!selectedProduct || !weight) {
            alert("Будь ласка, виберіть продукт та введіть вагу.");
            return;
        }

        if (!printerData.printer) {
            console.warn("Printer not connected. Mocking print.");
        }

        // 🧪 BETA: Check for duplicate serial number
        const duplicate = historyData.checkDuplicate(
            labelData.serialNumber,
            selectedProduct.name,
            labelData.date
        );

        if (duplicate) {
            const proceed = window.confirm(
                `⚠️ УВАГА: Дублікат!\n\n` +
                `Бейл #${duplicate.serialNumber} для "${duplicate.product?.name}" ` +
                `вже існує з вагою ${duplicate.weight} кг.\n\n` +
                `Якщо це помилка - відредагуйте існуючий запис в Історії (📜).\n\n` +
                `Продовжити друк все одно?`
            );
            if (!proceed) return;
        }

        // Use selected product/weight for current print, OR provided args if I refactor later.
        // For now, let's keep executePrint for the MAIN UI print button.
        // And create a separate `handlePrintLabelData` for the queue.

        await handlePrintLabelData({
            ...labelData,
            // Ensure we use the current selection for sorting logic if printing from main UI
            // But labelData already has it.
        }, copies);
    };

    // Generic Print Handler (Refactored)
    const handlePrintLabelData = async (data: LabelData, copies: number): Promise<boolean> => {
        const logoToUse = selectedLabelSize.id === '100x100' ? logoZplLarge : logoZplSmall;

        // Custom Template Logic:
        // If Product is 'Short Fiber' (id: 2) OR 'Hurds Calibrated' (id: 3) AND Size is 100x100 -> Use Offset Template
        // Custom Template Logic:
        // 1. Check for overrides or dynamic generation first
        // If Product is 'Short Fiber' (id: 2) OR 'Hurds Calibrated' (id: 3) AND Size is 100x100 -> Use Offset Template
        let zplTemplate = await getEffectiveTemplate(selectedLabelSize.id, 'operator');

        if ((data.product?.id === '2' || data.product?.id === '3') && selectedLabelSize.id === '100x100') {
            zplTemplate = ZPL_100x100_OFFSET;
        }

        // Generate EXACT barcode string to save in history
        const generatedBarcode = zebraService.formatBarcode(barcodePattern, {
            date: data.date,
            sku: data.product?.sku || '',
            serialNumber: data.serialNumber.toString(),
            weight: data.weight,
            productName: data.product?.name || 'Unknown'
        });

        // Add generated barcode to data object
        const finalData = { ...data, barcode: generatedBarcode };

        const zpl = zebraService.generateZPL(zplTemplate, {
            date: data.date,
            productName: data.product?.name || 'Unknown',
            productNameEn: data.product?.name_en || '',
            sku: data.product?.sku || '',
            weight: data.weight,
            serialNumber: data.serialNumber.toString(),
            sortLabel: data.sortLabel || '',
            sortValue: data.sortValue || '',
            quantity: copies,
            logoZpl: logoToUse,
            barcodePattern: barcodePattern
        });

        let success = false;
        if (printerData.printer) {
            success = await zebraService.print(printerData.printer, zpl);
        } else {
            console.log(`--- MOCK PRINTING ZPL (${selectedLabelSize.name}) - Copies: ${copies} ---`);
            // console.log(zpl);
            success = true;
        }

        let status: 'ok' | 'error' = success ? 'ok' : 'error';

        // Add to history (Status Saved) with Ownership
        const timestamp = new Date().toISOString();
        if (printerData.printer || true) { // Always save, even if mock
            historyData.addToHistory({
                ...finalData,
                timestamp,
                status,
                shiftId: activeShift?.id
            }, currentUser);
        }

        // Add to Active Shift
        if (shiftService.hasActiveShift()) {
            shiftService.addPrintToShift({
                ...finalData,
                timestamp,
                status,
                operatorId: currentUser?.id,
                operatorName: currentUser?.name,
                shiftId: activeShift?.id
            });
            // Update local state to reflect new counts immediately if needed
            setActiveShift(shiftService.getCurrentShift());
        }

        return success;
    };

    // Wrapper for Main UI Print
    const executeMainPrint = async (copies: number) => {
        // Strict Duplicate Check REMOVED - System now overwrites/updates automatically via DB logic.
        // User requested: "If it exists, overwrite it."

        const success = await handlePrintLabelData(labelData, copies);
        if (success) {
            setProductCounters(prev => ({
                ...prev,
                [selectedProduct!.id]: (prev[selectedProduct!.id] ?? INITIAL_SERIAL) + 1
            }));
            setWeight('');
        } else {
            alert("Помилка друку.");
        }
    };


    const handlePrintClick = () => {
        if (!selectedProduct || !weight) {
            alert("Будь ласка, виберіть продукт та введіть вагу.");
            return;
        }

        printClickCountRef.current += 1;
        if (!printTimerRef.current) {
            printTimerRef.current = setTimeout(() => {
                const count = printClickCountRef.current;
                const copies = count >= 2 ? 2 : 1;
                console.log(`Print Timer Executed. Clicks: ${count}, Copies: ${copies}`);
                executeMainPrint(copies);
                printClickCountRef.current = 0;
                printTimerRef.current = null;
            }, 1000);
        }
    };

    const handleReprint = (item: LabelData) => {
        if (item.product) {
            // Find the full product object from availableProducts to ensure consistency
            const fullProduct = availableProducts.find(p => p.id === item.product!.id) || item.product;
            setSelectedProduct(fullProduct);

            // Set Counter to the historical serial number so it prints THAT number
            setProductCounters(prev => ({
                ...prev,
                [fullProduct.id]: item.serialNumber
            }));
        }
        setWeight(item.weight);
        setIsSettingsOpen(false);
    };

    const isPrintDisabled = !selectedProduct || !weight;

    return (
        <div className="app-container">
            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                printerData={printerData}
                isAdmin={currentUser?.role === 'admin'}
                currentUser={currentUser}
                selectedLabelSize={selectedLabelSize}
                onLabelSizeChange={setSelectedLabelSize}
                dataSource={DataManager.getDataSource()}
                onChangeDataSource={source => DataManager.setDataSource(source)}
                barcodePattern={barcodePattern}
                onBarcodePatternChange={(val) => {
                    setBarcodePattern(val);
                    localStorage.setItem('zebra_barcode_pattern_v1', val);
                }}
                historyData={historyData}
                reportEmail={historyData.reportEmail}
                onReportEmailChange={historyData.setReportEmail}
                onReprint={handleReprint}
            />

            {/* Deferred Print Modal */}
            <DeferredPrintModal
                isOpen={isQueueOpen}
                onClose={() => setIsQueueOpen(false)}
                queue={deferredData.queue}
                onRemove={deferredData.removeFromQueue}
                onPrintItem={(labelData, quantity) => handlePrintLabelData(labelData, quantity)}
                onClear={deferredData.clearQueue}
                loading={false}
            />

            {/* Print History Modal (New) */}
            <PrintHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={historyData.history}
                currentUser={currentUser}
                onUpdate={(entry) => historyData.updateHistoryEntry(entry, currentUser)}
                onDelete={(id) => historyData.deleteHistoryEntry(id, currentUser)}
                onReprint={handleReprint}
            />

            {/* Header */}
            {/* Header */}
            <Header
                currentUser={currentUser}
                onLogout={logout}
                onSettingsClick={() => setIsSettingsOpen(true)}
                onQueueClick={() => setIsQueueOpen(true)}
                activeShift={activeShift}
                onShiftClose={handleShiftCloseRequest}
                printerData={printerData}
            />

            {/* Main Content - Scrollable */}
            {/* Main Content - Scrollable with Padding for Footer */}
            <main className="app-main px-3 md:px-8 pb-32 md:pb-8 pt-4">
                <div className="max-w-7xl mx-auto">


                    <div className="max-w-xl mx-auto space-y-6">
                        {/* INPUTS SECTIONS */}
                        <div className="space-y-4 md:space-y-6">
                            {/* PRODUCT SELECTOR */}
                            <section className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-3 md:mb-4">
                                    <h2 className="text-lg md:text-xl font-bold text-slate-800">
                                        {selectedProduct ? (
                                            <span className="text-[#115740]">{selectedProduct.name} <span className="text-slate-400 font-normal text-sm ml-1">/ {selectedProduct.name_en}</span></span>
                                        ) : (
                                            "Виберіть продукт"
                                        )}
                                    </h2>
                                    <span className="text-xs md:text-sm font-medium text-slate-400">
                                        {availableProducts.length} позицій
                                    </span>
                                </div>

                                <ProductSelect
                                    products={availableProducts}
                                    selected={selectedProduct}
                                    onSelect={setSelectedProduct}
                                />

                                <div className="flex gap-3 md:gap-4 md:flex-col">
                                    {/* SERIAL NUMBER INPUT */}
                                    {selectedProduct && (
                                        <div className={`mt-0 pt-0 border-t-0 flex-1 animate-fade-in ${currentUser?.role === 'operator' && selectedProduct.id !== '3' ? 'w-full' : ''}`}>
                                            <div className="flex justify-between items-center mb-2 md:mb-3">
                                                <label className="text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wide">№ бейла</label>
                                                <span className="text-[10px] md:text-xs font-medium text-slate-400 truncate max-w-[80px]">
                                                    {currentUser?.role === 'operator' ? 'Тільки перегляд' : 'Ред.'}
                                                </span>
                                            </div>

                                            <div className="flex gap-1 md:gap-2 items-center">
                                                <button
                                                    onClick={() => {
                                                        setProductCounters(prev => ({ ...prev, [selectedProduct.id]: Math.max(1, currentSerialNumber - 1) }));
                                                    }}
                                                    className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-lg md:text-xl font-bold text-red-600 transition-colors">
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={currentSerialNumber}
                                                    readOnly={currentUser?.role === 'operator'}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (!isNaN(val) && val >= 1) {
                                                            setProductCounters(prev => ({ ...prev, [selectedProduct.id]: val }));
                                                        }
                                                    }}
                                                    className={`flex-1 w-full min-w-[60px] bg-white border-2 border-slate-200 rounded-lg text-center text-lg md:text-xl font-mono font-bold text-slate-800 focus:border-[#115740] focus:outline-none transition-colors h-10 md:h-12 ${currentUser?.role === 'operator' ? 'bg-slate-50 text-slate-500' : ''}`}
                                                />
                                                <button
                                                    onClick={() => {
                                                        setProductCounters(prev => ({ ...prev, [selectedProduct.id]: currentSerialNumber + 1 }));
                                                    }}
                                                    className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-lg md:text-xl font-bold text-[#115740] transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sort Selection */}
                                    {selectedProduct && selectedProduct.sorts && selectedProduct.sorts.length > 0 && (
                                        (currentUser?.role !== 'operator' || selectedProduct.id === '3') && (
                                            <div className="mt-0 pt-0 border-t-0 flex-1 animate-fade-in">

                                                <SortSelect
                                                    sorts={selectedProduct.sorts}
                                                    selectedSort={selectedSort}
                                                    onSelect={setSelectedSort}
                                                />
                                            </div>
                                        )
                                    )}
                                </div>
                            </section>

                            <section className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-3 md:mb-4">
                                    <h2 className="text-lg md:text-xl font-bold text-slate-800">Введіть Вагу</h2>
                                    <span className="text-xs md:text-sm font-medium text-slate-400">КГ</span>
                                </div>

                                <div className="bg-slate-100 rounded-xl p-2 md:p-4 mb-3 md:mb-4 text-center border-2 border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                                    <input
                                        type="text"
                                        readOnly
                                        value={weight}
                                        placeholder="0.00"
                                        className="w-full bg-transparent text-center text-4xl md:text-5xl font-mono font-bold text-slate-800 focus:outline-none placeholder-slate-300"
                                    />
                                </div>

                                <Keypad
                                    onKeyPress={handleWeightKeyPress}
                                    onClear={() => setWeight('')}
                                    onBackspace={() => setWeight(prev => prev.slice(0, -1))}
                                />
                            </section>
                        </div>

                    </div>
                </div>
            </main>

            {/* Universal Sticky Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.15)]">
                <div className="p-4 flex gap-3 md:gap-4 max-w-7xl mx-auto md:px-8">
                    {/* History Button (New for Operator) */}
                    <button
                        onClick={() => setIsHistoryOpen(true)}
                        className="flex-[1] flex items-center justify-center gap-2 py-3 md:py-4 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl md:rounded-2xl hover:bg-slate-200 active:scale-95 transition-all text-sm md:text-lg border border-slate-200"
                    >
                        📜 <span className="hidden sm:inline">Історія</span>
                    </button>

                    {/* Deferred Print Button */}
                    {/* Deferred Print Button - Always visible, disabled if invalid */}
                    <button
                        onClick={() => {
                            deferredData.addToQueue(labelData);
                            setWeight('');
                            setProductCounters(prev => ({ ...prev, [selectedProduct!.id]: (prev[selectedProduct!.id] ?? INITIAL_SERIAL) + 1 }));
                            alert("Додано в чергу!");
                        }}
                        disabled={isPrintDisabled}
                        className={`flex-1 py-3 md:py-4 rounded-xl font-bold text-lg md:text-xl border-2 flex items-center justify-center gap-2 group transition-colors ${isPrintDisabled
                            ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                            : 'border-[#115740] text-[#115740] hover:bg-green-50 active:bg-green-100'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 md:h-7 md:w-7 transition-transform ${!isPrintDisabled && 'group-active:scale-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden md:inline">Відкласти друк</span>
                        <span className="md:hidden">Відкласти</span>
                    </button>

                    <button
                        onClick={handlePrintClick}
                        disabled={isPrintDisabled}
                        className={`flex-[3] py-3 md:py-4 rounded-xl font-bold text-xl md:text-2xl shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 ${isPrintDisabled
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-[#115740] hover:bg-[#0d4633] text-white shadow-green-900/30 ring-0 hover:ring-4 hover:ring-[#115740]/20'
                            }`}
                    >
                        <PrinterIcon />
                        {selectedProduct && weight ? 'ДРУКУВАТИ' : 'ЗАПОВНІТЬ ДАНІ'}
                    </button>
                </div>
            </div>
            {/* Shift Open Modal */}
            {showShiftOpenModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                        <div className="text-4xl mb-4">👋</div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Вітаємо, {currentUser?.name}!</h2>
                        <p className="text-slate-500 mb-6">Для початку роботи необхідно відкрити нову зміну.</p>
                        <button
                            onClick={handleShiftOpen}
                            className="w-full py-3 bg-[#115740] text-white font-bold rounded-xl hover:bg-[#0d4633] transition-colors text-lg"
                        >
                            Відкрити зміну
                        </button>
                    </div>
                </div>
            )}
            {/* Shift Close Confirmation Modal */}
            <ShiftCloseConfirmModal
                isOpen={showShiftConfirmModal}
                onClose={() => setShowShiftConfirmModal(false)}
                onConfirm={confirmShiftClose}
                currentShift={activeShift}
            />

            {/* Shift Close Summary Modal */}
            {showShiftCloseModal && shiftCloseData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="bg-[#115740] p-6 text-white text-center">
                            <div className="text-4xl mb-2">✅</div>
                            <h2 className="text-2xl font-bold">Зміна закрита!</h2>
                            <p className="opacity-80">Звіт сформовано успішно</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border">
                                    <div className="text-xs text-slate-500 uppercase font-bold text-center">Тривалість</div>
                                    <div className="font-mono font-bold text-lg text-center">{shiftCloseData.summary.duration}</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border">
                                    <div className="text-xs text-slate-500 uppercase font-bold text-center">Всього друків</div>
                                    <div className="font-mono font-bold text-lg text-center">{shiftCloseData.summary.printCount}</div>
                                </div>
                            </div>

                            {/* Email Status & Manual Download */}
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${shiftCloseData.emailStatus?.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                <div className="text-xl">{shiftCloseData.emailStatus?.success ? '📧' : '⚠️'}</div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold uppercase tracking-tight">{shiftCloseData.emailStatus?.success ? 'Email відправлено' : 'Email не відправлено'}</div>
                                    <div className="text-xs opacity-90">{shiftCloseData.emailStatus?.message}</div>
                                </div>
                                {shiftCloseData.file && (
                                    <button
                                        onClick={() => {
                                            const url = URL.createObjectURL(shiftCloseData.file!);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = shiftCloseData.file!.name;
                                            a.click();
                                        }}
                                        className="bg-white shadow-sm border border-slate-200 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                        title="Завантажити звіт вручну"
                                    >
                                        📥
                                    </button>
                                )}
                            </div>

                            <div className="border-t pt-2">
                                <h3 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider text-slate-400">Топ продукції</h3>
                                <div className="space-y-1.5">
                                    {shiftCloseData.summary.topProducts.map((p, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-slate-600 truncate flex-1 mr-2">{p.name}</span>
                                            <span className="font-bold font-mono text-slate-800">{p.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setShowShiftCloseModal(false);
                                    logout();
                                }}
                                className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 shadow-lg shadow-slate-900/20 transition-colors mt-2 text-lg"
                            >
                                Завершити роботу
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
