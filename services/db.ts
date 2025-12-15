import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { USERS, PRODUCTS } from '../constants'; // Import initial data for seeding
import { IDataService } from '../types/data';
import { User, Product, LabelData } from '../types';

const DB_NAME = 'zebra_db';
const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;

export const DatabaseService = {
    async init(): Promise<void> {
        try {
            if (Capacitor.getPlatform() === 'web') {
                console.warn('SQLite is not available in web mode. Using fallback data.');
                return;
            }

            // 1. Create Connection
            console.log('--- Initializing SQLite DB ---');
            db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

            // 2. Open
            await db.open();
            console.log('--- DB Opened ---');

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
            synced INTEGER DEFAULT 0
        );
      `;

            await db.execute(schema);
            console.log('--- Tables Verified ---');

            // 4. Seed Data (if empty)
            await this.seedData();

        } catch (e) {
            console.error('Database Initialization Error:', e);
        }
    },

    async seedData() {
        if (!db) return;

        // Check if users exist
        const result = await db.query('SELECT count(*) as count FROM users');
        if (result.values && result.values[0].count > 0) {
            console.log('--- Data already seeded ---');
            return;
        }

        console.log('--- Seeding Initial Data ---');

        // Seed Users
        for (const u of USERS) {
            await db.run('INSERT INTO users (id, name, role, pin) VALUES (?, ?, ?, ?)', [u.id, u.name, u.role, u.pin]);
        }

        // Seed Products
        for (const p of PRODUCTS) {
            await db.run('INSERT INTO products (id, name, sku, category, sorts) VALUES (?, ?, ?, ?, ?)',
                [p.id, p.name, p.sku, p.category, JSON.stringify(p.sorts || [])]
            );
        }
        console.log('--- Seeding Complete ---');
    },

    async getConnection(): Promise<SQLiteDBConnection | null> {
        if (!db) await this.init();
        return db;
    },

    // --- CRUD Implementation ---

    async getProducts(): Promise<Product[]> {
        if (!db) return [];
        const res = await db.query('SELECT * FROM products');
        return (res.values?.map(p => ({
            ...p,
            sorts: JSON.parse(p.sorts || '[]')
        })) || []) as Product[];
    },

    async getUsers(): Promise<User[]> {
        if (!db) return [];
        const res = await db.query('SELECT * FROM users');
        return (res.values || []) as User[];
    },

    async addToHistory(entry: LabelData & { timestamp?: string }): Promise<void> {
        if (!db) return;

        // Ensure timestamp is present
        const timestamp = entry.timestamp || new Date().toISOString();
        const { product, weight, serialNumber, sortLabel, sortValue } = entry;

        // Safety check for product
        if (!product) return;

        await db.run(
            `INSERT INTO history (timestamp, product_name, sku, weight, serial_number, sort_label, sort_value) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [timestamp, product.name, product.sku, weight, serialNumber, sortLabel, sortValue]
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
    }
};
