-- Create Database (Run this separately if DB doesn't exist)
-- CREATE DATABASE marijany_db;

-- Create Table: production_items
CREATE TABLE IF NOT EXISTS production_items (
    id SERIAL PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    barcode TEXT,
    date TEXT,
    serial_number INTEGER,
    weight NUMERIC(10, 3),
    product_name TEXT,
    product_name_en TEXT,
    status TEXT DEFAULT 'created', -- created, graded, palletized
    sort TEXT,
    lab_user_id TEXT,
    batch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    palletized_at TIMESTAMPTZ
);

-- Index for faster search
CREATE INDEX IF NOT EXISTS idx_serial_number ON production_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_status ON production_items(status);
