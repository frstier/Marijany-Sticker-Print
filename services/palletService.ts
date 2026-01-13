import { Batch, BatchItem } from '../types/pallet';
import { supabase } from './supabaseClient';

// Mock Storage Keys
const BATCH_STORAGE_KEY = 'zebra_batches_v1';
const BATCH_SEQUENCE_KEY = 'zebra_batch_seq_v1';

const USE_SUPABASE = true;

export const PalletService = {
    // --- State Management ---

    async getBatches(): Promise<Batch[]> {
        if (USE_SUPABASE && supabase) {
            try {
                // Fetch batches AND their items (via production_items)
                // Note: production_items has batch_id
                const { data: batches, error } = await supabase
                    .from('batches')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (!batches) return [];

                // For each batch, we need items. 
                // We could include them in the query: .select('*, items:production_items(*)')
                // Let's try to optimize:
                const { data: items } = await supabase
                    .from('production_items')
                    .select('*')
                    .not('batch_id', 'is', null);

                // Merge
                return batches.map((b: any) => ({
                    id: b.id, // Supabase UUID
                    // If we want to display a shorter number, we might use batch_number or fallback to ID
                    // The UI might expect string ID.
                    displayId: b.batch_number,
                    date: b.created_at,
                    sort: b.sort,
                    status: b.status as any,
                    totalWeight: b.total_weight || 0,
                    items: items
                        ? items.filter((i: any) => i.batch_id === b.id).map((i: any) => ({
                            productionItemId: i.id, // Link to source
                            serialNumber: i.serial_number,
                            weight: i.weight,
                            productName: i.product_name,
                            sort: i.sort,
                            date: i.date,
                            barcode: i.barcode
                        }))
                        : []
                }));
            } catch (e) {
                console.error("Supabase getBatches failed", e);
                // Fallback to local
            }
        }

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

    getNextBatchNumber(): number {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const lastDate = localStorage.getItem('zebra_batch_date_v1');

        if (lastDate !== today) {
            // New day, reset sequence
            localStorage.setItem('zebra_batch_date_v1', today);
            localStorage.setItem(BATCH_SEQUENCE_KEY, '0');
            return 1;
        }

        const seq = parseInt(localStorage.getItem(BATCH_SEQUENCE_KEY) || '0') + 1;
        localStorage.setItem(BATCH_SEQUENCE_KEY, seq.toString());
        return seq;
    },

    async createBatch(sort: string, customId?: string, productName: string = 'Unknown'): Promise<Batch> {
        // Generate Standard ID if not provided
        // Format: P-YYYYMMDD-XXX
        let id = customId;
        if (!id) {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const seq = this.getNextBatchNumber();
            id = `P-${today}-${String(seq).padStart(3, '0')}`;
        }

        if (USE_SUPABASE && supabase) {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // Insert into Supabase
            const { data, error } = await supabase
                .from('batches')
                .insert({
                    sort,
                    product_name: productName,
                    status: 'active',
                    batch_number: id, // Store the formatted ID
                    date: today
                })
                .select()
                .single();

            if (error) {
                console.error("❌ Supabase createBatch FAILED:", error);
                throw new Error(`Failed to create batch: ${error.message}`);
            }

            if (!data) {
                console.error("❌ Supabase createBatch returned no data");
                throw new Error("Failed to create batch: No data returned");
            }

            console.log("✅ Batch created successfully:", data.id, "Display:", data.batch_number);

            return {
                id: data.id, // UUID for internal use
                displayId: data.batch_number, // Formatted ID for display
                date: data.created_at,
                items: [],
                totalWeight: 0,
                sort: data.sort,
                status: data.status as any
            };
        }

        // Local fallback (only if Supabase not enabled)
        const newBatch: Batch = {
            id,
            displayId: id,
            date: new Date().toISOString(),
            items: [],
            totalWeight: 0,
            sort,
            status: 'open'
        };

        const localBatches = await this.getBatches();
        localBatches.push(newBatch);
        this.saveBatches(localBatches);
        return newBatch;
    },

    async updateBatchId(oldId: string, newId: string): Promise<Batch> {
        // Renaming/Renumbering might be tricky in Supabase (UUID vs visible number).
        // Let's assume this is mostly for local 'visual' ID.
        // In Supabase we might map this to 'batch_number'.

        if (USE_SUPABASE && supabase) {
            await supabase
                .from('batches')
                .update({ batch_number: newId })
                .eq('id', oldId);

            // Return updated
            const batches = await this.getBatches();
            return batches.find(b => b.id === oldId)!;
        }

        const batches = await this.getBatches();
        const idx = batches.findIndex(b => b.id === oldId);
        if (idx === -1) throw new Error("Batch not found");

        if (batches.some(b => b.id === newId && b.id !== oldId)) {
            throw new Error(`Batch #${newId} already exists!`);
        }

        batches[idx].id = newId;
        this.saveBatches(batches);

        // Sequence update
        const newNum = parseInt(newId);
        if (!isNaN(newNum)) {
            const currentSeq = parseInt(localStorage.getItem(BATCH_SEQUENCE_KEY) || '0');
            if (newNum > currentSeq) {
                localStorage.setItem(BATCH_SEQUENCE_KEY, newNum.toString());
            }
        }

        return batches[idx];
    },

    async addItemToBatch(batchId: string, item: BatchItem): Promise<Batch> {
        if (USE_SUPABASE && supabase) {
            // 1. Link item to batch
            // We need 'productionItemId' in BatchItem to link correctly!
            // If item comes from 'ProductionService', it has ID.
            if (!item.productionItemId) {
                console.error("Item missing productionItemId", item);
                throw new Error("Cannot add item: missing DB ID");
            }

            const { error } = await supabase
                .from('production_items')
                .update({
                    batch_id: batchId,
                    status: 'palletized' // Ensure status is set
                })
                .eq('id', item.productionItemId);

            if (error) throw error;

            // Optimistic return or single fetch
            // Fetching single batch is faster and reliable if we query by ID
            // But getBatches() fetches ALL. Let's make a getBatchById helper or just fetch one.

            const { data: batchData, error: batchError } = await supabase
                .from('batches')
                .select('*')
                .eq('id', batchId)
                .single();

            if (batchError || !batchData) {
                // Fallback: Single fetch failed, try getBatches
                console.warn("Single batch fetch failed, falling back to getBatches", batchError);
                const batches = await this.getBatches();
                const foundBatch = batches.find(b => b.id === batchId);
                if (!foundBatch) {
                    console.error(`Batch ${batchId} not found in getBatches either`);
                    throw new Error("Batch not found after update");
                }
                return foundBatch;
            }

            // We also need items for this batch to update UI correctly
            const { data: itemsData } = await supabase
                .from('production_items')
                .select('*')
                .eq('batch_id', batchId);

            return {
                id: batchData.id,
                displayId: batchData.batch_number,
                date: batchData.created_at,
                sort: batchData.sort,
                status: batchData.status,
                totalWeight: batchData.total_weight || 0,
                items: itemsData ? itemsData.map((i: any) => ({
                    productionItemId: i.id,
                    serialNumber: i.serial_number,
                    weight: i.weight,
                    productName: i.product_name,
                    sort: i.sort,
                    date: i.date,
                    barcode: i.barcode
                })) : []
            };
        }

        const batches = await this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);

        if (batchIndex === -1) throw new Error("Batch not found");

        if (batches[batchIndex].items.find(i => i.serialNumber === item.serialNumber)) {
            throw new Error("Цей тюк вже додано в цю палету.");
        }

        batches[batchIndex].items.push(item);
        batches[batchIndex].totalWeight = batches[batchIndex].items.reduce((sum, i) => sum + i.weight, 0);

        this.saveBatches(batches);
        return batches[batchIndex];
    },

    async removeItemFromBatch(batchId: string, serialNumber: number): Promise<Batch> {
        if (USE_SUPABASE && supabase) {
            // Find item by serial + batch
            // Or better, we need the ID. 
            // We can query item by serial+batchId

            const { data: items } = await supabase
                .from('production_items')
                .select('id')
                .eq('batch_id', batchId)
                .eq('serial_number', serialNumber)
                .single();

            if (items) {
                await supabase
                    .from('production_items')
                    .update({ batch_id: null, status: 'graded' }) // reset
                    .eq('id', items.id);
            }

            const batches = await this.getBatches();
            return batches.find(b => b.id === batchId)!;
        }

        const batches = await this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);

        if (batchIndex === -1) throw new Error("Batch not found");

        batches[batchIndex].items = batches[batchIndex].items.filter(i => i.serialNumber !== serialNumber);
        batches[batchIndex].totalWeight = batches[batchIndex].items.reduce((sum, i) => sum + i.weight, 0);

        this.saveBatches(batches);
        return batches[batchIndex];
    },

    async closeBatch(batchId: string): Promise<Batch> {
        if (USE_SUPABASE && supabase) {
            await supabase
                .from('batches')
                .update({ status: 'closed', closed_at: new Date().toISOString() })
                .eq('id', batchId);

            const batches = await this.getBatches();
            return batches.find(b => b.id === batchId)!;
        }

        const batches = await this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);
        if (batchIndex === -1) throw new Error("Batch not found");

        batches[batchIndex].status = 'closed';
        this.saveBatches(batches);
        return batches[batchIndex];
    },

    async disbandBatch(batchId: string): Promise<BatchItem[]> {
        if (USE_SUPABASE && supabase) {
            // 1. Get items to return
            const { data: items } = await supabase
                .from('production_items')
                .select('*')
                .eq('batch_id', batchId);

            // 2. Unlink items
            await supabase
                .from('production_items')
                .update({ batch_id: null, status: 'graded' })
                .eq('batch_id', batchId);

            // 3. Delete batch
            await supabase
                .from('batches')
                .delete()
                .eq('id', batchId);

            return items ? items.map((i: any) => ({
                productionItemId: i.id,
                serialNumber: i.serial_number,
                weight: i.weight,
                productName: i.product_name,
                sort: i.sort,
                date: i.date,
                barcode: i.barcode
            })) : [];
        }

        const batches = await this.getBatches();
        const batchIndex = batches.findIndex(b => b.id === batchId);
        if (batchIndex === -1) throw new Error("Batch not found");

        const itemsToReturn = [...batches[batchIndex].items];
        batches.splice(batchIndex, 1);
        this.saveBatches(batches);

        return itemsToReturn;
    },

    // --- Helpers ---

    parseBarcode(barcodeString: string): BatchItem | null {
        try {
            const parts = barcodeString.split('-');
            if (parts.length < 4) return null;
            const [date, sku, serialStr, weightStr] = parts;

            return {
                serialNumber: parseInt(serialStr),
                weight: parseFloat(weightStr),
                productName: sku,
                sort: 'Unknown',
                date: date
            };
        } catch (e) {
            console.error("Parse error", e);
            return null;
        }
    }
};
