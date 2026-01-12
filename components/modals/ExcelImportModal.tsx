import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, LabelSizeConfig } from '../../types';
import { PRODUCTS, LABEL_SIZES, ZPL_100x100_OFFSET } from '../../constants';
import { zebraService } from '../../services/zebraService';
import { ProductionService } from '../../services/productionService';
import { usePrinter } from '../../hooks/usePrinter';
import ConfirmDialog from '../ConfirmDialog';

interface ExcelImportModalProps {
    onClose: () => void;
    currentUser: any;
}

interface ImportItem {
    id: number; // Row index (1-based)
    date: string; // From Excel
    serialNumber: number;
    weight: number;
    sort: string;
    productName: string;
    status: 'pending' | 'success' | 'error';
    message?: string;
    barcode?: string;
    createdAt?: string;
}

// Helper to parse Excel dates
const parseExcelDate = (value: any): string => {
    if (!value) return new Date().toLocaleDateString('uk-UA');

    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
        // Excel base date is Dec 30, 1899
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return date.toLocaleDateString('uk-UA');
    }

    // If string, try to normalize
    const str = String(value).trim();
    // Assuming DD.MM.YYYY or similar
    // We can just return string if it looks like a date, user can verify in preview
    return str;
}

// Steps: 1=Select Product & File, 2=Preview & Import, 3=Results & Print
export default function ExcelImportModal({ onClose, currentUser }: ExcelImportModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [items, setItems] = useState<ImportItem[]>([]);

    // Status State
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Printer
    const { printer } = usePrinter();

    // Alert Dialog State
    const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

    // Overwrite Confirmation State
    const [overwriteConfirm, setOverwriteConfirm] = useState<{
        isOpen: boolean;
        duplicates: { item: ImportItem; existing: any }[];
        onConfirm: () => void;
    }>({ isOpen: false, duplicates: [], onConfirm: () => { } });

    // Items with conflicts (for skipping)
    const [blockedItems, setBlockedItems] = useState<Set<number>>(new Set());

    // Reset Flow
    const reset = () => {
        setStep(1);
        setFile(null);
        setItems([]);
        setIsImporting(false);
        setProgress({ current: 0, total: 0 });
    };

    // File Handler
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Safety check if product not selected (though UI should prevent this)
        if (!selectedProduct) {
            setAlertDialog({ isOpen: true, message: "Спочатку оберіть продукт!" });
            return;
        }

        setFile(selectedFile);

        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // SMART ROW DETECTION
        // We look for the first row where Column B (index 1) is a Number (Serial Number)
        // This skips headers, empty lines, titles, etc.
        let startIndex = -1;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 2) continue;

            const colB = row[1];

            // Check if B is a number or a numeric string (e.g. "123")
            // We use a loose check because Excel might read it as string
            const isNumericB = (typeof colB === 'number') || (typeof colB === 'string' && !isNaN(parseInt(colB)) && /^\d+$/.test(colB.trim()));

            if (isNumericB) {
                startIndex = i;
                break;
            }
        }

        if (startIndex === -1) {
            setAlertDialog({ isOpen: true, message: "Не вдалося знайти дані! Переконайтесь, що файл містить колонку '№' (B) з числовими номерами." });
            return;
        }

        const parsed: ImportItem[] = [];
        let indexCounter = 1;

        for (let i = startIndex; i < jsonData.length; i++) {
            const row = jsonData[i];
            // Must have at least columns A and B. C and D might be empty or valid.
            if (!row || row.length < 2) continue;

            const dateRaw = row[0];
            const serial = parseInt(row[1]);

            // Weight can be in C (index 2)
            let weight = 0;
            if (row[2]) {
                if (typeof row[2] === 'number') weight = row[2];
                else if (typeof row[2] === 'string') weight = parseFloat(row[2].replace(',', '.'));
            }

            // Sort in D (index 3)
            const sort = row[3] ? String(row[3]) : '';

            // Strict check: Serial must be valid number. Weight is optional? No, usually required.
            // Let's assume weight is required.
            if (!isNaN(serial) && serial > 0) {
                // If weight is NaN, maybe default to 0 or skip? 
                // Let's allow 0 weight but usually it should be > 0.
                const finalWeight = isNaN(weight) ? 0 : weight;

                parsed.push({
                    id: indexCounter++,
                    date: parseExcelDate(dateRaw),
                    serialNumber: serial,
                    weight: finalWeight,
                    sort: sort,
                    productName: selectedProduct.name,
                    status: 'pending'
                });
            }
        }

        setItems(parsed);

        if (parsed.length > 0) {
            setStep(2);
        } else {
            setAlertDialog({ isOpen: true, message: "Файл здається порожнім або дані некоректні (не знайдено жодного рядка з номером)." });
        }
    };

    // --- STEP 2: IMPORT LOGIC ---
    const runImport = async () => {
        if (!selectedProduct || items.length === 0) return;

        // Phase 1: Check for duplicates before importing
        setIsImporting(true);
        setProgress({ current: 0, total: items.length });

        const duplicates: { item: ImportItem; existing: any }[] = [];
        const blocked: number[] = [];

        for (const item of items) {
            const existing = await ProductionService.findBySerialAndProduct(
                item.serialNumber,
                selectedProduct.name
            );
            if (existing) {
                if (existing.status === 'palletized' || existing.status === 'shipped') {
                    // Can't overwrite - mark as blocked
                    blocked.push(item.id);
                } else {
                    // Can overwrite with confirmation
                    duplicates.push({ item, existing });
                }
            }
        }

        // If there are blocked items, show warning
        if (blocked.length > 0) {
            setBlockedItems(new Set(blocked));
            const blockedNumbers = items.filter(i => blocked.includes(i.id)).map(i => `#${i.serialNumber}`).join(', ');
            setAlertDialog({
                isOpen: true,
                message: `Наступні номери неможливо перезаписати (вже оприходуваний/реалізований): ${blockedNumbers}. Вони будуть пропущені.`
            });
        }

        // If there are duplicates that can be overwritten, ask confirmation
        if (duplicates.length > 0) {
            setIsImporting(false);
            setOverwriteConfirm({
                isOpen: true,
                duplicates,
                onConfirm: () => {
                    setOverwriteConfirm({ isOpen: false, duplicates: [], onConfirm: () => { } });
                    proceedWithImport(blocked);
                }
            });
            return;
        }

        // No duplicates - proceed directly
        await proceedWithImport(blocked);
    };

    const proceedWithImport = async (blockedIds: number[]) => {
        if (!selectedProduct) return;

        setIsImporting(true);

        // Generate Batch ID: import_YYYYMMDD_HHMMSS
        const now = new Date();
        const batchId = `import_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

        const pattern = localStorage.getItem('zebra_barcode_pattern_v1') || '{date}-{sku}-{serialNumber}-{weight}';
        const updatedItems = [...items];
        const itemsToProcess = items.filter(i => !blockedIds.includes(i.id));
        setProgress({ current: 0, total: itemsToProcess.length });

        let processedCount = 0;
        for (let i = 0; i < updatedItems.length; i++) {
            const item = updatedItems[i];

            // Skip blocked items
            if (blockedIds.includes(item.id)) {
                updatedItems[i] = { ...item, status: 'error', message: 'Заблоковано (оприходувано)' };
                continue;
            }

            try {
                // Check if exists for upsert logic
                const existing = await ProductionService.findBySerialAndProduct(
                    item.serialNumber,
                    selectedProduct.name
                );

                // Generate Barcode
                const barcode = zebraService.formatBarcode(pattern, {
                    date: item.date,
                    sku: selectedProduct.sku,
                    serialNumber: item.serialNumber.toString(),
                    weight: item.weight.toFixed(2),
                    productName: selectedProduct.name
                });

                const needsLabCheck = !item.sort || item.sort.trim() === '';

                if (existing) {
                    // UPDATE existing item
                    await ProductionService.updateItem({
                        ...existing,
                        barcode,
                        weight: item.weight,
                        sort: item.sort || '',
                        date: item.date,
                        status: needsLabCheck ? 'created' : 'graded',
                        labNotes: needsLabCheck ? "IMPORTED - Очікує перевірки (Перезапис)" : "IMPORTED (Перезапис)",
                        importBatchId: batchId,
                        printedAt: undefined // Reset print status on overwrite
                    });
                    updatedItems[i] = { ...item, status: 'success', barcode, message: 'Перезаписано' };
                } else {
                    // CREATE new item
                    await ProductionService.createItem({
                        id: crypto.randomUUID(),
                        barcode,
                        serialNumber: item.serialNumber,
                        weight: item.weight,
                        productName: selectedProduct.name,
                        productNameEn: selectedProduct.name_en,
                        sort: item.sort || '',
                        date: item.date,
                        status: needsLabCheck ? 'created' : 'graded',
                        createdAt: new Date().toISOString(),
                        operatorId: currentUser.id,
                        labNotes: needsLabCheck ? "IMPORTED - Очікує перевірки" : "IMPORTED",
                        importBatchId: batchId,
                        printedAt: undefined
                    });
                    updatedItems[i] = { ...item, status: 'success', barcode };
                }

                processedCount++;

            } catch (e: any) {
                console.error(e);
                updatedItems[i] = { ...item, status: 'error', message: e.message };
            }

            setProgress({ current: processedCount, total: itemsToProcess.length });
        }

        setItems(updatedItems);
        setIsImporting(false);
        setStep(3); // Go to Results
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                        <span className="text-3xl text-blue-600">📥</span>
                        <div>
                            <div>Імпорт з Excel</div>
                            <div className="text-xs text-slate-500 font-normal">Крок {step} з 3</div>
                        </div>
                    </h2>
                    <button onClick={onClose} disabled={isImporting} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500 font-bold">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto bg-slate-50/50">

                    {/* STEP 1: Select */}
                    {step === 1 && (
                        <div className="p-8 max-w-4xl mx-auto space-y-8">

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4 items-start">
                                <div className="text-2xl">ℹ️</div>
                                <div className="text-sm text-blue-800">
                                    <p className="font-bold mb-1">Оновлена Інструкція:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Файл повинен бути формату <strong>.xlsx</strong>.</li>
                                        <li>Колонки: <strong>A: Дата, B: Номер, C: Вага, D: Сорт</strong>.</li>
                                        <li>Підтримується формат кириличної дати або стандартний Excel.</li>
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs">1</span>
                                    Оберіть Продукт
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {PRODUCTS.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedProduct(p)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 active:scale-95 ${selectedProduct?.id === p.id
                                                ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-100'
                                                : 'border-white bg-white shadow-sm hover:border-blue-300'}`}
                                        >
                                            <div className="font-bold text-slate-800 text-lg mb-1">{p.name}</div>
                                            <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded w-fit">{p.sku}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={!selectedProduct ? 'opacity-30 pointer-events-none filter blur-sm transition-all' : 'transition-all'}>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs">2</span>
                                    Завантажте Файл
                                </h3>

                                <label className="block w-full border-3 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group bg-white">
                                    <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="hidden" />
                                    <div className="text-6xl mb-4 group-hover:scale-110 transition-transform text-slate-300 group-hover:text-blue-400">📄</div>
                                    <div className="font-bold text-slate-600 text-lg group-hover:text-blue-700">Натисніть для вибору файлу</div>
                                    <div className="text-sm text-slate-400 mt-2">Колонки: Дата | № | Вага | Сорт</div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Preview */}
                    {step === 2 && (
                        <div className="p-6 h-full flex flex-col">
                            <div className="bg-white p-4 rounded-xl shadow-sm border mb-4 flex justify-between items-center">
                                <div>
                                    <div className="text-sm text-slate-500">Обраний продукт</div>
                                    <div className="font-bold text-xl">{selectedProduct?.name}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Записів</div>
                                    <div className="font-bold text-xl">{items.length}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-slate-500">Унікальних дат</div>
                                    <div className="font-bold text-xl">{new Set(items.map(i => i.date)).size}</div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border flex flex-col">
                                <div className="p-3 bg-slate-100 border-b font-bold text-xs text-slate-500 uppercase flex gap-4 pr-6">
                                    <div className="w-16">#Idx</div>
                                    <div className="w-32">Дата</div>
                                    <div className="w-20">№ Бейла</div>
                                    <div className="w-32">Вага</div>
                                    <div className="w-32">Сорт</div>
                                    <div className="flex-1">Статус</div>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 p-3 border-b hover:bg-slate-50 text-sm items-center">
                                            <div className="w-16 text-slate-400 font-mono text-xs">{item.id}</div>
                                            <div className="w-32 font-bold">{item.date}</div>
                                            <div className="w-20 font-mono font-bold">#{item.serialNumber}</div>
                                            <div className="w-32 font-mono">{item.weight} кг</div>
                                            <div className="w-32">
                                                <span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-700">{item.sort}</span>
                                            </div>
                                            <div className="flex-1 text-slate-400 text-xs">Очікує імпорту...</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Results (Success Message) */}
                    {step === 3 && (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-8 bg-slate-50">

                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-6xl shadow-xl shadow-green-100 animate-bounce">
                                ✅
                            </div>

                            <div className="max-w-xl">
                                <h3 className="text-3xl font-bold text-slate-800 mb-4">Імпорт Успішно Завершено!</h3>
                                <p className="text-lg text-slate-600">
                                    Ми успішно зберегли <strong>{items.filter(i => i.status === 'success').length}</strong> записів до бази даних.
                                </p>
                                <p className="text-slate-500 mt-2">
                                    Щоб розпочати друк стікерів, перейдіть до нового розділу <strong>"Менеджер Друку"</strong>.
                                    Це дозволить вам безпечно друкувати великі партії та контролювати прогрес.
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={onClose}
                                    className="px-8 py-4 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-lg"
                                >
                                    Закрити
                                </button>
                                {/* Future: Link to Print Hub */}
                                <button
                                    onClick={() => {
                                        onClose();
                                        // Alert not needed since modal closes
                                    }}
                                    className="px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all text-lg flex items-center gap-2"
                                >
                                    <span>🖨️</span> Перейте до Менеджера Друку
                                </button>
                            </div>

                        </div>
                    )}

                </div>

                {/* Footer Controls (Only for Step 1 & 2) */}
                {step < 3 && (
                    <div className="p-6 border-t bg-slate-50 flex justify-between items-center z-10">
                        <div>
                            {step > 1 && (
                                <button onClick={reset} disabled={isImporting} className="text-slate-500 hover:text-slate-800 font-bold text-sm px-4 py-2 rounded-lg hover:bg-slate-200">
                                    ↺ Почати спочатку
                                </button>
                            )}
                        </div>

                        <div className="flex gap-4">
                            {step === 2 && (
                                <>
                                    <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200">
                                        ← Назад
                                    </button>
                                    <button
                                        onClick={runImport}
                                        disabled={isImporting}
                                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2"
                                    >
                                        {isImporting ? 'Імпорт...' : '✅ Виконати Імпорт'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

            </div>

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

            {/* Overwrite Confirmation Dialog */}
            <ConfirmDialog
                isOpen={overwriteConfirm.isOpen}
                title="⚠️ Знайдено дублікати"
                message={`Наступні номери вже існують в базі: ${overwriteConfirm.duplicates.map(d => `#${d.item.serialNumber}`).join(', ')}. Перезаписати їх?`}
                confirmText={`Перезаписати (${overwriteConfirm.duplicates.length})`}
                cancelText="Скасувати"
                variant="warning"
                onCancel={() => {
                    setOverwriteConfirm({ isOpen: false, duplicates: [], onConfirm: () => { } });
                    setIsImporting(false);
                }}
                onConfirm={overwriteConfirm.onConfirm}
            />
        </div>
    );
}
