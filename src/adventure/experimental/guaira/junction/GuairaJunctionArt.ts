import { box as r, pixelLine as line, roof } from '../../../WorldPainting';
import type { WorldLevel, WorldObjects } from '../../../WorldPhysics';
import { pixelText } from '../../../../graphics/BitmapFont';
import { supportsStanding, isOneWayTile } from '../../../../world/tileRules';
import { drawGuairaWorker } from '../GuairaWorkerArt';
import { GUAIRA_JUNCTION as G, type JunctionRouting, type WaterOutlet } from './GuairaJunctionModel';

const P = Object.freeze({ ink: '#4c4144', sky: '#e9c69c', earth: '#b66f50', earthDark: '#875342',
    sand: '#edc78d', wood: '#94785b', bronze: '#b99465', pipe: '#735b4b', dry: '#bd9165',
    water: '#68b6bf', waterShade: '#377783', waterLight: '#b7dfd3', deck: '#eed4a0', iron: '#6c817c',
    green: '#829353', darkGreen: '#586c48', warning: '#f2be72' });

function scene(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save(); c.beginPath(); c.rect(0, 23, 320, 157); c.clip();
    draw(Math.round(cx), Math.round(cy)); c.restore();
}

function sign(c: CanvasRenderingContext2D, x: number, y: number, label: string, width: number) {
    r(c, x + 5, y + 14, 2, 9, P.wood); r(c, x, y, width, 14, P.pipe);
    r(c, x + 1, y + 1, width - 2, 11, '#d5b68a'); pixelText(c, label, x + 4, y + 4, P.ink);
}

function pipe(c: CanvasRenderingContext2D, x: number, y: number, length: number, wet: boolean, time: number, reduced: boolean, vertical = false) {
    r(c, x, y, vertical ? 9 : length, vertical ? length : 9, P.pipe);
    r(c, x + 1, y + 1, vertical ? 7 : length - 2, vertical ? length - 2 : 7, P.bronze);
    r(c, x + 3, y + 3, vertical ? 3 : length - 6, vertical ? length - 6 : 3, wet ? P.water : P.dry);
    for (let offset = 11; offset < length - 6; offset += 24) {
        if (vertical) { r(c, x - 1, y + offset, 11, 3, P.pipe); r(c, x + 3, y + offset, 3, 3, wet ? P.waterLight : P.sand); }
        else { r(c, x + offset, y - 1, 3, 11, P.pipe); r(c, x + offset, y + 3, 3, 3, wet ? P.waterLight : P.sand); }
    }
    // Required state remains legible without ripples; reduced motion holds only decoration.
    if (wet && !reduced) for (let offset = 5 + Math.floor(time / 140) % 20; offset < length - 5; offset += 20)
        r(c, x + (vertical ? 4 : offset), y + (vertical ? offset : 4), vertical ? 1 : 3, vertical ? 3 : 1, P.waterLight);
}

/** Backdrop only: every usable edge is rendered by terrain/objects from the engine. */
export function drawJunctionBackground(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reduced: boolean, routing: JunctionRouting) {
    scene(c, cx, cy, (cameraX, cameraY) => {
        const t = reduced ? 0 : time;
        r(c, 0, 23, 320, 157, P.sky); r(c, 0, 23, 320, 38, '#eed1a7');
        for (let i = -1; i < 6; i++) {
            const x = i * 92 - Math.round(cameraX * .14) % 92;
            r(c, x, 99 - Math.round(cameraY * .2), 75, 28, '#c89c78');
            r(c, x + 12, 89 - Math.round(cameraY * .2), 48, 12, '#d4ac83');
        }
        // The dry neighbourhood and the irrigated rows share an ordinary working landscape.
        const hx = 24 - cameraX, hy = 228 - cameraY;
        r(c, hx, hy, 94, 61, '#c8a784'); r(c, hx + 3, hy + 3, 88, 58, '#e0c29a');
        roof(c, hx - 6, hy - 16, 106, 18); r(c, hx + 19, hy + 25, 20, 36, '#796454');
        r(c, hx + 60, hy + 18, 20, 20, '#749a90'); r(c, hx + 69, hy + 18, 2, 20, '#d7b98b');
        for (let row = 0; row < 3; row++) for (let x = 760; x < 960; x += 20) {
            const y = 168 + row * 10;
            line(c, x - cameraX, y - cameraY, x + 17 - cameraX, y - cameraY, '#89a89a', 2);
            line(c, x + 8 - cameraX, y - 6 - cameraY, x + 8 - cameraX, y - cameraY, P.darkGreen);
            line(c, x + 3 - cameraX, y - 5 - cameraY, x + 8 - cameraX, y - cameraY, P.green);
            line(c, x + 13 - cameraX, y - 5 - cameraY, x + 8 - cameraX, y - cameraY, P.green);
        }
        // One intake, one bifurcation. Distinct A/B labels are redundant with colour.
        pipe(c, 132 - cameraX, 276 - cameraY, 176, true, t, reduced);
        r(c, 120 - cameraX, 250 - cameraY, 30, 35, P.pipe);
        r(c, 123 - cameraX, 253 - cameraY, 24, 29, '#d6b98b');
        r(c, 127 - cameraX, 260 - cameraY, 16, 13, P.waterShade);
        r(c, 129 - cameraX, 261 - cameraY, 12, 9, P.water);
        sign(c, 112 - cameraX, 227 - cameraY, 'AGUA LIMPA', 70);
        pipe(c, 300 - cameraX, 284 - cameraY, 104, routing.supplied === 'a', t, reduced, true);
        pipe(c, 300 - cameraX, 200 - cameraY, 361, routing.supplied === 'b', t, reduced);
        pipe(c, 300 - cameraX, 208 - cameraY, 76, routing.supplied === 'b', t, reduced, true);
        pipe(c, 652 - cameraX, 208 - cameraY, 180, routing.supplied === 'b', t, reduced, true);
        r(c, 291 - cameraX, 270 - cameraY, 26, 23, P.pipe);
        r(c, 293 - cameraX, 272 - cameraY, 22, 19, P.bronze);
        pixelText(c, routing.selected.toUpperCase(), 301 - cameraX, 277 - cameraY, routing.warning ? P.warning : P.ink);
        sign(c, 279 - cameraX, 308 - cameraY, 'A', 18);
        sign(c, 631 - cameraX, 180 - cameraY, 'B', 18);
        sign(c, 42 - cameraX, 264 - cameraY, 'BAIRRO', 47);
        sign(c, 811 - cameraX, 166 - cameraY, 'ARROZAL', 53);
        sign(c, 472 - cameraX, 359 - cameraY, '< ENTRADA', 70);
        sign(c, 104 - cameraX, 366 - cameraY, 'DEGRAU', 48);
        // Supporting posts stay behind the open recovery route; no painted ledge.
        for (const [x, top] of [[40,304],[200,304],[404,256],[552,256],[768,208],[920,208]]) {
            r(c, x - cameraX, top + 9 - cameraY, 8, 391 - top, '#a58d74');
            r(c, x + 1 - cameraX, top + 10 - cameraY, 2, 387 - top, '#c0a17a');
        }
    });
}

export function drawJunctionTerrain(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number) {
    scene(c, cx, cy, (cameraX, cameraY) => {
        for (let y = Math.max(0, level.worldToRow(cameraY)); y <= Math.min(G.height - 1, level.worldToRow(cameraY + 180)); y++)
            for (let x = Math.max(0, level.worldToCol(cameraX)); x <= Math.min(G.width - 1, level.worldToCol(cameraX + 320)); x++) {
                const tile = level.data.tiles[y][x]; if (!supportsStanding(tile)) continue;
                const px = x * 16 - cameraX, py = y * 16 - cameraY;
                if (isOneWayTile(tile)) {
                    // Muted back of the work patio grounds the non-colliding
                    // workers; the bright front edge remains the native surface.
                    r(c, px, py - 8, 16, 8, '#c5a576');
                    r(c, px, py, 16, 2, P.deck); r(c, px, py + 2, 16, 5, P.wood);
                    r(c, px, py + 7, 16, 2, P.ink); r(c, px + 3, py + 3, 1, 3, P.bronze);
                } else {
                    r(c, px, py, 16, 16, P.earth); r(c, px + 4, py + 8, 7, 2, P.earthDark);
                    if (!supportsStanding(level.data.tiles[y - 1]?.[x] ?? 0)) {
                        r(c, px, py, 16, 2, P.sand); r(c, px, py + 2, 16, 2, '#c88f5c');
                    }
                }
            }
    });
}

export function drawJunctionObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, time: number, reduced: boolean, routing: JunctionRouting) {
    scene(c, cx, cy, (cameraX, cameraY) => {
        for (const b of objects.bodies) {
            const x = Math.round(b.x) - cameraX, y = Math.round(b.y) - cameraY;
            if (x > 322 || x + b.width < -2) continue;
            if (b.kind === 'switch') {
                // Raised border and ↓ shape identify an impact plate independently of state.
                r(c, x - 2, y + 4, b.width + 4, 4, P.pipe); r(c, x, y + 2, b.width, 4, P.bronze);
                r(c, x + 2, y + 1, b.width - 4, 2, routing.warning ? P.warning : P.deck);
                pixelText(c, routing.selected.toUpperCase(), x + 13, y - 8, P.ink);
                r(c, x + 4, y - 5, 1, 4, P.ink); r(c, x + 2, y - 2, 5, 1, P.ink); r(c, x + 3, y - 1, 3, 1, P.ink);
                continue;
            }
            const outlet: WaterOutlet = b.id === G.liftAId ? 'a' : 'b';
            // Cylinder extension depicts required movement; it never animates independently.
            r(c, x + 72, y + 8, 16, G.recoveryY - b.y - 8, P.pipe);
            r(c, x + 76, y + 8, 8, G.recoveryY - b.y - 8, '#99a9a0');
            r(c, x + 68, G.recoveryY - 12 - cameraY, 24, 12, P.iron);
            r(c, x, y, b.width, 2, P.deck); r(c, x, y + 2, b.width, 4, '#a38961');
            r(c, x, y + 6, b.width, 2, P.ink);
            for (let xx = 8; xx < b.width; xx += 16) r(c, x + xx, y + 3, 2, 2, P.pipe);
            r(c, x + 3, y - 7, 14, 7, routing.warning ? P.warning : b.active ? P.water : P.wood);
            pixelText(c, outlet.toUpperCase(), x + 7, y - 7, P.ink);
            if (Math.abs(b.y - (b.active ? b.to!.y : G.dockY)) > .01) {
                const arrowY = y - 10, d = b.active ? -1 : 1;
                line(c, x + 27, arrowY - 3 * d, x + 27, arrowY + 3 * d, P.ink);
                line(c, x + 24, arrowY, x + 27, arrowY + 3 * d, P.ink);
                line(c, x + 30, arrowY, x + 27, arrowY + 3 * d, P.ink);
            }
        }
        for (const [x, y, kind] of [[108,296,'pump'],[421,248,'pump'],[848,200,'rice']] as const)
            if (x > cameraX - 20 && x < cameraX + 340) drawGuairaWorker(c, x - cameraX, y - cameraY, kind,
                { activeTimeMs: time, valveActive: routing.supplied === 'b', bridgeRise: routing.warning ? .5 : 1, reducedMotion: reduced });
    });
}
