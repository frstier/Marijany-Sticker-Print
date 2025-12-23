import { useState, useEffect } from 'react';
import { LabelData } from '../types';
import { DataManager } from '../services/dataManager';
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

    const addToHistory = async (entry: LabelData) => {
        // Update State
        const newHistory = [entry, ...history].slice(0, 100);
        setHistory(newHistory);

        // Save Local
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(newHistory));

        // Save via DataManager (DB or Cloud)
        try {
            await DataManager.getService().addToHistory(entry);
        } catch (e) {
            console.error("Failed to save to DataService", e);
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
                const itemDate = new Date(item.date);
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
                    const itemDate = new Date(ts);
                    return itemDate >= startDate && itemDate <= endDate;
                });

                // Append Deferred Items
                data = [...data, ...deferredItems];

                // Sort by date descending (newest first)
                data.sort((a, b) => {
                    const dateA = new Date((a as any).timestamp || a.date).getTime();
                    const dateB = new Date((b as any).timestamp || b.date).getTime();
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
            let dateObj: Date;
            try {
                dateObj = new Date(item.date || (item as any).timestamp);
                if (isNaN(dateObj.getTime())) dateObj = new Date();
            } catch { dateObj = new Date(); }

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
                "Сорт/Фракція": item.sortValue || "", // Updated to use Value (e.g. "1st Grade") instead of Label ("Sort")
                "Вага (кг)": Number(item.weight),
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
        const headers = ["Дата", "Час", "Продукт", "SKU", "Сорт/Фракція", "Вага (кг)", "Статус"];
        const rows = getDataForExport(dataset).map(r =>
            [r["Дата"], r["Час"], r["Продукт"], r["SKU"], r["Сорт/Фракція"], r["Вага (кг)"], r["Статус"]]
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
    const sendEmail = async (dataset: LabelData[] = history) => {
        if (dataset.length === 0) {
            alert("Дані для експорту відсутні");
            return;
        }

        const dateStr = new Date().toLocaleDateString('uk-UA');
        const count = dataset.length;
        const totalWeight = dataset.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(3);
        const subject = `Звіт виробництва ${dateStr}`;
        const body = `Звіт за ${dateStr}\nКількість: ${count} шт\nВага: ${totalWeight} кг\n\nФайл .xlsx додається.`;

        // 1. Generate XLSX File
        const file = generateXLSXFile(dataset);

        // 2. Try EmailJS (Still text summary mostly, unless we enhance it)
        const { EmailService } = await import('../services/email');
        if (EmailService.isConfigured()) {
            // ... existing logic ...
            const recipient = reportEmail || '';
            if (recipient) {
                try {
                    await EmailService.sendReport(dataset, recipient);
                    alert(`✅ Звіт (текстова версія) відправлено на ${recipient}`);
                    return;
                } catch (e) {
                    console.error("EmailJS sending failed", e);
                    if (!confirm("EmailJS помилка. Спробувати нативний метод (поділитися файлом)?")) return;
                }
            }
        }

        // 3. Fallback: Native Share (Preferred for Files)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: subject,
                    text: body,
                    files: [file]
                });
                return;
            } catch (err) { console.warn("Share failed", err); }
        }

        // 4. Last Resort: Mailto (Manual attachment)
        // We download the file first so user has it
        await exportXlsx(dataset);

        setTimeout(() => {
            const recipient = reportEmail ? reportEmail : '';
            const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(Файл збережено в документах. Будь ласка, прикріпіть його вручну.)")}`;
            window.location.href = mailtoLink;
        }, 1000);
    };

    // NEW: We just return true/false if it exists locally, but we DON'T block in UI anymore based on this alone for "Overwrite" logic.
    // However, to speed up UI, we might still want to know if it's a re-print.
    const checkDuplicate = (productId: string, serialNumber: number): boolean => {
        return history.some(item => item.product?.id === productId && item.serialNumber === serialNumber);
    };

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
                status: 'ok',
                synced: false
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
        reportData
    };
}
