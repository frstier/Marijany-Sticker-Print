import React, { useState, useEffect } from 'react';
import { PalletService } from '../../services/palletService';
import { ProductionService } from '../../services/productionService';
import { Batch } from '../../types/pallet';
import { ProductionItem } from '../../types/production';
import { utils, write } from 'xlsx';

interface PalletReportProps {
    onClose: () => void;
}

export default function PalletReport({ onClose }: PalletReportProps) {
    const [pallets, setPallets] = useState<Batch[]>([]);
    const [expandedPalletId, setExpandedPalletId] = useState<string | null>(null);
    const [palletItems, setPalletItems] = useState<ProductionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [disbandConfirmId, setDisbandConfirmId] = useState<string | null>(null);

    // Filters
    const [filterProduct, setFilterProduct] = useState<string>('');
    const [filterSort, setFilterSort] = useState<string>('');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');

    useEffect(() => {
        loadPallets();
    }, []);

    const loadPallets = async () => {
        const allBatches = await PalletService.getBatches();
        // Only show closed pallets
        setPallets(allBatches.filter(b => b.status === 'closed'));
    };

    // Filter pallets
    const filteredPallets = pallets.filter(pallet => {
        // ... (lines 37-54 unchanged)
        // Product filter
        if (filterProduct && !pallet.items.some(i => i.productName === filterProduct)) {
            return false;
        }
        // Sort filter
        if (filterSort && pallet.sort !== filterSort) {
            return false;
        }
        // Date filter
        if (filterDateFrom && pallet.closedAt) {
            const palletDate = new Date(pallet.closedAt).toISOString().split('T')[0];
            if (palletDate < filterDateFrom) return false;
        }
        if (filterDateTo && pallet.closedAt) {
            const palletDate = new Date(pallet.closedAt).toISOString().split('T')[0];
            if (palletDate > filterDateTo) return false;
        }
        return true;
    });

    // Get unique products and sorts for filter options
    const uniqueProducts = [...new Set(pallets.flatMap(p => p.items.map(i => i.productName)))];
    const uniqueSorts = [...new Set(pallets.map(p => p.sort).filter(Boolean))];

    const handleExpandPallet = async (palletId: string) => {
        if (expandedPalletId === palletId) {
            setExpandedPalletId(null);
            setPalletItems([]);
            return;
        }

        setLoading(true);
        setExpandedPalletId(palletId);

        try {
            const items = await ProductionService.getItemsByBatchId(palletId);
            setPalletItems(items);
        } catch (e) {
            console.error("Failed to load pallet items", e);
            setPalletItems([]);
        }

        setLoading(false);
    };

    const handleDisband = (palletId: string) => {
        // Open confirmation dialog
        setDisbandConfirmId(palletId);
    };

    const confirmDisband = async () => {
        const palletId = disbandConfirmId;
        if (!palletId) return;

        const pallet = pallets.find(p => p.id === palletId);
        if (!pallet) return;

        setDisbandConfirmId(null);

        try {
            // Get productionItemIds from batch items
            const itemIds = pallet.items
                .map(i => i.productionItemId)
                .filter((id): id is string => !!id);

            // Disband batch (removes from batches list)
            await PalletService.disbandBatch(palletId);

            // Return items to 'graded' status
            if (itemIds.length > 0) {
                await ProductionService.unpalletizeItems(itemIds);
            }

            // Reload pallets
            loadPallets();
            setExpandedPalletId(null);
        } catch (err: any) {
            console.error("Disband error:", err);
        }
    };

    const handleExportCSV = () => {
        if (pallets.length === 0) return;

        // Header
        let csv = 'Палета №,Дата,Кількість,Вага (кг),Сорт,Бейли\n';

        pallets.forEach(pallet => {
            const baleSerials = pallet.items.map(i => `#${i.serialNumber}`).join('; ');
            csv += `${pallet.id},${pallet.date.slice(0, 10)},${pallet.items.length},${pallet.totalWeight.toFixed(2)},${pallet.sort},"${baleSerials}"\n`;
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pallets_report_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const handleExportXLSX = () => {
        if (filteredPallets.length === 0) return;

        // Flatten all items from filtered pallets
        const allItems = filteredPallets.flatMap(pallet =>
            pallet.items.map(item => ({
                ...item,
                palletId: pallet.id,
                palletDate: pallet.date
            }))
        );

        // Sort by Product Name first
        allItems.sort((a, b) => a.productName.localeCompare(b.productName));

        // 1. Summary Sheet (Aggregated by Product)
        const productStats: Record<string, { count: number, weight: number }> = {};
        allItems.forEach(item => {
            const key = item.productName || 'Unknown';
            if (!productStats[key]) productStats[key] = { count: 0, weight: 0 };
            productStats[key].count++;
            productStats[key].weight += item.weight;
        });

        const summaryData = Object.entries(productStats).map(([name, stats]) => ({
            "Продукт": name,
            "Кількість (шт)": stats.count,
            "Вага (кг)": parseFloat(stats.weight.toFixed(3))
        }));

        // Total Row
        summaryData.push({
            "Продукт": "ВСЬОГО",
            "Кількість (шт)": allItems.length,
            "Вага (кг)": parseFloat(allItems.reduce((s, i) => s + i.weight, 0).toFixed(3))
        });

        // 2. Detailed Sheet
        const detailedData = allItems.map(item => ({
            "Дата": item.date, // Item Date (Production)
            "UID": item.barcode,
            "№": item.serialNumber,
            "№ Палети": item.palletId,
            "Продукт": item.productName,
            "Вага (кг)": Number(item.weight),
            "Сорт": item.sort || '-'
        }));

        // Create workbook
        const wb = utils.book_new();

        const wsSummary = utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
        utils.book_append_sheet(wb, wsSummary, 'Зведення');

        const wsDetails = utils.json_to_sheet(detailedData);
        wsDetails['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 10 }];
        utils.book_append_sheet(wb, wsDetails, 'Деталі');

        // Export
        const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Звіт_Обліковця_${new Date().toLocaleDateString('uk-UA')}.xlsx`;
        link.click();
    };

    const handlePrint = () => {
        // Flatten and Group
        const allItems = filteredPallets.flatMap(pallet =>
            pallet.items.map(item => ({
                ...item,
                palletId: pallet.id
            }))
        );

        const groupedItems: Record<string, typeof allItems> = {};
        allItems.forEach(item => {
            const key = item.productName || 'Інше';
            if (!groupedItems[key]) groupedItems[key] = [];
            groupedItems[key].push(item);
        });

        let tablesHtml = '';
        const totalWeight = allItems.reduce((sum, i) => sum + i.weight, 0).toFixed(2);

        Object.entries(groupedItems).forEach(([productName, items]) => {
            const groupWeight = items.reduce((sum, i) => sum + i.weight, 0).toFixed(2);
            const rows = items.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td style="font-family: monospace;">${item.barcode}</td>
                    <td>${item.serialNumber}</td>
                    <td>${item.palletId}</td>
                    <td style="text-align: right;">${item.weight} кг</td>
                    <td>${item.sort || '-'}</td>
                </tr>
            `).join('');

            tablesHtml += `
                <div class="product-section">
                    <h2>${productName}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>UID</th>
                                <th>№</th>
                                <th>№ Палети</th>
                                <th>Вага (кг)</th>
                                <th>Сорт</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="subtotal">
                        Всього по ${productName}: ${items.length} шт | Вага: ${groupWeight} кг
                    </div>
                </div>
            `;
        });

        const printContent = `
            <html>
            <head>
                <title>Звіт Обліковця</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; color: #333; margin-bottom: 10px; }
                    .period { text-align: center; color: #666; margin-bottom: 20px; }
                    .product-section { margin-bottom: 30px; page-break-inside: avoid; }
                    h2 { color: #4f46e5; border-bottom: 2px solid #e0e7ff; padding-bottom: 5px; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
                    th { background-color: #f3f4f6; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                    .subtotal { text-align: right; font-weight: bold; background: #eef2ff; padding: 8px; border-radius: 4px; color: #3730a3; }
                    .grand-total { margin-top: 30px; padding: 20px; background: #312e81; color: white; text-align: right; font-size: 1.2em; font-weight: bold; border-radius: 8px; }
                    @media print { 
                        body { -webkit-print-color-adjust: exact; } 
                        .product-section { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <h1>Звіт Обліковця (Палети)</h1>
                <div class="period">
                    ${filterDateFrom || 'Початок'} — ${filterDateTo || 'Сьогодні'}
                </div>

                ${tablesHtml}

                <div class="grand-total">
                    ЗАГАЛОМ: ${allItems.length} шт | ${totalWeight} кг
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Disband Confirmation Modal */}
            {disbandConfirmId && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">🔓 Розформування палети</h3>
                        <p className="text-slate-600 mb-6">
                            Ви впевнені, що хочете розформувати палету <strong>№{disbandConfirmId}</strong>?
                            <br />
                            Всі бейли повернуться на склад.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDisbandConfirmId(null)}
                                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-lg font-medium transition-colors"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={confirmDisband}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
                            >
                                Так, розформувати
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold">Звіти по Палетах</h2>
                        <p className="text-sm opacity-80">Перегляд сформованих палет та їх вмісту</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                        >
                            🖨️ Друк
                        </button>
                        <button
                            onClick={handleExportXLSX}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
                        >
                            📊 Excel (XLSX)
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                        >
                            📄 CSV
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3">
                    <select
                        value={filterProduct}
                        onChange={(e) => setFilterProduct(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                        <option value="">Всі продукти</option>
                        {uniqueProducts.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <select
                        value={filterSort}
                        onChange={(e) => setFilterSort(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                        <option value="">Всі сорти</option>
                        {uniqueSorts.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                        placeholder="Від"
                    />
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                        placeholder="До"
                    />
                    {(filterProduct || filterSort || filterDateFrom || filterDateTo) && (
                        <button
                            onClick={() => { setFilterProduct(''); setFilterSort(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                        >
                            ✕ Очистити
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {filteredPallets.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <div className="text-6xl mb-4">📦</div>
                            <p className="text-lg">Немає сформованих палет</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredPallets.map(pallet => (
                                <div key={pallet.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                    {/* Pallet Header */}
                                    <div className="p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex justify-between items-center">
                                        <div
                                            onClick={() => handleExpandPallet(pallet.id)}
                                            className="flex items-center gap-4 cursor-pointer flex-1"
                                        >
                                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
                                                #{pallet.id}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">Палета №{pallet.id}</div>
                                                <div className="text-sm text-slate-500">
                                                    {pallet.date.slice(0, 10)} • {pallet.items.length} бейлів • {pallet.totalWeight.toFixed(1)} кг
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                                                {pallet.sort}
                                            </span>
                                            <button
                                                onClick={() => handleDisband(pallet.id)}
                                                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-full text-xs font-bold transition-colors"
                                                title="Розформувати палету"
                                            >
                                                🔓 Розформувати
                                            </button>
                                            <span
                                                onClick={() => handleExpandPallet(pallet.id)}
                                                className={`transform transition-transform cursor-pointer ${expandedPalletId === pallet.id ? 'rotate-180' : ''}`}
                                            >
                                                ▼
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {expandedPalletId === pallet.id && (
                                        <div className="p-4 bg-white border-t border-slate-200">
                                            {loading ? (
                                                <div className="text-center py-4 text-slate-400">Завантаження...</div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-left text-slate-500 border-b">
                                                            <th className="pb-2 font-medium">№ Бейлу</th>
                                                            <th className="pb-2 font-medium">Продукт</th>
                                                            <th className="pb-2 font-medium">Сорт</th>
                                                            <th className="pb-2 font-medium text-right">Вага</th>
                                                            <th className="pb-2 font-medium">Дата</th>
                                                            <th className="pb-2 font-medium">Штрих-код</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pallet.items.map((item, idx) => (
                                                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                                                                <td className="py-2 font-mono font-bold text-slate-700">#{item.serialNumber}</td>
                                                                <td className="py-2">{item.productName}</td>
                                                                <td className="py-2">
                                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                                                        {item.sort}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 text-right font-medium">{item.weight} кг</td>
                                                                <td className="py-2 text-slate-500">{item.date}</td>
                                                                <td className="py-2 font-mono text-xs text-slate-400">{item.barcode}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="text-sm text-slate-500">
                        Всього палет: <strong>{pallets.length}</strong> •
                        Бейлів: <strong>{pallets.reduce((sum, p) => sum + p.items.length, 0)}</strong> •
                        Вага: <strong>{pallets.reduce((sum, p) => sum + p.totalWeight, 0).toFixed(1)} кг</strong>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-medium transition-colors"
                    >
                        Закрити
                    </button>
                </div>
            </div>
        </div>
    );
}
