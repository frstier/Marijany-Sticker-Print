import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ShipmentService } from '../../services/shipmentService';
import { Shipment, ShipmentStatus, CreateShipmentData, ShipmentItem } from '../../types/shipping';
import { Batch } from '../../types/pallet';
import ConfirmDialog from '../ConfirmDialog';
import ThemeToggle from '../ThemeToggle';

type ViewMode = 'list' | 'available';

const STATUS_LABELS: Record<ShipmentStatus, string> = {
    draft: '📝 Чернетка',
    loading: '📦 Завантаження',
    shipped: '🚚 Відправлено',
    in_transit: '🛣️ В дорозі',
    delivered: '✅ Доставлено',
    cancelled: '❌ Скасовано'
};

const STATUS_COLORS: Record<ShipmentStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    loading: 'bg-blue-100 text-blue-700',
    shipped: 'bg-orange-100 text-orange-700',
    in_transit: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
};

export default function ShippingInterface() {
    const { logout, currentUser } = useAuth();

    // State
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [availablePallets, setAvailablePallets] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<ViewMode>('list');

    // Selected shipment for editing
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showPalletPicker, setShowPalletPicker] = useState(false);

    // Form data
    const [formData, setFormData] = useState<CreateShipmentData>({
        destination: '',
        destinationAddress: '',
        carrier: '',
        truckNumber: '',
        driverName: '',
        driverPhone: '',
        scheduledDate: '',
        notes: ''
    });

    // Dialogs
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; shipmentId: string | null }>({
        isOpen: false,
        shipmentId: null
    });
    const [statusConfirm, setStatusConfirm] = useState<{
        isOpen: boolean;
        shipmentId: string | null;
        newStatus: ShipmentStatus | null;
    }>({ isOpen: false, shipmentId: null, newStatus: null });
    const [logoutConfirm, setLogoutConfirm] = useState(false);

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [shipmentsData, palletsData] = await Promise.all([
                ShipmentService.getShipments(),
                ShipmentService.getAvailablePallets()
            ]);
            setShipments(shipmentsData);
            setAvailablePallets(palletsData);
        } catch (e) {
            console.error('Failed to load shipping data:', e);
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const byStatus = shipments.reduce((acc, s) => {
            acc[s.status] = (acc[s.status] || 0) + 1;
            return acc;
        }, {} as Record<ShipmentStatus, number>);

        const totalWeight = shipments.reduce((sum, s) => sum + s.totalWeight, 0);
        const totalPallets = shipments.reduce((sum, s) => sum + s.totalPallets, 0);

        return { byStatus, totalWeight, totalPallets, count: shipments.length };
    }, [shipments]);

    // Handlers
    const handleLogoutClick = () => {
        if (logoutConfirm) {
            logout();
        } else {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 3000);
        }
    };

    const handleCreateShipment = async () => {
        if (!formData.destination.trim()) return;

        try {
            await ShipmentService.createShipment(formData, currentUser?.id);
            setShowCreateForm(false);
            resetForm();
            await loadData();
        } catch (e) {
            console.error('Failed to create shipment:', e);
        }
    };

    const handleUpdateStatus = async () => {
        if (!statusConfirm.shipmentId || !statusConfirm.newStatus) return;

        try {
            await ShipmentService.updateStatus(statusConfirm.shipmentId, statusConfirm.newStatus);
            setStatusConfirm({ isOpen: false, shipmentId: null, newStatus: null });
            await loadData();
        } catch (e) {
            console.error('Failed to update status:', e);
        }
    };

    const handleDeleteShipment = async () => {
        if (!deleteConfirm.shipmentId) return;

        try {
            await ShipmentService.deleteShipment(deleteConfirm.shipmentId);
            setDeleteConfirm({ isOpen: false, shipmentId: null });
            setSelectedShipment(null);
            await loadData();
        } catch (e) {
            console.error('Failed to delete shipment:', e);
        }
    };

    const handleAddPallet = async (batch: Batch) => {
        if (!selectedShipment) return;

        try {
            const updated = await ShipmentService.addPalletToShipment(
                selectedShipment.id,
                batch,
                currentUser?.id
            );
            setSelectedShipment(updated);
            await loadData();
        } catch (e) {
            console.error('Failed to add pallet:', e);
            alert((e as Error).message);
        }
    };

    const handleRemovePallet = async (batchId: string) => {
        if (!selectedShipment) return;

        try {
            const updated = await ShipmentService.removePalletFromShipment(
                selectedShipment.id,
                batchId
            );
            setSelectedShipment(updated);
            await loadData();
        } catch (e) {
            console.error('Failed to remove pallet:', e);
        }
    };

    const resetForm = () => {
        setFormData({
            destination: '',
            destinationAddress: '',
            carrier: '',
            truckNumber: '',
            driverName: '',
            driverPhone: '',
            scheduledDate: '',
            notes: ''
        });
    };

    const generateQRCode = (shipment: Shipment) => {
        const qrData = ShipmentService.generateDriverQRData(shipment);
        // For now, just log it - in production, use a QR library
        console.log('QR Data:', qrData);
        alert(`QR-код для водія:\n\n${shipment.shipmentNumber}\nПалет: ${shipment.totalPallets}\nВага: ${shipment.totalWeight} кг`);
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Sidebar */}
            <aside className="w-64 text-white flex flex-col shrink-0" style={{ backgroundColor: 'var(--header-bg)' }}>
                {/* Logo */}
                <div className="p-5 border-b border-white/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' }}>
                            🚚
                        </div>
                        <div>
                            <div className="font-bold text-lg">Shipping</div>
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Відвантаження</div>
                        </div>
                        <div className="ml-auto">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    <button
                        onClick={() => setActiveView('list')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'list' ? '' : 'hover:bg-white/10'}`}
                        style={activeView === 'list' ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">📋</span>
                        <span className="font-medium">Відвантаження</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>{stats.count}</span>
                    </button>

                    <button
                        onClick={() => setActiveView('available')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeView === 'available' ? '' : 'hover:bg-white/10'}`}
                        style={activeView === 'available' ? { backgroundColor: 'var(--accent-secondary)', color: '#1a1a1a' } : {}}
                    >
                        <span className="text-xl">📦</span>
                        <span className="font-medium">Доступні палети</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>{availablePallets.length}</span>
                    </button>
                </nav>

                {/* Quick Stats */}
                <div className="p-4 border-t border-white/20">
                    <div className="text-xs uppercase mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Статистика</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded px-2 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Чернеток:</span> <span className="font-bold">{stats.byStatus.draft || 0}</span>
                        </div>
                        <div className="rounded px-2 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>В дорозі:</span> <span className="font-bold">{stats.byStatus.shipped || 0}</span>
                        </div>
                    </div>
                    <div className="mt-2 text-lg font-bold" style={{ color: 'var(--accent-secondary)' }}>{stats.totalWeight.toFixed(1)} кг</div>
                </div>

                {/* User & Logout */}
                <div className="p-4 border-t border-white/20" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{currentUser?.name}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Логістика</div>
                        </div>
                        <button
                            onClick={handleLogoutClick}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${logoutConfirm ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white/10'}`}
                            style={!logoutConfirm ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                        >
                            {logoutConfirm ? '?' : '🚪'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="border-b px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {activeView === 'list' && 'Відвантаження'}
                            {activeView === 'available' && 'Доступні палети'}
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {activeView === 'list' && 'Управління відвантаженнями та трекінг'}
                            {activeView === 'available' && 'Палети готові до відвантаження'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeView === 'list' && (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"
                                style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                            >
                                <span>➕</span>
                                <span>Нове відвантаження</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    ) : activeView === 'list' ? (
                        /* Shipments List */
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {shipments.length === 0 ? (
                                <div className="col-span-full text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-5xl mb-4">🚚</div>
                                    <p>Немає відвантажень</p>
                                    <button
                                        onClick={() => setShowCreateForm(true)}
                                        className="mt-4 px-4 py-2 rounded-lg font-medium"
                                        style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                                    >
                                        Створити перше
                                    </button>
                                </div>
                            ) : (
                                shipments.map(shipment => (
                                    <div
                                        key={shipment.id}
                                        className="rounded-xl border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                                        onClick={() => setSelectedShipment(shipment)}
                                    >
                                        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                                                    {shipment.shipmentNumber}
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[shipment.status]}`}>
                                                    {STATUS_LABELS[shipment.status]}
                                                </span>
                                            </div>
                                            <div className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                                                📍 {shipment.destination}
                                            </div>
                                            {shipment.carrier && (
                                                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                                    🚛 {shipment.carrier} {shipment.truckNumber && `• ${shipment.truckNumber}`}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Палет</div>
                                                    <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{shipment.totalPallets}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Вага</div>
                                                    <div className="text-lg font-bold" style={{ color: 'var(--accent-primary)' }}>{shipment.totalWeight.toFixed(1)} кг</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* Available Pallets */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {availablePallets.length === 0 ? (
                                <div className="col-span-full text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-5xl mb-4">📦</div>
                                    <p>Немає палет для відвантаження</p>
                                </div>
                            ) : (
                                availablePallets.map(pallet => (
                                    <div
                                        key={pallet.id}
                                        className="rounded-xl border overflow-hidden"
                                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                                    >
                                        <div className="p-3" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                            <div className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                                #{pallet.displayId || pallet.id}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Шт:</span>
                                                    <span className="font-bold ml-1" style={{ color: 'var(--text-primary)' }}>{pallet.items.length}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Вага:</span>
                                                    <span className="font-bold ml-1" style={{ color: 'var(--accent-primary)' }}>{pallet.totalWeight.toFixed(1)}</span>
                                                </div>
                                            </div>
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
                                                {pallet.sort}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Shipment Detail Modal */}
            {selectedShipment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <div className="rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
                        {/* Header */}
                        <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                            <div>
                                <div className="font-mono font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
                                    {selectedShipment.shipmentNumber}
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>📍 {selectedShipment.destination}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${STATUS_COLORS[selectedShipment.status]}`}>
                                    {STATUS_LABELS[selectedShipment.status]}
                                </span>
                                <button
                                    onClick={() => setSelectedShipment(null)}
                                    className="p-2 rounded-full transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4">
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Палет</div>
                                    <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{selectedShipment.totalPallets}</div>
                                </div>
                                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Вага</div>
                                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{selectedShipment.totalWeight.toFixed(1)} кг</div>
                                </div>
                                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Перевізник</div>
                                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedShipment.carrier || '—'}</div>
                                </div>
                                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Водій</div>
                                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedShipment.driverName || '—'}</div>
                                </div>
                            </div>

                            {/* Pallets in Shipment */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Палети у відвантаженні</h3>
                                    {selectedShipment.status === 'draft' && (
                                        <button
                                            onClick={() => setShowPalletPicker(true)}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium"
                                            style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                                        >
                                            ➕ Додати палету
                                        </button>
                                    )}
                                </div>

                                {selectedShipment.items.length === 0 ? (
                                    <div className="text-center py-8 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                        Немає палет
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedShipment.items.map(item => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-3 rounded-lg"
                                                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                                        #{item.displayId || item.batchId.slice(0, 8)}
                                                    </span>
                                                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                                        {item.productName} • {item.sort}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                        {item.palletWeight.toFixed(1)} кг
                                                    </span>
                                                    {selectedShipment.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleRemovePallet(item.batchId)}
                                                            className="text-red-500 hover:bg-red-100 p-1 rounded"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                            <div className="flex flex-wrap gap-2">
                                {selectedShipment.status === 'draft' && (
                                    <>
                                        <button
                                            onClick={() => setStatusConfirm({ isOpen: true, shipmentId: selectedShipment.id, newStatus: 'loading' })}
                                            className="px-4 py-2 rounded-lg font-bold"
                                            style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                                        >
                                            📦 Почати завантаження
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm({ isOpen: true, shipmentId: selectedShipment.id })}
                                            className="px-4 py-2 rounded-lg font-bold bg-red-100 text-red-700"
                                        >
                                            🗑️ Видалити
                                        </button>
                                    </>
                                )}
                                {selectedShipment.status === 'loading' && (
                                    <button
                                        onClick={() => setStatusConfirm({ isOpen: true, shipmentId: selectedShipment.id, newStatus: 'shipped' })}
                                        className="px-4 py-2 rounded-lg font-bold bg-orange-500 text-white"
                                    >
                                        🚚 Відправити
                                    </button>
                                )}
                                {selectedShipment.status === 'shipped' && (
                                    <button
                                        onClick={() => setStatusConfirm({ isOpen: true, shipmentId: selectedShipment.id, newStatus: 'delivered' })}
                                        className="px-4 py-2 rounded-lg font-bold bg-green-500 text-white"
                                    >
                                        ✅ Доставлено
                                    </button>
                                )}
                                <button
                                    onClick={() => generateQRCode(selectedShipment)}
                                    className="px-4 py-2 rounded-lg font-bold"
                                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                >
                                    📱 QR для водія
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Shipment Form Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Нове відвантаження</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Призначення *</label>
                                <input
                                    type="text"
                                    value={formData.destination}
                                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                    placeholder="Назва країни / компанії"
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Адреса</label>
                                <input
                                    type="text"
                                    value={formData.destinationAddress}
                                    onChange={e => setFormData({ ...formData, destinationAddress: e.target.value })}
                                    placeholder="Повна адреса доставки"
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Перевізник</label>
                                    <input
                                        type="text"
                                        value={formData.carrier}
                                        onChange={e => setFormData({ ...formData, carrier: e.target.value })}
                                        placeholder="Компанія-перевізник"
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>№ авто</label>
                                    <input
                                        type="text"
                                        value={formData.truckNumber}
                                        onChange={e => setFormData({ ...formData, truckNumber: e.target.value })}
                                        placeholder="AA 1234 BB"
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Водій</label>
                                    <input
                                        type="text"
                                        value={formData.driverName}
                                        onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                                        placeholder="Ім'я водія"
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Телефон</label>
                                    <input
                                        type="tel"
                                        value={formData.driverPhone}
                                        onChange={e => setFormData({ ...formData, driverPhone: e.target.value })}
                                        placeholder="+380..."
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Примітки</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Додаткова інформація"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border resize-none"
                                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t flex gap-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                            <button
                                onClick={() => { setShowCreateForm(false); resetForm(); }}
                                className="flex-1 py-3 rounded-lg font-medium"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleCreateShipment}
                                disabled={!formData.destination.trim()}
                                className="flex-1 py-3 rounded-lg font-bold disabled:opacity-50"
                                style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
                            >
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pallet Picker Modal */}
            {showPalletPicker && selectedShipment && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Додати палету</h2>
                            <button onClick={() => setShowPalletPicker(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {availablePallets.length === 0 ? (
                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                    Немає доступних палет
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {availablePallets.map(pallet => (
                                        <button
                                            key={pallet.id}
                                            onClick={() => { handleAddPallet(pallet); setShowPalletPicker(false); }}
                                            className="p-3 rounded-lg border text-left hover:border-blue-500 transition-colors"
                                            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
                                        >
                                            <div className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                                #{pallet.displayId || pallet.id}
                                            </div>
                                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                                {pallet.items.length} шт • {pallet.totalWeight.toFixed(1)} кг
                                            </div>
                                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded mt-1 inline-block">
                                                {pallet.sort}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialogs */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Видалити відвантаження?"
                message="Ви впевнені? Всі палети будуть відкріплені."
                confirmText="Видалити"
                cancelText="Скасувати"
                variant="danger"
                onCancel={() => setDeleteConfirm({ isOpen: false, shipmentId: null })}
                onConfirm={handleDeleteShipment}
            />

            <ConfirmDialog
                isOpen={statusConfirm.isOpen}
                title="Змінити статус?"
                message={`Змінити статус на "${statusConfirm.newStatus ? STATUS_LABELS[statusConfirm.newStatus] : ''}"?`}
                confirmText="Підтвердити"
                cancelText="Скасувати"
                variant="info"
                onCancel={() => setStatusConfirm({ isOpen: false, shipmentId: null, newStatus: null })}
                onConfirm={handleUpdateStatus}
            />
        </div>
    );
}
