import React, { useState, useRef, useEffect } from 'react';
import { zebraService } from '../services/zebraService';
import { ZebraDevice } from '../types';

// ======================
// TYPES
// ======================
export interface LabelElement {
    id: string;
    type: 'text' | 'barcode' | 'qrcode' | 'line' | 'box' | 'variable';
    x: number; // Position in dots (203 dpi: 1mm = 8 dots)
    y: number;
    width?: number;
    height?: number;
    content?: string; // For text/variable
    variableName?: string; // e.g. {weight}, {date}
    fontSize?: number;
    fontStyle?: 'normal' | 'bold';
    rotation?: 0 | 90 | 180 | 270;
    barcodeType?: 'CODE128' | 'CODE39' | 'EAN13' | 'QR';
    barcodeHeight?: number;
}

export interface LabelTemplate {
    id: string;
    name: string;
    widthMm: number;
    heightMm: number;
    widthDots: number;
    heightDots: number;
    elements: LabelElement[];
    createdAt: string;
    updatedAt: string;
}

interface LabelDesignerProps {
    onClose: () => void;
    onSave?: (template: LabelTemplate) => void;
    initialTemplate?: LabelTemplate;
    printer?: ZebraDevice | null;
}

// ======================
// CONSTANTS
// ======================
const DOTS_PER_MM = 8; // 203 dpi ≈ 8 dots/mm
const AVAILABLE_VARIABLES = [
    { name: '{date}', label: 'Дата' },
    { name: '{productName}', label: 'Назва продукту' },
    { name: '{productNameEn}', label: 'Product Name (EN)' },
    { name: '{sku}', label: 'SKU' },
    { name: '{weight}', label: 'Вага' },
    { name: '{serialNumber}', label: 'Серійний номер' },
    { name: '{sortLabel}', label: 'Мітка сорту' },
    { name: '{sortValue}', label: 'Значення сорту' },
    { name: '{barcode}', label: 'Штрих-код' },
    { name: '{quantity}', label: 'Кількість' },
];

const PRESET_SIZES = [
    { name: '100x100 мм', width: 100, height: 100 },
    { name: '58x30 мм', width: 58, height: 30 },
    { name: '80x60 мм', width: 80, height: 60 },
    { name: '100x50 мм', width: 100, height: 50 },
];

// ======================
// PREDEFINED TEMPLATES
// ======================
const PREDEFINED_TEMPLATES: LabelTemplate[] = [
    {
        id: 'tpl_bale_standard',
        name: '📦 Бейл - Стандарт',
        widthMm: 100,
        heightMm: 100,
        widthDots: 800,
        heightDots: 800,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        elements: [
            { id: 'e1', type: 'text', x: 30, y: 30, content: 'MARIJANY HEMP', fontSize: 36, fontStyle: 'bold', rotation: 0 },
            { id: 'e2', type: 'line', x: 30, y: 80, width: 740, height: 3, rotation: 0 },
            { id: 'e3', type: 'text', x: 30, y: 100, content: 'Дата:', fontSize: 24, rotation: 0 },
            { id: 'e4', type: 'variable', x: 130, y: 100, variableName: '{date}', fontSize: 32, rotation: 0 },
            { id: 'e5', type: 'text', x: 30, y: 160, content: 'Продукт:', fontSize: 24, rotation: 0 },
            { id: 'e6', type: 'variable', x: 30, y: 200, variableName: '{productName}', fontSize: 40, rotation: 0 },
            { id: 'e7', type: 'variable', x: 30, y: 250, variableName: '{productNameEn}', fontSize: 28, rotation: 0 },
            { id: 'e8', type: 'text', x: 30, y: 320, content: 'SKU:', fontSize: 24, rotation: 0 },
            { id: 'e9', type: 'variable', x: 100, y: 320, variableName: '{sku}', fontSize: 28, rotation: 0 },
            { id: 'e10', type: 'text', x: 30, y: 380, content: 'Вага:', fontSize: 30, rotation: 0 },
            { id: 'e11', type: 'variable', x: 150, y: 360, variableName: '{weight}', fontSize: 80, rotation: 0 },
            { id: 'e12', type: 'text', x: 400, y: 420, content: 'kg', fontSize: 40, rotation: 0 },
            { id: 'e13', type: 'variable', x: 500, y: 380, variableName: '{sortLabel}', fontSize: 24, rotation: 0 },
            { id: 'e14', type: 'variable', x: 500, y: 420, variableName: '{sortValue}', fontSize: 32, rotation: 0 },
            { id: 'e15', type: 'text', x: 30, y: 500, content: 'Serial:', fontSize: 24, rotation: 0 },
            { id: 'e16', type: 'variable', x: 30, y: 540, variableName: '{serialNumber}', fontSize: 36, rotation: 0 },
            { id: 'e17', type: 'barcode', x: 100, y: 600, content: '{barcode}', width: 600, barcodeHeight: 100, barcodeType: 'CODE128', rotation: 0 },
        ]
    },
    {
        id: 'tpl_bale_compact',
        name: '📦 Бейл - Компактний',
        widthMm: 58,
        heightMm: 30,
        widthDots: 464,
        heightDots: 240,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        elements: [
            { id: 'e1', type: 'variable', x: 10, y: 10, variableName: '{productName}', fontSize: 22, rotation: 0 },
            { id: 'e2', type: 'variable', x: 10, y: 35, variableName: '{date}', fontSize: 16, rotation: 0 },
            { id: 'e3', type: 'variable', x: 10, y: 60, variableName: '{weight}', fontSize: 50, rotation: 0 },
            { id: 'e4', type: 'text', x: 140, y: 80, content: 'kg', fontSize: 20, rotation: 0 },
            { id: 'e5', type: 'variable', x: 220, y: 70, variableName: '{sortValue}', fontSize: 24, rotation: 0 },
            { id: 'e6', type: 'text', x: 330, y: 10, content: '#', fontSize: 16, rotation: 0 },
            { id: 'e7', type: 'variable', x: 350, y: 10, variableName: '{serialNumber}', fontSize: 18, rotation: 0 },
            { id: 'e8', type: 'barcode', x: 50, y: 130, content: '{barcode}', width: 360, barcodeHeight: 60, barcodeType: 'CODE128', rotation: 0 },
        ]
    },
    {
        id: 'tpl_pallet',
        name: '🚛 Палета (з штрих-кодами)',
        widthMm: 100,
        heightMm: 100,
        widthDots: 800,
        heightDots: 800,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        elements: [
            // === HEADER (як у оператора) ===
            { id: 'h1', type: 'text', x: 30, y: 20, content: 'MARIJANY HEMP', fontSize: 32, fontStyle: 'bold', rotation: 0 },
            { id: 'h2', type: 'text', x: 30, y: 55, content: 'Дата:', fontSize: 18, rotation: 0 },
            { id: 'h3', type: 'variable', x: 100, y: 55, variableName: '{date}', fontSize: 22, rotation: 0 },
            { id: 'h4', type: 'variable', x: 30, y: 85, variableName: '{productName}', fontSize: 28, rotation: 0 },
            { id: 'h5', type: 'variable', x: 30, y: 115, variableName: '{productNameEn}', fontSize: 18, rotation: 0 },
            { id: 'h6', type: 'text', x: 500, y: 20, content: 'PALLET', fontSize: 24, rotation: 0 },
            { id: 'h7', type: 'text', x: 500, y: 50, content: 'SKU:', fontSize: 16, rotation: 0 },
            { id: 'h8', type: 'variable', x: 560, y: 50, variableName: '{sku}', fontSize: 20, rotation: 0 },
            // Логотип буде тут (placeholder)
            { id: 'h9', type: 'box', x: 680, y: 15, width: 100, height: 80, rotation: 0 },
            { id: 'h10', type: 'text', x: 695, y: 45, content: 'LOGO', fontSize: 18, rotation: 0 },

            { id: 'h11', type: 'line', x: 20, y: 145, width: 760, height: 2, rotation: 0 },

            // === PALLET INFO ===
            { id: 'p1', type: 'text', x: 30, y: 155, content: 'ID Палети:', fontSize: 20, rotation: 0 },
            { id: 'p2', type: 'variable', x: 180, y: 150, variableName: '{serialNumber}', fontSize: 36, rotation: 0 },
            { id: 'p3', type: 'variable', x: 500, y: 155, variableName: '{sortLabel}', fontSize: 18, rotation: 0 },
            { id: 'p4', type: 'variable', x: 600, y: 150, variableName: '{sortValue}', fontSize: 28, rotation: 0 },

            { id: 'p5', type: 'line', x: 20, y: 195, width: 760, height: 2, rotation: 0 },

            // === BALE LIST (приклад 4 бейлів в 2 колонки з компактними штрих-кодами) ===
            // Колонка 1
            { id: 'b1', type: 'text', x: 30, y: 210, content: '1. #001 25.5kg', fontSize: 16, rotation: 0 },
            { id: 'bc1', type: 'barcode', x: 30, y: 230, content: 'BALE001', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b2', type: 'text', x: 30, y: 270, content: '2. #002 24.8kg', fontSize: 16, rotation: 0 },
            { id: 'bc2', type: 'barcode', x: 30, y: 290, content: 'BALE002', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b3', type: 'text', x: 30, y: 330, content: '3. #003 26.1kg', fontSize: 16, rotation: 0 },
            { id: 'bc3', type: 'barcode', x: 30, y: 350, content: 'BALE003', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b4', type: 'text', x: 30, y: 390, content: '4. #004 25.0kg', fontSize: 16, rotation: 0 },
            { id: 'bc4', type: 'barcode', x: 30, y: 410, content: 'BALE004', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b5', type: 'text', x: 30, y: 450, content: '5. #005 24.2kg', fontSize: 16, rotation: 0 },
            { id: 'bc5', type: 'barcode', x: 30, y: 470, content: 'BALE005', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            // Колонка 2
            { id: 'b6', type: 'text', x: 410, y: 210, content: '6. #006 25.3kg', fontSize: 16, rotation: 0 },
            { id: 'bc6', type: 'barcode', x: 410, y: 230, content: 'BALE006', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b7', type: 'text', x: 410, y: 270, content: '7. #007 24.9kg', fontSize: 16, rotation: 0 },
            { id: 'bc7', type: 'barcode', x: 410, y: 290, content: 'BALE007', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b8', type: 'text', x: 410, y: 330, content: '8. #008 25.7kg', fontSize: 16, rotation: 0 },
            { id: 'bc8', type: 'barcode', x: 410, y: 350, content: 'BALE008', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b9', type: 'text', x: 410, y: 390, content: '9. #009 24.5kg', fontSize: 16, rotation: 0 },
            { id: 'bc9', type: 'barcode', x: 410, y: 410, content: 'BALE009', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            { id: 'b10', type: 'text', x: 410, y: 450, content: '10. #010 26.0kg', fontSize: 16, rotation: 0 },
            { id: 'bc10', type: 'barcode', x: 410, y: 470, content: 'BALE010', width: 350, barcodeHeight: 25, barcodeType: 'CODE128', rotation: 0 },

            // === TOTALS ===
            { id: 't1', type: 'line', x: 20, y: 520, width: 760, height: 2, rotation: 0 },
            { id: 't2', type: 'text', x: 30, y: 535, content: 'Кількість:', fontSize: 22, rotation: 0 },
            { id: 't3', type: 'variable', x: 180, y: 530, variableName: '{quantity}', fontSize: 32, rotation: 0 },
            { id: 't4', type: 'text', x: 300, y: 535, content: 'шт', fontSize: 22, rotation: 0 },
            { id: 't5', type: 'text', x: 420, y: 535, content: 'Вага:', fontSize: 22, rotation: 0 },
            { id: 't6', type: 'variable', x: 520, y: 525, variableName: '{weight}', fontSize: 40, rotation: 0 },
            { id: 't7', type: 'text', x: 700, y: 535, content: 'kg', fontSize: 22, rotation: 0 },

            // === PALLET BARCODE ===
            { id: 'pb1', type: 'barcode', x: 150, y: 580, content: '{barcode}', width: 500, barcodeHeight: 60, barcodeType: 'CODE128', rotation: 0 },

            // === FOOTER (адреса) ===
            { id: 'f1', type: 'line', x: 20, y: 660, width: 760, height: 2, rotation: 0 },
            { id: 'f2', type: 'text', x: 30, y: 675, content: '12101, Ukraine, Zhytomyr region, Zhytomyr district,', fontSize: 14, rotation: 0 },
            { id: 'f3', type: 'text', x: 30, y: 695, content: 'Khoroshivska territorial community, Buildings complex No. 18', fontSize: 14, rotation: 0 },
        ]
    },

    {
        id: 'tpl_qr_label',
        name: '📱 QR-етикетка',
        widthMm: 80,
        heightMm: 60,
        widthDots: 640,
        heightDots: 480,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        elements: [
            { id: 'e1', type: 'qrcode', x: 30, y: 30, content: '{barcode}', width: 200, height: 200, rotation: 0 },
            { id: 'e2', type: 'variable', x: 260, y: 30, variableName: '{productName}', fontSize: 28, rotation: 0 },
            { id: 'e3', type: 'variable', x: 260, y: 70, variableName: '{productNameEn}', fontSize: 20, rotation: 0 },
            { id: 'e4', type: 'line', x: 260, y: 110, width: 350, height: 2, rotation: 0 },
            { id: 'e5', type: 'variable', x: 260, y: 130, variableName: '{weight}', fontSize: 60, rotation: 0 },
            { id: 'e6', type: 'text', x: 450, y: 150, content: 'kg', fontSize: 30, rotation: 0 },
            { id: 'e7', type: 'variable', x: 260, y: 200, variableName: '{sortValue}', fontSize: 24, rotation: 0 },
            { id: 'e8', type: 'text', x: 30, y: 260, content: '#', fontSize: 24, rotation: 0 },
            { id: 'e9', type: 'variable', x: 60, y: 260, variableName: '{serialNumber}', fontSize: 28, rotation: 0 },
            { id: 'e10', type: 'variable', x: 260, y: 260, variableName: '{date}', fontSize: 24, rotation: 0 },
            { id: 'e11', type: 'line', x: 30, y: 320, width: 580, height: 2, rotation: 0 },
            { id: 'e12', type: 'barcode', x: 80, y: 350, content: '{barcode}', width: 480, barcodeHeight: 80, barcodeType: 'CODE128', rotation: 0 },
        ]
    },
    {
        id: 'tpl_minimal',
        name: '✨ Мінімальний',
        widthMm: 100,
        heightMm: 50,
        widthDots: 800,
        heightDots: 400,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        elements: [
            { id: 'e1', type: 'variable', x: 30, y: 20, variableName: '{productName}', fontSize: 36, rotation: 0 },
            { id: 'e2', type: 'variable', x: 30, y: 70, variableName: '{weight}', fontSize: 80, rotation: 0 },
            { id: 'e3', type: 'text', x: 280, y: 100, content: 'kg', fontSize: 40, rotation: 0 },
            { id: 'e4', type: 'variable', x: 400, y: 30, variableName: '{sortValue}', fontSize: 40, rotation: 0 },
            { id: 'e5', type: 'variable', x: 600, y: 30, variableName: '{serialNumber}', fontSize: 32, rotation: 0 },
            { id: 'e6', type: 'variable', x: 400, y: 90, variableName: '{date}', fontSize: 28, rotation: 0 },
            { id: 'e7', type: 'line', x: 30, y: 180, width: 740, height: 2, rotation: 0 },
            { id: 'e8', type: 'barcode', x: 100, y: 210, content: '{barcode}', width: 600, barcodeHeight: 100, barcodeType: 'CODE128', rotation: 0 },
        ]
    },
];

// ======================
// MAIN COMPONENT
// ======================
export default function LabelDesigner({ onClose, onSave, initialTemplate, printer }: LabelDesignerProps) {
    // Template state
    const [templateName, setTemplateName] = useState(initialTemplate?.name || 'Новий шаблон');
    const [widthMm, setWidthMm] = useState(initialTemplate?.widthMm || 100);
    const [heightMm, setHeightMm] = useState(initialTemplate?.heightMm || 100);
    const [elements, setElements] = useState<LabelElement[]>(initialTemplate?.elements || []);

    // UI state
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [showZplPreview, setShowZplPreview] = useState(false);
    const [showGallery, setShowGallery] = useState(!initialTemplate); // Show gallery on first open
    const [zoom, setZoom] = useState(1);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printStatus, setPrintStatus] = useState<string | null>(null);



    // Load saved templates from localStorage
    const [savedTemplates, setSavedTemplates] = useState<LabelTemplate[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('label_templates') || '[]');
        } catch {
            return [];
        }
    });

    // Load template into editor
    const loadTemplate = (template: LabelTemplate) => {
        setTemplateName(template.name);
        setWidthMm(template.widthMm);
        setHeightMm(template.heightMm);
        // Clone elements with new IDs to avoid conflicts
        setElements(template.elements.map(el => ({ ...el, id: `el_${Date.now()}_${Math.random().toString(36).slice(2)}` })));
        setShowGallery(false);
        setSelectedElementId(null);
    };

    // Delete saved template
    const deleteSavedTemplate = (id: string) => {
        const updated = savedTemplates.filter(t => t.id !== id);
        setSavedTemplates(updated);
        localStorage.setItem('label_templates', JSON.stringify(updated));
    };



    const canvasRef = useRef<HTMLDivElement>(null);

    // Calculate canvas dimensions
    const widthDots = widthMm * DOTS_PER_MM;
    const heightDots = heightMm * DOTS_PER_MM;
    const canvasScale = Math.min(500 / widthDots, 600 / heightDots) * zoom;

    // Selected element
    const selectedElement = elements.find(e => e.id === selectedElementId);

    // ======================
    // ELEMENT CRUD
    // ======================
    const addElement = (type: LabelElement['type']) => {
        const newElement: LabelElement = {
            id: `el_${Date.now()}`,
            type,
            x: 50,
            y: 50,
            fontSize: 24,
            fontStyle: 'normal',
            rotation: 0,
        };

        switch (type) {
            case 'text':
                newElement.content = 'Текст';
                newElement.width = 200;
                break;
            case 'variable':
                newElement.variableName = '{weight}';
                newElement.fontSize = 32;
                break;
            case 'barcode':
                newElement.barcodeType = 'CODE128';
                newElement.barcodeHeight = 80;
                newElement.content = '{barcode}';
                newElement.width = 300;
                break;
            case 'qrcode':
                newElement.content = '{barcode}';
                newElement.width = 100;
                newElement.height = 100;
                break;
            case 'line':
                newElement.width = 200;
                newElement.height = 2;
                break;
            case 'box':
                newElement.width = 150;
                newElement.height = 100;
                break;
        }

        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
    };

    const updateElement = (id: string, updates: Partial<LabelElement>) => {
        setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const deleteElement = (id: string) => {
        setElements(elements.filter(el => el.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
    };

    const duplicateElement = (id: string) => {
        const el = elements.find(e => e.id === id);
        if (el) {
            const newEl = { ...el, id: `el_${Date.now()}`, x: el.x + 20, y: el.y + 20 };
            setElements([...elements, newEl]);
            setSelectedElementId(newEl.id);
        }
    };

    // ======================
    // DRAG & DROP
    // ======================
    const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
        e.stopPropagation();
        const el = elements.find(el => el.id === elementId);
        if (!el) return;

        setSelectedElementId(elementId);
        setIsDragging(true);

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left - (el.x * canvasScale),
                y: e.clientY - rect.top - (el.y * canvasScale)
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedElementId || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(widthDots - 50, (e.clientX - rect.left - dragOffset.x) / canvasScale));
        const newY = Math.max(0, Math.min(heightDots - 20, (e.clientY - rect.top - dragOffset.y) / canvasScale));

        updateElement(selectedElementId, { x: Math.round(newX), y: Math.round(newY) });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // ======================
    // ZPL GENERATION
    // ======================
    const generateZPL = (): string => {
        let zpl = `^XA\n^PW${widthDots}\n^LL${heightDots}\n^CI28\n\n`;

        elements.forEach(el => {
            const rotation = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N';

            switch (el.type) {
                case 'text':
                    zpl += `^FO${el.x},${el.y}^A0${rotation},${el.fontSize},${el.fontSize}^FH^FD${el.content}^FS\n`;
                    break;
                case 'variable':
                    zpl += `^FO${el.x},${el.y}^A0${rotation},${el.fontSize},${el.fontSize}^FH^FD${el.variableName}^FS\n`;
                    break;
                case 'barcode':
                    zpl += `^FO${el.x},${el.y}^BY2\n^BCN,${el.barcodeHeight || 80},Y,N,N\n^FH^FD${el.content}^FS\n`;
                    break;
                case 'qrcode':
                    zpl += `^FO${el.x},${el.y}^BQN,2,${Math.round((el.width || 100) / 10)}\n^FDQA,${el.content}^FS\n`;
                    break;
                case 'line':
                    zpl += `^FO${el.x},${el.y}^GB${el.width},${el.height || 2},${el.height || 2}^FS\n`;
                    break;
                case 'box':
                    zpl += `^FO${el.x},${el.y}^GB${el.width},${el.height},2^FS\n`;
                    break;
            }
        });

        zpl += `^PQ1\n^XZ`;
        return zpl;
    };

    // ======================
    // SAVE
    // ======================
    const handleSave = () => {
        const template: LabelTemplate = {
            id: initialTemplate?.id || `tpl_${Date.now()}`,
            name: templateName,
            widthMm,
            heightMm,
            widthDots,
            heightDots,
            elements,
            createdAt: initialTemplate?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Save to localStorage
        const savedTemplates = JSON.parse(localStorage.getItem('label_templates') || '[]');
        const existingIndex = savedTemplates.findIndex((t: LabelTemplate) => t.id === template.id);
        if (existingIndex >= 0) {
            savedTemplates[existingIndex] = template;
        } else {
            savedTemplates.push(template);
        }
        localStorage.setItem('label_templates', JSON.stringify(savedTemplates));

        if (onSave) onSave(template);
        onClose();
    };

    // ======================
    // RENDER
    // ======================

    // GALLERY VIEW - Show template selection
    if (showGallery) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🎨</span>
                        <div>
                            <h1 className="text-xl font-bold text-white">Оберіть шаблон</h1>
                            <p className="text-sm text-slate-400">Виберіть готовий шаблон або створіть новий</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">✕</button>
                </div>

                {/* Gallery Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* New Template Button */}
                    <div className="mb-8">
                        <button
                            onClick={() => setShowGallery(false)}
                            className="bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all flex items-center gap-3"
                        >
                            <span className="text-2xl">✨</span>
                            <span>Новий порожній шаблон</span>
                        </button>
                    </div>

                    {/* Predefined Templates */}
                    <div className="mb-8">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span>📋</span> Готові шаблони
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {PREDEFINED_TEMPLATES.map(tpl => (
                                <button
                                    key={tpl.id}
                                    onClick={() => loadTemplate(tpl)}
                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl p-4 text-left transition-all group"
                                >
                                    {/* Preview Mini Canvas */}
                                    <div
                                        className="bg-white rounded mb-3 relative overflow-hidden"
                                        style={{
                                            width: '100%',
                                            paddingTop: `${(tpl.heightMm / tpl.widthMm) * 100}%`,
                                        }}
                                    >
                                        <div className="absolute inset-0 p-2 flex items-center justify-center">
                                            <div className="text-[10px] text-slate-500 text-center">
                                                {tpl.elements.length} елементів
                                            </div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{tpl.name}</div>
                                    <div className="text-xs text-slate-400 mt-1">{tpl.widthMm}×{tpl.heightMm} мм</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Saved Templates */}
                    {savedTemplates.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span>💾</span> Збережені шаблони
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {savedTemplates.map(tpl => (
                                    <div
                                        key={tpl.id}
                                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-green-500 rounded-xl p-4 text-left transition-all group relative"
                                    >
                                        <button
                                            onClick={() => loadTemplate(tpl)}
                                            className="w-full text-left"
                                        >
                                            <div
                                                className="bg-white rounded mb-3 relative overflow-hidden"
                                                style={{
                                                    width: '100%',
                                                    paddingTop: `${(tpl.heightMm / tpl.widthMm) * 100}%`,
                                                }}
                                            >
                                                <div className="absolute inset-0 p-2 flex items-center justify-center">
                                                    <div className="text-[10px] text-slate-500 text-center">
                                                        {tpl.elements.length} елементів
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="font-bold text-white group-hover:text-green-400 transition-colors">{tpl.name}</div>
                                            <div className="text-xs text-slate-400 mt-1">{tpl.widthMm}×{tpl.heightMm} мм</div>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteSavedTemplate(tpl.id); }}
                                            className="absolute top-2 right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Видалити"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex">
            {/* Left Panel - Toolbox */}
            <div className="w-64 bg-slate-800 text-white p-4 flex flex-col border-r border-slate-700 overflow-y-auto">

                <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>🎨</span>
                        <span>Редактор</span>
                    </div>
                    <button
                        onClick={() => setShowGallery(true)}
                        className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
                        title="Галерея шаблонів"
                    >
                        📋
                    </button>
                </h2>

                {/* Template Name */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Назва шаблону</label>
                    <input
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
                    />
                </div>

                {/* Size Selection */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Розмір етикетки</label>
                    <div className="grid grid-cols-2 gap-2">
                        {PRESET_SIZES.map(size => (
                            <button
                                key={size.name}
                                onClick={() => { setWidthMm(size.width); setHeightMm(size.height); }}
                                className={`text-xs py-2 rounded transition-colors ${widthMm === size.width && heightMm === size.height
                                    ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                {size.name}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <input
                            type="number"
                            value={widthMm}
                            onChange={e => setWidthMm(Number(e.target.value))}
                            className="w-1/2 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
                            placeholder="Ширина"
                        />
                        <span className="text-slate-500 self-center">×</span>
                        <input
                            type="number"
                            value={heightMm}
                            onChange={e => setHeightMm(Number(e.target.value))}
                            className="w-1/2 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
                            placeholder="Висота"
                        />
                    </div>
                </div>

                {/* Add Elements */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-2">Додати елемент</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => addElement('text')} className="bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs flex items-center gap-1">
                            <span>📝</span> Текст
                        </button>
                        <button onClick={() => addElement('variable')} className="bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs flex items-center gap-1">
                            <span>🔗</span> Змінна
                        </button>
                        <button onClick={() => addElement('barcode')} className="bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs flex items-center gap-1">
                            <span>📊</span> Barcode
                        </button>
                        <button onClick={() => addElement('qrcode')} className="bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs flex items-center gap-1">
                            <span>⬛</span> QR Code
                        </button>
                        <button onClick={() => addElement('line')} className="bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs flex items-center gap-1">
                            <span>➖</span> Лінія
                        </button>
                        <button onClick={() => addElement('box')} className="bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs flex items-center gap-1">
                            <span>⬜</span> Рамка
                        </button>
                    </div>
                </div>

                {/* Zoom */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Масштаб: {Math.round(zoom * 100)}%</label>
                    <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={zoom}
                        onChange={e => setZoom(Number(e.target.value))}
                        className="w-full"
                    />
                </div>

                {/* Elements List */}
                <div className="flex-1 overflow-y-auto">
                    <label className="block text-xs text-slate-400 mb-2">Елементи ({elements.length})</label>
                    <div className="space-y-1">
                        {elements.map(el => (
                            <div
                                key={el.id}
                                onClick={() => setSelectedElementId(el.id)}
                                className={`p-2 rounded text-xs flex justify-between items-center cursor-pointer transition-colors ${selectedElementId === el.id ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <span className="truncate">
                                    {el.type === 'text' && `📝 ${el.content}`}
                                    {el.type === 'variable' && `🔗 ${el.variableName}`}
                                    {el.type === 'barcode' && `📊 Barcode`}
                                    {el.type === 'qrcode' && `⬛ QR Code`}
                                    {el.type === 'line' && `➖ Лінія`}
                                    {el.type === 'box' && `⬜ Рамка`}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-700 space-y-2">
                    {/* Printer Status */}
                    <div className={`text-xs px-2 py-1 rounded text-center ${printer ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                        🖨️ {printer ? printer.name : 'Принтер не підключено'}
                    </div>

                    {/* Test Print Button */}
                    <button
                        onClick={async () => {
                            if (!printer) {
                                setPrintStatus('❌ Принтер не підключено!');
                                setTimeout(() => setPrintStatus(null), 3000);
                                return;
                            }
                            setIsPrinting(true);
                            setPrintStatus('⏳ Друк...');
                            try {
                                const zpl = generateZPL();
                                await zebraService.print(printer, zpl);
                                setPrintStatus('✅ Надруковано!');
                            } catch (err) {
                                setPrintStatus('❌ Помилка друку');
                                console.error(err);
                            } finally {
                                setIsPrinting(false);
                                setTimeout(() => setPrintStatus(null), 3000);
                            }
                        }}
                        disabled={isPrinting}
                        className={`w-full py-3 rounded text-sm font-bold transition-all flex items-center justify-center gap-2 ${isPrinting ? 'bg-yellow-600 animate-pulse' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        {isPrinting ? '⏳ Друкую...' : '🖨️ Тестовий друк'}
                    </button>

                    {/* Print Status */}
                    {printStatus && (
                        <div className="text-center text-sm py-1">{printStatus}</div>
                    )}

                    <button
                        onClick={() => setShowZplPreview(!showZplPreview)}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium"
                    >
                        {showZplPreview ? '← Назад до редактора' : '👁️ Переглянути ZPL'}
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
                        >
                            Скасувати
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-bold"
                        >
                            💾 Зберегти
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col bg-slate-700 overflow-hidden">
                {/* Header */}
                <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700">
                    <div className="text-white">
                        <span className="font-bold">{templateName}</span>
                        <span className="text-slate-400 ml-3">{widthMm}×{heightMm} мм ({widthDots}×{heightDots} dots)</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">✕</button>
                </div>

                {showZplPreview ? (
                    /* ZPL Preview */
                    <div className="flex-1 p-6 overflow-auto">
                        <pre className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
                            {generateZPL()}
                        </pre>
                        <button
                            onClick={() => navigator.clipboard.writeText(generateZPL())}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                            📋 Скопіювати ZPL
                        </button>
                    </div>
                ) : (
                    /* Visual Canvas */
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                        <div
                            ref={canvasRef}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onClick={() => setSelectedElementId(null)}
                            className="relative bg-white shadow-2xl"
                            style={{
                                width: widthDots * canvasScale,
                                height: heightDots * canvasScale,
                                backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
                                backgroundSize: `${10 * canvasScale}px ${10 * canvasScale}px`,
                            }}
                        >
                            {elements.map(el => (
                                <div
                                    key={el.id}
                                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                                    onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                                    className={`absolute cursor-move transition-shadow ${selectedElementId === el.id ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:ring-1 hover:ring-blue-300'}`}
                                    style={{
                                        left: el.x * canvasScale,
                                        top: el.y * canvasScale,
                                        transform: `rotate(${el.rotation || 0}deg)`,
                                    }}
                                >
                                    {el.type === 'text' && (
                                        <div style={{ fontSize: (el.fontSize || 24) * canvasScale * 0.7, fontWeight: el.fontStyle === 'bold' ? 'bold' : 'normal' }}>
                                            {el.content}
                                        </div>
                                    )}
                                    {el.type === 'variable' && (
                                        <div
                                            className="bg-blue-100 text-blue-800 px-1 rounded border border-blue-300"
                                            style={{ fontSize: (el.fontSize || 24) * canvasScale * 0.7 }}
                                        >
                                            {el.variableName}
                                        </div>
                                    )}
                                    {el.type === 'barcode' && (
                                        <div
                                            className="bg-gradient-to-r from-black via-white to-black flex items-end justify-center"
                                            style={{
                                                width: (el.width || 200) * canvasScale,
                                                height: (el.barcodeHeight || 80) * canvasScale,
                                            }}
                                        >
                                            <span className="text-xs text-black bg-white px-1">{el.content}</span>
                                        </div>
                                    )}
                                    {el.type === 'qrcode' && (
                                        <div
                                            className="bg-slate-200 flex items-center justify-center border border-slate-400"
                                            style={{
                                                width: (el.width || 100) * canvasScale,
                                                height: (el.height || 100) * canvasScale,
                                            }}
                                        >
                                            <span className="text-xs text-slate-600">QR</span>
                                        </div>
                                    )}
                                    {el.type === 'line' && (
                                        <div
                                            className="bg-black"
                                            style={{
                                                width: (el.width || 200) * canvasScale,
                                                height: Math.max(1, (el.height || 2) * canvasScale),
                                            }}
                                        />
                                    )}
                                    {el.type === 'box' && (
                                        <div
                                            className="border-2 border-black"
                                            style={{
                                                width: (el.width || 150) * canvasScale,
                                                height: (el.height || 100) * canvasScale,
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel - Properties */}
            {selectedElement && !showZplPreview && (
                <div className="w-72 bg-slate-800 text-white p-4 border-l border-slate-700 overflow-y-auto">
                    <h3 className="font-bold mb-4 flex items-center justify-between">
                        <span>⚙️ Властивості</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => duplicateElement(selectedElement.id)}
                                className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                                title="Дублювати"
                            >
                                📋
                            </button>
                            <button
                                onClick={() => deleteElement(selectedElement.id)}
                                className="p-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                                title="Видалити"
                            >
                                🗑️
                            </button>
                        </div>
                    </h3>

                    {/* Position */}
                    <div className="mb-4">
                        <label className="block text-xs text-slate-400 mb-1">Позиція (dots)</label>
                        <div className="flex gap-2">
                            <div>
                                <span className="text-[10px] text-slate-500">X</span>
                                <input
                                    type="number"
                                    value={selectedElement.x}
                                    onChange={e => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500">Y</span>
                                <input
                                    type="number"
                                    value={selectedElement.y}
                                    onChange={e => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Content (for text) */}
                    {selectedElement.type === 'text' && (
                        <div className="mb-4">
                            <label className="block text-xs text-slate-400 mb-1">Текст</label>
                            <input
                                type="text"
                                value={selectedElement.content}
                                onChange={e => updateElement(selectedElement.id, { content: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                            />
                        </div>
                    )}

                    {/* Variable Selection */}
                    {selectedElement.type === 'variable' && (
                        <div className="mb-4">
                            <label className="block text-xs text-slate-400 mb-1">Змінна</label>
                            <select
                                value={selectedElement.variableName}
                                onChange={e => updateElement(selectedElement.id, { variableName: e.target.value })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                            >
                                {AVAILABLE_VARIABLES.map(v => (
                                    <option key={v.name} value={v.name}>{v.label} ({v.name})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Font Size */}
                    {(selectedElement.type === 'text' || selectedElement.type === 'variable') && (
                        <div className="mb-4">
                            <label className="block text-xs text-slate-400 mb-1">Розмір шрифту (dots)</label>
                            <input
                                type="range"
                                min={12}
                                max={120}
                                value={selectedElement.fontSize || 24}
                                onChange={e => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                                className="w-full"
                            />
                            <div className="text-center text-sm">{selectedElement.fontSize || 24}</div>
                        </div>
                    )}

                    {/* Width & Height */}
                    {(selectedElement.type === 'line' || selectedElement.type === 'box' || selectedElement.type === 'barcode') && (
                        <div className="mb-4">
                            <label className="block text-xs text-slate-400 mb-1">Розмір (dots)</label>
                            <div className="flex gap-2">
                                <div>
                                    <span className="text-[10px] text-slate-500">W</span>
                                    <input
                                        type="number"
                                        value={selectedElement.width || 100}
                                        onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500">H</span>
                                    <input
                                        type="number"
                                        value={selectedElement.height || selectedElement.barcodeHeight || 50}
                                        onChange={e => updateElement(selectedElement.id, {
                                            height: Number(e.target.value),
                                            barcodeHeight: selectedElement.type === 'barcode' ? Number(e.target.value) : undefined
                                        })}
                                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rotation */}
                    <div className="mb-4">
                        <label className="block text-xs text-slate-400 mb-1">Обертання</label>
                        <div className="flex gap-2">
                            {[0, 90, 180, 270].map(r => (
                                <button
                                    key={r}
                                    onClick={() => updateElement(selectedElement.id, { rotation: r as 0 | 90 | 180 | 270 })}
                                    className={`flex-1 py-2 rounded text-sm ${selectedElement.rotation === r ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                                >
                                    {r}°
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Barcode Type */}
                    {selectedElement.type === 'barcode' && (
                        <div className="mb-4">
                            <label className="block text-xs text-slate-400 mb-1">Тип штрих-коду</label>
                            <select
                                value={selectedElement.barcodeType}
                                onChange={e => updateElement(selectedElement.id, { barcodeType: e.target.value as any })}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                            >
                                <option value="CODE128">Code 128</option>
                                <option value="CODE39">Code 39</option>
                                <option value="EAN13">EAN-13</option>
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
