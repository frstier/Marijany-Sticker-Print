/**
 * PNG to ZPL GRF Converter
 * Converts PNG images to ZPL ~DG (Download Graphic) format for Zebra printers
 */

// Cache for converted images to avoid re-processing
const imageCache: Map<string, string> = new Map();

/**
 * Convert an image URL/path to ZPL GRF format
 * @param imageSrc - Image path or URL (e.g., '/logo_bw.png')
 * @param targetWidth - Target width in dots (optional, will scale proportionally)
 * @param targetHeight - Target height in dots (optional)
 * @returns Promise<string> - ZPL ~DG command string
 */
export async function imageToZplGrf(
    imageSrc: string,
    targetWidth?: number,
    targetHeight?: number
): Promise<string> {
    // Check cache first
    const cacheKey = `${imageSrc}_${targetWidth}_${targetHeight}`;
    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey)!;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            try {
                // Calculate dimensions
                let width = targetWidth || img.width;
                let height = targetHeight || img.height;

                // ZPL requires width to be multiple of 8
                width = Math.ceil(width / 8) * 8;

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d')!;

                // Fill white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);

                // Draw image scaled to target size
                ctx.drawImage(img, 0, 0, width, height);

                // Get pixel data
                const imageData = ctx.getImageData(0, 0, width, height);
                const pixels = imageData.data;

                // Convert to monochrome hex
                let hexString = '';
                const bytesPerRow = Math.ceil(width / 8);
                const totalBytes = bytesPerRow * height;

                for (let y = 0; y < height; y++) {
                    for (let byteIndex = 0; byteIndex < bytesPerRow; byteIndex++) {
                        let byte = 0;
                        for (let bit = 0; bit < 8; bit++) {
                            const x = byteIndex * 8 + bit;
                            if (x < width) {
                                const pixelIndex = (y * width + x) * 4;
                                const r = pixels[pixelIndex];
                                const g = pixels[pixelIndex + 1];
                                const b = pixels[pixelIndex + 2];
                                // Convert to grayscale and threshold
                                const gray = (r + g + b) / 3;
                                // In ZPL, 1 = black, 0 = white (inverted from typical)
                                if (gray < 128) {
                                    byte |= (1 << (7 - bit));
                                }
                            }
                        }
                        hexString += byte.toString(16).toUpperCase().padStart(2, '0');
                    }
                }

                // Create ZPL command
                // Format: ~DGR:name,totalBytes,bytesPerRow,hexData
                const graphicName = `R:IMG${Date.now().toString(36).toUpperCase()}`;
                const zplCommand = `~DG${graphicName},${totalBytes},${bytesPerRow},${hexString}`;

                // Return both the download command and the reference command
                const result = {
                    download: zplCommand,
                    reference: `^XGR:${graphicName.split(':')[1]},1,1^FS`,
                    name: graphicName.split(':')[1]
                };

                // For simplicity, we'll use inline graphic format with ^GFA
                // ^GFA,<total>,<rows>,<bytes_per_row>,<data>
                const gfaCommand = `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexString}`;

                // Cache the result
                imageCache.set(cacheKey, gfaCommand);

                resolve(gfaCommand);
            } catch (err) {
                reject(err);
            }
        };

        img.onerror = () => {
            reject(new Error(`Failed to load image: ${imageSrc}`));
        };

        img.src = imageSrc;
    });
}

/**
 * Preload and cache an image for ZPL conversion
 */
export async function preloadImageForZpl(imageSrc: string, width?: number, height?: number): Promise<void> {
    await imageToZplGrf(imageSrc, width, height);
}

/**
 * Get cached ZPL for an image (returns empty string if not cached)
 */
export function getCachedImageZpl(imageSrc: string, width?: number, height?: number): string {
    const cacheKey = `${imageSrc}_${width}_${height}`;
    return imageCache.get(cacheKey) || '';
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
    imageCache.clear();
}
