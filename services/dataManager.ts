import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './db';
import { SupabaseService } from './supabase';
import { PostgresApiService } from './postgresApi';
import { IDataService } from '../types/data';

const STORAGE_KEY = 'zebra_data_source';

export const DataManager = {
    getService(): IDataService {
        // Priority: 1. LocalStorage (Manual Override), 2. Env Var, 3. Default (SQLite)
        let source = localStorage.getItem(STORAGE_KEY);

        if (!source) {
            source = import.meta.env.VITE_DATA_SOURCE || 'sqlite';
        }

        if (source === 'supabase') {
            console.log('--- Using Supabase Data Source ---');
            return SupabaseService;
        }

        if (source === 'postgres') {
            console.log('--- Using Postgres API Data Source ---');
            return PostgresApiService;
        }

        // Default to SQLite
        return DatabaseService;
    },

    async init() {
        await this.getService().init();
    },

    setDataSource(source: 'sqlite' | 'supabase' | 'postgres') {
        localStorage.setItem(STORAGE_KEY, source);
        window.location.reload(); // Reload to re-init services
    },

    getDataSource(): 'sqlite' | 'supabase' | 'postgres' {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'sqlite' || stored === 'supabase' || stored === 'postgres') return stored;

        // Fallback to env or default
        const env = import.meta.env.VITE_DATA_SOURCE;
        return (env === 'sqlite' || env === 'supabase' || env === 'postgres') ? env : 'sqlite';
    }
};
