import { Capacitor } from '@capacitor/core';
import { CapacitorZebraPrinter } from 'capacitor-zebra-printer';
import { ZebraDevice } from '../types';

/**
 * Service Wrapper for Zebra Printing.
 * Supports:
 * 1. Web (Desktop): Uses official Zebra Browser Print SDK.
 * 2. Native (Android/iOS): Uses 'capacitor-zebra-printer' plugin.
 */
class ZebraService {

  private isNative = Capacitor.isNativePlatform();

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
      // Native Discovery - Plugin v0.2.0 does not support auto-discovery.
      // We will rely on manual entry or future implementation.
      console.warn("Native discovery not supported by current plugin.");
      return [];
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
        // Plugin v0.2.0 print takes specific options. 
        // We cast to any to avoid build errors if types are missing/incorrect.
        const res = await CapacitorZebraPrinter.print({
          value: zpl, // Some versions use 'value'
          zpl: zpl,   // Others use 'zpl'
          address: device.uid,
          ip: device.uid, // Try passing UID as IP if it's network
          port: 9100      // Default zebra port
        } as any);

        console.log("Native Print Result:", res);
        return true;
      } catch (e) {
        console.error("Native Print Error:", e);
        return false;
      }
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

  generateZPL(template: string, data: { date: string; productName: string; sku: string; weight: string; serialNumber: string; sortLabel?: string; sortValue?: string; quantity?: number; logoZpl?: string; barcodePattern?: string }): string {
    let zpl = template;

    // Use custom pattern or default to Date-SKU-Batch-Weight
    const pattern = data.barcodePattern || '{date}-{sku}-{serialNumber}-{weight}';

    let barcodeValue = pattern;
    barcodeValue = barcodeValue.split('{date}').join(data.date);
    barcodeValue = barcodeValue.split('{sku}').join(data.sku);
    barcodeValue = barcodeValue.split('{serialNumber}').join(data.serialNumber);
    barcodeValue = barcodeValue.split('{weight}').join(data.weight);
    barcodeValue = barcodeValue.split('{productName}').join(data.productName);

    // Replace all occurrences in template
    zpl = zpl.split('{date}').join(data.date);
    zpl = zpl.split('{productName}').join(data.productName);
    zpl = zpl.split('{sku}').join(data.sku);
    zpl = zpl.split('{weight}').join(data.weight);
    zpl = zpl.split('{serialNumber}').join(data.serialNumber);
    zpl = zpl.split('{barcode}').join(barcodeValue);

    // Dynamic Sort/Fraction Label & Value
    zpl = zpl.split('{sortLabel}').join(data.sortLabel || 'Sort');
    zpl = zpl.split('{sortValue}').join(data.sortValue || '');

    // Quantity
    zpl = zpl.split('{quantity}').join(data.quantity ? data.quantity.toString() : '1');

    // Logo (if provided, else remove placeholder)
    zpl = zpl.split('{logo}').join(data.logoZpl || '');

    return zpl;
  }
}

export const zebraService = new ZebraService();