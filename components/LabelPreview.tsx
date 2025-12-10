import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { LabelData, LabelSizeConfig } from '../types';

interface LabelPreviewProps {
  data: LabelData;
  sizeConfig?: LabelSizeConfig;
}

const LabelPreview: React.FC<LabelPreviewProps> = ({ data, sizeConfig }) => {
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
      // Generate Barcode string: SKU-SerialNumber (e.g., CH-EDM-10001)
      // If no product is selected, use a placeholder
      const barcodeValue = data.product 
        ? `${data.product.sku}-${data.serialNumber}`
        : '00000000';

      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: styles.barcodeHeight,
          displayValue: true,
          font: "monospace",
          textAlign: "center",
          textPosition: "bottom",
          textMargin: 5,
          fontSize: 14,
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
      
      {/* Header: Date */}
      <div className="flex justify-between items-start mb-4">
        <div>
           <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest`}>Date</p>
           <p className={`${styles.textSize} font-mono font-bold text-slate-900`}>{data.date}</p>
        </div>
      </div>

      {/* Product Info */}
      <div className="mb-4">
        <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest`}>Product</p>
        <p className={`${styles.productSize} font-bold text-slate-900 leading-tight`}>
          {data.product ? data.product.name : '---'}
        </p>
        <p className={`${styles.textSize} font-mono text-slate-600 mt-1`}>
            SKU: {data.product ? data.product.sku : '---'}
        </p>
      </div>

      {/* Weight */}
      <div className="flex items-end justify-between mb-4 border-b-2 border-slate-900 pb-4">
        <div>
            <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest`}>Weight</p>
            <div className="flex items-baseline">
                <p className={`${styles.weightSize} font-bold text-slate-900 tracking-tighter`}>
                    {data.weight || '0.00'}
                </p>
                <span className={`ml-1 ${styles.weightLabelSize} font-bold text-slate-400`}>kg</span>
            </div>
        </div>
      </div>

      {/* Serial & Barcode Area */}
      <div className="mt-auto flex flex-col items-center justify-end h-full">
        <div className="w-full mb-2">
            <p className={`${styles.titleSize} text-slate-500 uppercase font-bold tracking-widest text-left`}>Serial No.</p>
            <p className={`${styles.textSize} font-mono font-bold text-left`}>#{data.serialNumber}</p>
        </div>
        
        {/* Real Barcode SVG */}
        <div className="w-full flex justify-center py-2">
            <svg ref={barcodeRef} className="w-full max-w-[90%]"></svg>
        </div>
      </div>
      
      <p className="text-center text-[10px] text-slate-400 mt-2 font-mono">
          Zebra ZD620 Preview
      </p>
    </div>
  );
};

export default LabelPreview;