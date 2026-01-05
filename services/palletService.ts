import { Batch, BatchItem } from '../types/pallet';

// Mock Storage Keys
const BATCH_STORAGE_KEY = 'zebra_batches_v1';
const BATCH_SEQUENCE_KEY = 'zebra_batch_seq_v1';

export const PalletService = {
    // --- State Management (Mock DB) ---

    getBatches(): Batch[] {
        try {
            const data = localStorage.getItem(BATCH_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Failed to load batches", e);
            return [];
        }
    },

    saveBatches(batches: Batch[]) {
        localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batches));
    },

    // --- Actions ---

    // --- Actions ---

    getNextBatchNumber(): number {
        return parseInt(localStorage.getItem(BATCH_SEQUENCE_KEY) || '0') + 1;
    },

    createBatch(sort: string, customId?: string): Batch {
        const batches = this.getBatches();

        let id = customId;
        if (!id) {
            // Generate Simplified ID (Start from 1)
            let seq = this.getNextBatchNumber();
            localStorage.setItem(BATCH_SEQUENCE_KEY, seq.toString());
            id = seq.toString();
        }

        const newBatch: Batch = {
            id,
            date: new Date().toISOString(),
            items: [],
            totalWeight: 0,
            sort,
            status: 'open'
        };

        batches.push(newBatch);
        this.saveBatches(batches);
        return newBatch;
    },

    updateBatchId(oldId: string, newId: string): Batch {
        const batches = this.getBatches();
        const idx = batches.findIndex(b => b.id === oldId);
        if (idx === -1) throw new Error("Batch not found");

        // Check collision
        if (batches.some(b => b.id === newId && b.id !== oldId)) {
            throw new Error(`Batch #${newId} already exists!`);
        }

        batches[idx].id = newId;
        this.saveBatches(batches);

        // If the new ID is a number greater than sequence, optionally update sequence?
        // User asked for auto-increment. If user types "100", next should probably be "101".
        const newNum = parseInt(newId);
        if (!isNaN(newNum)) {
            const currentSeq = parseInt(localStorage.getItem(BATCH_SEQUENCE_KEY) || '0');
            if (newNum > currentSeq) {
                localStorage.setItem(BATCH_SEQUENCE_KEY, newNum.toString());
            }
        }

        return batches[idx];
    },

    addItemToBatch(batchId: string, item: BatchItem): Batch {
        const batches = this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);

        if (batchIndex === -1) throw new Error("Batch not found");

        // Validation: Duplicate Check (Global or Batch? currently Global check is safer but let's do Batch for now)
        // Ideally we check if this serial is in ANY open or closed batch to prevent re-palletizing.
        // For MVP, checking current batch.
        if (batches[batchIndex].items.find(i => i.serialNumber === item.serialNumber)) {
            throw new Error("Цей тюк вже додано в цю палету.");
        }

        // Add Item
        batches[batchIndex].items.push(item);

        // Recalculate Totals
        batches[batchIndex].totalWeight = batches[batchIndex].items.reduce((sum, i) => sum + i.weight, 0);

        this.saveBatches(batches);
        return batches[batchIndex];
    },

    removeItemFromBatch(batchId: string, serialNumber: number): Batch {
        const batches = this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);

        if (batchIndex === -1) throw new Error("Batch not found");

        batches[batchIndex].items = batches[batchIndex].items.filter(i => i.serialNumber !== serialNumber);
        // Recalculate Totals
        batches[batchIndex].totalWeight = batches[batchIndex].items.reduce((sum, i) => sum + i.weight, 0);

        this.saveBatches(batches);
        return batches[batchIndex];
    },

    closeBatch(batchId: string): Batch {
        const batches = this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);
        if (batchIndex === -1) throw new Error("Batch not found");

        batches[batchIndex].status = 'closed';
        this.saveBatches(batches);
        return batches[batchIndex];
    },

    disbandBatch(batchId: string): BatchItem[] {
        const batches = this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);
        if (batchIndex === -1) throw new Error("Batch not found");

        const itemsToReturn = [...batches[batchIndex].items];

        // Remove batch from list
        batches.splice(batchIndex, 1);
        this.saveBatches(batches);

        return itemsToReturn;
    },

    // --- Helpers ---

    // Parse Barcode: Expecting our ZPL format if possible, or we need to standardize it.
    // Our QR/Barcodes usually encoded: "{date}-{sku}-{serialNumber}-{weight}" (based on standard interface defaults)
    parseBarcode(barcodeString: string): BatchItem | null {
        try {
            // Example pattern: 24.12.2025-SKU123-1001-50.5
            // OR JSON? The user prompt said: "привязано до партії ... ОБОВЯЗКОВО яке є на вже простікеровано"
            // Let's assume the separators are dashes.

            const parts = barcodeString.split('-');
            if (parts.length < 4) return null;

            // This is a naive parser, assumes standard order. 
            // We might need to make this more robust or look up the serial in our main DB (products/history).

            const [date, sku, serialStr, weightStr] = parts;

            return {
                serialNumber: parseInt(serialStr),
                weight: parseFloat(weightStr),
                productName: sku, // Placeholder, ideally lookup name by SKU
                sort: 'Unknown', // This is tricky. Barcode usually doesn't have Sort unless we added it.
                // User said: "Part is formed from Long Fiber... mandatory that it is already labeled".
                // We might need to look up the PRODUCT details if we have the SKU.
                date: date
            };
        } catch (e) {
            console.error("Parse error", e);
            return null;
        }
    }
};
