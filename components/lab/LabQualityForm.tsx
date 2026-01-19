import React from 'react';

// Quality parameter definitions per product type
export interface LabParameter {
    key: string;
    label: string;
    unit: string;
    min?: number;
    max?: number;
    step?: number;
}

export interface LabData {
    [key: string]: number | undefined;
}

// Product-specific parameter configurations
export const LAB_PARAMETERS: Record<string, LabParameter[]> = {
    // Довге волокно / Long Fiber
    'long_fiber': [
        { key: 'fiberLength', label: 'Довжина волокна', unit: 'мм', min: 0, max: 1000, step: 0.1 },
        { key: 'breakingLoad', label: 'Розривне навантаження', unit: 'Н', min: 0, max: 100, step: 0.1 },
        { key: 'linearDensity', label: 'Лінійна щільність', unit: 'текс', min: 0, max: 50, step: 0.01 },
        { key: 'shivContent', label: 'Вміст костри', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'unprocessedFiber', label: 'Вміст не розщепленого волокна', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'impurityContent', label: 'Вміст сміттєвої домішки', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'moisture', label: 'Вологість', unit: '%', min: 0, max: 100, step: 0.1 },
    ],
    // Коротке волокно / Short Fiber
    'short_fiber': [
        { key: 'breakingLoad', label: 'Розривне навантаження', unit: 'Н', min: 0, max: 100, step: 0.1 },
        { key: 'shivContent', label: 'Вміст костри', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'impurityContent', label: 'Вміст сміттєвої домішки', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'unprocessedFiber', label: 'Вміст не розщепленого волокна', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'moisture', label: 'Вологість', unit: '%', min: 0, max: 100, step: 0.1 },
    ],
    // Костра не калібрована / Hurds Uncalibrated
    'hurds_uncalibrated': [
        { key: 'impurityContent', label: 'Вміст сміттєвої домішки', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'fiberContent', label: 'Вміст волокна', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'seedContent', label: 'Вміст насіння', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'moisture', label: 'Вологість', unit: '%', min: 0, max: 100, step: 0.1 },
    ],
    // Костра калібрована / Hurds Calibrated
    'hurds_calibrated': [
        { key: 'fractionalComposition', label: 'Фракційний склад', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'fiberContent', label: 'Вміст волокна', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'moisture', label: 'Вологість', unit: '%', min: 0, max: 100, step: 0.1 },
    ],
};

// Map product name to parameter key
export function getProductParamKey(productName: string): string {
    const name = productName.toLowerCase();
    if (name.includes('довге') || name.includes('long')) return 'long_fiber';
    if (name.includes('коротке') || name.includes('short')) return 'short_fiber';
    if (name.includes('калібрована') || name.includes('calibrated')) return 'hurds_calibrated';
    if (name.includes('костра') || name.includes('hurds') || name.includes('shiv')) return 'hurds_uncalibrated';
    return 'long_fiber'; // default
}

interface LabQualityFormProps {
    productName: string;
    values: LabData;
    onChange: (values: LabData) => void;
    sort: string;
    onSortChange: (sort: string) => void;
}

const LabQualityForm: React.FC<LabQualityFormProps> = ({
    productName,
    values,
    onChange,
    sort,
    onSortChange
}) => {
    const paramKey = getProductParamKey(productName);
    const parameters = LAB_PARAMETERS[paramKey] || LAB_PARAMETERS['long_fiber'];

    const handleChange = (key: string, value: string) => {
        const numValue = value === '' ? undefined : parseFloat(value);
        onChange({ ...values, [key]: numValue });
    };

    // Simple sort options (can be determined by lab data later)
    const sortOptions = ['1', '2', '3', '4', 'Нестандарт'];

    return (
        <div className="space-y-4">
            {/* Sort selector */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    Сорт
                </label>
                <div className="flex flex-wrap gap-2">
                    {sortOptions.map(s => (
                        <button
                            key={s}
                            onClick={() => onSortChange(s)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${sort === s
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quality parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parameters.map(param => (
                    <div key={param.key} className="bg-slate-800 rounded-lg p-3">
                        <label className="block text-sm text-slate-400 mb-1">
                            {param.label}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={values[param.key] ?? ''}
                                onChange={(e) => handleChange(param.key, e.target.value)}
                                min={param.min}
                                max={param.max}
                                step={param.step || 0.1}
                                placeholder="0"
                                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-slate-500 text-sm min-w-[40px]">{param.unit}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LabQualityForm;
