import React, { useState } from 'react';
import { LabelData, User } from '../types';
import { CloseIcon } from './Icons';

interface PrintHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: LabelData[];
    currentUser: User | null;
    onUpdate: (entry: LabelData) => void;
    onDelete: (id: string) => void;
    onReprint: (entry: LabelData) => void;
}

const PrintHistoryModal: React.FC<PrintHistoryModalProps> = ({
    isOpen,
    onClose,
    history,
    currentUser,
    onUpdate,
    onDelete,
    onReprint
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editWeight, setEditWeight] = useState('');
    const [editSort, setEditSort] = useState('');
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    if (!isOpen) return null;

    const isAdmin = currentUser?.role === 'admin';

    const sortedHistory = [...history].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.date).getTime();
        const timeB = new Date(b.timestamp || b.date).getTime();
        return timeB - timeA;
    });

    const handleEditStart = (item: LabelData) => {
        setEditingId(item.id || null);
        setEditWeight(item.weight);
        setEditSort(item.sortValue || '');
        setSaveSuccess(null);
    };

    const handleSave = (item: LabelData) => {
        // Update the item with new weight
        const updatedItem: LabelData = {
            ...item,
            weight: editWeight,
            sortValue: editSort,
            // Update barcode with new weight (format: DD.MM.YYYY-SKU-Serial-Weight)
            barcode: item.barcode?.replace(/\d+(\.\d+)?$/, editWeight) || item.barcode
        };

        onUpdate(updatedItem);
        setEditingId(null);
        setSaveSuccess(`✅ Збережено! Вага: ${editWeight} кг. Передрук...`);

        // Auto-trigger reprint with updated data
        setTimeout(() => {
            onReprint(updatedItem);
            setSaveSuccess(null);
        }, 500);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-card)] shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">📜 Історія та Звіти</h2>
                        <p className="text-xs text-[var(--text-muted)]">Усі записи доступні для перегляду. Редагування — тільки власних.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                {/* Success Toast */}
                {saveSuccess && (
                    <div className="bg-green-100 border-b border-green-200 px-4 py-2 text-green-800 text-sm font-medium flex items-center gap-2 animate-fade-in">
                        <span>{saveSuccess}</span>
                        <span className="text-xs opacity-70">Лаборант та обліковець бачитимуть оновлені дані</span>
                    </div>
                )}

                {/* Table Header (Desktop) */}
                <div className="hidden md:grid grid-cols-8 gap-2 p-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <div className="col-span-1">Час</div>
                    <div className="col-span-2">Продукт/Сорт</div>
                    <div className="col-span-1 text-center">№ Серійний</div>
                    <div className="col-span-1 text-center">Вага (кг)</div>
                    <div className="col-span-1 text-center">Оператор</div>
                    <div className="col-span-2 text-right">Дії</div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-2 md:p-0">
                    {sortedHistory.length === 0 ? (
                        <div className="p-20 text-center text-[var(--text-muted)]">Історія поки що порожня</div>
                    ) : (
                        sortedHistory.map((item) => {
                            const isOwner = item.operatorId === currentUser?.id;
                            const canEdit = isOwner || isAdmin;
                            const isEditing = editingId === item.id;
                            const date = new Date(item.timestamp || item.date);

                            return (
                                <div key={item.id} className={`grid grid-cols-1 md:grid-cols-8 gap-2 p-3 md:p-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-colors items-center ${isEditing ? 'bg-blue-50/50' : ''}`}>
                                    {/* Time */}
                                    <div className="col-span-1 flex md:block justify-between items-center">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase">Час:</span>
                                        <div className="text-sm font-mono text-[var(--text-secondary)]">
                                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            <div className="text-[10px] opacity-60 md:block hidden">{date.toLocaleDateString('uk-UA')}</div>
                                        </div>
                                    </div>

                                    {/* Product */}
                                    <div className="col-span-2 flex md:block justify-between items-center">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase">Продукт:</span>
                                        <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                                            {item.product?.name}
                                            <div className="text-xs font-normal text-emerald-600">
                                                {isEditing ? (
                                                    <input
                                                        value={editSort}
                                                        onChange={e => setEditSort(e.target.value)}
                                                        className="border border-blue-300 rounded px-1 w-full mt-1 text-xs"
                                                    />
                                                ) : (
                                                    item.sortValue || '—'
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Serial */}
                                    <div className="col-span-1 flex md:block justify-between items-center md:text-center">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase">№:</span>
                                        <div className="font-mono font-bold text-[var(--text-primary)] bg-slate-100 rounded px-1.5 py-0.5 inline-block text-xs">
                                            {item.serialNumber}
                                        </div>
                                    </div>

                                    {/* Weight */}
                                    <div className="col-span-1 flex md:block justify-between items-center md:text-center">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase">Вага:</span>
                                        <div className="text-lg font-mono font-bold text-[#115740]">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editWeight}
                                                    onChange={e => setEditWeight(e.target.value)}
                                                    className="w-20 border-2 border-blue-400 rounded px-1 text-center"
                                                />
                                            ) : (
                                                ` ${item.weight}`
                                            )}
                                        </div>
                                    </div>

                                    {/* Operator */}
                                    <div className="col-span-1 flex md:block justify-between items-center md:text-center text-xs text-[var(--text-muted)]">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase">Опер:</span>
                                        <div className="truncate">{item.operatorName || '—'}</div>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-2 flex justify-end gap-2 pt-2 md:pt-0">
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold">Скас.</button>
                                                <button onClick={() => handleSave(item)} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-bold">Збер.</button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => onReprint(item)}
                                                    className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                    title="Повторний друк"
                                                >
                                                    🖨️
                                                </button>
                                                {canEdit && (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditStart(item)}
                                                            className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                            title="Редагувати"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => item.id && onDelete(item.id)}
                                                            className="p-1.5 md:p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                            title="Видалити"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrintHistoryModal;
