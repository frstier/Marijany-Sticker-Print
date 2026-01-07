import { useState, useEffect } from 'react';
import { LabelData } from '../types';
import { DataManager } from '../services/dataManager';
import { ProductionService } from '../services/productionService';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { read, utils, write } from 'xlsx';

const LOCAL_STORAGE_HISTORY_KEY = 'zebra_print_history_v1';

export function useHistory() {
    const [history, setHistory] = useState<LabelData[]>([]);

    useEffect(() => {
        const loadHistory = async () => {
            // 1. Try DataManager Service
            try {
                const service = DataManager.getService();
                const dbHistory = await service.getHistory();
                if (dbHistory.length > 0) {
                    setHistory(dbHistory);
                    return;
                }
            } catch (e) { console.error("History Load Error", e); }

            // 2. Fallback to LocalStorage (always)
            try {
                const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
                if (saved) setHistory(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load history", e);
            }
        };
        loadHistory();
    }, []);

    const addToHistory = async (entry: LabelData, currentUser?: any) => {
        const enrichedEntry = {
            ...entry,
            operatorId: currentUser?.id,
            operatorName: currentUser?.name,
            timestamp: new Date().toISOString()
        };

        // Update State
        const newHistory = [enrichedEntry, ...history].slice(0, 500);
        setHistory(newHistory);

        // Save Local (Backup)
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(newHistory));

        // SYNC TO SUPABASE (via ProductionService)
        try {
            // Map LabelData -> ProductionItem
            await ProductionService.createItem({
                id: enrichedEntry.id, // Use unique ID
                barcode: enrichedEntry.barcode || '', // Ensure barcode is set
                date: enrichedEntry.date,
                productName: enrichedEntry.product?.name || 'Unknown',
                productNameEn: enrichedEntry.product?.name_en,
                serialNumber: enrichedEntry.serialNumber,
                weight: parseFloat(enrichedEntry.weight) || 0,
                status: 'created',
                createdAt: enrichedEntry.timestamp,
                operatorId: enrichedEntry.operatorId
            });
            console.log('✅ Synced to Supabase/ProductionService');
        } catch (e) {
            console.error("Failed to sync to ProductionService", e);
        }

        // Save via DataManager (Legacy/DB) if needed
        try {
            await DataManager.getService().addToHistory(enrichedEntry);
        } catch (e) {
            console.error("Failed to save to DataService", e);
        }
    };

    const updateHistoryEntry = async (updatedEntry: LabelData, currentUser: any): Promise<boolean> => {
        const existing = history.find(h => h.id === updatedEntry.id);
        if (!existing) return false;

        // Update local state
        const newHistory = history.map(h => h.id === updatedEntry.id ? updatedEntry : h);
        setHistory(newHistory);
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(newHistory));

        // Sync to Supabase via DataManager (update, not insert)
        let syncSuccess = false;
        try {
            const service = DataManager.getService() as any;
            if (service.updateHistoryEntry) {
                await service.updateHistoryEntry(updatedEntry);
                console.log('✅ Updated in Supabase history');
                syncSuccess = true;
            }
        } catch (e) {
            console.error('Failed to update in Supabase', e);
        }

        // Also sync to ProductionService (production_items table)
        try {
            await ProductionService.updateItemFromHistory(existing, updatedEntry);
            console.log('✅ Updated in production_items');
        } catch (e) {
            console.error('Failed to sync to ProductionService', e);
        }

        return syncSuccess;
    };

    // 🧪 BETA: Check for duplicate serial numbers
    const checkDuplicate = (serialNumber: number, productName: string, date: string): LabelData | null => {
        return history.find(h =>
            h.serialNumber === serialNumber &&
            h.product?.name === productName &&
            h.date === date &&
            h.status !== 'cancelled'
        ) || null;
    };

    const deleteHistoryEntry = async (id: string, currentUser: any) => {
        const existing = history.find(h => h.id === id);
        if (!existing) return;

        if (!window.confirm("Видалити цей запис повністю?")) return;

        // Update local state
        const newHistory = history.filter(h => h.id !== id);
        setHistory(newHistory);
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(newHistory));

        // Delete from Supabase history table
        try {
            const service = DataManager.getService() as any;
            if (service.deleteHistoryEntry) {
                await service.deleteHistoryEntry(id);
                console.log('✅ Deleted from Supabase history');
            }
        } catch (e) {
            console.error('Failed to delete from Supabase history', e);
        }

        // Also delete from production_items table
        try {
            await ProductionService.deleteItem(id);
            console.log('✅ Deleted from production_items');
        } catch (e) {
            console.error('Failed to delete from production_items', e);
        }
    };

    const clearHistory = () => {
        if (window.confirm("Ви впевнені, що хочете очистити історію?")) {
            setHistory([]);
            localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
        }
    };

    // Export Logic
    // Helper to get raw CSV string
    // Reporting State
    const [reportSummary, setReportSummary] = useState<{ count: number, totalWeight: number }>({ count: 0, totalWeight: 0 });
    const [reportData, setReportData] = useState<LabelData[]>([]);

    // Helper to parse DD.MM.YYYY string
    const parseDateStr = (dateStr: string | undefined): Date => {
        if (!dateStr) return new Date();
        // If ISO format (e.g. 2024-12-24T...)
        if (dateStr.includes('T') || dateStr.includes('-')) {
            return new Date(dateStr);
        }
        // If DD.MM.YYYY
        const parts = dateStr.split('.');
        if (parts.length === 3) {
            // new Date(year, monthIndex, day)
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(dateStr); // Fallback
    };

    async function generateReport(startDate: Date, endDate: Date) {
        let data: LabelData[] = [];
        try {
            data = await DataManager.getService().getReportData(startDate, endDate);
        } catch (e) {
            console.warn("DataManager report generation failed, falling back to local state", e);
        }

        // Fallback or Merge if DB empty (common in Web/Test mode)
        if (data.length === 0 && history.length > 0) {
            console.log("Using local history state for report generation");
            data = history.filter(item => {
                const itemDate = parseDateStr(item.date);
                // Compare timestamps if available for precision, otherwise day comparison
                return itemDate >= startDate && itemDate <= endDate;
            });
        }

        // Merge QUEUE (Deferred items) if they match date range
        try {
            const queueStr = localStorage.getItem('zebra_deferred_queue_v1');
            if (queueStr) {
                const queue: LabelData[] = JSON.parse(queueStr);
                const deferredItems = queue.filter(item => {
                    const ts = (item as any).timestamp || item.date;
                    const itemDate = ts.includes('T') ? new Date(ts) : parseDateStr(item.date);
                    return itemDate >= startDate && itemDate <= endDate;
                });

                // Append Deferred Items
                data = [...data, ...deferredItems];

                // Sort by date descending (newest first)
                data.sort((a, b) => {
                    const dateA = new Date((a as any).timestamp || parseDateStr(a.date)).getTime();
                    const dateB = new Date((b as any).timestamp || parseDateStr(b.date)).getTime();
                    return dateB - dateA;
                });
            }
        } catch (e) {
            console.error("Failed to merge deferred queue into report", e);
        }

        setReportData(data);

        // Calculate Summary
        const weight = data.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
        setReportSummary({
            count: data.length,
            totalWeight: parseFloat(weight.toFixed(3))
        });
        return data;
    }

    // Export Logic
    // Export Logic

    // Shared Data Mapping Helper
    const getDataForExport = (dataset: LabelData[]) => {
        return dataset.map(item => {
            let dateObj: Date = parseDateStr(item.date);
            // If timestamp exists, prefer it for Time info
            if (item.timestamp) {
                dateObj = new Date(item.timestamp);
            }

            const statusMap: Record<string, string> = {
                'ok': 'ОК',
                'error': 'Помилка',
                'cancelled': 'Відмінено',
                'deferred': 'Відкладено'
            };
            const statusLabel = statusMap[item.status || 'ok'] || item.status || 'OK';

            return {
                "Дата": dateObj.toLocaleDateString('uk-UA'),
                "Час": dateObj.toLocaleTimeString('uk-UA'),
                "Продукт": item.product?.name || "",
                "SKU": item.product?.sku || "",
                "№": item.serialNumber,
                "Сорт/Фракція": item.sortValue || "",
                "Вага (кг)": Number(item.weight),
                "Штрих-код": item.barcode || "",
                "Оператор": item.operatorName || "",
                "ID Зміни": item.shiftId || "",
                "Статус": statusLabel
            };
        });
    };

    const generateXLSXFile = (dataset: LabelData[]): File => {
        const data = getDataForExport(dataset);
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Report");

        // Use 'array' type for Blob/File creation
        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const filename = `Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        return new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    };

    // Helper to get raw CSV string (Legacy support if needed, or for quick debug)
    const getCSVContent = (dataset: LabelData[] = history): string => {
        const BOM = "\uFEFF";
        const headers = ["Дата", "Час", "Продукт", "SKU", "№", "Сорт/Фракція", "Вага (кг)", "Статус"];
        const rows = getDataForExport(dataset).map(r =>
            [r["Дата"], r["Час"], r["Продукт"], r["SKU"], (r as any)["№"], r["Сорт/Фракція"], r["Вага (кг)"], r["Статус"]]
                .map(val => `"${(val || '').toString().replace(/"/g, '""')}"`)
                .join(",")
        );
        return BOM + headers.join(",") + "\n" + rows.join("\n");
    };

    const exportCsv = async (dataset: LabelData[] = history) => {
        if (dataset.length === 0) { alert("Дані для експорту відсутні"); return; }
        // ... (Keep existing implementation if needed or just alias to Xlsx if user wants ONLY Xlsx)
        // User said "default to XLSX instead of CSV" implying CSV replacement in automatic flows.
        // We'll keep exportCsv as CSV for manual button, but usage in sendEmail will change.
        if (Capacitor.isNativePlatform()) {
            try {
                const csvContent = getCSVContent(dataset);
                const fileName = `ZebraReport_${Date.now()}.csv`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: csvContent,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
                alert(`✅ CSV збережено: ${fileName}`);
            } catch (e) { alert('❌ Error: ' + e); }
        } else {
            // Web fallback
            const csvContent = getCSVContent(dataset);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = "report.csv";
            link.click();
        }
    };

    // Excel Export (Manual)
    const exportXlsx = async (dataset: LabelData[] = history) => {
        if (dataset.length === 0) { alert("Дані для експорту відсутні"); return; }

        const filename = `ZebraReport_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
        const data = getDataForExport(dataset);
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Report");

        if (Capacitor.isNativePlatform()) {
            const wbout = write(wb, { bookType: 'xlsx', type: 'base64' });
            try {
                await Filesystem.writeFile({
                    path: filename,
                    data: wbout,
                    directory: Directory.Documents
                });
                alert(`✅ Excel збережено у Documents:\n${filename}`);
            } catch (e) { alert('❌ Excel save failed: ' + e); }
        } else {
            const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
        }
    };

    const [reportEmail, setReportEmail] = useState<string>('');

    useEffect(() => {
        const savedEmail = localStorage.getItem('zebra_report_email_v1');
        if (savedEmail) setReportEmail(savedEmail);
    }, []);

    const saveReportEmail = (email: string) => {
        setReportEmail(email);
        localStorage.setItem('zebra_report_email_v1', email);
    };

    // SEND EMAIL (Updated to use XLSX)
    const sendEmail = async (dataset: LabelData[] = history): Promise<{ success: boolean; message: string; file?: File }> => {
        if (dataset.length === 0) {
            return { success: false, message: "Дані для експорту відсутні" };
        }

        const dateStr = new Date().toLocaleDateString('uk-UA');
        const count = dataset.length;
        const totalWeight = dataset.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(3);
        const subject = `Звіт виробництва ${dateStr}`;
        const body = `Звіт за ${dateStr}\nКількість: ${count} шт\nВага: ${totalWeight} кг\n\nФайл .xlsx додається.`;

        // 1. Generate XLSX File
        const file = generateXLSXFile(dataset);

        // 2. Try EmailJS
        const { EmailService } = await import('../services/email');
        if (EmailService.isConfigured()) {
            const recipient = reportEmail || localStorage.getItem('zebra_report_email_v1') || '';
            if (recipient) {
                try {
                    await EmailService.sendReport(dataset, recipient);
                    return { success: true, message: `Звіт відправлено на ${recipient}`, file };
                } catch (e) {
                    console.error("EmailJS sending failed", e);
                    // Continue to fallback
                }
            }
        }

        // 3. Fallback: Native Share
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: subject,
                    text: body,
                    files: [file]
                });
                return { success: true, message: "Відкрито вікно відправки", file };
            } catch (err) {
                console.warn("Share failed", err);
                // Continue to fallback
            }
        }

        // 4. Last Resort: Just return the file for manual download
        return { success: false, message: "Авто-відправка не вдалася. Спробуйте завантажити файл вручну.", file };
    };

    // OLD checkDuplicate removed - now using enhanced BETA version defined above

    // TEST: Generate Dummy Data
    const addDummyData = async () => {
        const products = [
            { id: 'marijany_b8_hemp', name: 'Marijany B8 Hemp', sku: 'MJ-B8-HMP', category: 'shiv' as const },
            { id: 'marijany_classic', name: 'Marijany Classic', sku: 'MJ-CLS', category: 'fiber' as const },
            { id: 'marijany_gold', name: 'Marijany Gold', sku: 'MJ-GLD', category: 'dust' as const }
        ];

        for (let i = 0; i < 5; i++) {
            const randomProd = products[Math.floor(Math.random() * products.length)];
            const entry: LabelData = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(), // Today
                product: randomProd,
                weight: (Math.random() * 2 + 0.5).toFixed(3),
                serialNumber: Math.floor(Math.random() * 1000) + 1000,
                sortLabel: Math.random() > 0.5 ? '1 Сорт' : '2 Сорт',
                sortValue: '1',
                status: 'ok'
            };
            await addToHistory(entry);
        }
        alert("Додано 5 тестових записів за сьогодні!");
    };

    return {
        history,
        checkDuplicate,
        addToHistory,
        addDummyData, // Exporting helper
        clearHistory,
        exportCsv,
        exportXlsx,
        sendEmail,
        reportEmail,
        setReportEmail: saveReportEmail,
        // Reporting
        generateReport,
        reportSummary,
        reportData,
        updateHistoryEntry,
        deleteHistoryEntry
    };
}
