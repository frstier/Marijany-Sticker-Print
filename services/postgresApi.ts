import { IDataService } from '../types/data';
import { User, Product, LabelData } from '../types';
import { USERS, PRODUCTS } from '../constants';

const API_URL_KEY = 'zebra_api_url';
const DEFAULT_API_URL = 'http://localhost:3000';

export const PostgresApiService: IDataService = {
    async init() {
        console.log('PostgresApiService initialized');
        // Check health?
        const url = this.getApiUrl();
        try {
            await fetch(`${url}/api/health`);
        } catch (e) {
            console.error("API Health Check Failed", e);
        }
    },

    getApiUrl() {
        return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
    },

    setApiUrl(url: string) {
        localStorage.setItem(API_URL_KEY, url);
    },

    // --- Read ---

    // For now, Products and Users are static in the app, 
    // unless we add endpoints for them in the node server.
    async getUsers(): Promise<User[]> {
        return USERS;
    },

    async getProducts(): Promise<Product[]> {
        return PRODUCTS;
    },

    async getHistory(): Promise<LabelData[]> {
        const url = this.getApiUrl();
        try {
            const res = await fetch(`${url}/api/items`);
            if (!res.ok) throw new Error('Failed to fetch items');
            const data = await res.json();

            // Map DB snake_case to LabelData
            return data.map((row: any) => ({
                product: PRODUCTS.find(p => p.sku === row.product_sku || p.name === row.product_name) || { name: row.product_name, name_en: row.product_name_en, id: '0', sku: 'UNK', category: 'unknown' },
                weight: row.weight,
                serialNumber: row.serial_number,
                date: new Date(row.created_at).toLocaleDateString(), // Use created_at or encoded date?
                // If the DB stores the printed date label, use that if available.
                // Looking at schema in index.js: 'date' column exists.
                // row.date
                ...row // spread rest
            }));
        } catch (e) {
            console.error("getHistory error", e);
            return [];
        }
    },

    // --- Write ---

    async addToHistory(entry: LabelData & { timestamp?: string }): Promise<void> {
        const url = this.getApiUrl();
        // Server expects: { id, barcode, date, productName, productNameEn, serialNumber, weight, status }
        // We generate a UID or let server handle it? Server uses 'uid' in INSERT.
        // If we don't send ID, does server generate?
        // Schema says: INSERT INTO ... VALUES ($1...) -> uid is $1.
        // So we must provide ID.

        const payload = {
            id: entry.barcode || crypto.randomUUID(), // Use barcode as ID or random
            barcode: entry.barcode,
            date: entry.date,
            productName: entry.product?.name,
            productNameEn: entry.product?.name_en,
            serialNumber: entry.serialNumber,
            weight: entry.weight,
            status: 'printed'
        };

        try {
            const res = await fetch(`${url}/api/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to save item');
        } catch (e) {
            console.error("addToHistory error", e);
            // Queue for offline? Not for now.
        }
    },

    // --- Reporting ---
    async getReportData(startDate: Date, endDate: Date): Promise<LabelData[]> {
        // Naive implementation: fetch all and filter client side
        // Ideal: Server endpoint with params
        const all = await this.getHistory();
        return all.filter(item => {
            const d = new Date(item.date); // or item.timestamp
            return d >= startDate && d <= endDate;
        });
    }
};
