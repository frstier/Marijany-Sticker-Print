import React, { useState, useEffect, useRef } from 'react';
import { GradingService } from '../../services/gradingService';
import { PalletService } from '../../services/palletService'; // For parsing
import { GradedItem } from '../../types/lab';

interface GradingStationProps {
    onClose: () => void;
    currentUserId: string;
}

export default function GradingStation({ onClose, currentUserId }: GradingStationProps) {
    const [scanInput, setScanInput] = useState('');
    const [scannedData, setScannedData] = useState<{ name: string, weight: number, date: string, serial: number, raw: string } | null>(null);
    const [selectedSort, setSelectedSort] = useState<string>('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);

    // Mock Sorts (Eventually from DB/Product Config)
    const sorts = ['1 Сорт', '2 Сорт', '3 Сорт', 'Нестандарт', 'Сміття'];

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        const raw = scanInput.trim();
        if (!raw) return;

        const parsed = PalletService.parseBarcode(raw);
        if (parsed) {
            setScannedData({
                name: parsed.productName,
                weight: parsed.weight,
                date: parsed.date,
                serial: parsed.serialNumber,
                raw: raw
            });
            setError('');
            setSuccessMsg('');
        } else {
            setError("Невірний формат штрих-коду");
            setScannedData(null);
        }
    };

    const handleSave = () => {
        if (!scannedData || !selectedSort) return;

        try {
            GradingService.saveGrade(scannedData.raw, selectedSort, currentUserId);
            setSuccessMsg(`Тюк №${scannedData.serial} збережено як "${selectedSort}"`);

            // Reset for next
            setScannedData(null);
            setSelectedSort('');
            setScanInput('');
            setError('');

            // Refocus
            if (inputRef.current) inputRef.current.focus();

        } catch (e: any) {
            setError(e.message || "Помилка збереження");
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-auto flex flex-col h-[70vh] overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-purple-900 text-white p-4 flex justify-between items-center shrink-0">
                <div className="font-bold text-lg">Експертиза Продукції</div>
                <button onClick={onClose} className="text-purple-200 hover:text-white">✕</button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">

                {/* Scanner Section */}
                {!scannedData ? (
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="bg-purple-50 p-8 rounded-2xl border-2 border-purple-100 text-center space-y-4">
                            <div className="text-6xl">🔍</div>
                            <h3 className="text-xl font-bold text-purple-900">Скануйте штрих-код тюка</h3>
                            <p className="text-purple-600">Наведіть сканер на етикетку оператора</p>

                            <form onSubmit={handleScan}>
                                <input
                                    ref={inputRef}
                                    value={scanInput}
                                    onChange={e => setScanInput(e.target.value)}
                                    className="w-full text-center text-lg p-3 rounded-lg border-2 border-purple-300 focus:border-purple-600 font-mono"
                                    placeholder="Click here & Scan"
                                    autoFocus
                                />
                            </form>
                            {error && <div className="text-red-600 font-bold">{error}</div>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-slide-up">
                        {/* Info Card */}
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10 text-9xl leading-none">📦</div>

                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Продукт</div>
                                    <div className="text-xl font-bold text-slate-800">{scannedData.name}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Дата</div>
                                    <div className="text-xl font-bold text-slate-800">{scannedData.date}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Вага</div>
                                    <div className="text-3xl font-bold text-blue-600">{scannedData.weight} <span className="text-lg text-slate-400">кг</span></div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Серійний №</div>
                                    <div className="text-xl font-mono bg-white inline-block px-2 rounded border border-slate-200">#{scannedData.serial}</div>
                                </div>
                            </div>
                        </div>

                        {/* Grading Section */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Присвоїти Сорт / Якість</label>
                            <div className="grid grid-cols-2 gap-3">
                                {sorts.map(sort => (
                                    <button
                                        key={sort}
                                        onClick={() => setSelectedSort(sort)}
                                        className={`p-4 rounded-xl text-lg font-bold border-2 transition-all ${selectedSort === sort
                                                ? 'border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-900/20 transform scale-105'
                                                : 'border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-purple-50'
                                            }`}
                                    >
                                        {sort}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={() => { setScannedData(null); setScanInput(''); }}
                                className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-xl"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!selectedSort}
                                className={`flex-[2] py-4 rounded-xl font-bold text-xl transition-all shadow-xl ${selectedSort
                                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20 active:scale-95'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                ЗБЕРЕГТИ РЕЗУЛЬТАТ
                            </button>
                        </div>
                    </div>
                )}

                {successMsg && (
                    <div className="p-4 bg-green-100 text-green-800 rounded-xl text-center font-bold border border-green-200 animate-pulse">
                        ✅ {successMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
