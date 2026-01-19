-- Add lab_data column to production_items for storing quality parameters
-- Run this in Supabase SQL Editor

ALTER TABLE production_items 
ADD COLUMN IF NOT EXISTS lab_data JSONB;

-- Create index for querying lab data
CREATE INDEX IF NOT EXISTS idx_production_items_lab_data ON production_items USING GIN (lab_data);

-- Example of lab_data structure:
-- For Long Fiber:
-- {
--   "fiberLength": 45.5,
--   "breakingLoad": 12.3,
--   "linearDensity": 0.8,
--   "shivContent": 2.1,
--   "unprocessedFiber": 1.5,
--   "impurityContent": 0.3,
--   "moisture": 8.5
-- }
--
-- For Short Fiber:
-- {
--   "breakingLoad": 10.2,
--   "shivContent": 3.5,
--   "impurityContent": 0.5,
--   "unprocessedFiber": 2.0,
--   "moisture": 9.0
-- }
--
-- For Hurds Uncalibrated:
-- {
--   "impurityContent": 0.2,
--   "fiberContent": 1.5,
--   "seedContent": 0.8,
--   "moisture": 12.0
-- }
--
-- For Hurds Calibrated:
-- {
--   "fractionalComposition": 95.5,
--   "fiberContent": 1.2,
--   "moisture": 11.5
-- }
