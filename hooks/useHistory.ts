import { useState, useEffect } from 'react';
import { LabelData } from '../types';
import { DataManager } from '../services/dataManager'; // Added DataManager import
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const LOCAL_STORAGE_HISTORY_KEY = 'zebra_print_history_v1';

export function useHistory() {
    const [history, setHistory] = useState<LabelData[]>([]);

    useEffect(() => {
        const loadHistory = async () => {
            // 1. Try DataManager Service
            try {
                const service = DataManager.getService();
                // If NOT web, or if configured to use Supabase, we fetch remote/db history.
                // For now, let's just attempt to fetch if not pure local web fallback.
                // Actually, DataManager routing should handle "is it a service we want to read from?".
                // If default web -> uses DatabaseService -> detects web -> returns empty.

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
            // Optional: Clear DB too? For now, keep DB as 'Archive' and only clear local view.
        }
    };

    // Export Logic
    // Helper to get raw CSV string
    const getCSVContent = (): string => {
        const BOM = "\uFEFF";
        const headers = ["Дата", "Час", "Продукт", "SKU", "Вага (кг)", "Серійний номер"];

        const csvRows = history.map(item => {
            const ts = (item as any).timestamp || new Date().toISOString(); // Fallback
            let dateObj: Date;
            try {
                dateObj = new Date(ts);
                if (isNaN(dateObj.getTime())) throw new Error("Invalid Date");
            } catch {
                dateObj = new Date();
            }

            const timeStr = dateObj.toLocaleTimeString('uk-UA');
            // Use date from item if it's a string, or format dateObj
            const dateStr = typeof item.date === 'string' ? item.date : dateObj.toLocaleDateString('uk-UA');

            const escape = (text: string) => `"${(text || '').toString().replace(/"/g, '""')}"`;

            return [
                escape(dateStr),
                escape(timeStr),
                escape(item.product?.name || ""),
                escape(item.product?.sku || ""),
                escape(item.weight),
                item.serialNumber
            ].join(",");
        });

        return BOM + headers.join(",") + "\n" + csvRows.join("\n");
    };

    // Legacy File object generator for Web Share API
    const generateCSV = (): File => {
        const csvString = getCSVContent();
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const filename = `ZebraLog_${new Date().toISOString().split('T')[0]}.csv`;
        return new File([blob], filename, { type: 'text/csv' });
    };

    const exportCsv = async () => {
        if (history.length === 0) {
            alert("Історія друку порожня");
            return;
        }

        if (Capacitor.isNativePlatform()) {
            // NATIVE: Write to Documents
            try {
                const csvContent = getCSVContent();
                const fileName = `ZebraLog_${new Date().toISOString().split('T')[0]}.csv`;

                await Filesystem.writeFile({
                    path: fileName,
                    data: csvContent,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });

                alert(`✅ Звіт збережено у папку Documents:\n${fileName}`);
            } catch (e) {
                console.error(e);
                alert('❌ Помилка збереження файлу: ' + e);
            }
        } else {
            // WEB: Download Link
            const file = generateCSV();
            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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

    const sendEmail = async () => {
        if (history.length === 0) {
            alert("Історія друку порожня");
            return;
        }

        const file = generateCSV();
        const subject = `Production Log - ${new Date().toLocaleDateString('uk-UA')}`;
        const body = `Звіт виробництва за ${new Date().toLocaleDateString('uk-UA')}.\n\nФайл звіту додається.`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: subject,
                    text: body,
                    files: [file]
                });
                return;
            } catch (err) {
                console.log("Share API failed", err);
            }
        }

        exportCsv();
        setTimeout(() => {
            const recipient = reportEmail ? reportEmail : '';
            const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(Увага: Файл CSV був завантажений на ваш пристрій. Будь ласка, прикріпіть його до цього листа вручну.)")}`;
            window.location.href = mailtoLink;
        }, 500);
    };

    const checkDuplicate = (productId: string, serialNumber: number): boolean => {
        return history.some(item => item.product?.id === productId && item.serialNumber === serialNumber);
    };

    return {
        history,
        checkDuplicate,
        addToHistory,
        clearHistory,
        exportCsv,
        sendEmail,
        reportEmail,
        setReportEmail: saveReportEmail
    };
}
