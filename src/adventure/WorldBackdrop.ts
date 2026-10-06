import type { Island } from './types';
import { box, polygon, oval, cloud, palm, pine, tank, pipe, crane, container, station, freezer, arch, villa, roof, pixelLine } from './WorldPainting';
function peak(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, light: string) {
    polygon(c, [[x, y + h], [x + w * .19, y + h * .47], [x + w * .3, y + h * .54], [x + w * .47, y], [x + w * .58, y + h * .3], [x + w * .72, y + h * .39], [x + w, y + h]], color);
    polygon(c, [[x + w * .47, y], [x + w * .43, y + h * .54], [x + w * .29, y + h * .66], [x + w * .23, y + h], [x + w * .6, y + h], [x + w * .56, y + h * .36]], light);
}
function sea(c: CanvasRenderingContext2D, y: number, color: string, light: string) {
    box(c, 0, y, 640, 240 - y, color);
    for (let i = 0; i < 95; i++)
        box(c, (i * 67) % 640, y + 3 + (i * 13) % Math.max(1, 236 - y), 3 + i % 10, 1, light);
}
function boat(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
    polygon(c, [[x, y], [x + size, y], [x + size - 7, y + 10], [x + 8, y + 10]], '#718b9b');
    box(c, x + 10, y - 8, size * .48, 8, '#a8bfc1');
    box(c, x + 13, y - 6, size * .35, 3, '#668da3');
    box(c, x + size * .5, y - 16, 3, 9, '#6c8395');
}
/** Each biome has its own silhouette, atmosphere and three cached native parallax planes. */
export class WorldBackdrop {
    private cache = new Map<string, HTMLCanvasElement[]>();
    private skyCache: { top: string; bottom: string; colors: string[] } | null = null;
    /** Only the palette changes these 60 native bands. Keep the last pair,
     * comparing values so editor/in-place color changes are visible immediately.
     * Reuse colors, not a raster surface: each original rectangle is still drawn.
     */
    private skyColors(sky: Island['sky']): readonly string[] {
        const [top, bottom] = sky;
        if (this.skyCache?.top === top && this.skyCache.bottom === bottom) return this.skyCache.colors;
        const channels = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
        const a = channels(top), b = channels(bottom), colors: string[] = [];
        for (let y = 0; y < 180; y += 3) {
            const t = y / 180;
            colors.push(`rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`);
        }
        this.skyCache = { top, bottom, colors };
        return colors;
    }
    private layers(world: number, variant: number): HTMLCanvasElement[] {
        const key = `${world}:${variant}`;
        const cached = this.cache.get(key);
        if (cached) {
            this.cache.delete(key);
            this.cache.set(key, cached);
            return cached;
        }
        const layers = [0, 1, 2].map(depth => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 240;
            const c = canvas.getContext('2d')!;
            c.imageSmoothingEnabled = false;
            const shift = variant * 29;
            if (depth === 0) {
                if (world !== 5)
                    for (let i = 0; i < 6; i++)
                        cloud(c, (i * 119 + shift) % 700 - 20, 38 + (i % 3) * 17, 45 + i % 3 * 14, world === 6 ? '#f2c9c0' : world === 2 ? '#efddbc' : '#e4f2e4');
                if (world === 1) {
                    sea(c, 137, '#6ab5c3', '#a0d8d4');
                    for (let i = 0; i < 7; i++)
                        peak(c, i * 107 - 28, 104 - i % 3 * 9, 72, 44 + i % 3 * 8, '#96c9cf', '#b6d9d3');
                }
                else if (world === 2) {
                    sea(c, 146, '#8fb7bf', '#c4d1bd');
                    for (let i = 0; i < 7; i++) {
                        const x = i * 100 + shift % 25;
                        box(c, x, 104 + i % 3 * 9, 48, 44, '#92a7b4');
                        box(c, x + 2, 101 + i % 3 * 9, 44, 4, '#b0bdc3');
                        box(c, x + 36, 89 + i % 3 * 8, 5, 27, '#92a7b4');
                    }
                }
                else if (world === 3) {
                    for (let i = 0; i < 9; i++) {
                        const x = i * 82;
                        box(c, x, 101 + i % 3 * 8, 60, 139, '#9fb8c4');
                        box(c, x + 4, 99 + i % 3 * 8, 53, 3, '#b9cdd1');
                        box(c, x + 39, 73 + i % 2 * 8, 6, 55, '#a6c0ca');
                        for (let j = 0; j < 3; j++)
                            box(c, x + 8 + j * 15, 115 + i % 3 * 8, 8, 8, '#c4d8d5');
                    }
                }
                else if (world === 4) {
                    for (let i = 0; i < 8; i++)
                        peak(c, i * 96 - 30, 65 + (i % 3) * 19, 130, 170, '#a9bed9', '#c7d6e3');
                    cloud(c, 104, 195, 170, '#e1e5ed');
                    cloud(c, 385, 185, 210, '#e1e5ed');
                }
                else if (world === 5) {
                    box(c, 0, 20, 640, 220, '#497391');
                    for (let i = 0; i < 9; i++) {
                        const x = i * 80;
                        box(c, x, 26, 6, 214, '#3c6484');
                        box(c, x + 8, 37, 60, 90, '#6085a0');
                        box(c, x + 12, 41, 52, 82, '#537a99');
                        box(c, x + 11, 40, 54, 3, '#7b9eb4');
                        oval(c, x + 24, 57, 25, 25, '#476d8e');
                        for (let j = 0; j < 4; j++)
                            pixelLine(c, x + 36, 69, x + 36 + Math.cos(j * Math.PI / 2) * 10, 69 + Math.sin(j * Math.PI / 2) * 10, '#6386a2', 3);
                        box(c, x + 4, 141, 72, 4, '#7099b0');
                    }
                }
                else {
                    sea(c, 157, '#a0b2c7', '#c6cad0');
                    for (let i = 0; i < 5; i++) {
                        peak(c, i * 142 - 32, 110 + (i % 2) * 10, 154, 130, '#ac9fbb', '#c3b1c4');
                        const x = i * 142 + 10;
                        box(c, x, 91 + i % 2 * 17, 48, 50, '#b4a4b9');
                        polygon(c, [[x - 4, 94 + i % 2 * 17], [x + 24, 80 + i % 2 * 17], [x + 53, 94 + i % 2 * 17]], '#bd9aa6');
                        for (let j = 0; j < 3; j++)
                            box(c, x + 7 + j * 12, 102 + i % 2 * 17, 4, 7, '#9c8ca9');
                    }
                }
            }
            else if (depth === 1) {
                c.globalAlpha = world === 5 ? .45 : .55;
                if (world === 1) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 155 + 21;
                        peak(c, x, 105 + i % 2 * 17, 67, 112, '#93b3ad', '#c8c8a8');
                        box(c, x + 19, 109 + i % 2 * 17, 26, 4, '#8faa86');
                    }
                    arch(c, 350, 129, 89, 85, true);
                    palm(c, 71, 129, 32, true);
                    box(c, 506, 77, 13, 58, '#e4d8b2');
                    box(c, 506, 91, 13, 8, '#b67470');
                    box(c, 506, 114, 13, 7, '#b67470');
                    box(c, 503, 74, 19, 5, '#637d8e');
                    roof(c, 502, 67, 21, 7);
                }
                else if (world === 2) {
                    for (let i = 0; i < 4; i++)
                        crane(c, i * 177 + 19, 60 + i % 2 * 17, 125, 120);
                    boat(c, 44, 177, 52);
                    boat(c, 277, 166, 42);
                    boat(c, 484, 180, 67);
                }
                else if (world === 3) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 141 + 12;
                        pipe(c, x + 54, 72 + i % 2 * 9, 81, 96);
                        tank(c, x, 87 + i % 2 * 18, 65, 139, 0);
                    }
                }
                else if (world === 4) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 146;
                        peak(c, x, 106 + i % 2 * 12, 106, 134, '#6a92a7', '#9db4bd');
                        pine(c, x + 28, 151 + i % 2 * 4, 53);
                    }
                    pixelLine(c, 0, 109, 320, 132, '#658297');
                    pixelLine(c, 320, 132, 640, 101, '#658297');
                    station(c, 451, 110, 58, 60);
                }
                else if (world === 5) {
                    for (let i = 0; i < 4; i++) {
                        const x = i * 181;
                        tank(c, x + 19, 93, 62, 117, 0, true);
                        pipe(c, x + 73, 63, 66, 126, true);
                    }
                }
                else {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 152 + 9;
                        villa(c, x, 107 + i % 2 * 15, 89, 93);
                        arch(c, x + 88, 160, 64, 74);
                        pine(c, x + 103, 177, 48, true);
                    }
                }
            }
            else {
                c.globalAlpha = world === 5 ? .5 : .6;
                if (world === 1) {
                    for (let i = 0; i < 6; i++) {
                        const x = i * 121 + 24;
                        oval(c, x, 185 + i % 2 * 5, 67, 35, '#77a987');
                        palm(c, x + 28, 205, 38 + i % 2 * 16, true);
                    }
                }
                if (world === 2) {
                    for (let i = 0; i < 6; i++)
                        container(c, i * 121, 177 + (i % 2) * 11, 79, 50, i + variant);
                }
                if (world === 3) {
                    for (let i = 0; i < 4; i++) {
                        const x = i * 185 + 17;
                        box(c, x, 20, 7, 220, '#688b9f');
                        box(c, x + 2, 21, 2, 219, '#9fb9c3');
                        box(c, x, 34, 124, 6, '#799dad');
                        box(c, x + 13, 59, 96, 59, '#527589');
                        box(c, x + 16, 62, 90, 53, '#9cc4cf');
                        for (let j = 0; j < 3; j++)
                            box(c, x + 37 + j * 25, 62, 3, 53, '#688a9d');
                        pipe(c, x + 66, 141, 67, 93);
                    }
                }
                if (world === 4) {
                    for (let i = 0; i < 6; i++)
                        pine(c, i * 139 + 10, 241, 66 + i % 2 * 23, true);
                }
                if (world === 5) {
                    for (let i = 0; i < 4; i++) {
                        const x = i * 186 + 9;
                        freezer(c, x, 116, 73, 107);
                        pipe(c, x + 80, 45, 81, 181, true);
                    }
                }
                if (world === 6) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 144;
                        arch(c, x, 157, 77, 83);
                        pine(c, x + 110, 233, 71, true);
                    }
                }
            }
            c.globalAlpha = 1;
            return canvas;
        });
        this.cache.set(key, layers);
        // A full campaign should not retain all 36 three-layer canvas sets on mobile.
        if (this.cache.size > 6)
            this.cache.delete(this.cache.keys().next().value!);
        return layers;
    }
    draw(c: CanvasRenderingContext2D, island: Island, cx: number, cy: number, time: number, variant = 0) {
        const sky = this.skyColors(island.sky);
        for (let y = 0; y < 180; y += 3) box(c, 0, y, 320, 3, sky[y / 3]);
        this.layers(island.id, variant).forEach((layer, i) => {
            const f = [.055, .16, .31][i], x = -(((cx * f + (i === 0 && island.id !== 5 ? time * .00065 : 0)) % 640 + 640) % 640), y = Math.round(-cy * [.035, .09, .14][i]);
            c.drawImage(layer, Math.round(x), y);
            c.drawImage(layer, Math.round(x + 640), y);
        });
        // Ambient motes live behind the playable structures and never imitate projectiles.
        if (island.id === 5)
            for (let i = 0; i < 15; i++) {
                const x = ((i * 83 - cx * .22) % 340 + 340) % 340 - 10, y = (i * 37 + time * .005) % 180;
                box(c, x, y, 1, 1, '#acd7e780');
            }
    }
}
