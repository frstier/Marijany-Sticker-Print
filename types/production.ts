export type ItemStatus = 'created' | 'graded' | 'palletized' | 'shipped';

export interface ProductionItem {
    id: string;
    barcode: string; // "24.12.2025-LF-101-50.5"

    // Parsed info
    date: string;
    productName: string;
    productNameEn?: string; // Optional English name
    serialNumber: number;
    weight: number;
    createdAt?: string;

    // Status
    status: ItemStatus;

    // Lab Data
    sort?: string;
    gradedAt?: string;
    labUserId?: string;

    // Accountant Data
    batchId?: string; // If palletized
    palletizedAt?: string;

    // Shipping Data
    shippedAt?: string;
}
