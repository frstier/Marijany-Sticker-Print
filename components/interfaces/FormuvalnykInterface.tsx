import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePrinter } from '../../hooks/usePrinter';
import { QuadService } from '../../services/quadService';
import { ProductionItem } from '../../types/production';
import { Quad } from '../../types/quad';
import ThemeToggle from '../ThemeToggle';
import ConfirmDialog from '../ConfirmDialog';
import { zebraService } from '../../services/zebraService';
import { imageToZplGrf } from '../../utils/imageToZpl';

type ViewMode = 'available' | 'quads';

export default function FormuvalnykInterface() {
    const { logout, currentUser } = useAuth();
    const printerData = usePrinter();

    // Navigation
    const [activeView, setActiveView] = useState<ViewMode>('available');

    // Data
    const [availableBales, setAvailableBales] = useState<ProductionItem[]>([]);
    const [quads, setQuads] = useState<Quad[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection for creating quad
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filter
    const [filterSort, setFilterSort] = useState<string>('all');

    // Modals
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [printing, setPrinting] = useState(false);

    // Dialogs
    const [disbandConfirm, setDisbandConfirm] = useState<{ isOpen: boolean; quadId: string | null }>({ isOpen: false, quadId: null });

    // Load data
    useEffect(() => {
        loadData();
    }, [activeView]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeView === 'available') {
                const bales = await QuadService.getAvailableBales();
                setAvailableBales(bales);
            } else {
                const allQuads = await QuadService.getQuads('created');
                setQuads(allQuads);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Generate ZPL for quad sticker
    const generateQuadZPL = async (quad: Quad): Promise<string> => {
        const toHex = (str: string) => {
            if (!str) return "";
            return Array.from(new TextEncoder().encode(str))
                .map(b => "_" + b.toString(16).toUpperCase().padStart(2, "0"))
                .join("");
        };

        // Logo processing
        let logoZpl = '';
        try {
            logoZpl = await imageToZplGrf('/logo.bmp', 100, 100);
            logoZpl = `^FO680,15${logoZpl}`;
        } catch (e) {
            console.error('Logo process error', e);
        }

        // Items ZPL (4 bales)
        const itemsZpl = quad.items.map((item, idx) => {
            const y = 220 + (idx * 55);
            return `^FO30,${y}^A0N,20,20^FD${idx + 1}. #${item.serialNumber} - ${item.weight.toFixed(1)}kg^FS
^FO450,${y}^BY2^BCN,30,Y,N,N^FD${item.serialNumber}^FS`;
        }).join('\n');

        return `^XA
^PW800
^LL600
^CI28

${logoZpl}

^FO30,20^A0N,32,32^FB500,1,0,L^FDMARIJANY HEMP^FS
^FO30,55^A0N,18,18^FH^FDДата: ${quad.date}^FS
^FO30,85^A0N,28,28^FH^FD${toHex(quad.sort || 'Не вказано')}^FS
^FO30,115^A0N,18,18^FDHEMP FIBER - LONG FIBER^FS

^FO500,20^A0N,28,28^FDQUAD^FS
^FO500,55^A0N,16,16^FD4 BALES^FS

^FO20,150^GB760,2,2^FS

^FO30,165^A0N,22,22^FDID Четвірки:^FS
^FO200,160^A0N,36,36^FH^FD${quad.id}^FS

^FO20,200^GB760,2,2^FS

${itemsZpl}

^FO20,440^GB760,2,2^FS
^FO30,455^A0N,22,22^FDКількість:^FS
^FO180,450^A0N,36,36^FD${quad.items.length}^FS
^FO240,455^A0N,22,22^FDшт^FS
^FO350,455^A0N,22,22^FDЗагальна вага:^FS
^FO550,445^A0N,48,48^FD${quad.totalWeight.toFixed(1)}^FS
^FO700,455^A0N,22,22^FDkg^FS

^FO100,500^BY2^BCN,60,Y,N,N^FD${quad.id}^FS

^FO20,570^GB760,2,2^FS
^FO30,580^A0N,12,12^FD12101, Ukraine, Zhytomyr region, Zhytomyr district^FS

^PQ1
^XZ`;
    };

    // Print quad sticker
    const handlePrintQuad = async (quad: Quad) => {
        if (!printerData.printer) {
            setCreateError("Принтер не налаштовано. Додайте принтер в налаштуваннях Адміністратора.");
            setTimeout(() => setCreateError(null), 5000);
            return;
        }

        setPrinting(true);
        try {
            const zpl = await generateQuadZPL(quad);
            await zebraService.print(printerData.printer, zpl);
            setSuccessMessage(`Етикетку ${quad.id} надруковано!`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (e: any) {
            setCreateError(e.message || "Помилка друку");
            setTimeout(() => setCreateError(null), 3000);
        } finally {
            setPrinting(false);
        }
    };

    // Get unique sorts for filter
    const availableSorts = useMemo(() => {
        const sorts = new Set(availableBales.map(b => b.sort).filter(Boolean));
        return Array.from(sorts).sort();
    }, [availableBales]);

    // Filtered bales
    const filteredBales = useMemo(() => {
        if (filterSort === 'all') return availableBales;
        return availableBales.filter(b => b.sort === filterSort);
    }, [availableBales, filterSort]);

    // Stats
    const stats = useMemo(() => {
        const bySort: Record<string, number> = {};
        availableBales.forEach(b => {
            const sort = b.sort || 'Без сорту';
            bySort[sort] = (bySort[sort] || 0) + 1;
        });
        return { total: availableBales.length, bySort, quadsCreated: quads.length };
    }, [availableBales, quads]);

    // Handlers
    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            // Limit to 4 selections
            if (newSet.size >= 4) {
                setCreateError("Можна обрати максимум 4 бейли");
                setTimeout(() => setCreateError(null), 3000);
                return;
            }
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleCreateQuad = async () => {
        if (selectedIds.size !== 4) {
            setCreateError("Потрібно обрати рівно 4 бейли");
            setTimeout(() => setCreateError(null), 3000);
            return;
        }

        const selectedBalesArr = availableBales.filter(b => selectedIds.has(b.id));

        // Validate same sort
        const sorts = new Set(selectedBalesArr.map(b => b.sort));
        if (sorts.size > 1) {
            setCreateError("Всі бейли повинні бути одного сорту");
            setTimeout(() => setCreateError(null), 3000);
            return;
        }

        try {
            setLoading(true);
            const newQuad = await QuadService.createQuad(selectedBalesArr, currentUser?.id || '');

            // MANDATORY: Print sticker after creating quad
            await handlePrintQuad(newQuad);

            setSuccessMessage("Четвірку створено та надруковано!");
            setTimeout(() => setSuccessMessage(null), 3000);
            setSelectedIds(new Set());
            await loadData();
        } catch (e: any) {
            setCreateError(e.message || "Помилка створення четвірки");
            setTimeout(() => setCreateError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleSendToWarehouse = async (quadId: string) => {
        try {
            setLoading(true);
            await QuadService.sendToWarehouse(quadId);
            setSuccessMessage("Четвірку відправлено на склад!");
            setTimeout(() => setSuccessMessage(null), 3000);
            await loadData();
        } catch (e: any) {
            setCreateError(e.message || "Помилка відправки");
            setTimeout(() => setCreateError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleDisbandQuad = async () => {
        const quadId = disbandConfirm.quadId;
        setDisbandConfirm({ isOpen: false, quadId: null });
        if (!quadId) return;

        try {
            setLoading(true);
            await QuadService.disbandQuad(quadId);
            setSuccessMessage("Четвірку розформовано");
            setTimeout(() => setSuccessMessage(null), 3000);
            await loadData();
        } catch (e: any) {
            setCreateError(e.message || "Помилка розформування");
            setTimeout(() => setCreateError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    // Selected bales info
    const selectedBales = availableBales.filter(b => selectedIds.has(b.id));
    const selectedWeight = selectedBales.reduce((sum, b) => sum + b.weight, 0);

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Sidebar */}
            <aside className="w-64 text-white flex flex-col shrink-0" style={{ backgroundColor: 'var(--header-bg)' }}>
                {/* Logo */}
                <div className="p-5 border-b border-white/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' }}>
                            4
                        </div>
                        <div>
                            <div className="font-bold text-lg">HeMP</div>
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Формувальник</div>
                        </div>
                        <div className="ml-auto">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    <button
                        onClick={() => setActiveView('available')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'available' ? '' : 'hover:bg-white/10'}`}
                        style={activeView === 'available' ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">📦</span>
                        <span className="font-medium">Доступні бейли</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>{stats.total}</span>
                    </button>

                    <button
                        onClick={() => setActiveView('quads')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'quads' ? '' : 'hover:bg-white/10'}`}
                        style={activeView === 'quads' ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">📋</span>
                        <span className="font-medium">Четвірки</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>{stats.quadsCreated}</span>
                    </button>
                </nav>

                {/* Stats by Sort */}
                <div className="p-4 border-t border-white/10">
                    <div className="text-xs uppercase mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>По сортах</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(stats.bySort).map(([sort, count]) => (
                            <div key={sort} className="bg-white/10 rounded px-2 py-1">
                                <span className="text-white/60">{sort}:</span> <span className="font-bold">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User & Logout */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{currentUser?.name}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Формувальник</div>
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
                {/* Header */}
                <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {activeView === 'available' && 'Формування четвірок'}
                            {activeView === 'quads' && 'Готові четвірки'}
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {activeView === 'available' && 'Оберіть 4 бейли одного сорту для формування четвірки'}
                            {activeView === 'quads' && 'Відправте четвірки на склад готової продукції'}
                        </p>
                    </div>

                    {activeView === 'available' && (
                        <div className="flex items-center gap-3">
                            {/* Sort Filter */}
                            <select
                                value={filterSort}
                                onChange={(e) => setFilterSort(e.target.value)}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            >
                                <option value="all">Всі сорти</option>
                                {availableSorts.map(sort => (
                                    <option key={sort} value={sort}>{sort}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </header>

                {/* Messages */}
                {createError && (
                    <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                        ⚠️ {createError}
                    </div>
                )}
                {successMessage && (
                    <div className="mx-6 mt-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg text-sm">
                        ✅ {successMessage}
                    </div>
                )}

                {/* Selection Bar */}
                {activeView === 'available' && selectedIds.size > 0 && (
                    <div className="mx-6 mt-4 p-4 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>
                        <div className="flex items-center gap-4">
                            <span className="font-bold">Обрано: {selectedIds.size}/4</span>
                            <span className="text-sm opacity-80">Вага: {selectedWeight.toFixed(1)} кг</span>
                            {selectedBales.length > 0 && (
                                <span className="text-sm opacity-80">Сорт: {selectedBales[0].sort}</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={clearSelection}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleCreateQuad}
                                disabled={selectedIds.size !== 4}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${selectedIds.size === 4
                                    ? 'bg-white text-green-700 hover:bg-green-50'
                                    : 'bg-white/30 cursor-not-allowed'
                                    }`}
                            >
                                Створити четвірку
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    ) : activeView === 'available' ? (
                        /* Available Bales Grid */
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filteredBales.length === 0 ? (
                                <div className="col-span-full text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-5xl mb-4">📭</div>
                                    <p>Немає доступних бейлів для формування</p>
                                </div>
                            ) : (
                                filteredBales.map(bale => (
                                    <div
                                        key={bale.id}
                                        onClick={() => toggleSelect(bale.id)}
                                        className={`rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg ${selectedIds.has(bale.id)
                                            ? 'border-green-500 bg-green-50 shadow-md'
                                            : 'hover:border-gray-300'
                                            }`}
                                        style={{
                                            backgroundColor: selectedIds.has(bale.id) ? undefined : 'var(--bg-card)',
                                            borderColor: selectedIds.has(bale.id) ? undefined : 'var(--border-color)'
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>#{bale.serialNumber}</span>
                                            {selectedIds.has(bale.id) && (
                                                <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm">✓</span>
                                            )}
                                        </div>
                                        <div className="text-2xl font-bold mb-1" style={{ color: 'var(--accent-primary)' }}>{bale.weight} кг</div>
                                        <div className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">
                                            {bale.sort}
                                        </div>
                                        <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{bale.date}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* Quads List */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {quads.length === 0 ? (
                                <div className="col-span-full text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-5xl mb-4">📋</div>
                                    <p>Немає готових четвірок</p>
                                </div>
                            ) : (
                                quads.map(quad => (
                                    <div key={quad.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                        <div className="p-4" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>
                                            <div className="font-mono font-bold text-xl">{quad.id}</div>
                                            <div className="text-sm opacity-80">{quad.date}</div>
                                        </div>
                                        <div className="p-4">
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Кількість</div>
                                                    <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{quad.items.length} шт</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Вага</div>
                                                    <div className="text-lg font-bold" style={{ color: 'var(--accent-primary)' }}>{quad.totalWeight.toFixed(1)} кг</div>
                                                </div>
                                            </div>
                                            <div className="mb-4">
                                                <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700">
                                                    {quad.sort}
                                                </span>
                                            </div>
                                            {/* Items list */}
                                            <div className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                <div className="font-medium mb-1">Бейли:</div>
                                                <div className="grid grid-cols-2 gap-1 text-xs">
                                                    {quad.items.map((item, idx) => (
                                                        <div key={item.id}>#{item.serialNumber} ({item.weight}кг)</div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => handlePrintQuad(quad)}
                                                    disabled={printing}
                                                    className="w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all border-2"
                                                    style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', backgroundColor: 'transparent' }}
                                                >
                                                    <span>{printing ? '⏳' : '🖨️'}</span>
                                                    <span>{printing ? 'Друк...' : 'Друк етикетки'}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleSendToWarehouse(quad.id)}
                                                    className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                                                    style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                                                >
                                                    <span>📦</span>
                                                    <span>На склад</span>
                                                </button>
                                                <button
                                                    onClick={() => setDisbandConfirm({ isOpen: true, quadId: quad.id })}
                                                    className="w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-sm bg-red-50 text-red-600 hover:bg-red-100"
                                                >
                                                    <span>🔓</span>
                                                    <span>Розформувати</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Disband Confirmation */}
            <ConfirmDialog
                isOpen={disbandConfirm.isOpen}
                title="Розформувати четвірку?"
                message={`Ви впевнені, що хочете розформувати четвірку ${disbandConfirm.quadId}? Бейли повернуться в список доступних.`}
                confirmText="Розформувати"
                cancelText="Скасувати"
                variant="danger"
                onCancel={() => setDisbandConfirm({ isOpen: false, quadId: null })}
                onConfirm={handleDisbandQuad}
            />
        </div>
    );
}
