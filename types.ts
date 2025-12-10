export type ProductCategory = 'fiber' | 'shiv' | 'dust';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
}

export interface LabelData {
  product: Product | null;
  weight: string;
  serialNumber: number;
  date: string;
}

// Global definition for the Zebra SDK object attached to window
declare global {
  interface Window {
    BrowserPrint: any;
    Zebra: any; // Added Zebra global namespace
  }
}

export interface ZebraDevice {
  uid: string;
  name: string;
  connection: string;
  deviceType: string;
  version: number;
  manufacturer: string;
  provider: string;
  // The official SDK device object has methods attached to it
  send?: (data: string, success?: any, error?: any) => void;
  read?: (success?: any, error?: any) => void;
}

export enum PrinterStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface LabelPreviewStyles {
  containerPadding: string;
  titleSize: string;
  textSize: string;
  productSize: string;
  weightSize: string;
  weightLabelSize: string;
  barcodeHeight: number;
}

export interface LabelSizeConfig {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  template: string;
  cssAspectRatio: string;
  previewStyles: LabelPreviewStyles;
}