-- =====================================================
-- Migration: Add 'receiving' role to users table
-- Date: 2026-01-08
-- Description: Adds the 'receiving' role for warehouse/receiving department
-- =====================================================

-- Drop existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with 'receiving' role included
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('accountant', 'lab', 'agro', 'admin', 'operator', 'report', 'postgres_user', 'receiving'));

-- Done!
-- After running this, you can create users with role='receiving'
