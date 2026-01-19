import { ProductionItem } from '../types/production';
import { supabase } from './supabaseClient';

// reuse simple parser if needed, or duplicate logic to keep decoupled for now
const parseBarcodeSimple = (code: string) => {
    try {
        const parts = code.split('-');
        if (parts.length < 4) return null;
        return {
            date: parts[0],
            name: parts[1],
            serial: parseInt(parts[2]),
            weight: parseFloat(parts[3])
        };
    } catch { return null; }
};

const STORAGE_KEY = 'zebra_production_db_v1';

// ProductionService.ts (Updated for Supabase)
const USE_SUPABASE = true; // TOGGLE: Set to true to use Supabase
const USE_API = false; // Legacy Mock API toggle
const API_URL = ''; // Placeholder for legacy API URL

export const ProductionService = {
    // --- State ---

    // NEW: Async Fetch from Supabase
    async fetchItems(): Promise<ProductionItem[]> {
        // Fallback to local if credentials missing in env (though USE_SUPABASE forces check)
        if (!USE_SUPABASE || !supabase) return this.getItemsLocal();

        try {
            const { data, error } = await supabase
                .from('production_items')
                .select('*, locations(code)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data) return [];

            return data.map((i: any) => ({
                id: i.id,
                barcode: i.barcode,
                date: i.date,
                productName: i.product_name,
                productNameEn: i.product_name_en,
                serialNumber: i.serial_number,
                weight: i.weight,
                status: i.status as any, // 'created' | 'graded' | ...
                sort: i.sort,
                createdAt: i.created_at,
                // labUserId: i.lab_user_id, // Add if needed
                labUserId: i.lab_user_id,
                labNotes: i.lab_notes, // Map from DB
                operatorId: i.operator_id,
                batchId: i.batch_id,
                updatedAt: i.updated_at, // Vital for tracking grading time
                gradedAt: i.updated_at, // Proxy for gradedAt since we update updated_at on grading
                importBatchId: i.import_batch_id, // For Print Hub grouping
                printedAt: i.printed_at, // For Print Hub status tracking
                locationId: i.location_id,
                locationCode: i.locations?.code // Mapped from join
            }));
        } catch (e) {
            console.error("Supabase Fetch Failed, falling back to local", e);
            // Optional: fallback to local if offline? 
            // For now, let's mix: if fetch fails, maybe return local? 
            // Or better: just alert error? Let's return local for safety.
            return this.getItemsLocal();
        }
    },

    // Old Sync Method (now 'getItemsLocal')
    getItemsLocal(): ProductionItem[] {
        let items: ProductionItem[] = [];
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                items = JSON.parse(data);
            }
        } catch (e) {
            console.error("Error loading production db", e);
        }

        // Bridge Logic (Sync History)
        this.syncHistoryToLocal(items);

        if (items.length === 0) {
            // return this.generateMockData();
            return [];
        }

        return items.sort((a, b) => b.serialNumber - a.serialNumber);
    },

    // Extracted Sync Logic
    syncHistoryToLocal(items: ProductionItem[]) {
        try {
            const historyStr = localStorage.getItem('zebra_print_history_v1');
            if (historyStr) {
                const historyItems: any[] = JSON.parse(historyStr);
                let hasNew = false;
                historyItems.forEach(hItem => {
                    const uniqueId = hItem.id || `auto-${hItem.serialNumber}-${hItem.product?.id || hItem.productName}`;
                    const exists = items.some(pi => pi.id === uniqueId || (pi.serialNumber === hItem.serialNumber && pi.productName === (hItem.product?.name || hItem.productName)));
                    if (!exists) {
                        const newItem: ProductionItem = {
                            id: uniqueId,
                            barcode: hItem.barcode || `${hItem.date}-${hItem.product?.id || 'UNK'}-${hItem.serialNumber}-${hItem.weight}`,
                            date: hItem.date,
                            productName: hItem.product?.name || hItem.productName || 'Unknown',
                            productNameEn: hItem.product?.name_en,
                            serialNumber: parseInt(hItem.serialNumber),
                            weight: parseFloat(hItem.weight),
                            status: 'created',
                            createdAt: hItem.timestamp
                        };
                        items.push(newItem);
                        hasNew = true;

                        // NEW: If API is valid, try to push this new item to server immediately
                        if (USE_SUPABASE) this.postItemToApi(newItem);
                    }
                });
                if (hasNew) {
                    console.log("Synced new items from Operator History to Production DB");
                    this.saveItemsLocal(items);
                }
            }
        } catch (e) { console.error(e); }
    },


    async postItemToApi(item: ProductionItem) {
        if (!USE_SUPABASE || !supabase) return;

        try {
            const dbItem = {
                serial_number: item.serialNumber,
                product_name: item.productName,
                product_name_en: item.productNameEn,
                weight: item.weight,
                date: item.date,
                status: item.status,
                sort: item.sort,
                lab_notes: item.labNotes, // Map to DB
                barcode: item.barcode,
                created_at: item.createdAt || new Date().toISOString(),
                operator_id: item.operatorId
            };

            const { data, error } = await supabase
                .from('production_items')
                .upsert(dbItem, { onConflict: 'serial_number, product_name, date' }) // Prevent duplicates
                .select();

            if (error) {
                console.error("Supabase UPSERT Error:", error);
            } else {
                console.log("Supabase Saved:", data);
            }
        } catch (e) { console.error("Failed to POST item to Supabase", e); }
    },

    saveItemsLocal(items: ProductionItem[]) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    },

    // --- Actions ---

    // Updated to be Async-Compatible
    async getPendingItems(): Promise<ProductionItem[]> {
        const items = await this.fetchItems();

        // Lab only works with:
        const allowed = [
            'Довге волокно', 'Long Fiber',
            'Коротке волокно', 'Short Fiber'
        ];

        return items.filter(i =>
            i.status === 'created' &&
            allowed.some(name => i.productName.includes(name))
        );
    },

    async getGradedItems(): Promise<ProductionItem[]> {
        const items = await this.fetchItems();
        // Return only 'graded' items that are NOT palletized or shipped yet
        // NEW: Also exclude items that are currently in an open pallet (have a batchId)
        return items.filter(i => i.status === 'graded' && !i.batchId);
    },

    async getItemsByBatchId(batchId: string): Promise<ProductionItem[]> {
        const items = await this.fetchItems();
        return items.filter(i => i.batchId === batchId);
    },

    async palletizeItems(ids: string[], batchId: string): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                // Bulk update status to 'palletized'
                const { error } = await supabase
                    .from('production_items')
                    .update({
                        status: 'palletized',
                        batch_id: batchId,
                        // palletizedAt: new Date().toISOString() // Not in schema, relying on updated_at? Or maybe we missed it. 
                        // Schema has updated_at.
                    })
                    .in('id', ids);

                if (error) console.error("Supabase Palletize Error", error);
                return;
            } catch (e) { console.error("Supabase Palletize Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        let updated = false;

        ids.forEach(id => {
            const idx = items.findIndex(i => i.id === id);
            if (idx !== -1) {
                items[idx] = {
                    ...items[idx],
                    status: 'palletized',
                    batchId: batchId,
                    palletizedAt: new Date().toISOString()
                };
                updated = true;
            }
        });

        if (updated) {
            this.saveItemsLocal(items);
        }
    },

    // 🧪 BETA: Update production item when operator edits history entry
    async updateItemFromHistory(oldEntry: any, newEntry: any): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                // We need to match by identifying fields: serial, product_name, date
                // AND status must be 'created' (to be safe)

                const { error, data } = await supabase
                    .from('production_items')
                    .update({
                        weight: parseFloat(newEntry.weight),
                        product_name: newEntry.product?.name,
                        product_name_en: newEntry.product?.name_en,
                        serial_number: newEntry.serialNumber,
                        barcode: newEntry.barcode
                    })
                    .eq('serial_number', oldEntry.serialNumber)
                    .eq('product_name', oldEntry.product?.name)
                    .eq('date', oldEntry.date)
                    .eq('status', 'created') // Safety check
                    .select();

                if (error) console.error("Supabase Update From History Error", error);
                else console.log("Supabase Updated Item:", data);

                if (data && data.length === 0) {
                    console.warn("Supabase: No item found to update or status was not 'created'");
                    // Optional: Alert user?
                }
                return;
            } catch (e) { console.error("Supabase Update Failed", e); }
        }

        // Fallback Local
        // Find matching production item by serial + product + date
        const items = this.getItemsLocal();
        const idx = items.findIndex(i =>
            i.serialNumber === oldEntry.serialNumber &&
            i.productName === oldEntry.product?.name &&
            i.date === oldEntry.date
        );

        if (idx === -1) {
            console.warn('[BETA] Production item not found for history entry', oldEntry);
            return;
        }

        // Only allow edits if status is 'created' (not yet processed by lab)
        if (items[idx].status !== 'created') {
            console.warn('[BETA] Cannot edit item with status:', items[idx].status);
            alert('Неможливо редагувати: цей бейл вже оброблено лабораторією');
            return;
        }

        // Update the item
        items[idx] = {
            ...items[idx],
            weight: parseFloat(newEntry.weight),
            productName: newEntry.product?.name || items[idx].productName,
            productNameEn: newEntry.product?.name_en || items[idx].productNameEn,
            serialNumber: newEntry.serialNumber,
            barcode: newEntry.barcode || items[idx].barcode
        };

        this.saveItemsLocal(items);
        console.log('[BETA] Updated production item:', items[idx]);
    },

    async unpalletizeItems(ids: string[]): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                const { error } = await supabase
                    .from('production_items')
                    .update({
                        status: 'graded',
                        batch_id: null,
                        // palletizedAt: null 
                    })
                    .in('id', ids);

                if (error) console.error("Supabase Unpalletize Error", error);
                return;
            } catch (e) { console.error("Supabase Unpalletize Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        let updated = false;

        ids.forEach(id => {
            const idx = items.findIndex(i => i.id === id);
            if (idx !== -1) {
                items[idx] = {
                    ...items[idx],
                    status: 'graded',
                    batchId: undefined,
                    palletizedAt: undefined
                };
                updated = true;
            }
        });

        if (updated) {
            this.saveItemsLocal(items);
        }
    },

    async shipItems(ids: string[]): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                const { error } = await supabase
                    .from('production_items')
                    .update({ status: 'shipped' })
                    .in('id', ids);

                if (error) console.error("Supabase Ship Error", error);
                return;
            } catch (e) { console.error("Supabase Ship Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        let updated = false;

        ids.forEach(id => {
            const idx = items.findIndex(i => i.id === id);
            if (idx !== -1) {
                items[idx] = {
                    ...items[idx],
                    status: 'shipped',
                    shippedAt: new Date().toISOString()
                };
                updated = true;
            }
        });

        if (updated) {
            this.saveItemsLocal(items);
        }
    },

    async gradeItem(id: string, sort: string, userId: string, notes?: string): Promise<ProductionItem> {
        if (USE_SUPABASE && supabase) {
            try {
                const { data, error } = await supabase
                    .from('production_items')
                    .update({
                        status: 'graded',
                        sort: sort,
                        lab_notes: notes, // Save notes
                        lab_user_id: userId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;

                // Return mapped item
                return {
                    id: data.id,
                    serialNumber: data.serial_number,
                    productName: data.product_name,
                    productNameEn: data.product_name_en,
                    weight: data.weight,
                    date: data.date,
                    status: data.status,
                    sort: data.sort,
                    labNotes: data.lab_notes,
                    barcode: data.barcode,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at
                };
            } catch (e) {
                console.error("Supabase Grade Failed", e);
                throw e; // Propagate error so UI knows
            }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) throw new Error("Item not found");

        const updatedItem = {
            ...items[idx],
            status: 'graded' as const,
            sort,
            gradedAt: new Date().toISOString(),
            labNotes: notes,
            labUserId: userId
        };
        items[idx] = updatedItem;
        this.saveItemsLocal(items);
        return updatedItem;
    },

    async revertGrade(id: string): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                const { error } = await supabase
                    .from('production_items')
                    .update({
                        status: 'created',
                        sort: null,
                        lab_notes: null,
                        lab_user_id: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;
                return;
            } catch (e) { console.error("Supabase Revert Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1) {
            items[idx] = {
                ...items[idx],
                status: 'created',
                sort: undefined,
                gradedAt: undefined,
                labNotes: undefined,
                labUserId: undefined
            };
            this.saveItemsLocal(items);
        }
    },

    // --- Return to Lab ---
    async returnToLab(id: string): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                // Reset to 'created', clear sort/notes
                const { error } = await supabase
                    .from('production_items')
                    .update({
                        status: 'created',
                        sort: null,
                        lab_notes: null,
                        lab_user_id: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;
                return;
            } catch (e) {
                console.error("Supabase ReturnToLab Failed", e);
                throw e;
            }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1) {
            items[idx] = {
                ...items[idx],
                status: 'created',
                sort: undefined,
                labNotes: undefined,
                labUserId: undefined
            };
            this.saveItemsLocal(items);
        }
    },

    // --- Full CRUD for Journal ---

    async getAllItems(): Promise<ProductionItem[]> {
        // Return ALL items for the journal (history view)
        return await this.fetchItems();
    },

    async createItem(item: ProductionItem): Promise<ProductionItem> {
        if (USE_SUPABASE && supabase) {
            try {
                const dbItem = {
                    serial_number: item.serialNumber,
                    product_name: item.productName,
                    product_name_en: item.productNameEn,
                    weight: item.weight,
                    date: item.date,
                    status: item.status,
                    sort: item.sort,
                    lab_notes: item.labNotes,
                    barcode: item.barcode,
                    created_at: item.createdAt || new Date().toISOString(),
                    operator_id: item.operatorId,
                    import_batch_id: item.importBatchId || null,
                    printed_at: item.printedAt || null
                };

                const { data, error } = await supabase
                    .from('production_items')
                    .upsert(dbItem, { onConflict: 'serial_number, product_name, date' })
                    .select()
                    .single();

                if (error) throw error;

                return {
                    ...item,
                    id: data.id, // Update with real ID from DB
                    createdAt: data.created_at
                };
            } catch (e) { console.error("Supabase Create Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        items.push(item);
        this.saveItemsLocal(items);
        return item;
    },

    async updateItem(item: ProductionItem): Promise<void> {
        if (USE_API) {
            try {
                await fetch(`${API_URL}/items/${item.id}`, {
                    method: 'PUT', // or PATCH
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
            } catch (e) { console.error("API Update Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        const idx = items.findIndex(i => i.id === item.id);
        if (idx !== -1) {
            items[idx] = item;
            this.saveItemsLocal(items);
        }
    },

    async deleteItem(id: string): Promise<void> {
        if (USE_API) {
            try {
                await fetch(`${API_URL}/items/${id}`, {
                    method: 'DELETE'
                });
            } catch (e) { console.error("API Delete Failed", e); }
        }

        // Fallback Local
        const items = this.getItemsLocal();
        const filtered = items.filter(i => i.id !== id);
        this.saveItemsLocal(filtered);
    },

    async setPrintedStatus(id: string, printedAt: string): Promise<void> {
        if (USE_SUPABASE && supabase) {
            try {
                const { error } = await supabase
                    .from('production_items')
                    .update({ printed_at: printedAt })
                    .eq('id', id);

                if (error) console.error("Supabase Print Status Error", error);
            } catch (e) { console.error("Supabase Print Status Failed", e); }
            return;
        }

        // Fallback Local
        const items = this.getItemsLocal();
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1) {
            items[idx].printedAt = printedAt;
            this.saveItemsLocal(items);
        }
    },

    // --- Mock Data Generator (Keep for Fallback) ---
    generateMockData(): ProductionItem[] {
        const mockItems: ProductionItem[] = [];
        const products = ['LF', 'SF', 'HC'];
        const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('.'); // 24.12.2025
        for (let i = 1; i <= 20; i++) {
            const pName = products[Math.floor(Math.random() * products.length)];
            const weight = (Math.random() * 5 + 20).toFixed(1);
            const serial = 1000 + i;
            mockItems.push({
                id: crypto.randomUUID(),
                barcode: `${today}-${pName}-${serial}-${weight}`,
                date: today,
                productName: pName,
                serialNumber: serial,
                weight: parseFloat(weight),
                status: i <= 5 ? 'graded' : 'created',
                sort: i <= 5 ? '1 Сорт' : undefined,
                gradedAt: i <= 5 ? new Date().toISOString() : undefined
            });
        }
        this.saveItemsLocal(mockItems);
        return mockItems;
    },

    // --- Serial Number Management ---

    /**
     * Find item by serial number AND product name
     * Returns null if not found
     */
    async findBySerialAndProduct(serialNumber: number, productName: string): Promise<ProductionItem | null> {
        if (USE_SUPABASE && supabase) {
            try {
                const { data, error } = await supabase
                    .from('production_items')
                    .select('*')
                    .eq('serial_number', serialNumber)
                    .eq('product_name', productName)
                    .maybeSingle();

                if (error) throw error;
                if (!data) return null;

                return {
                    id: data.id,
                    barcode: data.barcode,
                    date: data.date,
                    productName: data.product_name,
                    productNameEn: data.product_name_en,
                    serialNumber: data.serial_number,
                    weight: data.weight,
                    status: data.status,
                    sort: data.sort,
                    createdAt: data.created_at,
                    labNotes: data.lab_notes,
                    operatorId: data.operator_id,
                    batchId: data.batch_id,
                    importBatchId: data.import_batch_id,
                    printedAt: data.printed_at
                };
            } catch (e) {
                console.error("Supabase findBySerialAndProduct failed", e);
                return null;
            }
        }

        // Local fallback
        const items = this.getItemsLocal();
        return items.find(i => i.serialNumber === serialNumber && i.productName === productName) || null;
    },

    /**
     * Get maximum serial number for a specific product
     * Returns 0 if no items found
     */
    async getMaxSerialNumber(productName: string): Promise<number> {
        if (USE_SUPABASE && supabase) {
            try {
                const { data, error } = await supabase
                    .from('production_items')
                    .select('serial_number')
                    .eq('product_name', productName)
                    .order('serial_number', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                return data?.serial_number || 0;
            } catch (e) {
                console.error("Supabase getMaxSerialNumber failed", e);
                return 0;
            }
        }

        // Local fallback
        const items = this.getItemsLocal().filter(i => i.productName === productName);
        if (items.length === 0) return 0;
        return Math.max(...items.map(i => i.serialNumber));
    }
};
