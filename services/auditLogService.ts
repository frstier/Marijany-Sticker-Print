import { LabelData, User } from '../types';
import { supabase } from './supabaseClient';

const AUDIT_LOG_KEY = 'audit_log_v1';
const MAX_LOG_ENTRIES = 500;
const USE_SUPABASE = true;

export type AuditAction =
    | 'login' | 'logout' | 'print' | 'settings_change'
    | 'user_create' | 'user_update' | 'user_delete'
    | 'created' | 'graded' | 'palletized' | 'shipped' | 'unpalletized'
    | 'status_changed' | 'location_assigned' | 'deleted' | 'updated'
    | 'batch_created' | 'batch_closed' | 'shipment_created' | 'shipment_dispatched';

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: AuditAction;
    userId: string;
    userName: string;
    userRole: string;
    details: string;
    metadata?: Record<string, any>;
    // New fields for entity tracking
    entityType?: 'production_item' | 'batch' | 'shipment' | 'user' | 'system';
    entityId?: string;
    oldValue?: any;
    newValue?: any;
}

class AuditLogService {
    private logs: AuditLogEntry[] = [];

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        try {
            const saved = localStorage.getItem(AUDIT_LOG_KEY);
            if (saved) {
                this.logs = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load audit log:', e);
            this.logs = [];
        }
    }

    private saveToStorage() {
        try {
            // Keep only last MAX_LOG_ENTRIES
            if (this.logs.length > MAX_LOG_ENTRIES) {
                this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
            }
            localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(this.logs));
        } catch (e) {
            console.error('Failed to save audit log:', e);
        }
    }

    private createEntry(
        action: AuditAction,
        user: User | null,
        details: string,
        metadata?: Record<string, any>,
        entityType?: AuditLogEntry['entityType'],
        entityId?: string,
        oldValue?: any,
        newValue?: any
    ): AuditLogEntry {
        return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            action,
            userId: user?.id || 'unknown',
            userName: user?.name || 'Система',
            userRole: user?.role || 'system',
            details,
            metadata,
            entityType,
            entityId,
            oldValue,
            newValue
        };
    }

    private async saveToSupabase(entry: AuditLogEntry) {
        if (!USE_SUPABASE || !supabase) return;

        try {
            await supabase.from('audit_logs').insert({
                entity_type: entry.entityType || 'system',
                entity_id: entry.entityId || entry.id,
                action: entry.action,
                old_value: entry.oldValue,
                new_value: entry.newValue,
                user_id: entry.userId !== 'unknown' ? entry.userId : null,
                user_name: entry.userName,
                notes: entry.details
            });
        } catch (e) {
            console.error('[AuditLog] Supabase save failed:', e);
        }
    }

    async log(
        action: AuditAction,
        user: User | null,
        details: string,
        metadata?: Record<string, any>,
        entityType?: AuditLogEntry['entityType'],
        entityId?: string,
        oldValue?: any,
        newValue?: any
    ) {
        const entry = this.createEntry(action, user, details, metadata, entityType, entityId, oldValue, newValue);
        this.logs.push(entry);
        this.saveToStorage();
        await this.saveToSupabase(entry);
        console.log(`📝 Audit: [${action}] ${details}`, metadata);
        return entry;
    }

    // === User Actions ===
    logLogin(user: User) {
        return this.log('login', user, `Вхід користувача ${user.name}`, undefined, 'user', user.id);
    }

    logLogout(user: User) {
        return this.log('logout', user, `Вихід користувача ${user.name}`, undefined, 'user', user.id);
    }

    logPrint(user: User | null, labelData: LabelData) {
        const productName = labelData.product?.name || 'N/A';
        return this.log('print', user, `Друк етикетки: ${productName}`, {
            productName,
            serial: labelData.serialNumber,
            sort: labelData.sortValue || labelData.sort
        }, 'production_item', labelData.serialNumber?.toString());
    }

    logSettingsChange(user: User, setting: string, oldValue: any, newValue: any) {
        return this.log('settings_change', user, `Зміна налаштування: ${setting}`, {
            setting,
            oldValue,
            newValue
        }, 'system', 'settings', oldValue, newValue);
    }

    logUserCreate(admin: User, newUser: User) {
        return this.log('user_create', admin, `Створено користувача: ${newUser.name}`, {
            newUserId: newUser.id,
            newUserRole: newUser.role
        }, 'user', newUser.id);
    }

    logUserUpdate(admin: User, updatedUser: User) {
        return this.log('user_update', admin, `Оновлено користувача: ${updatedUser.name}`, {
            userId: updatedUser.id
        }, 'user', updatedUser.id);
    }

    logUserDelete(admin: User, deletedUser: User) {
        return this.log('user_delete', admin, `Видалено користувача: ${deletedUser.name}`, {
            userId: deletedUser.id
        }, 'user', deletedUser.id);
    }

    // === Production Item Actions (NEW) ===
    async logGrading(itemId: string, itemSerial: number, sort: string, user: User | null) {
        return this.log(
            'graded',
            user,
            `Бейл #${itemSerial} сортовано: ${sort}`,
            { sort },
            'production_item',
            itemId,
            { status: 'created' },
            { status: 'graded', sort }
        );
    }

    async logPalletization(itemId: string, itemSerial: number, batchId: string, user: User | null) {
        return this.log(
            'palletized',
            user,
            `Бейл #${itemSerial} додано до палети ${batchId}`,
            { batchId },
            'production_item',
            itemId,
            { status: 'graded' },
            { status: 'palletized', batch_id: batchId }
        );
    }

    async logShipment(itemId: string, itemSerial: number, user: User | null) {
        return this.log(
            'shipped',
            user,
            `Бейл #${itemSerial} відвантажено`,
            undefined,
            'production_item',
            itemId,
            { status: 'palletized' },
            { status: 'shipped' }
        );
    }

    async logUnpalletization(itemId: string, itemSerial: number, user: User | null) {
        return this.log(
            'unpalletized',
            user,
            `Бейл #${itemSerial} знято з палети`,
            undefined,
            'production_item',
            itemId,
            { status: 'palletized' },
            { status: 'graded' }
        );
    }

    async logLocationAssignment(
        entityType: 'production_item' | 'batch',
        entityId: string,
        locationCode: string,
        user: User | null
    ) {
        return this.log(
            'location_assigned',
            user,
            `Призначено локацію ${locationCode}`,
            { location: locationCode },
            entityType,
            entityId,
            undefined,
            { location: locationCode }
        );
    }

    async logBatchCreated(batchId: string, user: User | null) {
        return this.log(
            'batch_created',
            user,
            `Створено палету ${batchId}`,
            undefined,
            'batch',
            batchId
        );
    }

    async logBatchClosed(batchId: string, itemCount: number, user: User | null) {
        return this.log(
            'batch_closed',
            user,
            `Закрито палету ${batchId} (${itemCount} бейлів)`,
            { itemCount },
            'batch',
            batchId,
            { status: 'open' },
            { status: 'closed' }
        );
    }

    // === Getters ===
    getAll(): AuditLogEntry[] {
        return [...this.logs].reverse(); // Most recent first
    }

    getByAction(action: AuditAction): AuditLogEntry[] {
        return this.logs.filter(e => e.action === action).reverse();
    }

    getByUser(userId: string): AuditLogEntry[] {
        return this.logs.filter(e => e.userId === userId).reverse();
    }

    getByEntity(entityType: string, entityId: string): AuditLogEntry[] {
        return this.logs.filter(e => e.entityType === entityType && e.entityId === entityId).reverse();
    }

    getRecent(count: number = 50): AuditLogEntry[] {
        return this.logs.slice(-count).reverse();
    }

    // Fetch from Supabase for entity history
    async getEntityHistory(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
        if (!USE_SUPABASE || !supabase) {
            return this.getByEntity(entityType, entityId);
        }

        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map((row: any) => ({
                id: row.id,
                timestamp: new Date(row.created_at).getTime(),
                action: row.action,
                userId: row.user_id || 'unknown',
                userName: row.user_name || 'Система',
                userRole: 'system',
                details: row.notes || '',
                entityType: row.entity_type,
                entityId: row.entity_id,
                oldValue: row.old_value,
                newValue: row.new_value
            }));
        } catch (e) {
            console.error('[AuditLog] getEntityHistory failed:', e);
            return this.getByEntity(entityType, entityId);
        }
    }

    async getRecentFromSupabase(limit: number = 50): Promise<AuditLogEntry[]> {
        if (!USE_SUPABASE || !supabase) {
            return this.getRecent(limit);
        }

        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (data || []).map((row: any) => ({
                id: row.id,
                timestamp: new Date(row.created_at).getTime(),
                action: row.action,
                userId: row.user_id || 'unknown',
                userName: row.user_name || 'Система',
                userRole: 'system',
                details: row.notes || '',
                entityType: row.entity_type,
                entityId: row.entity_id,
                oldValue: row.old_value,
                newValue: row.new_value
            }));
        } catch (e) {
            console.error('[AuditLog] getRecentFromSupabase failed:', e);
            return this.getRecent(limit);
        }
    }

    // Action label helpers
    getActionLabel(action: string): string {
        const labels: Record<string, string> = {
            'login': '🔐 Вхід',
            'logout': '🚪 Вихід',
            'print': '🖨️ Друк',
            'settings_change': '⚙️ Налаштування',
            'user_create': '👤 Новий користувач',
            'user_update': '✏️ Оновлено користувача',
            'user_delete': '🗑️ Видалено користувача',
            'created': '🆕 Створено',
            'graded': '✅ Сортовано',
            'palletized': '📦 Палетизовано',
            'shipped': '🚛 Відвантажено',
            'unpalletized': '↩️ Знято з палети',
            'status_changed': '🔄 Зміна статусу',
            'location_assigned': '📍 Локацію призначено',
            'deleted': '🗑️ Видалено',
            'updated': '✏️ Оновлено',
            'batch_created': '📦 Палету створено',
            'batch_closed': '🔒 Палету закрито',
            'shipment_created': '🚚 Відвантаження',
            'shipment_dispatched': '✈️ Відправлено'
        };
        return labels[action] || action;
    }

    clear() {
        this.logs = [];
        this.saveToStorage();
    }
}

// Singleton instance
export const auditLog = new AuditLogService();
