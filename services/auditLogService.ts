import { LabelData, User } from '../types';

const AUDIT_LOG_KEY = 'audit_log_v1';
const MAX_LOG_ENTRIES = 500;

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: 'login' | 'logout' | 'print' | 'settings_change' | 'user_create' | 'user_update' | 'user_delete';
    userId: string;
    userName: string;
    userRole: string;
    details: string;
    metadata?: Record<string, any>;
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
        action: AuditLogEntry['action'],
        user: User | null,
        details: string,
        metadata?: Record<string, any>
    ): AuditLogEntry {
        return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            action,
            userId: user?.id || 'unknown',
            userName: user?.name || 'Система',
            userRole: user?.role || 'system',
            details,
            metadata
        };
    }

    log(
        action: AuditLogEntry['action'],
        user: User | null,
        details: string,
        metadata?: Record<string, any>
    ) {
        const entry = this.createEntry(action, user, details, metadata);
        this.logs.push(entry);
        this.saveToStorage();
        console.log(`📝 Audit: [${action}] ${details}`, metadata);
        return entry;
    }

    // Convenience methods
    logLogin(user: User) {
        return this.log('login', user, `Вхід користувача ${user.name}`);
    }

    logLogout(user: User) {
        return this.log('logout', user, `Вихід користувача ${user.name}`);
    }

    logPrint(user: User | null, labelData: LabelData) {
        return this.log('print', user, `Друк етикетки: ${labelData.productName || 'N/A'}`, {
            productName: labelData.productName,
            serial: labelData.serial,
            sort: labelData.sort
        });
    }

    logSettingsChange(user: User, setting: string, oldValue: any, newValue: any) {
        return this.log('settings_change', user, `Зміна налаштування: ${setting}`, {
            setting,
            oldValue,
            newValue
        });
    }

    logUserCreate(admin: User, newUser: User) {
        return this.log('user_create', admin, `Створено користувача: ${newUser.name}`, {
            newUserId: newUser.id,
            newUserRole: newUser.role
        });
    }

    logUserUpdate(admin: User, updatedUser: User) {
        return this.log('user_update', admin, `Оновлено користувача: ${updatedUser.name}`, {
            userId: updatedUser.id
        });
    }

    logUserDelete(admin: User, deletedUser: User) {
        return this.log('user_delete', admin, `Видалено користувача: ${deletedUser.name}`, {
            userId: deletedUser.id
        });
    }

    // Getters
    getAll(): AuditLogEntry[] {
        return [...this.logs].reverse(); // Most recent first
    }

    getByAction(action: AuditLogEntry['action']): AuditLogEntry[] {
        return this.logs.filter(e => e.action === action).reverse();
    }

    getByUser(userId: string): AuditLogEntry[] {
        return this.logs.filter(e => e.userId === userId).reverse();
    }

    getRecent(count: number = 50): AuditLogEntry[] {
        return this.logs.slice(-count).reverse();
    }

    clear() {
        this.logs = [];
        this.saveToStorage();
    }
}

// Singleton instance
export const auditLog = new AuditLogService();
