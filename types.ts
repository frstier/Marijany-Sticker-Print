// Basic Product Types
export type ProductCategory = 'fiber' | 'shiv' | 'dust';

export type UserRole = 'accountant' | 'lab' | 'agro' | 'admin' | 'operator' | 'report' | 'postgres_user';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}


export interface Product {
  id: string;
  name: string;
  name_en?: string;
  sku: string;
  category: ProductCategory;
  sorts?: string[];
}

export interface LabelData {
  id?: string; // Added for unique identification
  product: Product | null;
  weight: string;
  serialNumber: number;
  date: string;
  sortLabel?: string;
  sortValue?: string;
  barcode?: string; // EXACT generated barcode string
  timestamp?: string;
  status?: 'ok' | 'error' | 'cancelled' | 'deferred';
  operatorId?: string; // Track who printed this
  operatorName?: string; // For reports
  shiftId?: string; // Optional link to shift
  // Deprecated: sort?: string;
}

// Global definition for the Zebra SDK object attached to window
declare global {
  interface Window {
    BrowserPrint: any;
    Zebra: any; // Added Zebra global namespace
    bluetoothSerial?: any; // Cordova plugin global
  }
}

// Minimal Web Bluetooth Types
interface BluetoothRemoteGATTCharacteristic {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    read: boolean;
  };
  writeValue: (value: BufferSource) => Promise<void>;
  readValue: () => Promise<DataView>;
}

interface BluetoothRemoteGATTService {
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  device: {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  };
  connect: () => Promise<BluetoothRemoteGATTServer>;
  getPrimaryServices: () => Promise<BluetoothRemoteGATTService[]>;
}

interface Navigator {
  bluetooth: {
    requestDevice(options: {
      filters?: Array<{ namePrefix?: string, name?: string, services?: Array<string | number> }>;
      optionalServices?: Array<string | number>;
      acceptAllDevices?: boolean;
    }): Promise<{
      id: string;
      name?: string;
      gatt?: BluetoothRemoteGATTServer;
    }>;
  };
}

declare module 'capacitor-zebra-printer';

export interface ZebraDevice {
  uid: string;
  name: string;
  connection: string;
  deviceType: string;
  version: string | number;
  manufacturer: string;
  provider: string;
  // The official SDK device object has methods attached to it
  send?: (data: string, success?: any, error?: any) => void;
  read?: (success?: any, error?: any) => void;
  // For Web Bluetooth
  gattServer?: BluetoothRemoteGATTServer;
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