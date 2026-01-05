import { LabelData, User } from '../types';

const SHIFT_STORAGE_KEY = 'zebra_active_shift_v1';
const SHIFT_HISTORY_KEY = 'zebra_shift_history_v1';

export interface Shift {
    id: string;
    userId: string;
    userName: string;
    startTime: number;
    endTime?: number;
    isActive: boolean;
    printCount: number;
    totalWeight: number;
    prints: LabelData[];
}

export interface ShiftSummary {
    duration: string;
    printCount: number;
    totalWeight: number;
    topProducts: { name: string; count: number }[];
}

class ShiftService {
    private activeShift: Shift | null = null;
    private shiftHistory: Shift[] = [];

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        try {
            const active = localStorage.getItem(SHIFT_STORAGE_KEY);
            if (active) {
                this.activeShift = JSON.parse(active);
            }
            const history = localStorage.getItem(SHIFT_HISTORY_KEY);
            if (history) {
                this.shiftHistory = JSON.parse(history);
            }
        } catch (e) {
            console.error('Failed to load shift data:', e);
        }
    }

    private saveToStorage() {
        try {
            if (this.activeShift) {
                localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(this.activeShift));
            } else {
                localStorage.removeItem(SHIFT_STORAGE_KEY);
            }
            localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(this.shiftHistory.slice(-50)));
        } catch (e) {
            console.error('Failed to save shift data:', e);
        }
    }

    openShift(user: User): Shift {
        if (this.activeShift) {
            throw new Error('Зміна вже відкрита. Спочатку закрийте поточну зміну.');
        }

        const shift: Shift = {
            id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            userName: user.name,
            startTime: Date.now(),
            isActive: true,
            printCount: 0,
            totalWeight: 0,
            prints: []
        };

        this.activeShift = shift;
        this.saveToStorage();
        console.log('📂 Shift opened:', shift);
        return shift;
    }

    closeShift(): { shift: Shift; summary: ShiftSummary } {
        if (!this.activeShift) {
            throw new Error('Немає активної зміни для закриття.');
        }

        this.activeShift.endTime = Date.now();
        this.activeShift.isActive = false;

        const summary = this.calculateSummary(this.activeShift);

        this.shiftHistory.push(this.activeShift);
        const closedShift = this.activeShift;
        this.activeShift = null;
        this.saveToStorage();

        console.log('📁 Shift closed:', closedShift, summary);
        return { shift: closedShift, summary };
    }

    addPrintToShift(labelData: LabelData): void {
        if (!this.activeShift) {
            console.warn('No active shift to add print to');
            return;
        }

        this.activeShift.prints.push(labelData);
        this.activeShift.printCount++;
        this.activeShift.totalWeight += parseFloat(String(labelData.weight)) || 0;
        this.saveToStorage();
    }

    getCurrentShift(): Shift | null {
        return this.activeShift;
    }

    getShiftHistory(): Shift[] {
        return [...this.shiftHistory].reverse();
    }

    hasActiveShift(): boolean {
        return this.activeShift !== null && this.activeShift.isActive;
    }

    private calculateSummary(shift: Shift): ShiftSummary {
        const duration = this.formatDuration(shift.startTime, shift.endTime || Date.now());

        // Calculate top products
        const productCounts: { [key: string]: number } = {};
        shift.prints.forEach(p => {
            const name = p.productName || 'Невідомо';
            productCounts[name] = (productCounts[name] || 0) + 1;
        });
        const topProducts = Object.entries(productCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        return {
            duration,
            printCount: shift.printCount,
            totalWeight: shift.totalWeight,
            topProducts
        };
    }

    private formatDuration(startMs: number, endMs: number): string {
        const diff = endMs - startMs;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}г ${minutes}хв`;
    }

    getShiftPrints(): LabelData[] {
        return this.activeShift?.prints || [];
    }
}

// Singleton
export const shiftService = new ShiftService();
