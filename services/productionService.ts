import { ProductionItem } from '../types/production';
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

// ProductionService.ts (Updated for API)

const API_URL = 'http://localhost:3000/api';
const USE_API = false; // TOGGLE: Set to true to use Backend

export const ProductionService = {
    // --- State ---

    // NEW: Async Fetch
    async fetchItems(): Promise<ProductionItem[]> {
        if (!USE_API) return this.getItemsLocal(); // Fallback to old sync method

        try {
            const res = await fetch(`${API_URL}/items`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();

            // Map Snake_case (DB) to CamelCase (Frontend) if needed
            // Our API seems to return snake_case for keys based on query `SELECT *`
            // UNLESS we aliased them in the query.
            // Let's assume standard mapping:
            return data.map((i: any) => ({
                id: i.uid || i.id,
                barcode: i.barcode,
                date: i.date,
                productName: i.product_name || i.productName,
                productNameEn: i.product_name_en || i.productNameEn,
                serialNumber: i.serial_number || i.serialNumber,
                weight: parseFloat(i.weight),
                status: i.status,
                sort: i.sort,
                createdAt: i.created_at || i.createdAt,
                labUserId: i.lab_user_id,
                batchId: i.batch_id
            }));
        } catch (e) {
            console.error("API Fetch Failed, falling back to local", e);
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
            return this.generateMockData();
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
                        if (USE_API) this.postItemToApi(newItem);
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
        try {
            await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        } catch (e) { console.error("Failed to POST item to API", e); }
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
        return items.filter(i => i.status === 'graded');
    },

    async getItemsByBatchId(batchId: string): Promise<ProductionItem[]> {
        const items = await this.fetchItems();
        return items.filter(i => i.batchId === batchId);
    },

    async palletizeItems(ids: string[], batchId: string): Promise<void> {
        if (USE_API) {
            try {
                await Promise.all(ids.map(id =>
                    fetch(`${API_URL}/items/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'palletized',
                            batchId: batchId,
                            palletizedAt: new Date().toISOString()
                        })
                    })
                ));
                return;
            } catch (e) { console.error("API Palletize Failed", e); }
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

    async unpalletizeItems(ids: string[]): Promise<void> {
        if (USE_API) {
            try {
                await Promise.all(ids.map(id =>
                    fetch(`${API_URL}/items/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'graded',
                            batchId: null,
                            palletizedAt: null
                        })
                    })
                ));
                return;
            } catch (e) { console.error("API Unpalletize Failed", e); }
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
        if (USE_API) {
            try {
                // Batch update or individual updates
                await Promise.all(ids.map(id =>
                    fetch(`${API_URL}/items/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'shipped',
                            shippedAt: new Date().toISOString()
                        })
                    })
                ));
                return;
            } catch (e) { console.error("API Ship Failed", e); }
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

    async gradeItem(id: string, sort: string, userId: string): Promise<ProductionItem> {
        if (USE_API) {
            try {
                const res = await fetch(`${API_URL}/items/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'graded', sort, labUserId: userId })
                });
                if (res.ok) {
                    return await res.json(); // Return updated item
                }
            } catch (e) { console.error("API Grade Failed", e); }
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
            labUserId: userId
        };
        items[idx] = updatedItem;
        this.saveItemsLocal(items);
        return updatedItem;
    },

    async revertGrade(id: string): Promise<void> {
        if (USE_API) {
            try {
                await fetch(`${API_URL}/items/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'created',
                        sort: null,
                        gradedAt: null,
                        labUserId: null
                    })
                });
                return;
            } catch (e) { console.error("API Revert Failed", e); }
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
        if (USE_API) {
            try {
                const res = await fetch(`${API_URL}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                if (res.ok) return await res.json();
            } catch (e) { console.error("API Create Failed", e); }
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
    }
};
