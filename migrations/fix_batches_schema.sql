-- Migration: Fix batches table schema
-- Run this in Supabase SQL Editor

-- 1. Add batch_number column
ALTER TABLE batches ADD COLUMN IF NOT EXISTS batch_number TEXT;

-- 2. Since existing batches have TEXT id, we need to:
--    Option A: Keep existing schema (simpler)
--    Option B: Migrate to UUID (complex)

-- Let's go with Option A: Update code to work with current schema
-- We'll use id as both UUID and display (keep it as TEXT)

-- For new design: id should be UUID, batch_number should be display ID
-- But this requires data migration...

-- RECOMMENDED: Drop and recreate table (if no production data)
DROP TABLE IF EXISTS batch_items CASCADE;
DROP TABLE IF EXISTS batches CASCADE;

CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number TEXT UNIQUE NOT NULL, -- P-20260112-001
    date TEXT NOT NULL,
    total_weight DECIMAL(10, 2) DEFAULT 0,
    sort TEXT NOT NULL,
    product_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    production_item_id UUID REFERENCES production_items(id) ON DELETE SET NULL,
    
    serial_number INTEGER NOT NULL,
    weight DECIMAL(10, 2) NOT NULL,
    product_name TEXT NOT NULL,
    sort TEXT NOT NULL,
    date TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update production_items.batch_id to UUID
ALTER TABLE production_items DROP COLUMN IF EXISTS batch_id;
ALTER TABLE production_items ADD COLUMN batch_id UUID REFERENCES batches(id);

-- Indexes
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_date ON batches(date);
CREATE INDEX idx_batches_batch_number ON batches(batch_number);
CREATE INDEX idx_batch_items_batch_id ON batch_items(batch_id);
CREATE INDEX idx_production_items_batch_id ON production_items(batch_id);

-- RLS
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to batches" ON batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to batch_items" ON batch_items FOR ALL USING (true) WITH CHECK (true);
