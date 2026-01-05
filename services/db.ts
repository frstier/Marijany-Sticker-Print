// Dynamic Import wrapper for SQLite
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { USERS, PRODUCTS } from '../constants';
import { IDataService } from '../types/data';
import { User, Product, LabelData } from '../types';

// Type definitions needed for compilation
import type { SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'zebra_db';
let sqlite: SQLiteConnection | null = null;
let db: SQLiteDBConnection | null = null;

export const DatabaseService = {
    async init(): Promise<void> {
        try {
            if (Capacitor.getPlatform() === 'web') {
                console.warn('SQLite is not available in web mode. Using fallback data.');
                return;
            }

            // 1. Create Connection (Lazy Init & Dynamic Import)
            if (!sqlite) {
                const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
                sqlite = new SQLiteConnection(CapacitorSQLite);
            }

            console.log('--- Initializing SQLite DB ---');
            db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

            // 2. Open
            await db.open();
            console.log('--- DB Opened ---');

            // 3. Create Tables
            // 3. Create Tables
            const schema = `
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            pin TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            sku TEXT NOT NULL,
            category TEXT,
            sorts TEXT -- JSON stringified array
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            product_name TEXT,
            sku TEXT,
            weight TEXT,
            serial_number INTEGER,
            sort_label TEXT,
            sort_value TEXT,
            status TEXT DEFAULT 'ok',
            synced INTEGER DEFAULT 0,
            UNIQUE(sku, serial_number)
        );
      `;

            await db.execute(schema);
            console.log('--- Tables Verified ---');

            // 4. Seed/Sync Data
            await this.syncProducts();
            await this.seedUsers();

            // Migration for Status Column and Unique Constraint support
            try {
                await db.execute("ALTER TABLE history ADD COLUMN status TEXT DEFAULT 'ok'");
            } catch (e) { /* Ignore */ }
            try {
                await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_history_sku_serial ON history(sku, serial_number)");
            } catch (e) { /* Ignore */ }

        } catch (e) {
            console.error('Database Initialization Error:', e);
        }
    },

    // Read
    async getUsers(): Promise<User[]> {
        return USERS;
    },

    async getProducts(): Promise<Product[]> {
        return PRODUCTS;
    },

    // ... (seedUsers, syncProducts, getConnection)

    async addToHistory(entry: LabelData & { timestamp?: string }): Promise<void> {
        if (!db) return;

        // Ensure timestamp is present
        const timestamp = entry.timestamp || new Date().toISOString();
        const { product, weight, serialNumber, sortLabel, sortValue, status } = entry;

        // Safety check for product
        if (!product) return;

        // INSERT OR REPLACE to handle duplicates by overwriting
        await db.run(
            `INSERT INTO history (timestamp, product_name, sku, weight, serial_number, sort_label, sort_value, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(sku, serial_number) DO UPDATE SET
                timestamp = excluded.timestamp,
                weight = excluded.weight,
                sort_label = excluded.sort_label,
                sort_value = excluded.sort_value,
                status = excluded.status`,
            [timestamp, product.name, product.sku, weight, serialNumber, sortLabel, sortValue, status || 'ok']
        );
    },

    async getHistory(): Promise<LabelData[]> {
        if (!db) return [];
        const res = await db.query('SELECT * FROM history ORDER BY id DESC');
        if (!res.values) return [];

        return res.values.map((row: any) => ({
            date: row.timestamp,
            // Reconstruct partial product since DB only stores name/sku for history
            product: { name: row.product_name, sku: row.sku, id: '0' } as any,
            weight: row.weight,
            serialNumber: row.serial_number,
            sortLabel: row.sort_label,
            sortValue: row.sort_value
        }));
    },

    // --- Backup & Restore ---

    async backupDatabase(): Promise<string> {
        if (!db) throw new Error("Database not initialized");

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `marijany_backup_${timestamp}.json`;

            // 1. Fetch All Data
            const users = await db.query('SELECT * FROM users');
            const products = await db.query('SELECT * FROM products');
            const history = await db.query('SELECT * FROM history');

            const backupData = {
                meta: {
                    date: new Date().toISOString(),
                    version: '1.0',
                    appName: 'Marijany Sticker Print'
                },
                tables: {
                    users: users.values || [],
                    products: products.values || [],
                    history: history.values || []
                }
            };

            // 2. Write file to Documents
            await Filesystem.writeFile({
                path: fileName,
                data: JSON.stringify(backupData, null, 2),
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });

            return fileName;
        } catch (error) {
            console.error('Backup failed:', error);
            throw error;
        }
    },

    async importDatabase(jsonString: string): Promise<void> {
        if (!db) throw new Error("Database not initialized");

        try {
            const data = JSON.parse(jsonString);

            // Basic validation
            if (!data.meta || !data.tables || !data.tables.users || !data.tables.history) {
                throw new Error("Invalid backup file format");
            }

            // Begin Transaction
            await db.execute('BEGIN TRANSACTION');

            // 1. Clear Tables
            await db.execute('DELETE FROM users');
            await db.execute('DELETE FROM products');
            await db.execute('DELETE FROM history');

            // 2. Restore Users
            for (const u of data.tables.users) {
                await db.run(
                    'INSERT INTO users (id, name, role, pin) VALUES (?, ?, ?, ?)',
                    [u.id, u.name, u.role, u.pin]
                );
            }

            // 3. Restore Products (Optional checks if needed)
            if (data.tables.products && data.tables.products.length > 0) {
                for (const p of data.tables.products) {
                    await db.run(
                        'INSERT INTO products (id, name, name_en, sku, category, sorts) VALUES (?, ?, ?, ?, ?, ?)',
                        [p.id, p.name, p.name_en, p.sku, p.category, p.sorts]
                    );
                }
            } else {
                // If restore has no products, maybe we should re-seed defaults? 
                // For now, let's assume backup is authority.
                // Or call this.syncProducts() if we want defaults.
            }

            // 4. Restore History
            for (const h of data.tables.history) {
                await db.run(
                    `INSERT INTO history (id, timestamp, product_name, sku, weight, serial_number, sort_label, sort_value, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [h.id, h.timestamp, h.product_name, h.sku, h.weight, h.serial_number, h.sort_label, h.sort_value, h.status || 'ok']
                );
            }

            // Commit
            await db.execute('COMMIT');

            // Re-sync defaults to be safe (product list might be updated in code)
            await this.syncProducts();

            console.log('--- Restore Complete ---');

        } catch (e) {
            await db.execute('ROLLBACK');
            console.error('Import failed:', e);
            throw e;
        }
    },

    async getReportData(startDate: Date, endDate: Date): Promise<LabelData[]> {
        if (!db) return [];
        // SQLite date comparison string format: YYYY-MM-DDTHH:MM:SS.SSSZ
        // We use string comparison for ISO dates
        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();

        const res = await db.query(
            'SELECT * FROM history WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
            [startStr, endStr]
        );

        if (!res.values) return [];

        return res.values.map((row: any) => ({
            date: row.timestamp,
            product: { name: row.product_name, sku: row.sku, id: '0' } as any,
            weight: row.weight,
            serialNumber: row.serial_number,
            sortLabel: row.sort_label,
            sortValue: row.sort_value
        }));
    }
};
