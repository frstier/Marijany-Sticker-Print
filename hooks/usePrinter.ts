import { useState, useEffect } from 'react';
import { ZebraDevice, PrinterStatus } from '../types';
import { zebraService } from '../services/zebraService';

const SAVED_PRINTER_CONFIG_KEY = 'zebra_printer_config_v1';
const SAVED_AGENT_IP_KEY = 'zebra_agent_ip';

export function usePrinter() {
    const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(PrinterStatus.DISCONNECTED);
    const [printer, setPrinter] = useState<ZebraDevice | null>(null);
    const [discoveredPrinters, setDiscoveredPrinters] = useState<ZebraDevice[]>([]);
    const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
    const [agentIp, setAgentIp] = useState("127.0.0.1");

    // Load IP config
    useEffect(() => {
        const savedIp = localStorage.getItem(SAVED_AGENT_IP_KEY);
        if (savedIp) setAgentIp(savedIp);
    }, []);

    // Connect Printer on Mount
    useEffect(() => {
        autoConnectPrinter();
    }, []);

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
            localStorage.setItem(SAVED_PRINTER_CONFIG_KEY, JSON.stringify(device));
        } catch (error: any) {
            setPrinterStatus(PrinterStatus.ERROR);
        }
    };

    const searchPrinters = async () => {
        setIsSearchingPrinters(true);
        setDiscoveredPrinters([]);

        // Initialize with default or empty list
        let devices: ZebraDevice[] = [];

        try {
            // Try to find real printers
            devices = await zebraService.getAllPrinters();
        } catch (e) {
            console.warn("Real printer search failed (likely SDK missing), continuing with Virtual.", e);
        }

        // Add Virtual Printer for Testing (ALWAYS)
        devices.push({
            uid: 'virtual_printer_001',
            name: 'Virtual Test Printer',
            connection: 'virtual',
            deviceType: 'printer',
            manufacturer: 'Zebra (Sim)',
            provider: 'Virtual',
            version: '1.0'
        });

        setDiscoveredPrinters(devices);

        // Only alert if REALLY empty (which shouldn't happen with virtual)
        if (devices.length === 0) {
            alert(`Принтери не знайдено.`);
        }
    };

    const fixSsl = () => {
        const url = `https://${agentIp}:9101/ssl_support`;
        window.open(url, '_blank');
    };

    const selectPrinter = (device: ZebraDevice) => {
        setPrinter(device);
        setPrinterStatus(PrinterStatus.CONNECTED);
        localStorage.setItem(SAVED_PRINTER_CONFIG_KEY, JSON.stringify(device));
        setDiscoveredPrinters([]);
    };

    return {
        printer,
        printerStatus,
        discoveredPrinters,
        isSearchingPrinters,
        agentIp,
        setAgentIp,
        saveAgentIp,
        searchPrinters,
        selectPrinter,
        fixSsl,
        autoConnectPrinter,
        connectBluetooth: async () => {
            try {
                const device = await zebraService.requestBluetoothDevice();
                selectPrinter(device);
            } catch (e: any) {
                alert("Bluetooth Error: " + e.message);
            }
        }
    };
}
