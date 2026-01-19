import { supabase } from './supabaseClient';
import { ProductionService } from './productionService';
import { ProductionItem } from '../types/production';

const USE_SUPABASE = true;

export interface InventorySession {
    id: string;
    name: string;
    status: 'active' | 'completed' | 'cancelled';
    totalExpected: number;
    totalScanned: number;
    totalMissing: number;
    totalExtra: number;
    userId?: string;
    userName?: string;
    startedAt: string;
    completedAt?: string;
}

export interface InventoryItem {
    id: string;
    sessionId: string;
    productionItemId?: string;
    barcode: string;
    status: 'found' | 'missing' | 'extra' | 'mismatch';
    serialNumber?: number;
    productName?: string;
    weight?: number;
    sort?: string;
    expectedLocation?: string;
    actualLocation?: string;
    notes?: string;
    scannedAt: string;
}

export interface InventorySummary {
    session: InventorySession;
    foundItems: InventoryItem[];
    missingItems: InventoryItem[];
    extraItems: InventoryItem[];
}

export const InventoryService = {
    /**
     * Create a new inventory session
     */
    async createSession(name: string, userId?: string, userName?: string): Promise<InventorySession | null> {
        if (!USE_SUPABASE || !supabase) {
            console.error('[Inventory] Supabase not available');
            return null;
        }

        try {
            // Get current item count for expected total
            const items = await ProductionService.fetchItems();
            const inStockItems = items.filter(i => i.status === 'graded' || i.status === 'palletized');

            const { data, error } = await supabase
                .from('inventory_sessions')
                .insert({
                    name,
                    status: 'active',
                    total_expected: inStockItems.length,
                    total_scanned: 0,
                    total_missing: 0,
                    total_extra: 0,
                    user_id: userId,
                    user_name: userName
                })
                .select()
                .single();

            if (error) throw error;

            return this.mapSession(data);
        } catch (e) {
            console.error('[Inventory] createSession failed:', e);
            return null;
        }
    },

    /**
     * Get active session
     */
    async getActiveSession(): Promise<InventorySession | null> {
        if (!USE_SUPABASE || !supabase) return null;

        try {
            const { data, error } = await supabase
                .from('inventory_sessions')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
            return data ? this.mapSession(data) : null;
        } catch (e) {
            console.error('[Inventory] getActiveSession failed:', e);
            return null;
        }
    },

    /**
     * Get all sessions
     */
    async getSessions(): Promise<InventorySession[]> {
        if (!USE_SUPABASE || !supabase) return [];

        try {
            const { data, error } = await supabase
                .from('inventory_sessions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(this.mapSession);
        } catch (e) {
            console.error('[Inventory] getSessions failed:', e);
            return [];
        }
    },

    /**
     * Scan an item in the current session
     */
    async scanItem(sessionId: string, barcode: string, actualLocation?: string): Promise<InventoryItem | null> {
        if (!USE_SUPABASE || !supabase) return null;

        try {
            // Check if item already scanned in this session
            const { data: existing } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('session_id', sessionId)
                .eq('barcode', barcode)
                .single();

            if (existing) {
                console.log('[Inventory] Item already scanned:', barcode);
                return this.mapItem(existing);
            }

            // Find item in production_items
            const items = await ProductionService.fetchItems();
            const item = items.find(i => i.barcode === barcode);

            let status: InventoryItem['status'] = 'extra';
            let productionItemId: string | undefined;
            let serialNumber: number | undefined;
            let productName: string | undefined;
            let weight: number | undefined;
            let sort: string | undefined;

            if (item) {
                status = 'found';
                productionItemId = item.id;
                serialNumber = item.serialNumber;
                productName = item.productName;
                weight = item.weight;
                sort = item.sort;

                // Check location mismatch if locations are tracked
                if (actualLocation && item.locationId && actualLocation !== item.locationId) {
                    status = 'mismatch';
                }
            }

            // Insert scanned item
            const { data, error } = await supabase
                .from('inventory_items')
                .insert({
                    session_id: sessionId,
                    production_item_id: productionItemId,
                    barcode,
                    status,
                    serial_number: serialNumber,
                    product_name: productName,
                    weight,
                    sort,
                    actual_location: actualLocation
                })
                .select()
                .single();

            if (error) throw error;

            // Update session counters
            await this.updateSessionStats(sessionId);

            return this.mapItem(data);
        } catch (e) {
            console.error('[Inventory] scanItem failed:', e);
            return null;
        }
    },

    /**
     * Update session statistics
     */
    async updateSessionStats(sessionId: string): Promise<void> {
        if (!USE_SUPABASE || !supabase) return;

        try {
            const { data: items } = await supabase
                .from('inventory_items')
                .select('status')
                .eq('session_id', sessionId);

            const stats = {
                found: 0,
                extra: 0,
                mismatch: 0
            };

            (items || []).forEach((i: any) => {
                if (i.status === 'found' || i.status === 'mismatch') stats.found++;
                if (i.status === 'extra') stats.extra++;
            });

            await supabase
                .from('inventory_sessions')
                .update({
                    total_scanned: stats.found,
                    total_extra: stats.extra,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId);
        } catch (e) {
            console.error('[Inventory] updateSessionStats failed:', e);
        }
    },

    /**
     * Complete session and calculate missing items
     */
    async completeSession(sessionId: string): Promise<InventorySummary | null> {
        if (!USE_SUPABASE || !supabase) return null;

        try {
            // Get all expected items (in stock)
            const allItems = await ProductionService.fetchItems();
            const expectedItems = allItems.filter(i => i.status === 'graded' || i.status === 'palletized');

            // Get all scanned items
            const { data: scannedItems } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('session_id', sessionId);

            const scannedBarcodes = new Set((scannedItems || []).map((i: any) => i.barcode));

            // Find missing items
            const missingItems: ProductionItem[] = expectedItems.filter(i => !scannedBarcodes.has(i.barcode));

            // Insert missing items
            for (const item of missingItems) {
                await supabase.from('inventory_items').insert({
                    session_id: sessionId,
                    production_item_id: item.id,
                    barcode: item.barcode,
                    status: 'missing',
                    serial_number: item.serialNumber,
                    product_name: item.productName,
                    weight: item.weight,
                    sort: item.sort
                });
            }

            // Update session
            const { data: session, error } = await supabase
                .from('inventory_sessions')
                .update({
                    status: 'completed',
                    total_missing: missingItems.length,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .select()
                .single();

            if (error) throw error;

            // Get final items list
            const { data: finalItems } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('session_id', sessionId);

            const mapped: InventoryItem[] = (finalItems || []).map((row: any) => this.mapItem(row));

            return {
                session: this.mapSession(session),
                foundItems: mapped.filter((i: InventoryItem) => i.status === 'found' || i.status === 'mismatch'),
                missingItems: mapped.filter((i: InventoryItem) => i.status === 'missing'),
                extraItems: mapped.filter((i: InventoryItem) => i.status === 'extra')
            };
        } catch (e) {
            console.error('[Inventory] completeSession failed:', e);
            return null;
        }
    },

    /**
     * Cancel an active session
     */
    async cancelSession(sessionId: string): Promise<boolean> {
        if (!USE_SUPABASE || !supabase) return false;

        try {
            const { error } = await supabase
                .from('inventory_sessions')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            return !error;
        } catch (e) {
            console.error('[Inventory] cancelSession failed:', e);
            return false;
        }
    },

    /**
     * Get session items
     */
    async getSessionItems(sessionId: string): Promise<InventoryItem[]> {
        if (!USE_SUPABASE || !supabase) return [];

        try {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('session_id', sessionId)
                .order('scanned_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(this.mapItem);
        } catch (e) {
            console.error('[Inventory] getSessionItems failed:', e);
            return [];
        }
    },

    // Mappers
    mapSession(row: any): InventorySession {
        return {
            id: row.id,
            name: row.name,
            status: row.status,
            totalExpected: row.total_expected || 0,
            totalScanned: row.total_scanned || 0,
            totalMissing: row.total_missing || 0,
            totalExtra: row.total_extra || 0,
            userId: row.user_id,
            userName: row.user_name,
            startedAt: row.started_at,
            completedAt: row.completed_at
        };
    },

    mapItem(row: any): InventoryItem {
        return {
            id: row.id,
            sessionId: row.session_id,
            productionItemId: row.production_item_id,
            barcode: row.barcode,
            status: row.status,
            serialNumber: row.serial_number,
            productName: row.product_name,
            weight: row.weight,
            sort: row.sort,
            expectedLocation: row.expected_location,
            actualLocation: row.actual_location,
            notes: row.notes,
            scannedAt: row.scanned_at
        };
    }
};
