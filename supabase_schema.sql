-- =====================================================
-- Marijany-Sticker-Print - Supabase Schema
-- Created: 2026-01-06
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DROP EXISTING TABLES (to recreate from scratch)
-- =====================================================
DROP TABLE IF EXISTS batch_items CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS production_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- =====================================================
-- 2. USERS TABLE
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('accountant', 'lab', 'agro', 'admin', 'operator', 'report', 'postgres_user')),
    pin TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. PRODUCTS TABLE
-- =====================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_en TEXT,
    sku TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('fiber', 'shiv', 'dust')),
    sorts TEXT[], -- Array of available sorts for this product
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PRODUCTION_ITEMS TABLE (Main Work Items)
-- =====================================================
CREATE TABLE production_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode TEXT NOT NULL, -- "24.12.2025-LF-101-50.5"
    
    -- Parsed info
    date TEXT NOT NULL, -- "DD.MM.YYYY" format
    product_name TEXT NOT NULL,
    product_name_en TEXT,
    serial_number INTEGER NOT NULL,
    weight DECIMAL(10, 2) NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'graded', 'palletized', 'shipped')),
    
    -- Lab Data
    sort TEXT,
    graded_at TIMESTAMPTZ,
    lab_user_id UUID REFERENCES users(id),
    operator_id UUID REFERENCES users(id),
    
    -- Accountant Data (Pallet)
    batch_id TEXT, -- Links to batches.id
    palletized_at TIMESTAMPTZ,
    
    -- Shipping Data
    shipped_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: same serial + product + date = same item
    UNIQUE (serial_number, product_name, date)
);

-- =====================================================
-- 5. BATCHES TABLE (Pallets)
-- =====================================================
CREATE TABLE batches (
    id TEXT PRIMARY KEY, -- Human-readable ID like "P-20251224-001"
    date TEXT NOT NULL,
    total_weight DECIMAL(10, 2) DEFAULT 0,
    sort TEXT NOT NULL,
    product_name TEXT, -- Added for filtering
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. BATCH_ITEMS TABLE (Items in a Pallet)
-- =====================================================
CREATE TABLE batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    production_item_id UUID REFERENCES production_items(id) ON DELETE SET NULL,
    
    -- Denormalized data for quick access
    serial_number INTEGER NOT NULL,
    weight DECIMAL(10, 2) NOT NULL,
    product_name TEXT NOT NULL,
    sort TEXT NOT NULL,
    date TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. HISTORY TABLE (Operator Print History / Legacy)
-- =====================================================
CREATE TABLE history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name TEXT,
    sku TEXT,
    weight DECIMAL(10, 2),
    serial_number INTEGER NOT NULL,
    sort_label TEXT,
    sort_value TEXT,
    status TEXT DEFAULT 'ok',
    operator_id UUID REFERENCES users(id),
    operator_name TEXT,
    barcode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for upsert
    UNIQUE (sku, serial_number)
);

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_production_items_status ON production_items(status);
CREATE INDEX idx_production_items_date ON production_items(date);
CREATE INDEX idx_production_items_batch_id ON production_items(batch_id);
CREATE INDEX idx_production_items_barcode ON production_items(barcode);
CREATE INDEX idx_batch_items_batch_id ON batch_items(batch_id);
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_date ON batches(date);
CREATE INDEX idx_history_created_at ON history(created_at);
CREATE INDEX idx_history_sku_serial ON history(sku, serial_number);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) - Enable but allow all for now
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anonymous users (public access)
-- In production, you would want more restrictive policies

CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to production_items" ON production_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to batches" ON batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to batch_items" ON batch_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to history" ON history FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 9. SEED DATA - Default Users
-- =====================================================
INSERT INTO users (name, role, pin) VALUES
    ('Оператор', 'operator', '1111'),
    ('Лаборант', 'lab', '2222'),
    ('Обліковець', 'accountant', '3333'),
    ('Адміністратор', 'admin', '0000'),
    ('Агро', 'agro', '4444'),
    ('Звіти', 'report', '5555');

-- =====================================================
-- 10. SEED DATA - Default Products
-- =====================================================
INSERT INTO products (name, name_en, sku, category, sorts) VALUES
    ('Long Fiber', 'Long Fiber', 'LF', 'fiber', ARRAY['1 Сорт', '2 Сорт', '3 Сорт', 'Брак']),
    ('Short Fiber', 'Short Fiber', 'SF', 'fiber', ARRAY['1 Сорт', '2 Сорт', '3 Сорт', 'Брак']),
    ('Hemp Core', 'Hemp Core', 'HC', 'shiv', ARRAY['1 Сорт', '2 Сорт', '3 Сорт', 'Брак']),
    ('Hemp Dust', 'Hemp Dust', 'HD', 'dust', ARRAY['1 Сорт', '2 Сорт', 'Брак']);

-- =====================================================
-- Done! Tables created and seeded.
-- =====================================================
