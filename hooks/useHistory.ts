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

    // Aggregation State
    const [reportAggregation, setReportAggregation] = useState<any[]>([]);

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
                return itemDate >= startDate && itemDate <= endDate;
            });
        }

        // Merge QUEUE (Deferred items)
        try {
            const queueStr = localStorage.getItem('zebra_deferred_queue_v1');
            if (queueStr) {
                const queue: LabelData[] = JSON.parse(queueStr);
                const deferredItems = queue.filter(item => {
                    const ts = (item as any).timestamp || item.date;
                    const itemDate = ts.includes('T') ? new Date(ts) : parseDateStr(item.date);
                    return itemDate >= startDate && itemDate <= endDate;
                });
                data = [...data, ...deferredItems];
                data.sort((a, b) => {
                    const dateA = new Date((a as any).timestamp || parseDateStr(a.date)).getTime();
                    const dateB = new Date((b as any).timestamp || parseDateStr(b.date)).getTime();
                    return dateB - dateA;
                });
            }
        } catch (e) { console.error("Failed to merge deferred queue", e); }

        setReportData(data);

        // Calculate Summary (Total)
        const weight = data.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
        setReportSummary({
            count: data.length,
            totalWeight: parseFloat(weight.toFixed(3))
        });

        // Calculate Aggregation (By Product)
        const aggMap: Record<string, { count: number, weight: number }> = {};
        data.forEach(item => {
            const key = item.product?.name || 'Unknown';
            if (!aggMap[key]) aggMap[key] = { count: 0, weight: 0 };
            aggMap[key].count++;
            aggMap[key].weight += parseFloat(item.weight) || 0;
        });

        const aggList = Object.entries(aggMap).map(([name, stats]) => ({
            name,
            count: stats.count,
            weight: parseFloat(stats.weight.toFixed(3))
        })).sort((a, b) => b.weight - a.weight);

        setReportAggregation(aggList);

        return data;
    }

    // Export Logic
    const getDataForExport = (dataset: LabelData[]) => {
        return dataset.map(item => {
            let dateObj: Date = parseDateStr(item.date);
            if (item.timestamp) dateObj = new Date(item.timestamp);

            return {
                "Дата": dateObj.toLocaleDateString('uk-UA'),
                "UID": item.barcode || "", // Renamed from Barcode
                "№": item.serialNumber,
                "Продукт": item.product?.name || "",
                "Вага (кг)": Number(item.weight),
                "Сорт": item.sortValue || item.sortLabel || "-"
            };
        });
    };

    const generateXLSXFile = (dataset: LabelData[]): File => {
        // 1. Prepare Data
        const detailsData = getDataForExport(dataset);

        // 2. Prepare Summary Data
        const aggMap: Record<string, { count: number, weight: number }> = {};
        dataset.forEach(item => {
            const key = item.product?.name || 'Unknown';
            if (!aggMap[key]) aggMap[key] = { count: 0, weight: 0 };
            aggMap[key].count++;
            aggMap[key].weight += parseFloat(item.weight) || 0;
        });

        const summaryData = Object.entries(aggMap).map(([name, stats]) => ({
            "Продукт": name,
            "Кількість (шт)": stats.count,
            "Вага (кг)": parseFloat(stats.weight.toFixed(3))
        }));

        // Add Total Row
        const totalCount = dataset.length;
        const totalWeight = dataset.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
        summaryData.push({
            "Продукт": "ВСЬОГО",
            "Кількість (шт)": totalCount,
            "Вага (кг)": parseFloat(totalWeight.toFixed(3))
        });

        // 3. Create Workbook with 2 Sheets
        const wb = utils.book_new();

        const wsSummary = utils.json_to_sheet(summaryData);
        // Style columns for Summary
        wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
        utils.book_append_sheet(wb, wsSummary, "Зведення");

        const wsDetails = utils.json_to_sheet(detailsData);
        // Style columns for Details: Date, UID, No, Product, Weight, Sort
        wsDetails['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 10 }];
        utils.book_append_sheet(wb, wsDetails, "Деталі");

        // Use 'array' type for Blob/File creation
        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const filename = `Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        return new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    };

    const getCSVContent = (dataset: LabelData[] = history): string => {
        const BOM = "\uFEFF";
        const headers = ["Дата", "Час", "Продукт", "SKU", "№", "Сорт", "Вага (кг)", "Статус"];
        const rows = getDataForExport(dataset).map(r =>
            [r["Дата"], r["Час"], r["Продукт"], r["SKU"], (r as any)["№"], r["Сорт"], r["Вага (кг)"], r["Статус"]]
                .map(val => `"${(val || '').toString().replace(/"/g, '""')}"`)
                .join(",")
        );
        return BOM + headers.join(",") + "\n" + rows.join("\n");
    };

    const exportCsv = async (dataset: LabelData[] = history) => {
        if (dataset.length === 0) { alert("Дані для експорту відсутні"); return; }
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

        const file = generateXLSXFile(dataset);
        const filename = file.name;

        // For Native: need base64
        if (Capacitor.isNativePlatform()) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                try {
                    await Filesystem.writeFile({
                        path: filename,
                        data: base64data,
                        directory: Directory.Documents
                    });
                    alert(`✅ Excel збережено у Documents:\n${filename}`);
                } catch (e) { alert('❌ Excel save failed: ' + e); }
            };
            reader.readAsDataURL(file);
        } else {
            // Web
            const url = URL.createObjectURL(file);
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

        // Generate body with aggregation
        let body = `Звіт за ${dateStr}\n\nЗАГАЛОМ:\nКількість: ${count} шт\nВага: ${totalWeight} кг\n\n`;

        // Add simple aggregation text to email body too
        const aggMap: Record<string, { count: number, weight: number }> = {};
        dataset.forEach(item => {
            const key = item.product?.name || 'Unknown';
            if (!aggMap[key]) aggMap[key] = { count: 0, weight: 0 };
            aggMap[key].count++;
            aggMap[key].weight += parseFloat(item.weight) || 0;
        });

        body += "ПО ПРОДУКТАХ:\n";
        Object.entries(aggMap).forEach(([name, stats]) => {
            body += `- ${name}: ${stats.count} шт, ${stats.weight.toFixed(1)} кг\n`;
        });

        body += `\nФайл Excel (.xlsx) з деталями та зведенням додається.`;

        // 1. Generate XLSX File
        const file = generateXLSXFile(dataset);

        // 2. Try EmailJS
        const { EmailService } = await import('../services/email');
        if (EmailService.isConfigured()) {
            const recipient = reportEmail || localStorage.getItem('zebra_report_email_v1') || '';
            if (recipient) {
                try {
                    await EmailService.sendReport(dataset, recipient, file); // Updated to pass file
                    return { success: true, message: `Звіт відправлено на ${recipient}`, file };
                } catch (e) {
                    console.error("EmailJS sending failed", e);
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
            }
        }

        return { success: false, message: "Авто-відправка не вдалася. Спробуйте завантажити файл вручну.", file };
    };

    return {
        history,
        checkDuplicate,
        addToHistory,
        // addDummyData, // Removed
        clearHistory,
        exportCsv,
        exportXlsx,
        sendEmail,
        reportEmail,
        setReportEmail: saveReportEmail,
        // Reporting
        generateReport,
        reportSummary,
        reportAggregation, // Exposed
        reportData,
        updateHistoryEntry,
        deleteHistoryEntry
    };
}
