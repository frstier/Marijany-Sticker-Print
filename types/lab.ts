export interface GradedItem {
    id: string; // Unique ID for the grade record
    originalBarcode: string; // The raw barcode from the operator label

    // Parsed Data
    date: string;
    productName: string;
    serialNumber: number;
    weight: number;

    // Assigned by Lab
    assignedSort: string;
    gradedAt: string; // ISO Timestamp
    labUserId: string;
}

export interface LabStats {
    totalItems: number;
    totalWeight: number;
    bySort: Record<string, number>;
}
