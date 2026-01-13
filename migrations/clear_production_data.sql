-- =====================================================
-- Очистка даних (зберігаємо структуру та users/products)
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Спочатку скидаємо зв'язки batch_id в production_items
UPDATE production_items SET batch_id = NULL;

-- 2. Видаляємо зв'язки бейлів з палетами
DELETE FROM batch_items;

-- 3. Видаляємо палети
DELETE FROM batches;

-- 4. Видаляємо бейли (production items)
DELETE FROM production_items;

-- 5. Очищаємо історію друків
DELETE FROM history;

-- Готово! Структура збережена, users та products залишились.
