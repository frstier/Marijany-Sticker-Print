// Audit Log Service - Tracks user actions

interface AuditEntry {
    id: string;
    userId: string;
    userName: string;
    action: string;
    details: string;
    timestamp: string;
}

const AUDIT_STORAGE_KEY = 'hemp_audit_log_v1';
const MAX_ENTRIES = 500;
const TTL_DAYS = 30;

export const AuditService = {
    log(userId: string, userName: string, action: string, details: string = '') {
        const entries = this.getEntries();

        const entry: AuditEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            userName,
            action,
            details,
            timestamp: new Date().toISOString()
        };

        entries.unshift(entry);

        // Keep only last MAX_ENTRIES
        const trimmed = entries.slice(0, MAX_ENTRIES);

        // Remove entries older than TTL_DAYS
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);
        const filtered = trimmed.filter(e => new Date(e.timestamp) > cutoffDate);

        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(filtered));
    },

    getEntries(): AuditEntry[] {
        try {
            const data = localStorage.getItem(AUDIT_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    getByUser(userId: string): AuditEntry[] {
        return this.getEntries().filter(e => e.userId === userId);
    },

    getByAction(action: string): AuditEntry[] {
        return this.getEntries().filter(e => e.action === action);
    },

    getByDateRange(start: Date, end: Date): AuditEntry[] {
        return this.getEntries().filter(e => {
            const entryDate = new Date(e.timestamp);
            return entryDate >= start && entryDate <= end;
        });
    },

    clear() {
        localStorage.removeItem(AUDIT_STORAGE_KEY);
    },

    // Common actions
    ACTIONS: {
        LOGIN: 'login',
        LOGOUT: 'logout',
        PRINT: 'print',
        GRADE: 'grade',
        BATCH_GRADE: 'batch_grade',
        CREATE_PALLET: 'create_pallet',
        CLOSE_PALLET: 'close_pallet',
        DISBAND_PALLET: 'disband_pallet',
        WRITE_OFF: 'write_off',
        SETTINGS_CHANGE: 'settings_change'
    }
};
