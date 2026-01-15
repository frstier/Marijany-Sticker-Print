// =====================================================
// Shipping Types
// =====================================================

export type ShipmentStatus = 'draft' | 'loading' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled';

export interface Shipment {
    id: string;
    shipmentNumber: string;           // e.g., "SH-20260115-001"

    // Destination & Transport
    destination: string;
    destinationAddress?: string;
    carrier?: string;                 // Transport company
    truckNumber?: string;
    driverName?: string;
    driverPhone?: string;

    // Status
    status: ShipmentStatus;

    // Timestamps
    scheduledDate?: string;
    shippedAt?: string;
    deliveredAt?: string;
    createdAt: string;
    updatedAt?: string;

    // Details
    notes?: string;
    cmrNumber?: string;
    totalWeight: number;
    totalPallets: number;

    // Items
    items: ShipmentItem[];

    // Audit
    createdBy?: string;
}

export interface ShipmentItem {
    id: string;
    shipmentId: string;
    batchId: string;

    // Denormalized data
    palletWeight: number;
    palletItemCount: number;
    productName: string;
    sort: string;
    displayId?: string;               // Pallet display ID (P-YYYYMMDD-XXX)

    addedAt: string;
    addedBy?: string;
}

// Form data for creating shipment
export interface CreateShipmentData {
    destination: string;
    destinationAddress?: string;
    carrier?: string;
    truckNumber?: string;
    driverName?: string;
    driverPhone?: string;
    scheduledDate?: string;
    notes?: string;
}

// Summary for reports
export interface ShipmentSummary {
    totalShipments: number;
    totalPallets: number;
    totalWeight: number;
    byStatus: Record<ShipmentStatus, number>;
    byDestination: Record<string, number>;
}
