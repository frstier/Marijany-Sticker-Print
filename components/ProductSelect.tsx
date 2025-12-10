import React, { useState, useRef, useEffect } from 'react';
import { Product, ProductCategory } from '../types';

interface ProductSelectProps {
    products: Product[];
    selectedProduct: Product | null;
    onSelect: (product: Product) => void;
}

const ChevronDownIcon = () => (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

const FiberIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const ShivIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);

const DustIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
);

const ProductIcon = ({ category }: { category: ProductCategory }) => {
    switch (category) {
        case 'fiber': return <FiberIcon />;
        case 'shiv': return <ShivIcon />;
        case 'dust': return <DustIcon />;
        default: return <FiberIcon />;
    }
};

const getCategoryStyles = (category: ProductCategory) => {
    switch (category) {
        case 'fiber': return 'bg-emerald-100 text-emerald-700';
        case 'shiv': return 'bg-amber-100 text-amber-700';
        case 'dust': return 'bg-slate-200 text-slate-600';
        default: return 'bg-slate-100 text-slate-500';
    }
};

const ProductSelect: React.FC<ProductSelectProps> = ({ products, selectedProduct, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (product: Product) => {
        onSelect(product);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-50 border transition-all text-left flex items-center justify-between p-3 md:p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#115740] ${
                    isOpen ? 'border-[#115740] ring-1 ring-[#115740]' : 'border-slate-300'
                }`}
            >
                {selectedProduct ? (
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getCategoryStyles(selectedProduct.category)}`}>
                            <ProductIcon category={selectedProduct.category} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 truncate">{selectedProduct.name}</div>
                            <div className="text-xs text-slate-500 font-mono">SKU: {selectedProduct.sku}</div>
                        </div>
                    </div>
                ) : (
                    <span className="text-slate-500 text-lg">-- Оберіть товар --</span>
                )}
                
                <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-80 overflow-y-auto animate-fade-in-down">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => handleSelect(product)}
                            className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-slate-100 last:border-0 ${
                                selectedProduct?.id === product.id 
                                ? 'bg-green-50' 
                                : 'hover:bg-slate-50'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getCategoryStyles(product.category)}`}>
                                <ProductIcon category={product.category} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold truncate ${selectedProduct?.id === product.id ? 'text-[#115740]' : 'text-slate-800'}`}>
                                    {product.name}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                    SKU: {product.sku}
                                </div>
                            </div>
                            {selectedProduct?.id === product.id && (
                                <div className="text-[#115740]">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductSelect;