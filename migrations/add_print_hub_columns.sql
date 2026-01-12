-- Migration: Add ALL missing columns to production_items
-- These columns are required for Print Hub and Excel Import to work
-- Run this in Supabase SQL Editor

-- Add lab_notes column (for lab comments during grading)
ALTER TABLE production_items
ADD COLUMN IF NOT EXISTS lab_notes TEXT DEFAULT NULL;

-- Add import_batch_id column (stores the batch ID from Excel imports)
ALTER TABLE production_items
ADD COLUMN IF NOT EXISTS import_batch_id TEXT DEFAULT NULL;

-- Add printed_at column (tracks when item was printed in Print Hub)
ALTER TABLE production_items
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ DEFAULT NULL;

-- Refresh Supabase schema cache (this is done automatically, but just in case)
-- NOTIFY pgrst, 'reload schema';

-- Optional: Create index for faster batch queries in Print Hub
CREATE INDEX IF NOT EXISTS idx_production_items_import_batch_id
ON production_items (import_batch_id)
WHERE import_batch_id IS NOT NULL;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'production_items' 
AND column_name IN ('lab_notes', 'import_batch_id', 'printed_at');
