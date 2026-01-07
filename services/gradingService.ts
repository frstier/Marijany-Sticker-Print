import { GradedItem, LabStats } from '../types/lab';
import { PalletService } from './palletService';
import { supabase } from './supabaseClient';

export const GradingService = {
    // --- Async Actions ---

    async getGradedItems(): Promise<GradedItem[]> {
        try {
            // Fetch items that have been assigned a sort (status 'graded' or 'palletized' or 'shipped')
            const { data, error } = await supabase
                .from('production_items')
                .select('*')
                .not('sort', 'is', null)
                .order('updated_at', { ascending: false })
                .limit(100); // Limit to recent 100 for performance in this view

            if (error) throw error;
            if (!data) return [];

            return data.map(item => ({
                id: item.id,
                originalBarcode: item.barcode || '', // Fallback
                date: item.date,
                productName: item.product_name,
                serialNumber: item.serial_number,
                weight: item.weight,
                assignedSort: item.sort,
                gradedAt: item.updated_at, // Use updated_at as graded time
                labUserId: item.lab_user_id
            }));
        } catch (e) {
            console.error("Supabase: Failed to load graded items", e);
            return [];
        }
    },

    async saveGrade(barcode: string, sort: string, userId: string): Promise<GradedItem> {
        const parsed = PalletService.parseBarcode(barcode);
        if (!parsed) throw new Error("Невірний формат штрих-коду");

        // We use UPSERT methodology based on the unique constraint (serial, product, date)
        // If the item exists (from operator), we update it.
        // If it doesn't exist (lab scanned first), we create it with status 'graded'.

        const payload = {
            serial_number: parsed.serialNumber,
            product_name: parsed.productName,
            date: parsed.date,
            weight: parsed.weight,
            barcode: barcode,
            sort: sort,
            status: 'graded',
            lab_user_id: userId,
            updated_at: new Date().toISOString()
        };

        // Using upsert with onConflict for unique keys
        const { data, error } = await supabase
            .from('production_items')
            .upsert(payload, { onConflict: 'serial_number,product_name,date' })
            .select() // Return the created/updated record
            .single();

        if (error) {
            console.error("Supabase Save Error:", error);
            throw new Error(`Помилка бази даних: ${error.message}`);
        }

        return {
            id: data.id,
            originalBarcode: barcode,
            date: data.date,
            productName: data.product_name,
            serialNumber: data.serial_number,
            weight: data.weight,
            assignedSort: data.sort,
            gradedAt: data.updated_at,
            labUserId: data.lab_user_id
        };
    },

    async getDailyStats(): Promise<LabStats> {
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        try {
            // We need to aggregate. Supabase doesn't have a simple aggregate API in JS client w/o RPC.
            // But for reasonable data size, we can fetch today's graded items and reduce client-side.
            // Filter by updated_at (approx logic) or we can just fetch all 'graded' items for today's DATE field if appropriate?
            // Let's use `updated_at` to reflect work done today.

            // Start of today
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('production_items')
                .select('weight, sort')
                .gte('updated_at', startOfDay.toISOString())
                .not('sort', 'is', null);

            if (error) throw error;

            const initialStats: LabStats = {
                totalItems: 0,
                totalWeight: 0,
                bySort: {}
            };

            if (!data) return initialStats;

            return data.reduce((acc, item) => {
                acc.totalItems += 1;
                acc.totalWeight += item.weight;
                acc.bySort[item.sort] = (acc.bySort[item.sort] || 0) + 1;
                return acc;
            }, initialStats);

        } catch (e) {
            console.error("Supabase: Failed to calc stats", e);
            return { totalItems: 0, totalWeight: 0, bySort: {} };
        }
    }
};
