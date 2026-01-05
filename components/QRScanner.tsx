import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan }) => {
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const startScanner = async () => {
            try {
                setError(null);
                setIsScanning(true);

                scannerRef.current = new Html5Qrcode('qr-reader');

                await scannerRef.current.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        // Success callback
                        console.log('📱 Scanned:', decodedText);
                        onScan(decodedText);
                        stopScanner();
                        onClose();
                    },
                    (errorMessage) => {
                        // Error callback (ignore - this fires constantly while scanning)
                    }
                );
            } catch (err: any) {
                console.error('QR Scanner Error:', err);
                setError(err.message || 'Не вдалося запустити камеру');
                setIsScanning(false);
            }
        };

        const stopScanner = async () => {
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) {
                    console.error('Stop scanner error:', e);
                }
                scannerRef.current = null;
            }
            setIsScanning(false);
        };

        startScanner();

        return () => {
            stopScanner();
        };
    }, [isOpen, onScan, onClose]);

    const handleClose = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (e) {
                console.error('Stop scanner error:', e);
            }
            scannerRef.current = null;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
                    <div className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📷 QR/Штрих-код Сканер
                    </div>
                    <button onClick={handleClose} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="p-4" ref={containerRef}>
                    {error ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4">⚠️</div>
                            <div className="text-red-500 mb-4">{error}</div>
                            <p className="text-sm text-[var(--text-muted)]">
                                Переконайтесь, що ви надали дозвіл на використання камери.
                            </p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div
                                id="qr-reader"
                                className="rounded-xl overflow-hidden"
                                style={{ width: '100%' }}
                            />
                            {isScanning && (
                                <div className="mt-4 text-center text-sm text-[var(--text-secondary)]">
                                    Наведіть камеру на QR-код або штрих-код
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] shrink-0">
                    <button
                        onClick={handleClose}
                        className="w-full py-3 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-hover)] transition-colors"
                    >
                        Закрити
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRScanner;
