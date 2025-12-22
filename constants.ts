import { Product, LabelSizeConfig, User } from './types';

// Exporting templates to be used in App.tsx logic if needed, 
// though strictly we might want to keep them private and just swap them in App.
// For now, I'll export them to make them accessible.
export { ZPL_100x100_OFFSET };

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Довге волокно', sku: 'LF', category: 'fiber', sorts: ['1', '2', '3', '4'] },
  { id: '2', name: 'Коротке волокно', sku: 'SF', category: 'fiber', sorts: ['1', '2', '3', '4'] },
  { id: '3', name: 'Костра калібрована', sku: 'HC', category: 'shiv', sorts: ['+1.5 мм', '-1.5 мм+1.0 мм', '-1.0 мм'] },
  { id: '4', name: 'Костра некалібрована', sku: 'HU', category: 'shiv', sorts: ['1', '2', '3'] },
  { id: '5', name: 'Костра мілкодисперсна', sku: 'HF', category: 'dust' },
  { id: '6', name: 'Висівки насіння', sku: 'SB', category: 'dust' },
  { id: '7', name: 'Транспортуючий шпагат', sku: 'TT', category: 'fiber' }, // Using 'fiber' category for Twine as generic
  { id: '8', name: 'Невпорядкована треста', sku: 'US', category: 'fiber' },
];

export const USERS: User[] = [
  { id: '5', name: 'Оператор', role: 'operator', pin: '1111' },
  { id: '2', name: 'Лабораторія', role: 'lab', pin: '2222' },
  { id: '1', name: 'Обліковець', role: 'accountant', pin: '3333' },
  { id: '3', name: 'Агро', role: 'agro', pin: '4444' },
  { id: '4', name: 'Адміністратор', role: 'admin', pin: '7777' },
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
^FO30,70^A0N,40,40^FH^FD{date}^FS

^FO30,150^A0N,30,30^FDProduct:^FS
^FO30,190^A0N,50,50^FH^FD{productName}^FS

^FO580,30{logo}^FS

^FO500,150^A0N,30,30^FH^FD{sortLabel}:^FS
^FO500,190^A0N,40,40^FH^FD{sortValue}^FS

^FO30,280^A0N,30,30^FDSKU:^FS
^FO130,280^A0N,30,30^FH^FD{sku}^FS

^FO30,360^A0N,40,40^FDWeight:^FS
^FO200,340^A0N,100,100^FH^FD{weight} kg^FS

^FO30,500^A0N,30,30^FDSerial No:^FS
^FO30,540^A0N,40,40^FH^FD#{serialNumber}^FS

^FO100,600^BY2
^BCN,100,Y,N,N
^FH^FD{barcode}^FS

^PQ{quantity}
^XZ
`;

// 100x100mm OFFSET (For Wire Attachment - Shifted Down ~15mm / 120 dots)
// We also compress vertical limits to fit within 800 dots height.
const ZPL_100x100_OFFSET = `
^XA
^PW800
^LL800
^CI28
^FO10,10^GB780,780,4^FS

^FO30,150^A0N,30,30^FDDate:^FS
^FO30,190^A0N,40,40^FH^FD{date}^FS

^FO30,240^A0N,30,30^FDProduct:^FS
^FO30,280^A0N,50,50^FH^FD{productName}^FS

^FO580,150{logo}^FS

^FO500,240^A0N,30,30^FH^FD{sortLabel}:^FS
^FO500,280^A0N,40,40^FH^FD{sortValue}^FS

^FO30,360^A0N,30,30^FDSKU:^FS
^FO130,360^A0N,30,30^FH^FD{sku}^FS

^FO30,440^A0N,40,40^FDWeight:^FS
^FO200,420^A0N,100,100^FH^FD{weight} kg^FS

^FO30,570^A0N,30,30^FDSerial No:^FS
^FO30,610^A0N,40,40^FH^FD#{serialNumber}^FS

^FO100,670^BY2
^BCN,90,Y,N,N
^FH^FD{barcode}^FS

^PQ{quantity}
^XZ
`;

// 58x30mm (~464x240 dots at 203dpi) - Very Compact & Optimized
const ZPL_58x30 = `
^XA
^PW464
^LL240
^CI28

^FO10,10^A0N,25,25^FH^FD{productName}^FS

^FO360,10{logo}^FS

^FO100,50^A0N,30,30^FH^FDDate: {date}^FS

^FO10,85^A0N,45,45^FH^FD{weight} kg^FS
^FO220,95^A0N,25,25^FH^FD{sortLabel}:{sortValue}^FS

^FO280,130^A0N,20,20^FH^FD#{serialNumber}^FS

^FO40,155^BY1
^BCN,40,Y,N,N
^FH^FD{barcode}^FS

^PQ{quantity}
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