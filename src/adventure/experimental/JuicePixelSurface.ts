// A small material palette eliminates vector antialiasing between pixel clusters.
const PALETTE = ['200b32','170c29','41105f','52155e','65118e','75209b','9022be','a72bcb',
    'b738c8','c449e0','dc80f4','ef91fa','fff0ff','ffeaa0','ffcd73','d433b6','f44380','a32aae','fb76b5'];
const RGB = PALETTE.map(hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)));
const nearest = new Int16Array(32768).fill(-1);

export function pixelateJuice(data: Uint8ClampedArray) {
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 112) { data[i + 3] = 0; continue; }
        const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
        let index = nearest[key];
        if (index < 0) {
            let distance = Infinity;
            // Quantized bin centers keep palette lookup independent of draw order.
            const r = (data[i] & 248) + 4, g = (data[i + 1] & 248) + 4, b = (data[i + 2] & 248) + 4;
            for (let j = 0; j < RGB.length; j++) {
                const color = RGB[j], d = (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2;
                if (d < distance) { index = j; distance = d; }
            }
            nearest[key] = index;
        }
        const color = RGB[index];
        data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
    }
}

interface Surface { canvas: OffscreenCanvas; context: CanvasRenderingContext2D; }
const surfaces = new WeakMap<CanvasRenderingContext2D, Surface>();

/** Rasterize in world pixels BEFORE any cinematic enlargement or screen scaling. */
export function drawJuicePixelBody(c: CanvasRenderingContext2D, center: number, feet: number,
    paint: (pixel: CanvasRenderingContext2D) => void, width = 38, height = 40) {
    if (typeof OffscreenCanvas === 'undefined') { paint(c); return; }
    const w = Math.ceil(width * 2) + 4, h = Math.ceil(height * 1.3) + 12;
    let surface = surfaces.get(c);
    if (!surface) {
        const canvas = new OffscreenCanvas(w, h);
        const context = canvas.getContext('2d', { willReadFrequently: true }) as unknown as CanvasRenderingContext2D | null;
        if (!context) { paint(c); return; }
        surface = { canvas, context }; surfaces.set(c, surface);
    }
    if (surface.canvas.width !== w) surface.canvas.width = w;
    if (surface.canvas.height !== h) surface.canvas.height = h;
    const pixel = surface.context, x = Math.round(center) - Math.floor(w / 2), y = Math.round(feet) - h + 8;
    pixel.clearRect(0, 0, w, h);
    pixel.save(); pixel.translate(-x, -y); paint(pixel); pixel.restore();
    const frame = pixel.getImageData(0, 0, w, h); pixelateJuice(frame.data); pixel.putImageData(frame, 0, 0);
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(surface.canvas, x, y); c.restore();
}
