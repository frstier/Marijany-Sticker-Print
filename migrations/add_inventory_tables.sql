-- =====================================================
-- Inventory Sessions Table Migration
-- Created: 2026-01-19
-- Purpose: Track inventory check sessions and scanned items
-- =====================================================

-- Inventory Sessions table
CREATE TABLE IF NOT EXISTS inventory_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session info
    name TEXT NOT NULL, -- e.g. "Інвентаризація січень 2026"
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    
    -- Stats (updated as items are scanned)
    total_expected INTEGER DEFAULT 0,  -- Items in DB at start
    total_scanned INTEGER DEFAULT 0,   -- Successfully scanned
    total_missing INTEGER DEFAULT 0,   -- Expected but not found
    total_extra INTEGER DEFAULT 0,     -- Found but not in DB
    
    -- User who created/runs the session
    user_id UUID REFERENCES users(id),
    user_name TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items - tracks each scanned item in a session
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    
    -- Item reference
    production_item_id UUID REFERENCES production_items(id),
    barcode TEXT NOT NULL,
    
    -- Status of this item in inventory
    status TEXT NOT NULL DEFAULT 'found' CHECK (status IN (
        'found',      -- Item exists in DB and was scanned
        'missing',    -- Item exists in DB but was not scanned (calculated at end)
        'extra',      -- Item was scanned but doesn't exist in DB
        'mismatch'    -- Item found but data doesn't match (e.g., wrong location)
    )),
    
    -- Denormalized data for reporting
    serial_number INTEGER,
    product_name TEXT,
    weight DECIMAL(10, 2),
    sort TEXT,
    expected_location TEXT,  -- Where item should be
    actual_location TEXT,    -- Where item was scanned (if different)
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_sessions_status ON inventory_sessions(status);
CREATE INDEX idx_inventory_items_session_id ON inventory_items(session_id);
CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);

-- Enable RLS
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Allow all access (can be restricted later)
CREATE POLICY "Allow all access to inventory_sessions" ON inventory_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to inventory_items" ON inventory_items FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Done! Inventory tables created.
-- =====================================================
