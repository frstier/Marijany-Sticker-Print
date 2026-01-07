/**
 * ConfigService - Global app configuration stored in Supabase
 * Settings are shared across all devices
 */

import { supabase } from './supabaseClient';

// Config keys
export const CONFIG_KEYS = {
    PRINTER_CONFIG: 'printer_config',
    EMAIL_CONFIG: 'email_config',
    BARCODE_PATTERN: 'barcode_pattern',
    API_URL: 'api_url'
} as const;

type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

// Local cache
let configCache: Record<string, any> = {};
let isLoaded = false;

export const ConfigService = {
    /**
     * Load all config from Supabase (call once on app start)
     */
    async loadAll(): Promise<void> {
        if (!supabase) {
            console.warn('ConfigService: Supabase not available, using localStorage fallback');
            return;
        }

        try {
            const { data, error } = await supabase.from('app_config').select('*');
            if (error) throw error;

            if (data) {
                data.forEach(row => {
                    configCache[row.key] = row.value;
                });
                isLoaded = true;
                console.log('✅ ConfigService: Loaded', Object.keys(configCache).length, 'config items');
            }
        } catch (e) {
            console.error('ConfigService: Failed to load config', e);
        }
    },

    /**
     * Get a config value
     */
    get<T = any>(key: ConfigKey, fallback?: T): T {
        if (configCache[key] !== undefined) {
            return configCache[key] as T;
        }
        // Fallback to localStorage if not in cache
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                return JSON.parse(stored) as T;
            } catch {
                return stored as unknown as T;
            }
        }
        return fallback as T;
    },

    /**
     * Set a config value (saves to Supabase + local cache)
     */
    async set(key: ConfigKey, value: any): Promise<boolean> {
        // Update local cache immediately
        configCache[key] = value;

        // Also save to localStorage as backup
        localStorage.setItem(key, JSON.stringify(value));

        if (!supabase) return false;

        try {
            const { error } = await supabase
                .from('app_config')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;
            console.log('✅ ConfigService: Saved', key);
            return true;
        } catch (e) {
            console.error('ConfigService: Failed to save', key, e);
            return false;
        }
    },

    /**
     * Get printer config
     */
    getPrinterConfig(): { agentIp: string; printerName: string } {
        return this.get(CONFIG_KEYS.PRINTER_CONFIG, { agentIp: '', printerName: '' });
    },

    /**
     * Set printer config
     */
    async setPrinterConfig(agentIp: string, printerName: string): Promise<boolean> {
        return this.set(CONFIG_KEYS.PRINTER_CONFIG, { agentIp, printerName });
    },

    /**
     * Get email config
     */
    getEmailConfig(): { serviceId: string; templateId: string; publicKey: string; reportEmail: string } {
        return this.get(CONFIG_KEYS.EMAIL_CONFIG, { serviceId: '', templateId: '', publicKey: '', reportEmail: '' });
    },

    /**
     * Set email config
     */
    async setEmailConfig(config: { serviceId?: string; templateId?: string; publicKey?: string; reportEmail?: string }): Promise<boolean> {
        const current = this.getEmailConfig();
        return this.set(CONFIG_KEYS.EMAIL_CONFIG, { ...current, ...config });
    },

    /**
     * Get barcode pattern
     */
    getBarcodePattern(): string {
        return this.get(CONFIG_KEYS.BARCODE_PATTERN, 'DD.MM.YYYY-SKU-###-WEIGHT');
    },

    /**
     * Set barcode pattern
     */
    async setBarcodePattern(pattern: string): Promise<boolean> {
        return this.set(CONFIG_KEYS.BARCODE_PATTERN, pattern);
    },

    /**
     * Check if config is loaded
     */
    isLoaded(): boolean {
        return isLoaded;
    }
};

export default ConfigService;
