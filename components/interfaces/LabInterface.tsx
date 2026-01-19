import React, { useState, useEffect, useDeferredValue, memo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';
import { utils, write } from 'xlsx';
import NotificationBanner from '../ui/NotificationBanner';
import { NotificationService, NOTIFICATION_THRESHOLD } from '../../services/notificationService';
import ConfirmDialog from '../ConfirmDialog';
import ThemeToggle from '../ThemeToggle';
import LocationSelector from '../warehouse/LocationSelector';
import { LocationService } from '../../services/locationService';


export default function LabInterface() {
    const { logout, currentUser } = useAuth();

    // State
    const [pendingItems, setPendingItems] = useState<ProductionItem[]>([]);
    const [gradedItems, setGradedItems] = useState<ProductionItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null);
    const [selectedSort, setSelectedSort] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);

    // Product filter
    const [productFilter, setProductFilter] = useState<string>('');

    // Multi-select for batch grading
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchMode, setBatchMode] = useState(false);

    // Report modal
    const [showReport, setShowReport] = useState(false);
    const [reportEmail, setReportEmail] = useState(() => localStorage.getItem('lab_report_email') || '');
    const [emailSending, setEmailSending] = useState(false);

    // Notification state
    const [pendingCount, setPendingCount] = useState(0);
    const [showNotification, setShowNotification] = useState(true);

    // Revert confirmation dialog
    const [revertConfirm, setRevertConfirm] = useState<{ isOpen: boolean; item: ProductionItem | null }>({ isOpen: false, item: null });

    // Mock Sorts -> Now Dynamic
    // const sorts = ['1 Сорт', '2 Сорт', '3 Сорт', 'Нестандарт', 'Сміття'];

    // Dynamic Sorts based on Product
    const getSortsForProduct = (productName: string) => {
        // Simple mapping based on known names
        if (productName.includes('Костра калібрована') || productName.includes('Hurds Calibrated')) {
            return ['-5.0 +1.5', '-5.0 +0.8', '-1.5 +1.0', '-1.5 +0.8', '-0.8 +0.25', '-1.0', '-0.8', '-0.25', 'Нестандарт'];
        }
        // Fibers (LF, SF)
        if (productName.includes('волокно') || productName.includes('Fiber')) {
            return ['1', '2', '3', '4', 'Нестандарт'];
        }
        // Default / Fallback
        return ['1', '2', '3', 'Нестандарт'];
    };

    const currentSorts = selectedItem ? getSortsForProduct(selectedItem.productName) : [];

    // Load Data
    const loadData = async () => {
        try {
            const items = await ProductionService.getPendingItems();
            setPendingItems(items);
            // If selected item is no longer pending, deselect
            if (selectedItem && !items.find(i => i.id === selectedItem.id)) {
                setSelectedItem(null);
                setSelectedSort('');
            }
        } catch (e) {
            console.error("Failed to load lab items", e);
        }
    };

    const loadGradedItems = async () => {
        try {
            const items = await ProductionService.getGradedItems();
            setGradedItems(items);
        } catch (e) {
            console.error("Failed to load graded items", e);
        }
    };

    useEffect(() => {
        loadData();
        // Check pending count for notification
        NotificationService.getPendingCountForLab().then(count => {
            setPendingCount(count);
        });
    }, []);

    // Report State
    const [reportItems, setReportItems] = useState<ProductionItem[]>([]);
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

    const loadReportData = async () => {
        try {
            // Fetch ALL items to filter locally
            const allItems = await ProductionService.getAllItems();

            // Filter by Date Range AND Status
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const filtered = allItems.filter(item => {
                // Determine the relevant date for the report
                // If item is graded, we ideally want the Grading Date.
                // If gradedAt/updatedAt matches the filter range, include it.
                // Fallback to Creation Date (item.date) if no grading timestamp or if finding by production date.

                let relevantDateStr = item.date; // Default DD.MM.YYYY

                // If we have a timestamp for grading (updatedAt or gradedAt) and status is processed
                if ((item.status === 'graded' || item.status === 'palletized') && (item.updatedAt || item.gradedAt)) {
                    const ts = item.updatedAt || item.gradedAt || '';
                    if (ts) {
                        const dateObj = new Date(ts);
                        relevantDateStr = dateObj.toLocaleDateString('uk-UA'); // DD.MM.YYYY
                    }
                }

                const [d, m, y] = relevantDateStr.split('.').map(Number);
                const itemDate = new Date(y, m - 1, d); // Construct Date object

                const isDateInRange = itemDate >= start && itemDate <= end;
                // Show items if they are graded OR processed (not created)
                // Filter out 'created' items unless they have a sort (edge case)
                const isProcessed = item.status !== 'created';
                return isDateInRange && isProcessed;
            });

            setReportItems(filtered.sort((a, b) => b.serialNumber - a.serialNumber));
        } catch (e) {
            console.error("Failed to load report data", e);
        }
    };

    // Effect to reload report data when dates change
    useEffect(() => {
        if (showReport) {
            loadReportData();
        }
    }, [startDate, endDate, showReport]);

    // Report handlers
    const handleOpenReport = () => {
        // loadReportData will be triggered by useEffect when showReport becomes true
        setShowReport(true);
    };

    const handleDownloadXLSX = () => {
        // Prepare Data for Export (Matching Admin Interface order)
        // Date, UID, No, Product, Weight, Sort
        const itemsToExport = reportItems.length > 0 ? reportItems : gradedItems;

        // Sort by Product Name first, then Serial Number
        const sortedItems = [...itemsToExport].sort((a, b) => {
            if (a.productName < b.productName) return -1;
            if (a.productName > b.productName) return 1;
            return b.serialNumber - a.serialNumber;
        });

        const detailsData = sortedItems.map(item => ({
            "Дата": item.date,
            "UID": item.barcode,
            "№": item.serialNumber,
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
            "Кількість (шт)": gradedItems.length,
            "Вага (кг)": parseFloat(gradedItems.reduce((s, i) => s + i.weight, 0).toFixed(3))
        });

        const wb = utils.book_new();

        const wsSummary = utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
        utils.book_append_sheet(wb, wsSummary, 'Зведення');

        const wsDetails = utils.json_to_sheet(detailsData);
        wsDetails['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 10 }];
        utils.book_append_sheet(wb, wsDetails, 'Деталі');

        const buf = write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Звіт_Лабораторії_${new Date().toLocaleDateString('uk-UA')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const generateReportSummary = () => {
        const items = reportItems.length > 0 ? reportItems : gradedItems;
        const sortCounts: Record<string, { count: number; weight: number }> = {};
        items.forEach(item => {
            const sort = item.sort || 'Без сорту';
            if (!sortCounts[sort]) sortCounts[sort] = { count: 0, weight: 0 };
            sortCounts[sort].count++;
            sortCounts[sort].weight += item.weight;
        });

        let summary = `Звіт лабораторії за ${startDate} - ${endDate}\n\n`;
        summary += `Всього перевірено: ${items.length} бейлів\n\n`;
        summary += `За сортами:\n`;
        Object.entries(sortCounts).forEach(([sort, data]) => {
            summary += `  ${sort}: ${data.count} шт. (${data.weight.toFixed(1)} кг)\n`;
        });
        summary += `\nЗагальна вага: ${items.reduce((sum, i) => sum + i.weight, 0).toFixed(1)} кг`;
        return summary;
    };

    const handleSendEmail = async () => {
        if (!reportEmail) return;
        setEmailSending(true);
        localStorage.setItem('lab_report_email', reportEmail);

        try {
            const subject = `Звіт лабораторії ${new Date().toLocaleDateString('uk-UA')}`;
            const body = generateReportSummary();
            window.location.href = `mailto:${reportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        } catch (e) {
            console.error(e);
        }
        setEmailSending(false);
    };

    const requestRevertGrade = (item: ProductionItem) => {
        setRevertConfirm({ isOpen: true, item });
    };

    const handleRevertGrade = async () => {
        const item = revertConfirm.item;
        setRevertConfirm({ isOpen: false, item: null });
        if (!item) return;
        try {
            await ProductionService.revertGrade(item.id);
            loadReportData(); // Refresh report list
            loadData(); // Refresh main list
        } catch (e) {
            console.error("Failed to revert grade", e);
        }
    };

    // Handlers
    const handleGrade = async () => {
        if (!selectedItem || !selectedSort) return;
        try {
            await ProductionService.gradeItem(selectedItem.id, selectedSort, currentUser?.id || 'unknown');
            // Refresh list
            loadData();
            setSelectedSort('');
        } catch (e) {
            console.error(e);
        }
    };

    // Batch grading functions
    const toggleItemSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const handleBatchGrade = async () => {
        if (selectedIds.size === 0 || !selectedSort) return;
        try {
            await Promise.all(
                Array.from(selectedIds).map((id: string) =>
                    ProductionService.gradeItem(id, selectedSort, currentUser?.id || 'unknown')
                )
            );
            // Refresh list
            loadData();
            setSelectedIds(new Set());
            setSelectedSort('');
            setBatchMode(false);
        } catch (e) {
            console.error(e);
        }
    };

    // Get unique product names for filter buttons
    const uniqueProducts = Array.from<string>(new Set(pendingItems.map(item => item.productName)));

    const filteredItems = pendingItems.filter(item => {
        const matchesSearch = item.serialNumber.toString().includes(deferredSearchQuery) ||
            item.barcode.includes(deferredSearchQuery);
        const matchesProduct = !productFilter || item.productName === productFilter;
        return matchesSearch && matchesProduct;
    });

    // Logout State (Local)
    const [logoutConfirm, setLogoutConfirm] = useState(false);

    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    // Location Modal State
    const [locationModalItem, setLocationModalItem] = useState<ProductionItem | null>(null);

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Sidebar */}
            <aside className="w-64 text-white flex flex-col shrink-0" style={{ backgroundColor: 'var(--header-bg)' }}>
                {/* Logo */}
                <div className="p-5 border-b border-white/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' }}>
                            L
                        </div>
                        <div>
                            <div className="font-bold text-lg">HeMP</div>
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Лабораторія</div>
                        </div>
                        <div className="ml-auto">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    <button
                        onClick={() => { setShowReport(false); loadData(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${!showReport ? '' : 'hover:bg-white/10'}`}
                        style={!showReport ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">🧪</span>
                        <span className="font-medium">Перевірка</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>{pendingItems.length}</span>
                    </button>

                    <button
                        onClick={handleOpenReport}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${showReport ? '' : 'hover:bg-white/10'}`}
                        style={showReport ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">📊</span>
                        <span className="font-medium">Звіти</span>
                    </button>
                </nav>

                {/* Stats by Product */}
                <div className="p-4 border-t border-white/10">
                    <div className="text-xs uppercase mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>По продуктах</div>
                    <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                        {uniqueProducts.map(product => (
                            <div key={product} className="bg-white/10 rounded px-2 py-1 flex justify-between">
                                <span className="text-white/60 truncate" style={{ maxWidth: '140px' }}>{product.length > 18 ? product.substring(0, 16) + '...' : product}</span>
                                <span className="font-bold">{pendingItems.filter(i => i.productName === product).length}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User & Logout */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{currentUser?.name}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Лаборант</div>
                        </div>
                        <button
                            onClick={handleLogoutClick}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${logoutConfirm ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        >
                            {logoutConfirm ? '?' : '🚪'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Notification Banner */}
                {showNotification && NotificationService.shouldShowNotification(pendingCount) && (
                    <NotificationBanner
                        count={pendingCount}
                        message={`Є ${pendingCount} неоприходуваних бейлів — перевірте список!`}
                        onDismiss={() => setShowNotification(false)}
                    />
                )}

                {!showReport ? (
                    /* Main Lab View - Split */
                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT: List */}
                        <div className="w-full md:w-1/3 flex flex-col border-r" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                            <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                <div className="flex justify-between items-center mb-2">
                                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>На Перевірку <span style={{ color: 'var(--accent-primary)' }}>({pendingItems.length})</span></h2>
                                    <button
                                        onClick={() => {
                                            setBatchMode(!batchMode);
                                            if (!batchMode) {
                                                setSelectedItem(null);
                                            } else {
                                                setSelectedIds(new Set());
                                            }
                                        }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${batchMode
                                            ? 'text-white'
                                            : ''
                                            }`}
                                        style={batchMode ? { backgroundColor: 'var(--accent-primary)' } : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                    >
                                        {batchMode ? '☑️ Пакетний' : '🔲 Пакетний'}
                                    </button>
                                </div>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Пошук по №..."
                                    className="w-full p-2 rounded-lg border text-sm"
                                    style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                />
                                {/* Product Filter Buttons */}
                                {uniqueProducts.length > 1 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        <button
                                            onClick={() => setProductFilter('')}
                                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all`}
                                            style={!productFilter ? { backgroundColor: 'var(--accent-primary)', color: 'white' } : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                        >
                                            Всі ({pendingItems.length})
                                        </button>
                                        {uniqueProducts.map(product => (
                                            <button
                                                key={product}
                                                onClick={() => setProductFilter(product)}
                                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all`}
                                                style={productFilter === product ? { backgroundColor: 'var(--accent-primary)', color: 'white' } : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                            >
                                                {product.length > 15 ? product.substring(0, 13) + '...' : product} ({pendingItems.filter(i => i.productName === product).length})
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {/* Select All in batch mode */}
                                {batchMode && filteredItems.length > 0 && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                            onChange={selectAll}
                                            className="w-7 h-7 cursor-pointer"
                                            style={{ accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            Обрати всі ({selectedIds.size} / {filteredItems.length})
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {filteredItems.length === 0 ? (
                                    <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Список порожній</div>
                                ) : (
                                    filteredItems.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => batchMode ? toggleItemSelect(item.id) : setSelectedItem(item)}
                                            className={`p-4 border-b cursor-pointer transition-colors flex items-center gap-3 ${batchMode
                                                ? (selectedIds.has(item.id) ? 'border-l-4' : '')
                                                : (selectedItem?.id === item.id ? 'border-l-4' : '')
                                                }`}
                                            style={{
                                                borderColor: 'var(--border-color)',
                                                backgroundColor: (batchMode ? selectedIds.has(item.id) : selectedItem?.id === item.id) ? 'var(--bg-tertiary)' : 'transparent',
                                                borderLeftColor: (batchMode ? selectedIds.has(item.id) : selectedItem?.id === item.id) ? 'var(--accent-primary)' : 'var(--border-color)'
                                            }}
                                        >
                                            {batchMode && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={() => toggleItemSelect(item.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-7 h-7 shrink-0 cursor-pointer"
                                                    style={{ accentColor: 'var(--accent-primary)' }}
                                                />
                                            )}
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>№ {item.serialNumber}</div>
                                                    <div className="text-xs font-mono px-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{item.weight} кг</div>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.productName} | {item.date}</div>
                                                    <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--accent-primary)' }}>Pending</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Detail & Action */}
                        <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            {batchMode ? (
                                // Batch Mode Panel
                                <div className="w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                                    <div className="p-6 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                                        <div className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--accent-primary)' }}>Пакетне Сортування</div>
                                        <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            Обрано: {selectedIds.size} бейлів
                                        </div>
                                    </div>

                                    {selectedIds.size === 0 ? (
                                        <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                            <div className="text-6xl mb-4">☑️</div>
                                            <p>Оберіть бейли зі списку зліва для пакетного сортування</p>
                                        </div>
                                    ) : (
                                        <div className="p-8">
                                            <label className="block text-center text-sm font-bold mb-4 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                                Оберіть Якість для всіх обраних
                                            </label>

                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                                {['1', '2', '3', '4', 'Нестандарт'].map(sort => (
                                                    <button
                                                        key={sort}
                                                        onClick={() => setSelectedSort(sort)}
                                                        className={`p-4 rounded-xl font-bold transition-all text-sm md:text-base ${selectedSort === sort
                                                            ? 'text-white shadow-lg scale-105'
                                                            : 'border-2'
                                                            }`}
                                                        style={selectedSort === sort
                                                            ? { backgroundColor: 'var(--accent-primary)' }
                                                            : { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }
                                                        }
                                                    >
                                                        {sort}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                onClick={handleBatchGrade}
                                                disabled={!selectedSort}
                                                className={`w-full py-4 rounded-xl font-bold text-xl shadow-xl transition-all flex items-center justify-center gap-3 ${selectedSort
                                                    ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                                                    : 'cursor-not-allowed'
                                                    }`}
                                                style={!selectedSort ? { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' } : {}}
                                            >
                                                <span>СОРТУВАТИ {selectedIds.size} БЕЙЛІВ</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : !selectedItem ? (
                                <div className="text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-6xl mb-4">👈</div>
                                    <h3 className="text-xl font-bold mb-2">Оберіть бейл зі списку</h3>
                                    <p>Натисніть на запис зліва, щоб провести експертизу та присвоїти сорт.</p>
                                </div>
                            ) : (
                                <div className="w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                                    <div className="p-6 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--accent-primary)' }}>Обраний Бейл</div>
                                                <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>№ {selectedItem.serialNumber}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>{selectedItem.weight} <span className="text-lg font-normal" style={{ color: 'var(--text-muted)' }}>кг</span></div>
                                            </div>
                                        </div>

                                        <div className="mt-4 p-3 rounded-xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                            <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Продукт</div>
                                            <div className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{selectedItem.productName}</div>
                                        </div>

                                        <div className="mt-2 text-[10px] font-mono text-center" style={{ color: 'var(--text-muted)' }}>
                                            {selectedItem.barcode}
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        <label className="block text-center text-sm font-bold mb-4 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Оберіть Якість</label>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                            {currentSorts.map(sort => (
                                                <button
                                                    key={sort}
                                                    onClick={() => setSelectedSort(sort)}
                                                    className={`p-4 rounded-xl font-bold transition-all text-sm md:text-base ${selectedSort === sort
                                                        ? 'text-white shadow-lg scale-105'
                                                        : 'border-2'
                                                        }`}
                                                    style={selectedSort === sort
                                                        ? { backgroundColor: 'var(--accent-primary)' }
                                                        : { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }
                                                    }
                                                >
                                                    {sort}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={handleGrade}
                                            disabled={!selectedSort}
                                            className={`w-full py-4 rounded-xl font-bold text-xl shadow-xl transition-all flex items-center justify-center gap-3 ${selectedSort
                                                ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                                                : 'cursor-not-allowed'
                                                }`}
                                            style={!selectedSort ? { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' } : {}}
                                        >
                                            <span>ПІДТВЕРДИТИ</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Report View - Inline instead of Modal */
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Report Header */}
                        <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Звіт Лабораторії</h1>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Генерація звіту за період</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Від:</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="border rounded px-2 py-1 text-sm font-mono"
                                        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>До:</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="border rounded px-2 py-1 text-sm font-mono"
                                        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <button
                                    onClick={loadReportData}
                                    className="px-3 py-1 rounded text-sm font-bold"
                                    style={{ backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' }}
                                >
                                    🔄 Оновити
                                </button>
                            </div>
                        </header>

                        {/* Report Stats */}
                        <div className="p-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="text-center p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                    <div className="text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>{reportItems.length}</div>
                                    <div className="text-xs uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Всього бейлів</div>
                                </div>
                                <div className="text-center p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                    <div className="text-3xl font-bold text-green-600">{reportItems.reduce((sum, i) => sum + i.weight, 0).toFixed(1)}</div>
                                    <div className="text-xs uppercase font-bold text-green-500">Вага (кг)</div>
                                </div>
                                <div className="text-center p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                    <div className="text-3xl font-bold text-blue-600">{[...new Set(reportItems.map(i => i.sort))].length}</div>
                                    <div className="text-xs uppercase font-bold text-blue-500">Сортів</div>
                                </div>
                                <div className="text-center p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                    <div className="text-3xl font-bold text-orange-600">{[...new Set(reportItems.map(i => i.productName))].length}</div>
                                    <div className="text-xs uppercase font-bold text-orange-500">Продуктів</div>
                                </div>
                            </div>
                            {/* Sort badges */}
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {Object.entries(reportItems.reduce((acc, item) => {
                                    const key = item.sort || 'No Sort';
                                    if (!acc[key]) acc[key] = 0;
                                    acc[key]++;
                                    return acc;
                                }, {} as Record<string, number>)).map(([sort, count]) => (
                                    <span key={sort} className="px-3 py-1 border rounded-lg text-xs font-bold whitespace-nowrap" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--accent-primary)' }}>
                                        {sort}: {count}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-b flex flex-wrap gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                            <button
                                onClick={handleDownloadXLSX}
                                className="px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                                style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                            >
                                📥 Завантажити XLSX
                            </button>
                            <div className="flex items-center gap-2">
                                <input
                                    type="email"
                                    value={reportEmail}
                                    onChange={(e) => setReportEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className="px-3 py-2 rounded-lg border text-sm w-48"
                                    style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                />
                                <button
                                    onClick={handleSendEmail}
                                    disabled={!reportEmail || emailSending}
                                    className="px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' }}
                                >
                                    {emailSending ? '⏳' : '📧'} Email
                                </button>
                            </div>
                        </div>

                        {/* Report Table */}
                        <div className="flex-1 overflow-auto p-4">
                            {reportItems.length === 0 ? (
                                <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-5xl mb-4">📭</div>
                                    <p>Немає даних за вказаний період</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                            <th className="p-3 text-left font-bold" style={{ color: 'var(--text-secondary)' }}>№</th>
                                            <th className="p-3 text-left font-bold" style={{ color: 'var(--text-secondary)' }}>Продукт</th>
                                            <th className="p-3 text-left font-bold" style={{ color: 'var(--text-secondary)' }}>Сорт</th>
                                            <th className="p-3 text-right font-bold" style={{ color: 'var(--text-secondary)' }}>Вага</th>
                                            <th className="p-3 text-left font-bold" style={{ color: 'var(--text-secondary)' }}>Дата</th>
                                            <th className="p-3 text-left font-bold" style={{ color: 'var(--text-secondary)' }}>UID</th>
                                            <th className="p-3 text-left font-bold" style={{ color: 'var(--text-secondary)' }}>Локація</th>
                                            <th className="p-3 text-right font-bold" style={{ color: 'var(--text-secondary)' }}>Дія</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportItems.map(item => (
                                            <tr key={item.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                                                <td className="p-3 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{item.serialNumber}</td>
                                                <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>{item.productName}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.sort?.includes('1') ? 'bg-green-100 text-green-700' :
                                                        item.sort?.includes('Брак') ? 'bg-red-100 text-red-700' :
                                                            'bg-purple-100 text-purple-700'
                                                        }`}>
                                                        {item.sort}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{item.weight}</td>
                                                <td className="p-3" style={{ color: 'var(--text-muted)' }}>{item.date}</td>
                                                <td className="p-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{item.barcode}</td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => setLocationModalItem(item)}
                                                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${item.locationId
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        {item.locationId ? '📍 Змінити' : '➕ Призначити'}
                                                    </button>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => requestRevertGrade(item)}
                                                        disabled={item.status !== 'graded'}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ml-auto ${item.status !== 'graded' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'
                                                            }`}
                                                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                                                        title="Повернути на перевірку"
                                                    >
                                                        ↩️ Скасувати
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Revert Grade Confirmation Dialog */}
            <ConfirmDialog
                isOpen={revertConfirm.isOpen}
                title="Повернути бейл?"
                message={`Повернути бейл №${revertConfirm.item?.serialNumber} на перевірку? Сорт буде скинуто.`}
                confirmText="Повернути"
                cancelText="Скасувати"
                variant="warning"
                onCancel={() => setRevertConfirm({ isOpen: false, item: null })}
                onConfirm={handleRevertGrade}
            />
            {/* Location Assignment Modal */}
            {locationModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg dark:text-white">📍 Призначити локацію</h3>
                            <button
                                onClick={() => setLocationModalItem(null)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="text-sm text-gray-500 dark:text-gray-400">Бейл №{locationModalItem.serialNumber}</div>
                                <div className="font-bold dark:text-white">{locationModalItem.productName} ({locationModalItem.sort})</div>
                            </div>
                            <LocationSelector
                                value={locationModalItem.locationId}
                                onChange={async (locId) => {
                                    try {
                                        await LocationService.assignItemToLocation(locationModalItem.id, locId);
                                        setLocationModalItem(null);
                                        loadReportData(); // Refresh list to show new location
                                    } catch (e) {
                                        console.error('Failed to assign location', e);
                                        alert('Помилка при збереженні локації');
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
