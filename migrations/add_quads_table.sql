-- =====================================================
-- Migration: Add Quads Table and Update Production Items
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add 'formuvalnyk' role to users table constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('accountant', 'lab', 'agro', 'admin', 'operator', 'report', 'postgres_user', 'receiving', 'formuvalnyk'));

-- 2. Create Quads table
CREATE TABLE IF NOT EXISTS quads (
    id TEXT PRIMARY KEY, -- "Q-20260113-001"
    date TEXT NOT NULL,
    product_name TEXT NOT NULL DEFAULT 'Long Fiber',
    sort TEXT NOT NULL,
    total_weight DECIMAL(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'warehouse')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add quad_id column to production_items
ALTER TABLE production_items 
ADD COLUMN IF NOT EXISTS quad_id TEXT REFERENCES quads(id) ON DELETE SET NULL;

-- 4. Update status constraint in production_items
ALTER TABLE production_items DROP CONSTRAINT IF EXISTS production_items_status_check;
ALTER TABLE production_items ADD CONSTRAINT production_items_status_check 
    CHECK (status IN ('created', 'graded', 'packed', 'warehouse', 'palletized', 'shipped'));

-- 5. Add packed_at timestamp
ALTER TABLE production_items 
ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_quads_status ON quads(status);
CREATE INDEX IF NOT EXISTS idx_quads_date ON quads(date);
CREATE INDEX IF NOT EXISTS idx_production_items_quad_id ON production_items(quad_id);

-- 7. Enable RLS on quads
ALTER TABLE quads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quads" ON quads FOR ALL USING (true) WITH CHECK (true);

-- 8. Add Formuvalnyk user
INSERT INTO users (name, role, pin) 
VALUES ('Формувальник', 'formuvalnyk', '6666')
ON CONFLICT DO NOTHING;

-- Done!
