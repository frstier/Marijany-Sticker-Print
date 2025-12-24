import { GradedItem, LabStats } from '../types/lab';
import { PalletService } from './palletService'; // Reuse barcode parser if possible

const LAB_STORAGE_KEY = 'zebra_lab_grades_v1';

export const GradingService = {
    // --- State ---

    getGradedItems(): GradedItem[] {
        try {
            const data = localStorage.getItem(LAB_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Failed to load graded items", e);
            return [];
        }
    },

    saveGradedItems(items: GradedItem[]) {
        localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(items));
    },

    // --- Actions ---

    saveGrade(barcode: string, sort: string, userId: string): GradedItem {
        const parsed = PalletService.parseBarcode(barcode);
        if (!parsed) throw new Error("Невірний формат штрих-коду");

        const items = this.getGradedItems();

        // Check if already graded?
        // Ideally yes, but maybe we want to allow re-grading (correction).
        // Let's allow re-grading by checking if serial+date exists and updating it, or just append new record.
        // For simple log, let's append but maybe warn in UI. 
        // Logic: If same serial exists for same date, OVERWRITE.

        const existingIndex = items.findIndex(i => i.serialNumber === parsed.serialNumber && i.date === parsed.date && i.productName === parsed.productName);

        const newItem: GradedItem = {
            id: existingIndex >= 0 ? items[existingIndex].id : crypto.randomUUID(),
            originalBarcode: barcode,
            date: parsed.date,
            productName: parsed.productName,
            serialNumber: parsed.serialNumber,
            weight: parsed.weight,
            assignedSort: sort,
            gradedAt: new Date().toISOString(),
            labUserId: userId
        };

        if (existingIndex >= 0) {
            items[existingIndex] = newItem;
        } else {
            items.push(newItem);
        }

        this.saveGradedItems(items);
        return newItem;
    },

    getDailyStats(): LabStats {
        const items = this.getGradedItems();
        // Filter for today? Or all time? User asked for "accepted per day".
        // Let's assume the dashboard shows TODAY'S work.

        // Match "DD.MM.YYYY" from barcode date or use gradedAt? 
        // Use gradedAt to reflect work done TODAY.
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const todaysItems = items.filter(i => i.gradedAt.startsWith(todayStr));

        return todaysItems.reduce((acc, item) => {
            acc.totalItems += 1;
            acc.totalWeight += item.weight;
            acc.bySort[item.assignedSort] = (acc.bySort[item.assignedSort] || 0) + 1;
            return acc;
        }, {
            totalItems: 0,
            totalWeight: 0,
            bySort: {}
        } as LabStats);
    }
};
