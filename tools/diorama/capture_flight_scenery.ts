/** Rasterize the actual runGuairaFlight controller and shipped artwork at a fixed
 * 10 ms clock. This verifies Canvas composition, not browser DOM/CSS or input.
 * Run from the repo root: node --import tsx tools/diorama/capture_flight_scenery.ts [output]
 * Provide @napi-rs/canvas locally or set FEKA_CANVAS_MODULE to its installed path. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runGuairaFlight } from '../../src/adventure/WorldGuairaFlight';

const require = createRequire(import.meta.url);
// Optional offline QA dependency; never imported by the shipped game.
const { createCanvas, Image: NativeImage } = require(process.env.FEKA_CANVAS_MODULE || '@napi-rs/canvas');
const out = process.argv[2] || 'output/flight-composition/current';
await mkdir(out, { recursive: true });
let context: CanvasRenderingContext2D;

class Element extends EventTarget {
    children: Element[] = [];
    attributes = new Map<string, string>();
    textContent = ''; disabled = false; hidden = false; removed = false;
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    showModal() {} close() {} remove() { this.removed = true; }
    getContext() { return context; }
}
let time = 0, serial = 0;
const frames = new Map<number, FrameRequestCallback>();
const body = new Element();
const assetPath = (path: string) => resolve('public', path.replace(/^\//, ''));
Object.assign(globalThis, {
    HTMLElement: Element,
    document: Object.assign(new EventTarget(), {
        body, hidden: false, activeElement: null, createElement: () => new Element(),
    }),
    window: Object.assign(new EventTarget(), {
        matchMedia: () => ({ matches: false }), setTimeout, clearTimeout,
    }),
    performance: { now: () => time },
    Image: class extends NativeImage {
        set src(path: string) { super.src = readFileSync(assetPath(path)); }
    },
    fetch: async (path: string) => ({
        ok: true, json: async () => JSON.parse(await readFile(assetPath(path), 'utf8')),
    }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.set(++serial, callback); return serial;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
});

const times = [.05, 1.8, 3.4, 4.8, 6.7];
const routes = [['factory', 'guaira'], ['guaira', 'serra'], ['serra', 'guaira'], ['guaira', 'factory']] as const;
for (const [from, to] of routes) {
    const canvas = createCanvas(960, 540);
    context = canvas.getContext('2d'); time = 0;
    const cancel = runGuairaFlight({ from, to, soundEnabled: false, onArrive() {} });
    try {
        for (let i = 0; i < 1500 && !frames.size; i++) await new Promise(resolve => setTimeout(resolve, 10));
        if (!frames.size) throw new Error(`Flight not ready: ${body.children.at(-1)?.children[1].textContent}`);
        let next = 0;
        while (next < times.length) {
            if (frames.size !== 1) throw new Error(`Expected one flight frame, got ${frames.size}`);
            time += 10;
            const [id, callback] = [...frames][0]; frames.delete(id); callback(time);
            if (time >= times[next] * 1000 - .01) {
                await writeFile(`${out}/${from}-${to}-${times[next].toFixed(2)}.png`, canvas.toBuffer('image/png'));
                next++;
            }
        }
    } finally { cancel(); }
}
