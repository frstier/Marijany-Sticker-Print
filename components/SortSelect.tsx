import React, { useState, useRef, useEffect } from 'react';

interface SortSelectProps {
    sorts: string[];
    selectedSort: string;
    onSelect: (sort: string) => void;
    label?: string;
}

const ChevronDownIcon = () => (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

const SortSelect: React.FC<SortSelectProps> = ({ sorts, selectedSort, onSelect, label = "Сорт" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (sort: string) => {
        onSelect(sort);
        setIsOpen(false);
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in" ref={containerRef}>
            <label className="block mb-2 text-sm font-medium text-slate-700 uppercase tracking-wide">{label}</label>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full bg-slate-50 border transition-all text-left flex items-center justify-between p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#115740] ${isOpen ? 'border-[#115740] ring-1 ring-[#115740]' : 'border-slate-300'
                        }`}
                >
                    <span className={`font-bold ${selectedSort ? 'text-slate-900' : 'text-slate-500'}`}>
                        {selectedSort || "Оберіть зі списку"}
                    </span>
                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon />
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-60 overflow-y-auto animate-fade-in-down">
                        {sorts.map((sort) => (
                            <div
                                key={sort}
                                onClick={() => handleSelect(sort)}
                                className={`p-3 cursor-pointer transition-colors border-b border-slate-100 last:border-0 font-bold ${selectedSort === sort
                                        ? 'bg-emerald-50 text-[#115740]'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {sort}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SortSelect;
