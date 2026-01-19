import { supabase } from './supabaseClient';
import { ProductionItem } from '../types/production';

export interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    isActive: boolean;
    lastUsedAt?: string;
    expiresAt?: string;
    createdAt: string;
}

export interface Webhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    lastTriggeredAt?: string;
    lastStatus?: number;
    lastError?: string;
    createdAt: string;
}

export interface WebhookLog {
    id: string;
    webhookId: string;
    event: string;
    payload: any;
    responseStatus?: number;
    responseBody?: string;
    durationMs?: number;
    success: boolean;
    error?: string;
    createdAt: string;
}

export type WebhookEvent =
    | 'item.created'
    | 'item.graded'
    | 'item.palletized'
    | 'item.shipped'
    | 'batch.created'
    | 'batch.closed'
    | 'shipment.created'
    | 'shipment.completed';

const WEBHOOK_EVENTS: Record<WebhookEvent, string> = {
    'item.created': 'Новий бейл створено',
    'item.graded': 'Бейл відсортовано',
    'item.palletized': 'Бейл на палеті',
    'item.shipped': 'Бейл відвантажено',
    'batch.created': 'Палета створена',
    'batch.closed': 'Палета закрита',
    'shipment.created': 'Відвантаження створено',
    'shipment.completed': 'Відвантаження завершено'
};

export const ApiService = {
    // =====================================================
    // API KEYS
    // =====================================================

    /**
     * Generate a new API key
     */
    async generateApiKey(name: string, scopes: string[] = ['read']): Promise<{ apiKey: string; keyId: string } | null> {
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .rpc('generate_api_key', { p_name: name, p_scopes: scopes });

            if (error) throw error;

            return data?.[0] ? {
                apiKey: data[0].api_key,
                keyId: data[0].key_id
            } : null;
        } catch (e) {
            console.error('[API] generateApiKey failed:', e);
            return null;
        }
    },

    /**
     * Get all API keys (without the actual key, only metadata)
     */
    async getApiKeys(): Promise<ApiKey[]> {
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('api_keys')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(row => ({
                id: row.id,
                name: row.name,
                prefix: row.prefix,
                scopes: row.scopes,
                isActive: row.is_active,
                lastUsedAt: row.last_used_at,
                expiresAt: row.expires_at,
                createdAt: row.created_at
            }));
        } catch (e) {
            console.error('[API] getApiKeys failed:', e);
            return [];
        }
    },

    /**
     * Revoke (deactivate) an API key
     */
    async revokeApiKey(keyId: string): Promise<boolean> {
        if (!supabase) return false;

        try {
            const { error } = await supabase
                .from('api_keys')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', keyId);

            return !error;
        } catch (e) {
            console.error('[API] revokeApiKey failed:', e);
            return false;
        }
    },

    // =====================================================
    // WEBHOOKS
    // =====================================================

    /**
     * Create a new webhook subscription
     */
    async createWebhook(name: string, url: string, events: WebhookEvent[]): Promise<Webhook | null> {
        if (!supabase) return null;

        try {
            // Generate random secret for HMAC signing
            const secret = crypto.randomUUID() + '-' + Date.now();

            const { data, error } = await supabase
                .from('api_webhooks')
                .insert({
                    name,
                    url,
                    events,
                    secret,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;

            return this.mapWebhook(data);
        } catch (e) {
            console.error('[API] createWebhook failed:', e);
            return null;
        }
    },

    /**
     * Get all webhooks
     */
    async getWebhooks(): Promise<Webhook[]> {
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('api_webhooks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(this.mapWebhook);
        } catch (e) {
            console.error('[API] getWebhooks failed:', e);
            return [];
        }
    },

    /**
     * Update webhook
     */
    async updateWebhook(id: string, updates: Partial<{ name: string; url: string; events: WebhookEvent[]; isActive: boolean }>): Promise<boolean> {
        if (!supabase) return false;

        try {
            const dbUpdates: any = { updated_at: new Date().toISOString() };
            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.url !== undefined) dbUpdates.url = updates.url;
            if (updates.events !== undefined) dbUpdates.events = updates.events;
            if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

            const { error } = await supabase
                .from('api_webhooks')
                .update(dbUpdates)
                .eq('id', id);

            return !error;
        } catch (e) {
            console.error('[API] updateWebhook failed:', e);
            return false;
        }
    },

    /**
     * Delete webhook
     */
    async deleteWebhook(id: string): Promise<boolean> {
        if (!supabase) return false;

        try {
            const { error } = await supabase
                .from('api_webhooks')
                .delete()
                .eq('id', id);

            return !error;
        } catch (e) {
            console.error('[API] deleteWebhook failed:', e);
            return false;
        }
    },

    /**
     * Trigger webhooks for an event
     */
    async triggerWebhooks(event: WebhookEvent, payload: any): Promise<void> {
        if (!supabase) return;

        try {
            // Get active webhooks subscribed to this event
            const { data: webhooks } = await supabase
                .from('api_webhooks')
                .select('*')
                .eq('is_active', true)
                .contains('events', [event]);

            if (!webhooks || webhooks.length === 0) return;

            // Send to each webhook
            for (const webhook of webhooks) {
                this.sendWebhook(webhook, event, payload);
            }
        } catch (e) {
            console.error('[API] triggerWebhooks failed:', e);
        }
    },

    /**
     * Send webhook request (with retry logic)
     */
    async sendWebhook(webhook: any, event: WebhookEvent, payload: any, attempt = 1): Promise<void> {
        const startTime = Date.now();

        try {
            // Create signature
            const body = JSON.stringify({
                event,
                timestamp: new Date().toISOString(),
                data: payload
            });

            const signature = await this.createHmacSignature(body, webhook.secret);

            // Send request
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Event': event,
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Timestamp': new Date().toISOString(),
                    ...webhook.headers
                },
                body,
                signal: AbortSignal.timeout(webhook.timeout_ms || 30000)
            });

            const durationMs = Date.now() - startTime;
            const responseBody = await response.text();

            // Log the delivery
            await this.logWebhookDelivery(webhook.id, event, payload, {
                status: response.status,
                body: responseBody,
                durationMs,
                attempt,
                success: response.ok
            });

            // Update webhook status
            await supabase?.from('api_webhooks').update({
                last_triggered_at: new Date().toISOString(),
                last_status: response.status,
                last_error: response.ok ? null : responseBody
            }).eq('id', webhook.id);

            // Retry if failed
            if (!response.ok && attempt < webhook.retry_count) {
                setTimeout(() => {
                    this.sendWebhook(webhook, event, payload, attempt + 1);
                }, 1000 * attempt); // Exponential backoff
            }
        } catch (e: any) {
            const durationMs = Date.now() - startTime;

            // Log error
            await this.logWebhookDelivery(webhook.id, event, payload, {
                durationMs,
                attempt,
                success: false,
                error: e.message
            });

            // Retry
            if (attempt < webhook.retry_count) {
                setTimeout(() => {
                    this.sendWebhook(webhook, event, payload, attempt + 1);
                }, 1000 * attempt);
            }
        }
    },

    /**
     * Create HMAC-SHA256 signature
     */
    async createHmacSignature(payload: string, secret: string): Promise<string> {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    /**
     * Log webhook delivery
     */
    async logWebhookDelivery(
        webhookId: string,
        event: string,
        payload: any,
        result: { status?: number; body?: string; durationMs: number; attempt: number; success: boolean; error?: string }
    ): Promise<void> {
        if (!supabase) return;

        try {
            await supabase.from('api_webhook_logs').insert({
                webhook_id: webhookId,
                event,
                payload,
                response_status: result.status,
                response_body: result.body?.substring(0, 1000), // Limit size
                duration_ms: result.durationMs,
                attempt: result.attempt,
                success: result.success,
                error: result.error
            });
        } catch (e) {
            console.error('[API] logWebhookDelivery failed:', e);
        }
    },

    /**
     * Get webhook logs
     */
    async getWebhookLogs(webhookId?: string, limit = 50): Promise<WebhookLog[]> {
        if (!supabase) return [];

        try {
            let query = supabase
                .from('api_webhook_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (webhookId) {
                query = query.eq('webhook_id', webhookId);
            }

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map(row => ({
                id: row.id,
                webhookId: row.webhook_id,
                event: row.event,
                payload: row.payload,
                responseStatus: row.response_status,
                responseBody: row.response_body,
                durationMs: row.duration_ms,
                success: row.success,
                error: row.error,
                createdAt: row.created_at
            }));
        } catch (e) {
            console.error('[API] getWebhookLogs failed:', e);
            return [];
        }
    },

    // =====================================================
    // HELPERS
    // =====================================================

    getWebhookEventLabel(event: WebhookEvent): string {
        return WEBHOOK_EVENTS[event] || event;
    },

    getAllWebhookEvents(): { value: WebhookEvent; label: string }[] {
        return Object.entries(WEBHOOK_EVENTS).map(([value, label]) => ({
            value: value as WebhookEvent,
            label
        }));
    },

    mapWebhook(row: any): Webhook {
        return {
            id: row.id,
            name: row.name,
            url: row.url,
            events: row.events,
            isActive: row.is_active,
            lastTriggeredAt: row.last_triggered_at,
            lastStatus: row.last_status,
            lastError: row.last_error,
            createdAt: row.created_at
        };
    }
};
