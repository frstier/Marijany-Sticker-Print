import { Quad, QuadItem } from '../types/quad';
import { ProductionItem } from '../types/production';
import { supabase } from './supabaseClient';

const USE_SUPABASE = true;

export const QuadService = {

    /**
     * Get all quads (optionally filtered by status)
     */
    async getQuads(status?: 'created' | 'warehouse'): Promise<Quad[]> {
        if (!USE_SUPABASE || !supabase) return [];

        try {
            let query = supabase
                .from('quads')
                .select('*')
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data) return [];

            // Fetch items for each quad
            const quadsWithItems = await Promise.all(data.map(async (q: any) => {
                const items = await this.getQuadItems(q.id);
                return {
                    id: q.id,
                    date: q.date,
                    productName: q.product_name,
                    sort: q.sort,
                    totalWeight: parseFloat(q.total_weight) || 0,
                    status: q.status,
                    items,
                    createdBy: q.created_by,
                    createdAt: q.created_at
                };
            }));

            return quadsWithItems;
        } catch (e) {
            console.error("QuadService.getQuads failed", e);
            return [];
        }
    },

    /**
     * Get items for a specific quad
     */
    async getQuadItems(quadId: string): Promise<QuadItem[]> {
        if (!USE_SUPABASE || !supabase) return [];

        try {
            const { data, error } = await supabase
                .from('production_items')
                .select('id, serial_number, weight, barcode')
                .eq('quad_id', quadId);

            if (error) throw error;
            if (!data) return [];

            return data.map((i: any) => ({
                id: i.id,
                serialNumber: i.serial_number,
                weight: parseFloat(i.weight),
                barcode: i.barcode
            }));
        } catch (e) {
            console.error("QuadService.getQuadItems failed", e);
            return [];
        }
    },

    /**
     * Create a new quad from 4 bales
     */
    async createQuad(items: ProductionItem[], userId: string): Promise<Quad> {
        if (items.length !== 4) {
            throw new Error("Четвірка повинна містити рівно 4 бейли");
        }

        // Validate same product and sort
        const firstProduct = items[0].productName;
        const firstSort = items[0].sort;

        for (const item of items) {
            if (item.productName !== firstProduct) {
                throw new Error("Всі бейли повинні бути одного продукту");
            }
            if (item.sort !== firstSort) {
                throw new Error("Всі бейли повинні бути одного сорту");
            }
        }

        const today = new Date();
        const dateStr = today.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '.');

        // Generate unique ID
        const quadId = await this.generateQuadId(dateStr);

        const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);

        if (!USE_SUPABASE || !supabase) {
            throw new Error("Supabase not configured");
        }

        try {
            // 1. Create the quad
            const { error: quadError } = await supabase
                .from('quads')
                .insert({
                    id: quadId,
                    date: dateStr,
                    product_name: firstProduct,
                    sort: firstSort,
                    total_weight: totalWeight,
                    status: 'created',
                    created_by: userId
                });

            if (quadError) throw quadError;

            // 2. Update production items - link to quad and set status to 'packed'
            const itemIds = items.map(i => i.id);
            const { error: itemsError } = await supabase
                .from('production_items')
                .update({
                    quad_id: quadId,
                    status: 'packed',
                    packed_at: new Date().toISOString()
                })
                .in('id', itemIds);

            if (itemsError) throw itemsError;

            return {
                id: quadId,
                date: dateStr,
                productName: firstProduct,
                sort: firstSort!,
                totalWeight,
                status: 'created',
                items: items.map(i => ({
                    id: i.id,
                    serialNumber: i.serialNumber,
                    weight: i.weight,
                    barcode: i.barcode
                })),
                createdBy: userId,
                createdAt: new Date().toISOString()
            };
        } catch (e) {
            console.error("QuadService.createQuad failed", e);
            throw e;
        }
    },

    /**
     * Generate unique quad ID like "Q-20260113-001"
     */
    async generateQuadId(dateStr: string): Promise<string> {
        const dateForId = dateStr.split('.').reverse().join(''); // 13.01.2026 -> 20260113

        if (!USE_SUPABASE || !supabase) {
            return `Q-${dateForId}-001`;
        }

        try {
            // Find max ID for today
            const { data, error } = await supabase
                .from('quads')
                .select('id')
                .like('id', `Q-${dateForId}-%`)
                .order('id', { ascending: false })
                .limit(1);

            if (error) throw error;

            let nextNum = 1;
            if (data && data.length > 0) {
                const lastId = data[0].id;
                const lastNum = parseInt(lastId.split('-').pop() || '0');
                nextNum = lastNum + 1;
            }

            return `Q-${dateForId}-${nextNum.toString().padStart(3, '0')}`;
        } catch (e) {
            console.error("QuadService.generateQuadId failed", e);
            return `Q-${dateForId}-${Date.now().toString().slice(-3)}`;
        }
    },

    /**
     * Send quad to warehouse (change status)
     */
    async sendToWarehouse(quadId: string): Promise<void> {
        if (!USE_SUPABASE || !supabase) return;

        try {
            // Update quad status
            const { error: quadError } = await supabase
                .from('quads')
                .update({ status: 'warehouse' })
                .eq('id', quadId);

            if (quadError) throw quadError;

            // Update production items status
            const { error: itemsError } = await supabase
                .from('production_items')
                .update({ status: 'warehouse' })
                .eq('quad_id', quadId);

            if (itemsError) throw itemsError;

        } catch (e) {
            console.error("QuadService.sendToWarehouse failed", e);
            throw e;
        }
    },

    /**
     * Disband a quad (return items to 'graded' status)
     */
    async disbandQuad(quadId: string): Promise<void> {
        if (!USE_SUPABASE || !supabase) return;

        try {
            // Return items to 'graded' status
            const { error: itemsError } = await supabase
                .from('production_items')
                .update({
                    quad_id: null,
                    status: 'graded',
                    packed_at: null
                })
                .eq('quad_id', quadId);

            if (itemsError) throw itemsError;

            // Delete the quad
            const { error: quadError } = await supabase
                .from('quads')
                .delete()
                .eq('id', quadId);

            if (quadError) throw quadError;

        } catch (e) {
            console.error("QuadService.disbandQuad failed", e);
            throw e;
        }
    },

    /**
     * Get bales available for packing (graded, Long Fiber only)
     */
    async getAvailableBales(): Promise<ProductionItem[]> {
        if (!USE_SUPABASE || !supabase) return [];

        try {
            const { data, error } = await supabase
                .from('production_items')
                .select('*')
                .eq('status', 'graded')
                .or('product_name.eq.Long Fiber,product_name.eq.Довге волокно')
                .is('quad_id', null)
                .order('sort', { ascending: true })
                .order('serial_number', { ascending: true });

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
                status: i.status,
                sort: i.sort,
                createdAt: i.created_at
            }));
        } catch (e) {
            console.error("QuadService.getAvailableBales failed", e);
            return [];
        }
    }
};
