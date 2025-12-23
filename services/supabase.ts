import { IDataService } from '../types/data';
import { User, Product, LabelData } from '../types';
import { createClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'zebra_supabase_url';
const STORAGE_KEY_KEY = 'zebra_supabase_key';

let supabase: ReturnType<typeof createClient> | null = null;

const getCredentials = () => {
    const localUrl = localStorage.getItem(STORAGE_URL_KEY);
    const localKey = localStorage.getItem(STORAGE_KEY_KEY);
    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    return {
        url: localUrl || envUrl || '',
        key: localKey || envKey || ''
    };
};

// Initialize on load
const { url, key } = getCredentials();
if (url && key) {
    supabase = createClient(url, key);
}

export const SupabaseService: IDataService & { updateCredentials: (u: string, k: string) => void } = {
    async init() {
        const { url, key } = getCredentials();
        if (url && key && !supabase) {
            supabase = createClient(url, key);
        }

        if (!supabase) {
            console.warn("Supabase credentials missing. Service inactive.");
        } else {
            console.log("Supabase Service Initialized");
        }
    },

    updateCredentials(newUrl: string, newKey: string) {
        localStorage.setItem(STORAGE_URL_KEY, newUrl);
        localStorage.setItem(STORAGE_KEY_KEY, newKey);
        if (newUrl && newKey) {
            supabase = createClient(newUrl, newKey);
            window.location.reload(); // Simple reload to ensure fresh state
        }
    },

    async getUsers(): Promise<User[]> {
        if (!supabase) return [];
        const { data, error } = await supabase.from('users').select('*');
        if (error) {
            console.error("Supabase Users Error:", error);
            return [];
        }
        // Map DB fields to User type if necessary. Assuming 1:1 for now.
        return data as User[];
    },

    async getProducts(): Promise<Product[]> {
        if (!supabase) return [];
        const { data, error } = await supabase.from('products').select('*');
        if (error) {
            console.error("Supabase Products Error:", error);
            return [];
        }
        // Parse sorts if stored as JSON/Array
        return data.map((p: any) => ({
            ...p,
            sorts: typeof p.sorts === 'string' ? JSON.parse(p.sorts) : p.sorts
        })) as Product[];
    },

    async getHistory(): Promise<LabelData[]> {
        if (!supabase) return [];
        const { data, error } = await supabase.from('history').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) {
            console.error("Supabase History Error:", error);
            return [];
        }
        return data.map((row: any) => ({
            date: row.created_at, // Map Supabase timestamp to date string
            product: { name: row.product_name, sku: row.sku, id: '0' },
            weight: row.weight,
            serialNumber: row.serial_number,
            sortLabel: row.sort_label,
            sortValue: row.sort_value
        })) as unknown as LabelData[];
    },

    async addToHistory(entry: LabelData & { timestamp?: string }): Promise<void> {
        if (!supabase) return;

        const payload = {
            product_name: entry.product?.name,
            sku: entry.product?.sku,
            weight: entry.weight,
            serial_number: entry.serialNumber,
            sort_label: entry.sortLabel,
            sort_value: entry.sortValue,
            status: entry.status || 'ok',
            created_at: entry.timestamp || new Date().toISOString()
        };

        // Use Upsert to overwrite if SKU+SerialNumber exists
        // Requires a unique constraint on (sku, serial_number) in Supabase
        const { error } = await supabase.from('history').upsert([payload], { onConflict: 'sku, serial_number' });
        if (error) console.error("Supabase Save Error:", error);
    },

    async getReportData(startDate: Date, endDate: Date): Promise<LabelData[]> {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('history')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase Report Error:", error);
            return [];
        }

        return data.map((row: any) => ({
            date: row.created_at,
            product: { name: row.product_name, sku: row.sku, id: '0' },
            weight: row.weight,
            serialNumber: row.serial_number,
            sortLabel: row.sort_label,
            sortValue: row.sort_value
        })) as unknown as LabelData[];
    }
};
