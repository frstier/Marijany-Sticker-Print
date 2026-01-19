-- Add test lab user for development/testing
-- Run this in Supabase SQL Editor

INSERT INTO users (name, role, pin) VALUES
    ('Лаборант_тест', 'lab', '2223');
