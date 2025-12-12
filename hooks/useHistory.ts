import { useState, useEffect } from 'react';
import { LabelData } from '../types';
import { DataManager } from '../services/dataManager'; // Added DataManager import
import { Capacitor } from '@capacitor/core';

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
    const generateCSV = (): File => {
        const BOM = "\uFEFF";
        const headers = ["Дата", "Час", "Продукт", "SKU", "Вага (кг)", "Серійний номер"];

        const csvRows = history.map(item => {
            const dateObj = new Date(item.date); // item.date is stored as string in history? Check LabelData.
            // LabelData.date is a string. But for sorting/time we usually used ISO.
            // In App.tsx: date: today (locale string or ISO?). 
            // App.tsx: const today = new Date().toLocaleDateString('uk-UA');
            // If it is just date, time is lost.

            // Wait, previous code used item.timestamp in useHistory (HistoryItem type).
            // But App.tsx passes `timestamp: new Date().toISOString()` when calling addToHistory.
            // So item has timestamp.

            const ts = (item as any).timestamp || new Date().toISOString();
            const dateObjCorrect = new Date(ts);

            const timeStr = dateObjCorrect.toLocaleTimeString('uk-UA');
            const escape = (text: string) => `"${text.replace(/"/g, '""')}"`;

            return [
                escape(item.date),
                escape(timeStr),
                escape(item.product?.name || ""),
                escape(item.product?.sku || ""),
                escape(item.weight),
                item.serialNumber
            ].join(",");
        });

        const csvString = BOM + headers.join(",") + "\n" + csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

        const filename = `ZebraLog_${new Date().toISOString().split('T')[0]}.csv`;
        return new File([blob], filename, { type: 'text/csv' });
    };

    const exportCsv = () => {
        if (history.length === 0) {
            alert("Історія друку порожня");
            return;
        }
        const file = generateCSV();
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
            const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(Увага: Файл CSV був завантажений на ваш пристрій. Будь ласка, прикріпіть його до цього листа вручну.)")}`;
            window.location.href = mailtoLink;
        }, 500);
    };

    return {
        history,
        addToHistory,
        clearHistory,
        exportCsv,
        sendEmail
    };
}
