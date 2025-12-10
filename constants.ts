import { Product, LabelSizeConfig } from './types';

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Довге волокно', sku: 'LF' },
  { id: '2', name: 'Коротке волокно', sku: 'SF' },
  { id: '3', name: 'Костра калібрована', sku: 'CS' },
  { id: '4', name: 'Костра некалібрована', sku: 'NCS' },
  { id: '5', name: 'Пил костри', sku: 'DS' },
];

export const INITIAL_SERIAL = 1;

// --- ZPL TEMPLATES ---

// 100x100mm (~800x800 dots at 203dpi)
const ZPL_100x100 = `
^XA
^PW800
^LL800
^CI28
^FO10,10^GB780,780,4^FS

^FO30,30^A0N,30,30^FDDate:^FS
^FO30,70^A0N,40,40^FD{date}^FS

^FO30,150^A0N,30,30^FDProduct:^FS
^FO30,190^A0N,50,50^FD{productName}^FS

^FO30,280^A0N,30,30^FDSKU:^FS
^FO130,280^A0N,30,30^FD{sku}^FS

^FO30,360^A0N,40,40^FDWeight:^FS
^FO200,340^A0N,100,100^FD{weight} kg^FS

^FO30,500^A0N,30,30^FDSerial No:^FS
^FO30,540^A0N,40,40^FD#{serialNumber}^FS

^FO150,600^BY3
^BCN,150,Y,N,N
^FD{sku}-{serialNumber}^FS

^PQ2
^XZ
`;

// 58x30mm (~464x240 dots at 203dpi) - Very Compact & Optimized
const ZPL_58x30 = `
^XA
^PW464
^LL240
^CI28

^FO10,10^A0N,25,25^FD{productName}^FS

^FO10,45^A0N,45,45^FD{weight} kg^FS

^FO280,45^A0N,20,20^FD{date}^FS
^FO280,70^A0N,20,20^FD#{serialNumber}^FS

^FO60,110^BY2
^BCN,60,Y,N,N
^FD{sku}-{serialNumber}^FS

^PQ2
^XZ
`;

export const LABEL_SIZES: LabelSizeConfig[] = [
  {
    id: '100x100',
    name: 'Основний (100x100 мм)',
    widthMm: 100,
    heightMm: 100,
    template: ZPL_100x100,
    cssAspectRatio: '1/1',
    previewStyles: {
      containerPadding: 'p-6',
      titleSize: 'text-xs',
      textSize: 'text-lg',
      productSize: 'text-2xl',
      weightSize: 'text-5xl',
      weightLabelSize: 'text-xl',
      barcodeHeight: 60
    }
  },
  {
    id: '58x30',
    name: 'Малий (58x30 мм)',
    widthMm: 58,
    heightMm: 30,
    template: ZPL_58x30,
    cssAspectRatio: '58/30',
    previewStyles: {
      containerPadding: 'p-2',
      titleSize: 'text-[10px] hidden', // Hide labels to save space
      textSize: 'text-[10px]',
      productSize: 'text-sm font-bold truncate leading-none',
      weightSize: 'text-3xl', // Larger weight font
      weightLabelSize: 'text-xs',
      barcodeHeight: 45
    }
  }
];