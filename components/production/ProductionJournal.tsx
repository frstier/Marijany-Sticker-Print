import React, { useState, useEffect } from 'react';
import { ProductionItem, ItemStatus } from '../../types/production';
import { ProductionService } from '../../services/productionService';

interface Props {
    onClose: () => void;
}

export default function ProductionJournal({ onClose }: Props) {
    const [items, setItems] = useState<ProductionItem[]>([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingItem, setEditingItem] = useState<ProductionItem | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<ProductionItem>>({});

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        setLoading(true);
        try {
            const data = await ProductionService.getAllItems();
            // Accountant only sees items that have been graded (have sort assigned)
            // Created items without sort are Lab's responsibility
            const gradedOnly = data.filter(i => i.sort && i.sort.trim() !== '');
            setItems(gradedOnly.sort((a, b) => b.serialNumber - a.serialNumber));
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(i =>
        i.serialNumber.toString().includes(filter) ||
        i.barcode.toLowerCase().includes(filter.toLowerCase()) ||
        i.productName.toLowerCase().includes(filter.toLowerCase())
    );

    const handleEdit = (item: ProductionItem) => {
        setEditingItem(item);
        setFormData({ ...item });
        setIsCreating(false);
    };

    const handleCreate = () => {
        const nextSerial = items.length > 0 ? Math.max(...items.map(i => i.serialNumber)) + 1 : 1001;
        setEditingItem({
            id: crypto.randomUUID(),
            barcode: '',
            date: new Date().toISOString().slice(0, 10).split('-').reverse().join('.'),
            productName: 'Довге волокно',
            serialNumber: nextSerial,
            weight: 50,
            status: 'created',
            createdAt: new Date().toISOString()
        } as ProductionItem);
        setFormData({
            date: new Date().toISOString().slice(0, 10).split('-').reverse().join('.'),
            productName: 'Довге волокно',
            serialNumber: nextSerial,
            weight: 50,
            status: 'created'
        });
        setIsCreating(true);
    };

    const handleSave = async () => {
        if (!editingItem) return;

        const newItem = {
            ...editingItem,
            ...formData,
            // Re-generate barcode if key fields change
            barcode: `${formData.date}-${formData.productName === 'Довге волокно' ? 'LF' : formData.productName === 'Коротке волокно' ? 'SF' : 'HC'}-${formData.serialNumber}-${formData.weight}`
        } as ProductionItem;

        try {
            if (isCreating) {
                await ProductionService.createItem(newItem);
            } else {
                await ProductionService.updateItem(newItem);
            }
            setEditingItem(null);
            loadItems();
        } catch (e) {
            console.error(e);
            alert('Error saving item');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Видалити цей запипис? Це незворотно.')) {
            await ProductionService.deleteItem(id);
            loadItems();
        }
    };

    const handleReprint = async (item: ProductionItem) => {
        // Mock reprint for now, or use ZebraService if available globally
        alert(`Друк наліпки для #${item.serialNumber} надіслано!`);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur flex flex-col pt-16 pb-4 px-4 overflow-hidden">
            <div className="max-w-6xl w-full mx-auto bg-white rounded-xl shadow-2xl flex flex-col h-full overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Журнал Виробництва</h2>
                        <p className="text-xs text-slate-500">Перегляд оцінених бейлів (тільки читання)</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold">
                            Закрити
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <input
                        type="text"
                        placeholder="Пошук по номеру, штрихкоду..."
                        className="w-full md:w-96 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-slate-50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 border-b">№</th>
                                <th className="p-4 border-b">Дата</th>
                                <th className="p-4 border-b">Продукт</th>
                                <th className="p-4 border-b text-right">Вага</th>
                                <th className="p-4 border-b text-center">Сорт</th>
                                <th className="p-4 border-b text-center">Статус</th>
                                <th className="p-4 border-b text-right">Палета</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="p-4 font-mono font-bold text-slate-700">#{item.serialNumber}</td>
                                    <td className="p-4 text-sm text-slate-600">{item.date}</td>
                                    <td className="p-4 text-sm font-medium">{item.productName}</td>
                                    <td className="p-4 text-sm text-right font-mono">{item.weight} кг</td>
                                    <td className="p-4 text-center">
                                        {item.sort ? (
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold border border-purple-200">
                                                {item.sort}
                                            </span>
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="p-4 text-right text-xs text-slate-400">
                                        {item.batchId ? `Палета #${item.batchId}` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Edit Modal Overlay */}
                {editingItem && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-lg">{isCreating ? 'Створити Запис' : 'Редагування'}</h3>
                                <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Серійний №</label>
                                        <input
                                            type="number"
                                            className="w-full border rounded p-2 text-lg font-mono"
                                            value={formData.serialNumber}
                                            onChange={e => setFormData({ ...formData, serialNumber: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Вага (кг)</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full border rounded p-2 text-lg font-mono"
                                            value={formData.weight}
                                            onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Продукт</label>
                                    <select
                                        className="w-full border rounded p-2"
                                        value={formData.productName}
                                        onChange={e => setFormData({ ...formData, productName: e.target.value })}
                                    >
                                        <option value="Довге волокно">Довге волокно</option>
                                        <option value="Коротке волокно">Коротке волокно</option>
                                        <option value="Костра">Костра</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Статус</label>
                                        <select
                                            className="w-full border rounded p-2"
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value as ItemStatus })}
                                        >
                                            <option value="created">Створено</option>
                                            <option value="graded">Оцінено</option>
                                            <option value="palletized">На палеті</option>
                                            <option value="shipped">Відвантажено</option>
                                        </select>
                                    </div>
                                    {/* Sort is read-only for Accountant - Lab assigns it */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Сорт</label>
                                        <div className="w-full border rounded p-2 bg-slate-50 text-slate-500">
                                            {formData.sort || '- Не оцінено -'}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-400 mt-4 bg-slate-50 p-2 rounded">
                                    ID: {editingItem.id}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                                <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-slate-600 font-bold">Скасувати</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
                                    Зберегти
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
        created: 'bg-slate-100 text-slate-600',
        graded: 'bg-blue-100 text-blue-700',
        palletized: 'bg-purple-100 text-purple-700',
        shipped: 'bg-green-100 text-green-700'
    };
    const labels = {
        created: 'НОВИЙ',
        graded: 'ОЦІНЕНО',
        palletized: 'ПАЛЕТА',
        shipped: 'ВІДВАНТАЖЕНО'
    };
    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold border border-transparent ${styles[status as keyof typeof styles] || styles.created}`}>
            {labels[status as keyof typeof labels] || status}
        </span>
    );
};
