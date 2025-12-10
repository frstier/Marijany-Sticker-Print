import { ZebraDevice } from '../types';

/**
 * Service Wrapper for the official Zebra Browser Print SDK.
 * Assumes SDK is loaded globally via index.html
 */
class ZebraService {
  
  /**
   * Waits for the SDK to be available on the window object.
   * Retries for up to 3 seconds.
   */
  private async waitForSdk(timeoutMs = 3000): Promise<boolean> {
    // Immediate check
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
   * Gets the default printer using the official SDK.
   */
  async getDefaultPrinter(): Promise<ZebraDevice> {
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
                reject(new Error("Zebra Browser Print не відповідає. Перевірте, чи запущена програма на ПК."));
            }
        );
      } catch (e: any) {
          console.error("SDK Exception:", e);
          reject(new Error(e.message || "Unknown SDK Error"));
      }
    });
  }

  /**
   * Internal helper to scan for a specific type
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
                resolve([]); // Resolve empty array on error to allow other types to proceed
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
   * Aggregates devices from all connection types (printer, usb, net, bt)
   */
  async getAllPrinters(): Promise<ZebraDevice[]> {
    const isLoaded = await this.waitForSdk();
    if (!isLoaded) throw new Error("Бібліотека Zebra SDK не завантажилася.");

    console.log("Scanning for all printer types...");
    const types = ['printer', 'usb', 'net', 'bt'];
    const seenUids = new Set<string>();
    const allDevices: ZebraDevice[] = [];

    // Run scans in parallel for speed, or sequential if SDK demands it.
    // Sequential is safer for the Browser Print service.
    for (const type of types) {
        const devices = await this.getDevicesByType(type);
        for (const d of devices) {
            if (!seenUids.has(d.uid)) {
                seenUids.add(d.uid);
                // Tag the connection type if missing (though device object usually has it)
                if (!d.connection) d.connection = type;
                allDevices.push(d);
            }
        }
    }

    console.log("Total unique devices found:", allDevices.length);
    return allDevices;
  }

  /**
   * Sends ZPL code to the printer.
   */
  async print(device: ZebraDevice, zpl: string): Promise<boolean> {
    const isLoaded = await this.waitForSdk();
    if (!isLoaded || !device) return false;

    return new Promise((resolve) => {
      try {
        // Construct the device object manually if methods are missing (sometimes happens with serialized objects)
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

  generateZPL(template: string, data: { date: string; productName: string; sku: string; weight: string; serialNumber: string }): string {
    let zpl = template;
    // Replace all occurrences
    zpl = zpl.split('{date}').join(data.date);
    zpl = zpl.split('{productName}').join(data.productName);
    zpl = zpl.split('{sku}').join(data.sku);
    zpl = zpl.split('{weight}').join(data.weight);
    zpl = zpl.split('{serialNumber}').join(data.serialNumber);
    return zpl;
  }
}

export const zebraService = new ZebraService();