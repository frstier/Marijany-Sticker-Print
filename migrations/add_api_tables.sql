-- API Webhooks table for external integrations (Microsoft Dynamics, etc.)
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. API KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,  -- SHA-256 hash of the API key
    prefix TEXT NOT NULL,    -- First 8 chars for identification (e.g., "mj_live_")
    scopes TEXT[] DEFAULT ARRAY['read'],  -- ['read', 'write', 'webhook']
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- =====================================================
-- 2. WEBHOOK SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,                    -- Target URL (e.g., Dynamics endpoint)
    events TEXT[] NOT NULL,               -- ['item.created', 'item.graded', 'shipment.created']
    secret TEXT NOT NULL,                 -- For HMAC-SHA256 signature
    headers JSONB DEFAULT '{}',           -- Custom headers to send
    is_active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 30000,
    last_triggered_at TIMESTAMPTZ,
    last_status INTEGER,                  -- Last HTTP status code
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active webhooks
CREATE INDEX IF NOT EXISTS idx_api_webhooks_active ON api_webhooks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_webhooks_events ON api_webhooks USING GIN(events);

-- =====================================================
-- 3. WEBHOOK DELIVERY LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES api_webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    attempt INTEGER DEFAULT 1,
    success BOOLEAN DEFAULT false,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON api_webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON api_webhook_logs(created_at);

-- =====================================================
-- 4. DYNAMICS SYNC STATUS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dynamics_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,            -- 'production_item', 'batch', 'shipment'
    entity_id UUID NOT NULL,
    dynamics_id TEXT,                     -- ID in Dynamics
    sync_status TEXT DEFAULT 'pending',   -- 'pending', 'synced', 'failed'
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_dynamics_sync_status ON dynamics_sync_status(sync_status);
CREATE INDEX IF NOT EXISTS idx_dynamics_sync_entity ON dynamics_sync_status(entity_type, entity_id);

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamics_sync_status ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage API settings
CREATE POLICY "Allow all for authenticated" ON api_keys FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON api_webhooks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON api_webhook_logs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON dynamics_sync_status FOR ALL USING (true);

-- =====================================================
-- 6. FUNCTION: Generate API Key
-- =====================================================
CREATE OR REPLACE FUNCTION generate_api_key(p_name TEXT, p_scopes TEXT[] DEFAULT ARRAY['read'])
RETURNS TABLE(api_key TEXT, key_id UUID) AS $$
DECLARE
    v_key TEXT;
    v_prefix TEXT := 'mj_live_';
    v_random TEXT;
    v_id UUID;
BEGIN
    -- Generate random key
    v_random := encode(gen_random_bytes(32), 'hex');
    v_key := v_prefix || v_random;
    
    -- Insert with hashed key
    INSERT INTO api_keys (name, key_hash, prefix, scopes)
    VALUES (p_name, encode(sha256(v_key::bytea), 'hex'), v_prefix, p_scopes)
    RETURNING id INTO v_id;
    
    -- Return the actual key (only shown once!)
    RETURN QUERY SELECT v_key, v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNCTION: Validate API Key
-- =====================================================
CREATE OR REPLACE FUNCTION validate_api_key(p_key TEXT)
RETURNS TABLE(key_id UUID, key_name TEXT, scopes TEXT[]) AS $$
BEGIN
    RETURN QUERY
    SELECT ak.id, ak.name, ak.scopes
    FROM api_keys ak
    WHERE ak.key_hash = encode(sha256(p_key::bytea), 'hex')
      AND ak.is_active = true
      AND (ak.expires_at IS NULL OR ak.expires_at > NOW());
    
    -- Update last used timestamp
    UPDATE api_keys 
    SET last_used_at = NOW()
    WHERE key_hash = encode(sha256(p_key::bytea), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
