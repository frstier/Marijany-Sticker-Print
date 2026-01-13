// Quad (Четвірка) - группа з 4 бейлів одного продукту та сорту

export interface Quad {
    id: string;              // "Q-20260113-001"
    date: string;            // "13.01.2026"
    productName: string;     // "Long Fiber"
    sort: string;            // "1 Сорт"
    totalWeight: number;     // Сума ваг бейлів
    status: QuadStatus;
    items: QuadItem[];       // 4 бейли
    createdBy?: string;      // User ID
    createdAt?: string;
}

export type QuadStatus = 'created' | 'warehouse';

export interface QuadItem {
    id: string;              // production_item.id
    serialNumber: number;
    weight: number;
    barcode: string;
}
