import { Capacitor } from '@capacitor/core';
// import { CapacitorZebraPrinter } from 'capacitor-zebra-printer'; // Dynamically imported
import { ZebraDevice } from '../types';

/**
 * Service Wrapper for Zebra Printing.
 * Supports:
 * 1. Web (Desktop): Uses official Zebra Browser Print SDK.
 * 2. Native (Android/iOS): Uses 'capacitor-zebra-printer' plugin or 'cordova-plugin-bluetooth-serial'
 */
class ZebraService {

  private isNative = Capacitor.isNativePlatform();

  // Web Bluetooth Config
  // Standard Zebra UUIDs used for Serial Port Service usually
  // Or generic Serial Port Profile UUID: 00001101-0000-1000-8000-00805F9B34FB (Classic) - Web Bluetooth mostly supports BLE
  // For BLE Zebra often uses specific services.
  // We will try to filter by name prefix "Hi" or "Zebra" or generic services
  // NOTE: Web Bluetooth requires HTTPS and User Interaction.
  private ZEBRA_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'; // Example Generic Service or specific Zebra BLE
  // Actually, many Zebra generic BLE printers use a specific proprietary service or just standard Write/Read characteristics.
  // Ideally we should list all services or use acceptAllDevices: true (but requires at least one service in optionalServices)

  public async requestBluetoothDevice(): Promise<ZebraDevice> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth API is not available (Require HTTPS & Chrome).");
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        // acceptAllDevices: true, // Optional: if we want to show all
        filters: [
          { namePrefix: 'Zebra' },
          { namePrefix: 'XX' }, // Example placeholders
          { namePrefix: 'Printer' }
        ],
        optionalServices: ['generic_access', 0x18f0] // Add checks for services
        // Note: For real Zebra BLE, we often need the specific UUID key.
        // If the user's printer is Classic Bluetooth, Web Bluetooth API (GATT) might NOT work on Desktop Chrome
        // as Chrome only supports BLE (Bluetooth Low Energy) reliably, not BR/EDR.
        // However, let's assume they have a modern BLE supported Zebra or we try.
      });

      if (!device || !device.gatt) {
        throw new Error("Bluetooth Device selected but no GATT server found.");
      }

      const server = await device.gatt.connect();

      // Construct a ZebraDevice object
      const zebraDev: ZebraDevice = {
        uid: device.id,
        name: device.name || 'Bluetooth Printer',
        connection: 'bluetooth_direct',
        deviceType: 'printer',
        manufacturer: 'Zebra',
        provider: 'WebBluetooth',
        version: '1.0',
        gattServer: server // Store the server connection
      };

      return zebraDev;
    } catch (e: any) {
      console.error("Bluetooth pairing failed", e);
      throw new Error(e.message || "Pairing Cancelled");
    }
  }

  private async printViaWebBluetooth(device: ZebraDevice, zpl: string): Promise<boolean> {
    try {
      if (!device.gattServer || !device.gattServer.connected) {
        // Reconnect if needed
        if (device.gattServer && device.gattServer.device && device.gattServer.device.gatt) {
          device.gattServer = await device.gattServer.device.gatt.connect();
        } else {
          throw new Error("Bluetooth Disconnected. Please pair again.");
        }
      }

      const server = device.gattServer;
      const services = await server.getPrimaryServices();

      // Find a writable characteristic. 
      // Zebra BLE often has a "Write" characteristic.
      let charToUse: BluetoothRemoteGATTCharacteristic | null = null;

      for (const s of services) {
        const chars = await s.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            charToUse = c;
            break;
          }
        }
        if (charToUse) break;
      }

      if (!charToUse) {
        throw new Error("No writable characteristic found on this printer.");
      }

      // Chunk the ZPL data (Max MTU is often small ~20 or 512 bytes)
      const encoder = new TextEncoder();
      const data = encoder.encode(zpl);

      const CHUNK_SIZE = 100; // Safe-ish limit for BLE
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await charToUse.writeValue(chunk);
      }

      return true;
    } catch (e) {
      console.error("Bluetooth print failed", e);
      return false;
    }
  }

  /**
   * Waits for the SDK to be available on the window object (Web only).
   */
  private async waitForSdk(timeoutMs = 3000): Promise<boolean> {
    if (this.isNative) return true; // Native doesn't need BrowserPrint SDK

    if (typeof window !== 'undefined' && window.BrowserPrint) {
      return true;
    }

    console.log("Waiting for Zebra SDK to initialize...");
    const startTime = Date.now();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.BrowserPrint) {
          console.log("Zebra SDK detected!");
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          console.error("Zebra SDK wait timeout. BrowserPrint is undefined.");
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Gets the default printer.
   * Native: Returns the first discovered printer or null.
   * Web: Returns the default configured printer from BrowserPrint.
   */
  async getDefaultPrinter(): Promise<ZebraDevice> {
    if (this.isNative) {
      // Since discovery is not supported, we cannot auto-detect default.
      // Returning mocked 'Manual' printer if user set one, or error.
      throw new Error("Автопошук не працює. Будь ласка, додайте принтер вручну в налаштуваннях.");
    }

    // WEB Logic
    const isLoaded = await this.waitForSdk();
    if (!isLoaded) throw new Error("Бібліотека Zebra SDK не ініціалізувалась. Оновіть сторінку.");

    return new Promise((resolve, reject) => {
      try {
        window.BrowserPrint.getDefaultDevice(
          "printer",
          (device: ZebraDevice) => {
            if (device && device.name) {
              console.log("Default Printer found:", device.name);
              resolve(device);
            } else {
              reject(new Error("Принтер за замовчуванням не знайдено"));
            }
          },
          (error: any) => {
            console.error("SDK getDefaultDevice Error:", error);
            reject(new Error("Zebra Browser Print не відповідає."));
          }
        );
      } catch (e: any) {
        console.error("SDK Exception:", e);
        reject(new Error(e.message || "Unknown SDK Error"));
      }
    });
  }

  /**
   * Internal helper to scan for a specific type (Web Only)
   */
  private async getDevicesByType(type: string): Promise<ZebraDevice[]> {
    return new Promise((resolve) => {
      try {
        window.BrowserPrint.getLocalDevices(
          (deviceList: ZebraDevice[]) => {
            resolve(deviceList || []);
          },
          (error: any) => {
            console.warn(`SDK getLocalDevices Error [${type}]:`, error);
            resolve([]);
          },
          type
        );
      } catch (e) {
        console.warn(`Exception calling getLocalDevices [${type}]:`, e);
        resolve([]);
      }
    });
  }

  /**
   * Aggregates devices.
   */
  async getAllPrinters(): Promise<ZebraDevice[]> {
    if (this.isNative) {
      console.log("Native Discovery: Scanning Bluetooth...");
      return new Promise((resolve) => {
        if (!window.bluetoothSerial) {
          console.error("bluetoothSerial plugin missing!");
          resolve([]);
          return;
        }

        window.bluetoothSerial.list(
          (bonded: any[]) => {
            const devices: ZebraDevice[] = bonded.map((d: any) => ({
              uid: d.address,
              name: d.name,
              connection: 'bluetooth_classic',
              deviceType: 'printer',
              manufacturer: 'Zebra',
              provider: 'NativeBluetooth',
              version: '1.0'
            }));
            resolve(devices);
          },
          (err: any) => {
            console.error("Native Bluetooth List Failed:", err);
            resolve([]);
          }
        );
      });
    }

    // WEB Logic
    const isLoaded = await this.waitForSdk();
    if (!isLoaded) throw new Error("Бібліотека Zebra SDK не завантажилася.");

    console.log("Scanning for all printer types...");
    const types = ['printer', 'usb', 'net', 'bt'];
    const seenUids = new Set<string>();
    const allDevices: ZebraDevice[] = [];

    for (const type of types) {
      const devices = await this.getDevicesByType(type);
      for (const d of devices) {
        if (!seenUids.has(d.uid)) {
          seenUids.add(d.uid);
          if (!d.connection) d.connection = type;
          allDevices.push(d);
        }
      }
    }
    return allDevices;
  }

  /**
   * Sends ZPL code to the printer.
   */
  async print(device: ZebraDevice, zpl: string): Promise<boolean> {
    if (this.isNative) {
      try {
        console.log("Printing Native to:", device.uid);
        const { CapacitorZebraPrinter } = await import('capacitor-zebra-printer');

        if (device.connection === 'bluetooth_classic') {
          // ... Bluetooth Logic (omitted for brevity, assume unchanged) ...
          return new Promise((resolve) => {
            if (!window.bluetoothSerial) { resolve(false); return; }
            // ...
            window.bluetoothSerial.isConnected(
              () => { window.bluetoothSerial.write(zpl, () => resolve(true), () => resolve(false)); },
              () => { window.bluetoothSerial.connect(device.uid, () => window.bluetoothSerial.write(zpl, () => resolve(true), () => resolve(false)), () => resolve(false)); }
            );
          });
        }

        // Direct LAN / Network Logic
        if (device.connection === 'net' || device.provider === 'Manual') {
          console.log("Direct LAN Print to:", device.uid);
          await CapacitorZebraPrinter.print({
            ip: device.uid,
            port: 9100,
            zpl: zpl
          } as any);
          return true;
        }

        // Fallback / Generic
        const res = await CapacitorZebraPrinter.print({
          value: zpl,
          zpl: zpl,
          address: device.uid, // Might be MAC or IP
          ip: device.uid,
          port: 9100
        } as any);

        console.log("Native Print Result:", res);
        return true;
      } catch (e) {
        console.error("Native Print Error:", e);
        return false;
      }
    }

    // WEB Logic: Check for direct Bluetooth connection
    if (device.connection === 'bluetooth_direct' && device.gattServer) {
      return this.printViaWebBluetooth(device, zpl);
    }

    // VIRTUAL PRINTER (Test Mode)
    if (device.connection === 'virtual') {
      console.log(`[VIRTUAL PRINTER] Printing: ${zpl.substring(0, 50)}...`);
      // Simulate delay
      await new Promise(r => setTimeout(r, 500));
      return true;
    }

    // WEB Logic
    const isLoaded = await this.waitForSdk();
    if (!isLoaded || !device) return false;

    return new Promise((resolve) => {
      try {
        let sdkDevice = device;
        if ((!device.send || typeof device.send !== 'function') && window.BrowserPrint) {
          // @ts-ignore
          sdkDevice = new window.BrowserPrint.Device(device);
        }

        if (!sdkDevice.send) {
          console.error("Device object missing send method");
          resolve(false);
          return;
        }

        sdkDevice.send(
          zpl,
          (success: any) => {
            console.log("Print sent successfully");
            resolve(true);
          },
          (error: any) => {
            console.error("Print failed:", error);
            resolve(false);
          }
        );
      } catch (e) {
        console.error("Print exception:", e);
        resolve(false);
      }
    });
  }

  /**
   * Converts an image URL to a ZPL ^GFA command string.
   */
  async convertImageToZPL(imageUrl: string, options: { width: number, height: number, threshold?: number }): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not supported'));
          return;
        }

        // Set dimensions (resizing the image)
        canvas.width = options.width;
        canvas.height = options.height;

        // Draw image (scaling it)
        ctx.drawImage(img, 0, 0, options.width, options.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, options.width, options.height);
        const data = imageData.data;

        // Convert to monochrome 1-bit
        let binaryString = "";
        const threshold = options.threshold || 128;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Average for grayscale
          const avg = (r + g + b) / 3;
          // If dark enough -> 1 (print), else 0
          binaryString += avg < threshold ? "1" : "0";
        }

        // Pack bits into Hex bytes
        // Width in bytes (rounded up)
        const widthBytes = Math.ceil(options.width / 8);
        let hexBody = "";
        let totalBytes = 0;

        for (let h = 0; h < options.height; h++) {
          // Processing row by row
          for (let w = 0; w < widthBytes; w++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelIndex = (h * options.width) + (w * 8) + bit;
              if (pixelIndex < (h + 1) * options.width) {
                if (binaryString[pixelIndex] === '1') {
                  byte |= (1 << (7 - bit));
                }
              }
            }
            hexBody += byte.toString(16).padStart(2, '0').toUpperCase();
            totalBytes++;
          }
        }

        // Construct ^GFA command
        const command = `^GFA,${totalBytes},${totalBytes},${widthBytes},${hexBody}`;
        resolve(command);
      };
      img.onerror = (err) => reject(err);
      img.src = imageUrl;
    });
  }

  /**
   * Helper to encode strings to ZPL Hex format (^FH is required in template).
   * Example: "А" (UTF-8 bytes D0 90) -> "_D0_90"
   */
  private toZplHex(input: string): string {
    if (!input) return "";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);
    let hexStr = "";
    for (let i = 0; i < bytes.length; i++) {
      // ZPL Hex uses underscore prefix like _20 for space
      hexStr += "_" + bytes[i].toString(16).toUpperCase().padStart(2, "0");
    }
    return hexStr;
  }

  /**
   * Public helper to generate the barcode string based on pattern and data.
   * Useful for saving the exact same barcode to DB that was printed.
   */
  formatBarcode(pattern: string, data: {
    date: string;
    sku: string;
    serialNumber: string;
    weight: string;
    productName: string;
  }): string {
    let result = pattern || '{date}-{sku}-{serialNumber}-{weight}';
    result = result.split('{date}').join(data.date);
    result = result.split('{sku}').join(data.sku);
    result = result.split('{serialNumber}').join(data.serialNumber);
    result = result.split('{weight}').join(data.weight);
    result = result.split('{productName}').join(data.productName);
    return result;
  }

  generateZPL(template: string, data: {
    date: string;
    productName: string;
    productNameEn?: string;
    sku: string;
    weight: string;
    serialNumber: string;
    sortLabel?: string;
    sortValue?: string;
    quantity?: number;
    logoZpl?: string;
    barcodePattern?: string
  }): string {
    let zpl = template;

    // Use custom pattern or default to Date-SKU-Batch-Weight
    const pattern = data.barcodePattern || '{date}-{sku}-{serialNumber}-{weight}';

    // Generate barcode content using shared logic
    const barcodeValueRaw = this.formatBarcode(pattern, {
      date: data.date,
      sku: data.sku,
      serialNumber: data.serialNumber,
      weight: data.weight,
      productName: data.productName
    });

    // Encode Values for Safer Transport (Cyrillic Fix)
    // We assume templates now have ^FH before each ^FD for these fields
    const dateHex = this.toZplHex(data.date);
    const productHex = this.toZplHex(data.productName);
    const productEnHex = this.toZplHex(data.productNameEn || '');
    const skuHex = this.toZplHex(data.sku);
    const weightHex = this.toZplHex(data.weight);
    const serialHex = this.toZplHex(data.serialNumber);
    const sortLabelHex = this.toZplHex(data.sortLabel || 'Sort');
    const sortValueHex = this.toZplHex(data.sortValue || '');
    const barcodeHex = this.toZplHex(barcodeValueRaw);

    // Replace all occurrences in template using HEX values
    zpl = zpl.split('{date}').join(dateHex);
    zpl = zpl.split('{productName}').join(productHex);
    zpl = zpl.split('{productNameEn}').join(productEnHex);
    zpl = zpl.split('{sku}').join(skuHex);
    zpl = zpl.split('{weight}').join(weightHex);
    zpl = zpl.split('{serialNumber}').join(serialHex);
    zpl = zpl.split('{barcode}').join(barcodeHex);

    // Dynamic Sort/Fraction Label & Value
    zpl = zpl.split('{sortLabel}').join(sortLabelHex);
    zpl = zpl.split('{sortValue}').join(sortValueHex);

    // Quantity (Not encoded, just number)
    zpl = zpl.split('{quantity}').join(data.quantity ? data.quantity.toString() : '1');

    // Logo (if provided, else remove placeholder) - Logo is usually already hex data, so no encoding needed unless it's text
    zpl = zpl.split('{logo}').join(data.logoZpl || '');

    return zpl;
  }
}

export const zebraService = new ZebraService();