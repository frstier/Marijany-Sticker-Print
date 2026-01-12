import React, { useState, useEffect } from 'react';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';
import { utils, write } from 'xlsx';

interface AccountantReportProps {
    onClose: () => void;
}

export default function AccountantReport({ onClose }: AccountantReportProps) {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1); // Default to yesterday/today
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reportItems, setReportItems] = useState<ProductionItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadReportData();
    }, []);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const allItems = await ProductionService.getAllItems();

            // Filter by Date Range and Status
            // Include items that have passed through production (not just created)
            // Or maybe ALL items? "Analogy with Lab" -> Lab shows ALL graded items.
            // Account might want to see 'shipped' too.
            // Let's include everything except 'created' (unless they really want that). 
            // Usually 'created' means printed but not graded.

            // Lab Logic:
            const filtered = allItems.filter(item => {
                // Use gradedAt or updatedAt if available for more accurate "report date"
                // Otherwise fallback to creation date (item.date)
                const dateToCheck = item.gradedAt ? item.gradedAt.split('T')[0] : item.date;

                if (dateToCheck < startDate || dateToCheck > endDate) return false;

                // Exclude pure 'created' items if they haven't been processed? 
                // Lab report excludes nothing explicitly in my previous code, just filters by date.
                // But usually we care about finished goods.
                if (item.status === 'created') return false;

                return true;
            });

            setReportItems(filtered.sort((a, b) => b.serialNumber - a.serialNumber));
        } catch (e) {
            console.error("Failed to load report data", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        // Group items by Product Name
        const groupedItems: Record<string, ProductionItem[]> = {};
        reportItems.forEach(item => {
            const key = item.productName || 'Інше';
            if (!groupedItems[key]) groupedItems[key] = [];
            groupedItems[key].push(item);
        });

        // Generate HTML for each group
        let tablesHtml = '';
        const totalWeight = reportItems.reduce((sum, i) => sum + i.weight, 0).toFixed(2);

        Object.entries(groupedItems).sort((a, b) => a[0].localeCompare(b[0])).forEach(([productName, items]) => {
            const groupWeight = items.reduce((sum, i) => sum + i.weight, 0).toFixed(2);
            const rows = items.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td style="font-family: monospace;">${item.barcode}</td>
                    <td>${item.serialNumber}</td>
                    <td>${item.batchId || '-'}</td>
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
                <h1>Звіт Обліковця</h1>
                <div class="period">
                    ${startDate} — ${endDate}
                </div>

                ${tablesHtml}

                <div class="grand-total">
                    ЗАГАЛОМ: ${reportItems.length} шт | ${totalWeight} кг
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            // printWindow.print(); // Let user trigger print
        }
    };

    const handleDownloadXLSX = () => {
        // Sort by Product Name first, then Serial Number
        const sortedItems = [...reportItems].sort((a, b) => {
            if (a.productName < b.productName) return -1;
            if (a.productName > b.productName) return 1;
            return b.serialNumber - a.serialNumber;
        });

        const detailsData = sortedItems.map(item => ({
            "Дата": item.date,
            "UID": item.barcode,
            "№": item.serialNumber,
            "№ Палети": item.batchId || '-',
            "Продукт": item.productName,
            "Вага (кг)": Number(item.weight),
            "Сорт": item.sort || '-'
        }));

        // Summary Data
        const sortCounts: Record<string, { count: number; weight: number }> = {};
        sortedItems.forEach(item => {
            const key = item.productName || 'Unknown';
            if (!sortCounts[key]) sortCounts[key] = { count: 0, weight: 0 };
            sortCounts[key].count++;
            sortCounts[key].weight += item.weight;
        });

        const summaryData = Object.entries(sortCounts).map(([name, stats]) => ({
            "Продукт": name,
            "Кількість (шт)": stats.count,
            "Вага (кг)": parseFloat(stats.weight.toFixed(3))
        }));

        // Total Row
        summaryData.push({
            "Продукт": "ВСЬОГО",
            "Кількість (шт)": sortedItems.length,
            "Вага (кг)": parseFloat(sortedItems.reduce((s, i) => s + i.weight, 0).toFixed(3))
        });

        const wb = utils.book_new();

        const wsSummary = utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
        utils.book_append_sheet(wb, wsSummary, 'Зведення');

        const wsDetails = utils.json_to_sheet(detailsData);
        wsDetails['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 10 }];
        utils.book_append_sheet(wb, wsDetails, 'Деталі');

        const wbout = write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Звіт_Обліковця_${new Date().toLocaleDateString('uk-UA')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold">Звіт Обліковця</h2>
                        <p className="text-sm opacity-80">Генерація звіту за період</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-3xl">×</button>
                </div>

                {/* Controls */}
                <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-slate-600">Від:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 text-sm font-mono"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-slate-600">До:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 text-sm font-mono"
                        />
                    </div>
                    <button
                        onClick={loadReportData}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-bold"
                    >
                        🔄 Оновити
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center bg-white p-3 rounded-xl border border-blue-100">
                            <div className="text-3xl font-bold text-blue-700">{reportItems.length}</div>
                            <div className="text-xs text-blue-500 uppercase font-bold">Всього бейлів</div>
                        </div>
                        <div className="text-center bg-white p-3 rounded-xl border border-blue-100">
                            <div className="text-3xl font-bold text-green-600">{reportItems.reduce((sum, i) => sum + i.weight, 0).toFixed(1)}</div>
                            <div className="text-xs text-green-500 uppercase font-bold">Вага (кг)</div>
                        </div>
                        <div className="text-center bg-white p-3 rounded-xl border border-blue-100">
                            <div className="text-3xl font-bold text-purple-600">{[...new Set(reportItems.map(i => i.sort))].length}</div>
                            <div className="text-xs text-purple-500 uppercase font-bold">Сортів</div>
                        </div>
                        <div className="text-center bg-white p-3 rounded-xl border border-blue-100">
                            <div className="text-3xl font-bold text-orange-600">{[...new Set(reportItems.map(i => i.productName))].length}</div>
                            <div className="text-xs text-orange-500 uppercase font-bold">Продуктів</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all font-bold"
                        >
                            <span>🖨️</span> Друк (PDF)
                        </button>
                        <button
                            onClick={handleDownloadXLSX}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all font-bold"
                        >
                            <span>📊</span> Excel
                        </button>
                    </div>
                </div>

                {/* Table Preview */}
                <div className="flex-1 overflow-auto bg-slate-50 p-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    ) : (
                        <table className="w-full text-sm bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
                            <thead className="bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="p-3 text-left">Дата</th>
                                    <th className="p-3 text-left">UID</th>
                                    <th className="p-3 text-left">№</th>
                                    <th className="p-3 text-left">№ Палети</th>
                                    <th className="p-3 text-left">Продукт</th>
                                    <th className="p-3 text-right">Вага</th>
                                    <th className="p-3 text-left">Сорт</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportItems.map(item => (
                                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="p-3">{item.date}</td>
                                        <td className="p-3 font-mono text-xs">{item.barcode}</td>
                                        <td className="p-3 font-bold">#{item.serialNumber}</td>
                                        <td className="p-3">{item.batchId ? <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">#{item.batchId}</span> : <span className="text-slate-300">-</span>}</td>
                                        <td className="p-3">{item.productName}</td>
                                        <td className="p-3 text-right font-mono">{item.weight}</td>
                                        <td className="p-3">{item.sort}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
