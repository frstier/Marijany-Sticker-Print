import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './db';
import { SupabaseService } from './supabase';
import { IDataService } from '../types/data';

// Configuration
// In a real app, you might check a setting in LocalStorage or an Env Var.
// For now, we prefer SQLite on Native, and check a flag for Web.
// If VITE_DATA_SOURCE is 'supabase', we force Supabase.
// Otherwise, we default to SQLite (native) or LocalStorage Mock (web - handled by Hooks currently, but should be moved here).

const STORAGE_KEY = 'zebra_data_source';

export const DataManager = {
    getService(): IDataService {
        const platform = Capacitor.getPlatform();

        // Priority: 1. LocalStorage (Manual Override), 2. Env Var, 3. Default (SQLite)
        let source = localStorage.getItem(STORAGE_KEY);

        if (!source) {
            source = import.meta.env.VITE_DATA_SOURCE || 'sqlite';
        }

        if (source === 'supabase') {
            console.log('--- Using Supabase Data Source ---');
            return SupabaseService;
        }

        // Default to SQLite
        return DatabaseService;
    },

    async init() {
        await this.getService().init();
    },

    setDataSource(source: 'sqlite' | 'supabase') {
        localStorage.setItem(STORAGE_KEY, source);
        window.location.reload(); // Reload to re-init services
    },

    getDataSource(): 'sqlite' | 'supabase' {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'sqlite' || stored === 'supabase') return stored;

        // Fallback to env or default
        const env = import.meta.env.VITE_DATA_SOURCE;
        return (env === 'sqlite' || env === 'supabase') ? env : 'sqlite';
    }
};
