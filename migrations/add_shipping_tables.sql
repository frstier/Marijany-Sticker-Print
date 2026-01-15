-- =====================================================
-- Shipping Tables Migration
-- Created: 2026-01-15
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SHIPMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number TEXT UNIQUE NOT NULL,     -- e.g., "SH-20260115-001"
    
    -- Destination & Transport
    destination TEXT NOT NULL,
    destination_address TEXT,
    carrier TEXT,                              -- Transport company
    truck_number TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'loading', 'shipped', 'in_transit', 'delivered', 'cancelled')),
    
    -- Timestamps
    scheduled_date DATE,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    cmr_number TEXT,                          -- CMR document number
    total_weight DECIMAL(12, 2) DEFAULT 0,
    total_pallets INTEGER DEFAULT 0,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. SHIPMENT_ITEMS TABLE (Pallets in Shipment)
-- =====================================================
CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    
    -- Denormalized data for reports
    pallet_weight DECIMAL(10, 2),
    pallet_item_count INTEGER,
    product_name TEXT,
    sort TEXT,
    
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    
    -- Prevent duplicate pallets in same shipment
    UNIQUE (shipment_id, batch_id)
);

-- =====================================================
-- 3. UPDATE BATCHES TABLE - Add shipment reference
-- =====================================================
ALTER TABLE batches ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(id);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_number ON shipments(shipment_number);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_batch_id ON shipment_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_shipment_id ON batches(shipment_id);

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public access - adjust for production)
CREATE POLICY "Allow all access to shipments" ON shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to shipment_items" ON shipment_items FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 6. TRIGGER FOR updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_shipments_updated_at ON shipments;
CREATE TRIGGER update_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Done! Shipping tables created.
-- =====================================================
