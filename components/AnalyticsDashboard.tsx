import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { ProductionItem } from '../types/production';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

interface AnalyticsDashboardProps {
    items: ProductionItem[];
    onClose: () => void;
    isOpen?: boolean;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ items, onClose, isOpen = true }) => {
    if (!isOpen) return null;
    // Calculate stats
    const stats = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const currentItems = items || [];

        const todayItems = currentItems.filter(p => new Date(p.createdAt || p.date || 0) >= today);
        const weekItems = currentItems.filter(p => new Date(p.createdAt || p.date || 0) >= weekAgo);
        const monthItems = currentItems.filter(p => new Date(p.createdAt || p.date || 0) >= monthAgo);

        // Production per day (last 7 days)
        const dailyData: { [key: string]: number } = {};
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
            const key = date.toLocaleDateString('uk-UA', { weekday: 'short' });
            dailyData[key] = 0;
        }
        weekItems.forEach(p => {
            const date = new Date(p.createdAt || p.date || 0);
            const key = date.toLocaleDateString('uk-UA', { weekday: 'short' });
            if (dailyData[key] !== undefined) {
                dailyData[key]++;
            }
        });

        // Top products
        const productCounts: { [key: string]: number } = {};
        const productWeights: { [key: string]: number[] } = {};
        const shippedCount = currentItems.filter(i => i.status === 'shipped').length;
        const palletizedCount = currentItems.filter(i => i.status === 'palletized').length;
        const inStockCount = currentItems.filter(i => i.status === 'created' || i.status === 'graded').length;

        // Sort distribution
        const sortCounts: { [key: string]: number } = {};

        currentItems.forEach(p => {
            const name = p.productName || 'Невідомо';
            productCounts[name] = (productCounts[name] || 0) + 1;

            // Track weights per product for average
            if (!productWeights[name]) productWeights[name] = [];
            if (p.weight) productWeights[name].push(p.weight);

            // Track sort distribution
            const sortKey = p.sort || 'Без сорту';
            sortCounts[sortKey] = (sortCounts[sortKey] || 0) + 1;
        });

        const topProducts = Object.entries(productCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Average weight by product
        const avgWeightByProduct = Object.entries(productWeights).map(([name, weights]) => ({
            name,
            avgWeight: weights.length > 0
                ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)
                : '0'
        })).sort((a, b) => parseFloat(b.avgWeight) - parseFloat(a.avgWeight));

        // Total weight
        const totalWeight = currentItems.reduce((sum, i) => sum + (i.weight || 0), 0);
        const todayWeight = todayItems.reduce((sum, i) => sum + (i.weight || 0), 0);

        // Sort distribution for chart (top 5 sorts)
        const topSorts = Object.entries(sortCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        return {
            today: todayItems.length,
            todayWeight,
            week: weekItems.length,
            month: monthItems.length,
            total: currentItems.length,
            totalWeight,
            dailyLabels: Object.keys(dailyData),
            dailyValues: Object.values(dailyData),
            topProducts,
            avgWeightByProduct,
            topSorts,
            shipped: shippedCount,
            palletized: palletizedCount,
            inStock: inStockCount
        };
    }, [items]);

    // Chart options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1
                }
            }
        }
    };

    const barData = {
        labels: stats.dailyLabels,
        datasets: [
            {
                label: 'Друки',
                data: stats?.dailyValues || [],
                backgroundColor: 'rgba(17, 87, 64, 0.7)',
                borderColor: '#115740',
                borderWidth: 1,
                borderRadius: 4
            }
        ]
    };

    const doughnutData = {
        labels: (stats?.topProducts || []).map(p => p[0]),
        datasets: [
            {
                data: (stats?.topProducts || []).map(p => p[1]),
                backgroundColor: [
                    '#115740',
                    '#10b981',
                    '#34d399',
                    '#6ee7b7',
                    '#a7f3d0'
                ],
                borderWidth: 0
            }
        ]
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
                    <div className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📊 Аналітика
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 space-y-6">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Сьогодні', value: stats?.today ?? 0, icon: '📅' },
                            { label: 'Склад зберігання', value: stats?.inStock ?? 0, icon: '🏭' },
                            { label: 'Відвантажено', value: stats?.shipped ?? 0, icon: '🚛' }, // Changed from Month
                            { label: 'Всього зроблено', value: stats?.total ?? 0, icon: '🏷️' }
                        ].map(stat => (
                            <div key={stat.label} className="bg-[var(--bg-tertiary)] rounded-xl p-4 text-center">
                                <div className="text-2xl mb-1">{stat.icon}</div>
                                <div className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</div>
                                <div className="text-xs text-[var(--text-muted)]">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Weekly Chart */}
                    <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                            Друки за тиждень
                        </h3>
                        <div className="h-48">
                            <Bar data={barData} options={chartOptions} />
                        </div>
                    </div>

                    {/* Top Products */}
                    {(stats?.topProducts?.length ?? 0) > 0 && (
                        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                                Топ-5 продуктів
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="w-32 h-32">
                                    <Doughnut data={doughnutData} options={{ ...chartOptions, cutout: '60%' }} />
                                </div>
                                <div className="flex-1 space-y-2">
                                    {(stats?.topProducts || []).map(([name, count], i) => (
                                        <div key={name} className="flex items-center gap-2 text-sm">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: doughnutData.datasets[0].backgroundColor[i] }}
                                            />
                                            <span className="text-[var(--text-primary)] truncate flex-1">{name}</span>
                                            <span className="text-[var(--text-muted)] font-mono">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sort Distribution */}
                    {(stats?.topSorts?.length ?? 0) > 0 && (
                        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                                Розподіл по сортах
                            </h3>
                            <div className="space-y-2">
                                {(stats?.topSorts || []).map(([sort, count]) => {
                                    const maxCount = stats?.topSorts?.[0]?.[1] || 1;
                                    const percentage = ((count as number) / (maxCount as number)) * 100;
                                    return (
                                        <div key={sort} className="flex items-center gap-2">
                                            <span className="text-[var(--text-primary)] text-sm w-24 truncate">{sort}</span>
                                            <div className="flex-1 bg-[var(--bg-secondary)] rounded-full h-4 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-[var(--text-muted)] font-mono text-sm w-12 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Average Weight by Product */}
                    {(stats?.avgWeightByProduct?.length ?? 0) > 0 && (
                        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                                Середня вага (кг)
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {(stats?.avgWeightByProduct || []).slice(0, 6).map(({ name, avgWeight }) => (
                                    <div key={name} className="bg-[var(--bg-secondary)] rounded-lg px-3 py-2 flex justify-between items-center">
                                        <span className="text-[var(--text-primary)] text-sm truncate flex-1">{name}</span>
                                        <span className="text-emerald-500 font-bold ml-2">{avgWeight}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex justify-between items-center">
                                <span className="text-[var(--text-muted)] text-sm">Загальна вага:</span>
                                <span className="text-[var(--text-primary)] font-bold text-lg">{(stats?.totalWeight || 0).toFixed(1)} кг</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] shrink-0">
                    <button onClick={onClose} className="w-full py-3 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-hover)] transition-colors">
                        Закрити
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
