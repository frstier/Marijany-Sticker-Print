import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './db';
import { SupabaseService } from './supabase';
import { IDataService } from '../types/data';

// Configuration
// In a real app, you might check a setting in LocalStorage or an Env Var.
// For now, we prefer SQLite on Native, and check a flag for Web.
// If VITE_DATA_SOURCE is 'supabase', we force Supabase.
// Otherwise, we default to SQLite (native) or LocalStorage Mock (web - handled by Hooks currently, but should be moved here).

export const DataManager = {
    getService(): IDataService {
        const platform = Capacitor.getPlatform();
        const source = import.meta.env.VITE_DATA_SOURCE || 'sqlite'; // 'sqlite' | 'supabase'

        if (source === 'supabase') {
            console.log('--- Using Supabase Data Source ---');
            return SupabaseService;
        }

        // Default to SQLite (which handles platform check internally or we handle it here)
        // Note: DatabaseService.init() has a web-check that warns.
        // If we represent "Offline First" as the primary, DatabaseService is the go-to.
        return DatabaseService;
    },

    async init() {
        await this.getService().init();
    }
};
