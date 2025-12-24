import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PalletService } from './palletService';

describe('PalletService', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('should create a new batch with correct ID format', () => {
        const batch = PalletService.createBatch('Sort 1');
        expect(batch.sort).toBe('Sort 1');
        expect(batch.items).toHaveLength(0);
        expect(batch.status).toBe('open');
        expect(batch.id).toMatch(/^P-\d{8}-\d{3}$/); // P-YYYYMMDD-SEQ
    });

    it('should parse valid barcode strings correctly', () => {
        // Format: DATE-SKU-SERIAL-WEIGHT
        const barcode = '24.12.2025-LF-101-50.5';
        const parsed = PalletService.parseBarcode(barcode);

        expect(parsed).not.toBeNull();
        expect(parsed?.serialNumber).toBe(101);
        expect(parsed?.weight).toBe(50.5);
        expect(parsed?.productName).toBe('LF');
        expect(parsed?.date).toBe('24.12.2025');
    });

    it('should return null for invalid barcode format', () => {
        const invalid = 'INVALID-CODE';
        const parsed = PalletService.parseBarcode(invalid);
        expect(parsed).toBeNull();
    });

    it('should add item to batch and update totals', () => {
        const batch = PalletService.createBatch('Sort 1');

        const item1 = {
            serialNumber: 1,
            weight: 10.5,
            productName: 'T1',
            sort: 'S1',
            date: '2025'
        };

        const updatedBatch = PalletService.addItemToBatch(batch.id, item1);
        expect(updatedBatch.items).toHaveLength(1);
        expect(updatedBatch.totalWeight).toBe(10.5);

        const item2 = { ...item1, serialNumber: 2, weight: 20.0 };
        const finalBatch = PalletService.addItemToBatch(batch.id, item2);

        expect(finalBatch.items).toHaveLength(2);
        expect(finalBatch.totalWeight).toBe(30.5);
    });

    it('should preventing adding duplicate serials to the same batch', () => {
        const batch = PalletService.createBatch('Sort 1');
        const item = { serialNumber: 1, weight: 10, productName: 'T1', sort: 'S1', date: '2025' };

        PalletService.addItemToBatch(batch.id, item);

        expect(() => {
            PalletService.addItemToBatch(batch.id, item);
        }).toThrow("Цей тюк вже додано в цю палету.");
    });
});
