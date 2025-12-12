import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { LabelData, LabelSizeConfig } from '../types';

import { PencilIcon, CheckIcon } from './Icons';

interface LabelPreviewProps {
  data: LabelData;
  // Size config can be passed either as whole object OR as dimensions
  sizeConfig?: LabelSizeConfig;
  widthMm?: number;
  heightMm?: number;

  // Serial Edits
  isSerialEditing?: boolean;
  onSerialEdit?: () => void;
  tempSerialInput?: string;
  onSerialChange?: (val: string) => void;
  onSerialBlur?: () => void;
}

const LabelPreview: React.FC<LabelPreviewProps> = ({
  data,
  sizeConfig,
  widthMm,
  heightMm,
  isSerialEditing,
  onSerialEdit,
  tempSerialInput,
  onSerialChange,
  onSerialBlur
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  // Default styles or from config
  const styles = sizeConfig?.previewStyles || {
    containerPadding: 'p-6',
    titleSize: 'text-xs',
    textSize: 'text-lg',
    productSize: 'text-2xl',
    weightSize: 'text-5xl',
    weightLabelSize: 'text-xl',
    barcodeHeight: 60
  };

  const cssAspectRatio = sizeConfig?.cssAspectRatio || '1/1';

  useEffect(() => {
    if (barcodeRef.current) {
      // Generate Barcode string: Date-SKU-Batch-Weight
      // e.g. 12.12.2025-LF-100-20.5
      const barcodeValue = data.product
        ? `${data.date}-${data.product.sku}-${data.serialNumber}-${data.weight || '0'}`
        : '00000000';

      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          width: 1.5, // Slightly narrower to fit long string
          height: styles.barcodeHeight,
          displayValue: true,
          font: "monospace",
          textAlign: "center",
          textPosition: "bottom",
          textMargin: 5,
          fontSize: 10, // Smaller font for long string
          background: "transparent",
          lineColor: "#0f172a", // slate-900
          margin: 0
        });
      } catch (e) {
        console.error("Barcode generation error", e);
      }
    }
  }, [data, styles.barcodeHeight]);

  return (
    <div
      className={`w-full max-w-sm mx-auto bg-white border-2 border-slate-800 rounded-sm shadow-xl overflow-hidden relative flex flex-col select-none transition-transform duration-300 ${styles.containerPadding}`}
      style={{ aspectRatio: cssAspectRatio }}
    >

      {/* Visual Simulation of Zebra Label */}
      <div className="absolute top-0 left-0 w-full h-2 bg-slate-200/50"></div>

      {/* Logo Area - Top Right */}
      <div className="absolute top-2 right-2">
        <img src="/logo_bw.png" alt="Logo" className="h-8 object-contain opacity-90" />
      </div>

      {/* Product Info */}
      <div className="mb-2 text-center">
        <p className={`${styles.productSize} font-bold text-slate-900 leading-tight`}>
          {data.product ? data.product.name : '---'}
        </p>
      </div>

      {/* Date (Centered & Larger as requested) */}
      <div className="flex justify-center mb-4">
        <div className="text-center border-b border-slate-300 pb-1 px-4">
          <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest`}>Date</p>
          <p className="text-xl font-mono font-bold text-slate-900">{data.date}</p>
        </div>
      </div>

      {/* Weight & Sort (Parallel) */}
      <div className="flex items-end justify-between mb-4 border-b-2 border-slate-900 pb-4 px-2">
        {/* Weight */}
        <div>
          <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest`}>Weight</p>
          <div className="flex items-baseline">
            <p className={`${styles.weightSize} font-bold text-slate-900 tracking-tighter`}>
              {data.weight || '0.00'}
            </p>
            <span className={`ml-1 ${styles.weightLabelSize} font-bold text-slate-400`}>kg</span>
          </div>
        </div>

        {/* Static Sort Label parallel to Weight */}
        <div className="text-right mb-1">
          <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest`}>
            {data.sortLabel || 'Sort'}
          </p>
          <p className={`${styles.textSize} font-bold text-slate-800 mt-1`}>
            {data.sortValue || '____'}
          </p>
        </div>
      </div>

      {/* Serial & Barcode Area */}
      <div className="mt-auto flex flex-col items-center justify-end h-full">
        <div className="w-full mb-2">
          <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest text-left`}>Serial No.</p>

          <div className="flex items-center gap-2">
            {isSerialEditing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={tempSerialInput}
                  onChange={(e) => onSerialChange?.(e.target.value)}
                  onBlur={onSerialBlur}
                  onKeyDown={(e) => e.key === 'Enter' && onSerialBlur?.()}
                  className="w-24 border-b-2 border-[#115740] text-lg font-mono font-bold focus:outline-none bg-transparent"
                />
                <button onMouseDown={(e) => e.preventDefault()} onClick={onSerialBlur} className="text-green-600">
                  <CheckIcon />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/serial cursor-pointer" onClick={onSerialEdit}>
                <p className={`${styles.textSize} font-mono font-bold text-left`}>#{data.serialNumber}</p>
                <span className="opacity-0 group-hover/serial:opacity-100 text-slate-400 transition-opacity">
                  <PencilIcon />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Real Barcode SVG */}
        <div className="w-full flex justify-center py-2">
          <svg ref={barcodeRef} className="w-full max-w-[95%]"></svg>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-2 font-mono">
        Zebra ZD620 Preview
      </p>
    </div>
  );
};

export default LabelPreview;