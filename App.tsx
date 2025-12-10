import React, { useState, useEffect, useRef } from 'react';
import { Product, LabelData, PrinterStatus, ZebraDevice, LabelSizeConfig } from './types';
import { PRODUCTS, LABEL_SIZES, INITIAL_SERIAL } from './constants';
import { zebraService } from './services/zebraService';
import Keypad from './components/Keypad';
import LabelPreview from './components/LabelPreview';
import ProductSelect from './components/ProductSelect';

// --- ICONS ---
const PrinterIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
);

const PencilIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
);

const CheckIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
);

const CalendarIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);

const SettingsIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);

const RefreshIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
);

const CloseIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);

const DownloadIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);

const TrashIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

const MailIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);

const SearchIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);

const LockClosedIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

const ShieldCheckIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
);

const ExternalLinkIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
);

// --- STORAGE KEYS ---
const LOCAL_STORAGE_HISTORY_KEY = 'zebra_print_history_v1';
const LOCAL_STORAGE_COUNTERS_KEY = 'zebra_product_counters_v1';
const SAVED_PRINTER_CONFIG_KEY = 'zebra_printer_config_v1';
const SAVED_AGENT_IP_KEY = 'zebra_agent_ip';

export default function App() {
  // --- State ---
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [weight, setWeight] = useState<string>('');
  
  // NEW: Object to store counters for each product ID { "1": 105, "2": 300 }
  const [productCounters, setProductCounters] = useState<Record<string, number>>({});
  
  // Temporary editing state for the currently displayed serial number
  const [isSerialEditing, setIsSerialEditing] = useState(false);
  const [tempSerialInput, setTempSerialInput] = useState<string>("");

  // Printer State
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(PrinterStatus.DISCONNECTED);
  const [printer, setPrinter] = useState<ZebraDevice | null>(null);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<ZebraDevice[]>([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
  const [agentIp, setAgentIp] = useState("127.0.0.1");

  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSizeConfig>(LABEL_SIZES[0]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Admin Mode
  const [isAdminMode, setIsAdminMode] = useState(false);
  const adminClicksRef = useRef(0);
  const lastAdminClickTimeRef = useRef(0);
  
  // History State
  const [history, setHistory] = useState<Array<LabelData & { timestamp: string }>>([]);
  
  const lastClickTimeRef = useRef<number>(0);
  
  // Derived State
  const today = new Date().toLocaleDateString('uk-UA');
  
  // Determine current serial number based on selected product
  const currentSerialNumber = selectedProduct 
    ? (productCounters[selectedProduct.id] ?? INITIAL_SERIAL) 
    : 0;

  const labelData: LabelData = {
    product: selectedProduct,
    weight,
    serialNumber: currentSerialNumber,
    date: today
  };

  // --- Effects ---

  // 0. Load IP config
  useEffect(() => {
    const savedIp = localStorage.getItem(SAVED_AGENT_IP_KEY);
    if (savedIp) setAgentIp(savedIp);
  }, []);

  // 1. Connect Printer on Mount
  useEffect(() => {
    autoConnectPrinter();
  }, []);

  // 2. Load History & Counters
  useEffect(() => {
      try {
          const savedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
          if (savedHistory) {
              setHistory(JSON.parse(savedHistory));
          }

          // Load Product Counters
          const savedCounters = localStorage.getItem(LOCAL_STORAGE_COUNTERS_KEY);
          if (savedCounters) {
              setProductCounters(JSON.parse(savedCounters));
          } else {
              // Initialize defaults if empty
              const initial: Record<string, number> = {};
              PRODUCTS.forEach(p => initial[p.id] = INITIAL_SERIAL);
              setProductCounters(initial);
          }
      } catch (e) {
          console.error("Failed to load local storage data", e);
      }
  }, []);

  // 2.5 Listen for cross-tab storage changes (Sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_COUNTERS_KEY && e.newValue) {
        console.log("Syncing counters from other tab");
        setProductCounters(JSON.parse(e.newValue));
      }
      if (e.key === LOCAL_STORAGE_HISTORY_KEY && e.newValue) {
        setHistory(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 3. Save History & Counters
  useEffect(() => {
      try {
          localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
      } catch (e) { console.error(e); }
  }, [history]);

  useEffect(() => {
      try {
          localStorage.setItem(LOCAL_STORAGE_COUNTERS_KEY, JSON.stringify(productCounters));
      } catch (e) { console.error(e); }
  }, [productCounters]);


  // --- Helper Methods ---

  const saveAgentIp = () => {
      localStorage.setItem(SAVED_AGENT_IP_KEY, agentIp);
      if (window.confirm("Щоб застосувати нову IP-адресу, потрібно перезавантажити сторінку. Перезавантажити зараз?")) {
          window.location.reload();
      }
  };

  const autoConnectPrinter = async () => {
    setPrinterStatus(PrinterStatus.CONNECTING);
    setPrinter(null);
    
    // 1. Try to load saved FULL configuration from LocalStorage (Fastest)
    const savedConfig = localStorage.getItem(SAVED_PRINTER_CONFIG_KEY);
    if (savedConfig) {
        try {
            const device = JSON.parse(savedConfig) as ZebraDevice;
            // Optimistically set connected. The service will handle re-initialization during print.
            console.log("Restored printer config:", device.name);
            setPrinter(device);
            setPrinterStatus(PrinterStatus.CONNECTED);
            return;
        } catch (e) {
            console.error("Error parsing saved printer config", e);
            localStorage.removeItem(SAVED_PRINTER_CONFIG_KEY);
        }
    }

    // 2. Fallback: Scan for default (Slower)
    try {
        const device = await zebraService.getDefaultPrinter();
        setPrinter(device);
        setPrinterStatus(PrinterStatus.CONNECTED);
        // Save this default as the config automatically
        localStorage.setItem(SAVED_PRINTER_CONFIG_KEY, JSON.stringify(device));
    } catch (error: any) {
        setPrinterStatus(PrinterStatus.ERROR);
    }
  };

  const handleSearchPrinters = async () => {
    setIsSearchingPrinters(true);
    setDiscoveredPrinters([]);
    try {
        const devices = await zebraService.getAllPrinters();
        setDiscoveredPrinters(devices);
        if (devices.length === 0) {
            alert(`Принтери не знайдено за адресою ${agentIp}.\n\n1. Переконайтеся, що Zebra Browser Print запущено.\n2. Якщо це перший запуск, натисніть "Виправити SSL".`);
        }
    } catch (e) {
        console.error(e);
        alert("Помилка пошуку. Переконайтеся, що Zebra Browser Print запущено.");
    } finally {
        setIsSearchingPrinters(false);
    }
  };

  const handleFixSsl = () => {
      const url = `https://${agentIp}:9101/ssl_support`;
      window.open(url, '_blank');
  };

  const selectPrinter = (device: ZebraDevice) => {
      setPrinter(device);
      setPrinterStatus(PrinterStatus.CONNECTED);
      // Save full config
      localStorage.setItem(SAVED_PRINTER_CONFIG_KEY, JSON.stringify(device));
      setDiscoveredPrinters([]); 
  };

  const handleSettingsTitleClick = () => {
      const now = Date.now();
      
      // Reset counter if too much time passed between clicks (e.g., > 1 second)
      if (now - lastAdminClickTimeRef.current > 1000) {
          adminClicksRef.current = 0;
      }
      
      adminClicksRef.current += 1;
      lastAdminClickTimeRef.current = now;

      // Trigger on 3rd click (Triple Tap)
      if (adminClicksRef.current >= 3) {
          setIsAdminMode(prev => !prev);
          adminClicksRef.current = 0; // Reset after toggle
      }
  };

  // --- Input Handlers ---

  const handleWeightKeyPress = (key: string) => {
    if (key === '.' && weight.includes('.')) return;
    if (weight.length > 6) return;
    setWeight(prev => prev + key);
  };

  const handleWeightBackspace = () => {
    setWeight(prev => prev.slice(0, -1));
  };

  const handleWeightClear = () => {
    setWeight('');
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

  // --- Serial Number Logic ---

  const handleEditIconClick = () => {
      if (!selectedProduct) return;
      
      const now = Date.now();
      const timeDiff = now - lastClickTimeRef.current;
      if (timeDiff < 1000) {
          setIsSerialEditing(true);
          setTempSerialInput(currentSerialNumber.toString());
          lastClickTimeRef.current = 0; 
      } else {
          lastClickTimeRef.current = now;
      }
  };

  const handleSerialBlur = () => {
      if (!selectedProduct) return;
      setIsSerialEditing(false);
      
      const newVal = parseInt(tempSerialInput);
      if (!Number.isNaN(newVal) && newVal >= 1) {
          // Update the counter for THIS specific product
          setProductCounters(prev => ({
              ...prev,
              [selectedProduct.id]: newVal
          }));
      }
  };

  const handlePrint = async () => {
    if (!selectedProduct || !weight) {
      alert("Будь ласка, виберіть продукт та введіть вагу.");
      return;
    }

    if (printerStatus !== PrinterStatus.CONNECTED || !printer) {
        const confirmMock = window.confirm("Принтер не знайдено. Тестовий друк у консоль?");
        if (!confirmMock) return;
    }

    const zpl = zebraService.generateZPL(selectedLabelSize.template, {
        date: today,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        weight: weight,
        serialNumber: currentSerialNumber.toString()
    });

    let success = false;
    
    if (printer) {
        success = await zebraService.print(printer, zpl);
    } else {
        console.log(`--- MOCK PRINTING ZPL (${selectedLabelSize.name}) ---`);
        console.log(zpl);
        success = true;
    }

    if (success) {
        // Log to history
        const record = { ...labelData, timestamp: new Date().toISOString() };
        setHistory(prev => [...prev, record]);

        // Increment counter for THIS SPECIFIC PRODUCT
        // Use ?? INITIAL_SERIAL to ensure we don't restart from 1 if undefined/zero-like
        setProductCounters(prev => ({
            ...prev,
            [selectedProduct.id]: (prev[selectedProduct.id] ?? INITIAL_SERIAL) + 1
        }));

        setWeight('');
    } else {
        alert("Помилка друку.");
    }
  };

  // --- Export Logic ---

  const generateCSV = (): File => {
    const BOM = "\uFEFF"; 
    const headers = ["Дата", "Час", "Продукт", "SKU", "Вага (кг)", "Серійний номер"];
    
    const csvRows = history.map(item => {
        const dateObj = new Date(item.timestamp);
        const timeStr = dateObj.toLocaleTimeString('uk-UA');
        const escape = (text: string) => `"${text.replace(/"/g, '""')}"`;
        
        return [
            escape(item.date),
            escape(timeStr),
            escape(item.product?.name || ""),
            escape(item.product?.sku || ""),
            escape(item.weight),
            item.serialNumber
        ].join(",");
    });

    const csvString = BOM + headers.join(",") + "\n" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    
    const filename = `ZebraLog_${new Date().toISOString().split('T')[0]}.csv`;
    return new File([blob], filename, { type: 'text/csv' });
  };

  const handleExportHistory = () => {
    if (history.length === 0) {
        alert("Історія друку порожня");
        return;
    }
    const file = generateCSV();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendEmail = async () => {
    if (history.length === 0) {
        alert("Історія друку порожня");
        return;
    }

    const file = generateCSV();
    const subject = `Production Log - ${new Date().toLocaleDateString('uk-UA')}`;
    const body = `Звіт виробництва за ${new Date().toLocaleDateString('uk-UA')}.\n\nФайл звіту додається.`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: subject,
                text: body,
                files: [file]
            });
            return;
        } catch (err) {
            console.log("Share API failed", err);
        }
    }

    handleExportHistory(); 
    setTimeout(() => {
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(Увага: Файл CSV був завантажений на ваш пристрій. Будь ласка, прикріпіть його до цього листа вручну.)")}`;
        window.location.href = mailtoLink;
    }, 500);
  };

  const handleClearHistory = () => {
      if (window.confirm("Ви впевнені, що хочете очистити історію?")) {
          setHistory([]);
      }
  };

  const isPrintDisabled = !selectedProduct || !weight;

  const PrintButton = ({ className }: { className?: string }) => (
    <button
        onClick={handlePrint}
        disabled={isPrintDisabled}
        className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 ${
            isPrintDisabled
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : 'bg-[#115740] hover:bg-[#0d4633] text-white shadow-green-900/30'
        } ${className}`}
    >
        <PrinterIcon />
        ДРУК (Zebra)
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#D9D9D6] relative font-sans">
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
                    <button 
                        onClick={handleSettingsTitleClick}
                        className="text-xl font-bold text-slate-800 flex items-center gap-2 select-none active:scale-95 transition-transform"
                        title="Натисніть 3 рази для адміністрування"
                    >
                        <SettingsIcon />
                        Налаштування
                    </button>
                    <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="p-6 space-y-8">
                    
                    {/* Section: Printer Connection (ADMIN ONLY) */}
                    {isAdminMode && (
                        <section className="animate-fade-in bg-amber-50 p-4 rounded-xl border border-amber-200">
                             <h4 className="font-semibold text-amber-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                <LockClosedIcon />
                                Адміністрування принтера
                             </h4>
                             
                             <div className="mb-4 bg-white p-3 rounded border border-amber-100 text-xs text-amber-800">
                                 <p className="font-bold mb-1">Діагностика:</p>
                                 <ul className="list-disc list-inside space-y-1">
                                     <li>У вас встановлена програма <b>Zebra Browser Print</b>?</li>
                                     <li>Якщо ви в хмарі/preview, відкрийте сайт в <b>новій вкладці</b>.</li>
                                     <li>Якщо ви з телефону, вкажіть IP комп'ютера з принтером нижче.</li>
                                 </ul>
                                 <a href="https://www.zebra.com/us/en/support-downloads/software-utilities/browser-print.html" target="_blank" className="text-blue-600 underline mt-2 block flex items-center gap-1">
                                     <DownloadIcon /> Завантажити драйвер Zebra
                                 </a>
                             </div>

                             <div className="space-y-3">
                                 <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-amber-800 uppercase">IP Агента Zebra:</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={agentIp}
                                            onChange={(e) => setAgentIp(e.target.value)}
                                            className="border border-amber-300 rounded px-2 py-1 text-sm flex-1"
                                            placeholder="127.0.0.1"
                                        />
                                        <button onClick={saveAgentIp} className="text-xs bg-amber-200 px-2 rounded hover:bg-amber-300">Зберегти</button>
                                    </div>
                                    <p className="text-[10px] text-amber-600">За замовчуванням: 127.0.0.1 (цей комп'ютер)</p>
                                 </div>

                                 <button 
                                     onClick={handleFixSsl}
                                     className="w-full bg-white text-amber-700 border border-amber-300 p-2 rounded-lg hover:bg-amber-50 flex items-center justify-center gap-2 text-sm font-semibold"
                                 >
                                     <ShieldCheckIcon />
                                     Виправити SSL ({agentIp})
                                 </button>

                                 <div className="flex gap-2 border-t border-amber-200 pt-3">
                                    <button 
                                        onClick={handleSearchPrinters}
                                        disabled={isSearchingPrinters}
                                        className="w-full bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                                    >
                                        {isSearchingPrinters ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <SearchIcon />}
                                        {isSearchingPrinters ? 'Пошук...' : 'Знайти всі принтери'}
                                    </button>
                                 </div>

                                 {discoveredPrinters.length > 0 && (
                                     <div className="space-y-2 mt-2 max-h-40 overflow-y-auto custom-scrollbar bg-white rounded border border-amber-100 p-1">
                                         {discoveredPrinters.map(dev => (
                                             <button
                                                key={dev.uid}
                                                onClick={() => selectPrinter(dev)}
                                                className={`w-full text-left p-3 rounded-lg text-sm border flex items-center justify-between transition-colors ${
                                                    printer?.uid === dev.uid 
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 ring-1 ring-emerald-200'
                                                    : 'bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200'
                                                }`}
                                             >
                                                 <div className="truncate">
                                                     <div className="font-bold">{dev.name}</div>
                                                     <div className="text-xs text-slate-500 truncate mt-0.5">{dev.deviceType} ({dev.connection})</div>
                                                 </div>
                                                 {printer?.uid === dev.uid && <div className="text-emerald-500 font-bold px-2">✓</div>}
                                             </button>
                                         ))}
                                     </div>
                                 )}
                                 
                                 {printer && (
                                     <div className="pt-3 mt-2 border-t border-amber-200/50">
                                         <p className="text-xs text-amber-700">Обраний принтер:</p>
                                         <p className="text-sm font-medium text-amber-900">{printer.name} ({printer.connection})</p>
                                     </div>
                                 )}
                             </div>
                        </section>
                    )}

                    {/* Section: Label Size */}
                    <section>
                        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Розмір етикетки</h4>
                        <div className="space-y-3">
                            {LABEL_SIZES.map(size => (
                                <label 
                                    key={size.id} 
                                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                                        selectedLabelSize.id === size.id 
                                        ? 'border-[#115740] bg-green-50 ring-1 ring-[#115740]' 
                                        : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <input 
                                        type="radio" 
                                        name="labelSize"
                                        value={size.id}
                                        checked={selectedLabelSize.id === size.id}
                                        onChange={() => setSelectedLabelSize(size)}
                                        className="w-5 h-5 text-[#115740] focus:ring-[#115740] border-gray-300"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-slate-900 font-medium">{size.name}</span>
                                        <span className="block text-slate-500 text-sm">{size.widthMm} x {size.heightMm} мм</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Section: Data & Export */}
                    <section className="pt-4 border-t border-slate-100">
                         <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider flex justify-between">
                            Архів даних
                            <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs lowercase font-mono">
                                {history.length} rec
                            </span>
                         </h4>
                         
                         <div className="grid grid-cols-2 gap-3">
                             <button
                                onClick={handleExportHistory}
                                disabled={history.length === 0}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors border ${
                                    history.length === 0 
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                }`}
                             >
                                 <DownloadIcon />
                                 <span className="text-sm">Скачати CSV</span>
                             </button>

                             <button
                                onClick={handleSendEmail}
                                disabled={history.length === 0}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors border ${
                                    history.length === 0 
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                }`}
                             >
                                 <MailIcon />
                                 <span className="text-sm">Відправити</span>
                             </button>
                         </div>
                         
                         {history.length > 0 && (
                            <button
                                onClick={handleClearHistory}
                                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 text-sm font-medium transition-colors border border-transparent hover:border-red-100"
                            >
                                <TrashIcon />
                                Очистити пам'ять пристрою
                            </button>
                         )}
                    </section>
                </div>

                <div className="p-4 border-t bg-slate-50 text-right sticky bottom-0 z-10">
                    <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="px-6 py-2 bg-[#115740] text-white font-medium rounded-lg hover:bg-[#0d4633] shadow-sm"
                    >
                        Закрити
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#115740] border-b border-[#0f4433] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-3 h-14 md:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
                {/* Logo Placeholder */}
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-lg flex items-center justify-center text-white/50 shrink-0 border border-white/20">
                    <span className="text-[8px] font-bold tracking-wider">LOGO</span>
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-bold text-white leading-none tracking-tight">Marijany Sticker Print</h1>
                    <div className="flex items-center gap-1">
                        <p className="text-[10px] md:text-xs text-white/60">Лінія №1</p>
                        {/* New Window Warning Hint */}
                        {typeof window !== 'undefined' && window.self !== window.top && (
                            <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white font-bold bg-white/20 px-1 rounded flex items-center gap-0.5 hover:bg-white/30 ml-2" title="Відкрити в новому вікні">
                                <ExternalLinkIcon /> New Window
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Status Indicator (Bulb) */}
                <div 
                    className={`w-3 h-3 md:w-4 md:h-4 rounded-full shadow-lg transition-colors duration-300 border-2 border-white/20 ${
                        printerStatus === PrinterStatus.CONNECTED ? 'bg-emerald-400 shadow-emerald-900' :
                        printerStatus === PrinterStatus.CONNECTING ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-red-900'
                    }`}
                    title={printerStatus === PrinterStatus.CONNECTED ? "Підключено" : "Немає з'єднання"}
                />

                {/* Refresh Button */}
                <button 
                    onClick={autoConnectPrinter}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    title="Оновити з'єднання з принтером"
                >
                    <RefreshIcon />
                </button>

                {/* Settings Button */}
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    title="Налаштування етикетки"
                >
                    <SettingsIcon />
                </button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-6 pb-32 lg:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        
        {/* LEFT COLUMN: Controls */}
        <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6">
            
            {/* 1. Date */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
                <label className="block mb-2 text-sm font-medium text-slate-700 uppercase tracking-wide">Дата виробництва</label>
                <div className="flex items-center gap-3 text-slate-800">
                    <div className="text-[#115740]">
                        <CalendarIcon />
                    </div>
                    <span className="text-2xl font-bold font-mono">{today}</span>
                </div>
            </div>

             {/* 2. Grid for Inputs */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                
                {/* LEFT SIDE: Product & Serial */}
                <div className="flex flex-col gap-4 md:gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex-1 z-20">
                        <label className="block mb-2 text-sm font-medium text-slate-700 uppercase tracking-wide">Продукція</label>
                        {/* New Custom Select Component */}
                        <ProductSelect 
                            products={PRODUCTS}
                            selectedProduct={selectedProduct}
                            onSelect={handleProductSelect}
                        />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 transition-all z-10">
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-sm font-medium text-slate-700 uppercase tracking-wide">
                                 Серійний номер {selectedProduct && `(${selectedProduct.sku})`}
                             </label>
                             {!isSerialEditing && selectedProduct && (
                                 <button 
                                    onClick={handleEditIconClick}
                                    className="p-2 text-slate-400 hover:text-[#115740] hover:bg-green-50 rounded-full transition-colors active:scale-95"
                                    title="Натисніть двічі за 1с щоб редагувати"
                                 >
                                     <PencilIcon />
                                 </button>
                             )}
                        </div>
                        
                        <div className="h-14 md:h-16 flex items-center">
                            {isSerialEditing && selectedProduct ? (
                                <div className="w-full flex gap-2">
                                     <input 
                                        type="number" 
                                        autoFocus
                                        value={tempSerialInput} 
                                        onChange={(e) => setTempSerialInput(e.target.value)}
                                        onBlur={handleSerialBlur}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSerialBlur()}
                                        className="h-14 bg-white border border-[#115740] ring-2 ring-green-100 rounded-lg px-4 text-2xl font-mono font-bold text-slate-900 block w-full" 
                                    />
                                    <button 
                                        onClick={handleSerialBlur}
                                        className="bg-[#115740] text-white px-4 rounded-lg hover:bg-[#0d4633]"
                                    >
                                        <CheckIcon />
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    className={`w-full h-full border rounded-lg flex items-center justify-center text-3xl font-mono font-bold tracking-wider select-none ${
                                        selectedProduct 
                                        ? 'bg-slate-100 border-slate-300 text-slate-800 cursor-pointer' 
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                    }`}
                                    onClick={handleEditIconClick}
                                >
                                    {selectedProduct ? `#${currentSerialNumber}` : '---'}
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                           {isSerialEditing 
                             ? 'Введіть нове значення' 
                             : selectedProduct 
                                ? 'Для редагування натисніть двічі на олівець'
                                : 'Оберіть продукт для перегляду номера'
                            }
                        </p>
                    </div>

                </div>

                {/* RIGHT SIDE: Weight Input */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col h-full z-10">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-slate-700 uppercase tracking-wide">Вага (кг)</label>
                        <span className="text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">Manual</span>
                    </div>
                    
                    <div className="mb-3 relative">
                        <input 
                            type="text" 
                            readOnly 
                            value={weight} 
                            placeholder="0.00"
                            className="block w-full p-3 md:p-4 text-right text-4xl font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:ring-[#115740] focus:border-[#115740]" 
                        />
                    </div>
                    
                    <div className="mt-auto">
                        <Keypad 
                            onKeyPress={handleWeightKeyPress} 
                            onBackspace={handleWeightBackspace} 
                            onClear={handleWeightClear} 
                        />
                    </div>
                </div>
             </div>
        </div>

        {/* RIGHT COLUMN: Preview & Action */}
        <div className="lg:col-span-5 flex flex-col gap-6 z-0">
            <div className="bg-slate-800 rounded-xl shadow-lg p-4 md:p-6 text-white lg:sticky lg:top-24">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        Попередній перегляд
                    </h3>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                        {selectedLabelSize.name}
                    </span>
                </div>
                
                <LabelPreview data={labelData} sizeConfig={selectedLabelSize} />

                {/* Desktop Print Button */}
                <div className="mt-6 space-y-3 hidden lg:block">
                    <PrintButton />
                    <p className="text-center text-slate-400 text-sm">
                        {printerStatus === PrinterStatus.CONNECTED 
                            ? `Готовий до друку на ${printer?.name}` 
                            : 'Принтер не підключено'}
                    </p>
                </div>
            </div>
        </div>
      </main>

      {/* MOBILE STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 lg:hidden z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-safe">
        <div className="max-w-7xl mx-auto flex gap-3">
             <div className="flex-1">
                 <PrintButton className="h-14 text-xl" />
             </div>
        </div>
      </div>
    </div>
  );
}