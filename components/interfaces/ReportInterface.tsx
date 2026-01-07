import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';
import * as XLSX from 'xlsx';

type StatusFilter = 'all' | 'created' | 'graded' | 'palletized' | 'shipped';

export default function ReportInterface() {
    const { logout, currentUser } = useAuth();

    // Data
    const [items, setItems] = useState<ProductionItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [productFilter, setProductFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // UI
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const allItems = await ProductionService.getAllItems();
            setItems(allItems);
        } catch (e) {
            console.error('Failed to load production items', e);
        } finally {
            setLoading(false);
        }
    };

    // Filtered items
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Date filter
            const itemDate = item.date || item.createdAt?.split('T')[0];
            if (itemDate) {
                if (itemDate < startDate || itemDate > endDate) return false;
            }

            // Status filter
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;

            // Product filter
            if (productFilter !== 'all' && item.productName !== productFilter) return false;

            // Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchSerial = item.serialNumber?.toString().includes(q);
                const matchProduct = item.productName?.toLowerCase().includes(q);
                const matchSort = item.sort?.toLowerCase().includes(q);
                if (!matchSerial && !matchProduct && !matchSort) return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by date desc, then serial desc
            const dateA = a.createdAt || a.date || '';
            const dateB = b.createdAt || b.date || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return b.serialNumber - a.serialNumber;
        });
    }, [items, startDate, endDate, statusFilter, productFilter, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        const totalWeight = filteredItems.reduce((sum, i) => sum + (i.weight || 0), 0);
        const byStatus: Record<string, number> = {};
        const byProduct: Record<string, number> = {};

        filteredItems.forEach(item => {
            byStatus[item.status] = (byStatus[item.status] || 0) + 1;
            byProduct[item.productName] = (byProduct[item.productName] || 0) + 1;
        });

        return { totalWeight, count: filteredItems.length, byStatus, byProduct };
    }, [filteredItems]);

    // Unique products for filter
    const uniqueProducts = useMemo(() => {
        return [...new Set(items.map(i => i.productName))].filter(Boolean).sort();
    }, [items]);

    // Status labels
    const statusLabels: Record<string, string> = {
        created: '🆕 Створено',
        graded: '✅ Сортовано',
        palletized: '📦 Палетизовано',
        shipped: '🚛 Відвантажено'
    };

    // Export to XLSX
    const exportToXlsx = () => {
        const data = filteredItems.map(item => ({
            '№': item.serialNumber,
            'Дата': item.date,
            'Продукт': item.productName,
            'Сорт': item.sort || '-',
            'Вага (кг)': item.weight,
            'Статус': statusLabels[item.status] || item.status,
            'Палета': item.batchId || '-',
            'Штрих-код': item.barcode || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Продукція');

        // Auto-width columns
        const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
        ws['!cols'] = colWidths;

        const filename = `Звіт_продукції_${startDate}_${endDate}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // Print
    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Не вдалося відкрити вікно друку. Перевірте налаштування браузера.');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Звіт по продукції - ${startDate} - ${endDate}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 10px; }
                    .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
                    th { background: #f0f0f0; font-weight: bold; }
                    .status-created { background: #e3f2fd; }
                    .status-graded { background: #e8f5e9; }
                    .status-palletized { background: #fff3e0; }
                    .status-shipped { background: #f3e5f5; }
                    .summary { margin-top: 20px; font-size: 12px; }
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                    }
                </style>
            </head>
            <body>
                <h1>📊 MARIJANY HEMP - Звіт по продукції</h1>
                <div class="meta">
                    Період: ${startDate} - ${endDate}<br/>
                    Статус: ${statusFilter === 'all' ? 'Всі' : statusLabels[statusFilter]}<br/>
                    Продукт: ${productFilter === 'all' ? 'Всі' : productFilter}
                </div>
                ${printContent.innerHTML}
                <div class="summary">
                    <strong>Всього:</strong> ${stats.count} шт, ${stats.totalWeight.toFixed(1)} кг
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    const handleLogout = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-gradient-to-b from-indigo-900 to-purple-900 text-white flex flex-col shrink-0">
                <div className="p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                            📊
                        </div>
                        <div>
                            <div className="font-bold text-lg">Звіт</div>
                            <div className="text-[10px] text-white/60 uppercase tracking-wider">Продукція</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-1">Від</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-1">До</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-1">Статус</label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value="all" className="text-black">Всі статуси</option>
                            <option value="created" className="text-black">🆕 Створено</option>
                            <option value="graded" className="text-black">✅ Сортовано</option>
                            <option value="palletized" className="text-black">📦 Палетизовано</option>
                            <option value="shipped" className="text-black">🚛 Відвантажено</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-1">Продукт</label>
                        <select
                            value={productFilter}
                            onChange={e => setProductFilter(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value="all" className="text-black">Всі продукти</option>
                            {uniqueProducts.map(p => (
                                <option key={p} value={p} className="text-black">{p}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <button
                            onClick={loadData}
                            className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg font-medium transition-all text-sm"
                        >
                            🔄 Оновити дані
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <div className="text-xs text-white/60 uppercase mb-2">Статистика</div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div className="bg-white/10 rounded px-2 py-1">
                            <span className="text-white/60">Записів:</span> <span className="font-bold">{stats.count}</span>
                        </div>
                        <div className="bg-white/10 rounded px-2 py-1">
                            <span className="text-white/60">Вага:</span> <span className="font-bold">{stats.totalWeight.toFixed(1)}</span>
                        </div>
                    </div>
                    {/* Products breakdown */}
                    <div className="text-xs text-white/60 uppercase mb-1">По продуктах:</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                        {Object.entries(stats.byProduct).sort((a, b) => b[1] - a[1]).map(([product, count]) => (
                            <div key={product} className="flex justify-between bg-white/5 rounded px-2 py-0.5">
                                <span className="truncate">{product}</span>
                                <span className="font-bold ml-2">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{currentUser?.name}</div>
                            <div className="text-xs text-white/50">Звіт</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${logoutConfirm ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        >
                            {logoutConfirm ? '?' : '🚪'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Звіт по продукції</h1>
                        <p className="text-sm text-slate-500">Всі вироби що виходять з цеху</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Quick product filters */}
                        <div className="flex gap-1">
                            <button
                                onClick={() => setProductFilter('all')}
                                className={`px-3 py-1 rounded text-xs font-medium transition-all ${productFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Всі
                            </button>
                            {uniqueProducts.slice(0, 5).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setProductFilter(p)}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-all truncate max-w-[100px] ${productFilter === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    title={p}
                                >
                                    {p.length > 12 ? p.slice(0, 12) + '...' : p}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="🔍 Пошук..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2 text-sm w-48"
                        />
                        <button
                            onClick={exportToXlsx}
                            disabled={filteredItems.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            📊 Excel
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={filteredItems.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            🖨️ Друк
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div ref={printRef}>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 text-left font-bold text-slate-700">№</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Дата</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Продукт</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Сорт</th>
                                            <th className="p-3 text-right font-bold text-slate-700">Вага</th>
                                            <th className="p-3 text-center font-bold text-slate-700">Статус</th>
                                            <th className="p-3 text-left font-bold text-slate-700">Палета</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-slate-400">
                                                    <div className="text-4xl mb-2">📭</div>
                                                    Немає даних за обраний період
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredItems.map(item => (
                                                <tr key={item.id} className={`hover:bg-slate-50 status-${item.status}`}>
                                                    <td className="p-3 font-mono font-bold text-slate-800">#{item.serialNumber}</td>
                                                    <td className="p-3 text-slate-600">{item.date}</td>
                                                    <td className="p-3 text-slate-800">{item.productName}</td>
                                                    <td className="p-3">
                                                        {item.sort ? (
                                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
                                                                {item.sort}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-slate-800">{item.weight} кг</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'created' ? 'bg-blue-100 text-blue-700' :
                                                            item.status === 'graded' ? 'bg-green-100 text-green-700' :
                                                                item.status === 'palletized' ? 'bg-orange-100 text-orange-700' :
                                                                    item.status === 'shipped' ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {statusLabels[item.status] || item.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-mono text-xs">
                                                        {item.batchId || '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
