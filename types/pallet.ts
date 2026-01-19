export interface BatchItem {
    serialNumber: number;
    weight: number;
    productName: string;
    sort: string; // The grade/quality
    date: string;
    productionItemId?: string; // Link to ProductionItem.id for status updates
    sku?: string;
    barcode?: string;
    // Original ZPL or parsed data could be stored here if needed
}

export interface Batch {
    id: string; // Unique Pallet ID (e.g., "P-20251224-001")
    date: string;
    items: BatchItem[];
    totalWeight: number;
    sort: string; // The sort for the *entire* batch. All items must match or be compatible.
    status: 'open' | 'closed'; // Open = building, Closed = printed/finalized
    displayId?: string;
    locationId?: string;

    // Shipping
    shipmentId?: string;
    shippedAt?: string;
}
