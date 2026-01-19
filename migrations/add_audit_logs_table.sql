-- =====================================================
-- Audit Logs Table Migration
-- Created: 2026-01-19
-- Purpose: Track all status changes and important actions
-- =====================================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What changed
    entity_type TEXT NOT NULL CHECK (entity_type IN ('production_item', 'batch', 'shipment', 'user')),
    entity_id TEXT NOT NULL, -- UUID or custom ID of the entity
    
    -- Action performed
    action TEXT NOT NULL CHECK (action IN (
        'created', 'graded', 'palletized', 'shipped', 'unpalletized',
        'status_changed', 'location_assigned', 'deleted', 'updated',
        'batch_created', 'batch_closed', 'shipment_created', 'shipment_dispatched'
    )),
    
    -- Values before and after (JSON for flexibility)
    old_value JSONB,
    new_value JSONB,
    
    -- Who made the change
    user_id UUID REFERENCES users(id),
    user_name TEXT, -- Denormalized for quick access
    
    -- Additional context
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow all access (can be restricted later)
CREATE POLICY "Allow all access to audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Done! Audit logs table created.
-- =====================================================
