-- =====================================================
-- Add Locations Table
-- =====================================================

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone TEXT NOT NULL,           -- "A", "B", "C" (Warehouse Zone)
    rack TEXT NOT NULL,           -- "01", "02", ... (Rack Number)
    level TEXT NOT NULL,          -- "1", "2", "3" (Shelf Level)
    position TEXT,                -- "L", "R", "1", "2" (Position on Shelf)
    code TEXT UNIQUE NOT NULL,    -- "A-01-2-L" (Full Location Code)
    description TEXT,             -- Optional description
    is_occupied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);

-- =====================================================
-- Add Location References to Items and Batches
-- =====================================================

-- Add location_id to production_items (for individual bales)
ALTER TABLE production_items 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Add location_id to batches (for pallets)
ALTER TABLE batches 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_production_items_location_id ON production_items(location_id);
CREATE INDEX IF NOT EXISTS idx_batches_location_id ON batches(location_id);

-- =====================================================
-- RLS Policies for Locations
-- =====================================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to locations" ON locations FOR ALL USING (true) WITH CHECK (true);
