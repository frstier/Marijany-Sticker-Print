import { IDataService } from '../types/data';
import { User, Product, LabelData } from '../types';
import { createClient } from '@supabase/supabase-js';

// TODO: Move to env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Mock client if config missing to prevent crash during build/dev
const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export const SupabaseService: IDataService = {
    async init() {
        if (!supabase) {
            console.warn("Supabase credentials missing. Service inactive.");
        }
        console.log("Supabase Service Initialized");
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
            created_at: entry.timestamp || new Date().toISOString()
        };

        const { error } = await supabase.from('history').insert([payload]);
        if (error) console.error("Supabase Insert Error:", error);
    }
};
