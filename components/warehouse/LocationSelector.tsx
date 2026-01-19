import React, { useState, useEffect, useMemo } from 'react';
import { LocationService } from '../../services/locationService';
import { Location } from '../../types/location';

interface LocationSelectorProps {
    value?: string; // Selected location ID
    onChange: (locationId: string) => void;
    disabled?: boolean;
    filterOccupied?: boolean; // If true, hide occupied locations (unless selected)
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    filterOccupied = false
}) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [selectedRack, setSelectedRack] = useState<string>('');
    const [selectedLevel, setSelectedLevel] = useState<string>('');

    useEffect(() => {
        loadLocations();
    }, []);

    // Initialize selection from value
    useEffect(() => {
        if (value && locations.length > 0) {
            const loc = locations.find(l => l.id === value);
            if (loc) {
                setSelectedZone(loc.zone);
                setSelectedRack(loc.rack);
                setSelectedLevel(loc.level);
            }
        }
    }, [value, locations]);

    const loadLocations = async () => {
        setLoading(true);
        try {
            const data = await LocationService.getLocations();
            setLocations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Derived Options
    const zones = useMemo(() => {
        return Array.from(new Set(locations.map(l => l.zone))).sort();
    }, [locations]);

    const racks = useMemo(() => {
        return Array.from(new Set(
            locations
                .filter(l => l.zone === selectedZone)
                .map(l => l.rack)
        )).sort();
    }, [locations, selectedZone]);

    const levels = useMemo(() => {
        return Array.from(new Set(
            locations
                .filter(l => l.zone === selectedZone && l.rack === selectedRack)
                .map(l => l.level)
        )).sort();
    }, [locations, selectedZone, selectedRack]);

    const availablePositions = useMemo(() => {
        let filtered = locations.filter(l =>
            l.zone === selectedZone &&
            l.rack === selectedRack &&
            l.level === selectedLevel
        );

        if (filterOccupied) {
            filtered = filtered.filter(l => !l.isOccupied || l.id === value);
        }

        return filtered.sort((a, b) => (a.position || '').localeCompare(b.position || ''));
    }, [locations, selectedZone, selectedRack, selectedLevel, filterOccupied, value]);


    if (loading) return <div className="text-gray-500 text-sm">Loading locations...</div>;

    if (locations.length === 0) {
        return <div className="text-yellow-600 text-sm">No locations found via migration yet.</div>;
    }

    return (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📍 Місце зберігання
            </h3>

            <div className="grid grid-cols-3 gap-2">
                {/* Zone */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Зона</label>
                    <select
                        className="w-full text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 p-1"
                        value={selectedZone}
                        onChange={(e) => {
                            setSelectedZone(e.target.value);
                            setSelectedRack('');
                            setSelectedLevel('');
                        }}
                        disabled={disabled}
                    >
                        <option value="">--</option>
                        {zones.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                </div>

                {/* Rack */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Стелаж</label>
                    <select
                        className="w-full text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 p-1"
                        value={selectedRack}
                        onChange={(e) => {
                            setSelectedRack(e.target.value);
                            setSelectedLevel('');
                        }}
                        disabled={disabled || !selectedZone}
                    >
                        <option value="">--</option>
                        {racks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                {/* Level */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Рівень</label>
                    <select
                        className="w-full text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 p-1"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        disabled={disabled || !selectedRack}
                    >
                        <option value="">--</option>
                        {levels.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
            </div>

            {/* Positions */}
            {selectedLevel && (
                <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Позиція</label>
                    {availablePositions.length === 0 ? (
                        <div className="text-xs text-red-500">Немає вільних місць</div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {availablePositions.map(loc => {
                                const isSelected = loc.id === value;
                                const isOc = loc.isOccupied && !isSelected;

                                return (
                                    <button
                                        key={loc.id}
                                        onClick={() => onChange(loc.id)}
                                        disabled={disabled || isOc}
                                        className={`
                                            px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
                                            ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : isOc
                                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed decoration-slice'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                            }
                                        `}
                                    >
                                        {loc.position || 'N/A'}
                                        {isOc && <span className="ml-1 text-[10px]">🔒</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {value && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-right">
                    Обрано: <b>{locations.find(l => l.id === value)?.code}</b>
                </div>
            )}
        </div>
    );
};

export default LocationSelector;
