import React, { useState } from 'react';
import { LocationService } from '../../services/locationService';
import { ProductionService } from '../../services/productionService';
import { ProductionItem } from '../../types/production';
import { Location } from '../../types/location';

const LocationSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        location?: Location;
        items?: ProductionItem[];
        error?: string;
    } | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            // Strategy 1: Check if input is a Location Code (e.g. A-01-2-L)
            if (query.match(/^[A-Z]-[0-9]+-[0-9]+(-[A-Z0-9]+)?$/i)) {
                const loc = await LocationService.getLocationByCode(query.toUpperCase());
                if (loc) {
                    const contents = await LocationService.searchItemsInLocation(loc.id);
                    setResult({ location: loc, items: contents.items }); // Handling items only for MVP, pallets later
                    return;
                }
            }

            // Strategy 2: Check if input is a Bale/Item Serial (e.g. 1234)
            // Note: This is simplified. Ideally we need product context or unique serial logic.
            // Using a specialized search function in implementations

            // For now, let's assume we search by barcode or serial if it's numeric
            // Implementing a simple "Find by any means"

            // Strategy 3: Just show "Not found" for MVP if not a location code.
            // Implementing correct Item -> Location lookup requires extending ProductionService

            setResult({ error: 'Локацію не знайдено або формат коду невірний (очікується A-01-1-L)' });

        } catch (err) {
            setResult({ error: 'Помилка пошуку' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                🔍 Пошук
            </h3>

            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input
                    type="text"
                    placeholder="Код локації (A-01-1-L)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? '...' : 'Знайти'}
                </button>
            </form>

            {result?.error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {result.error}
                </div>
            )}

            {result?.location && (
                <div className="space-y-2">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <div className="text-xl font-bold text-blue-800 dark:text-blue-300">
                            {result.location.code}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Зона {result.location.zone} • Стелаж {result.location.rack} • Рівень {result.location.level}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h4 className="font-medium text-sm text-gray-500">Вміст:</h4>
                        {result.items && result.items.length > 0 ? (
                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                {result.items.map(item => (
                                    <li key={item.id} className="py-2 flex justify-between items-center text-sm">
                                        <span>{item.productName} ({item.sort})</span>
                                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                            #{item.serialNumber}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-gray-400 italic">Порожньо</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationSearch;
