import { pixelText } from '../../graphics/BitmapFont';

/** Native 320×180 canvas pixels; anchor is the door centre at the existing floor.
 * Decorative only: runtime owns position, camera, support, trigger and progression.
 * Draw after scenery, before terrain/actors/HUD. No textures, timers or audio.
 */
export const JUICE_ARRIVAL_METRICS = Object.freeze({
    width: 144, height: 112, doorWidth: 32, doorHeight: 46,
    signWidth: 48, signHeight: 40, minClearApproach: 48,
});
export type JuiceArrivalStatus = 'open' | 'closed' | 'complete';
export interface JuiceArrivalPlacement {
    /** Screen space: world door centre minus camera x. Do not pass tile units. */
    doorX: number;
    /** Screen space: top of the supporting floor minus camera y. */
    floorY: number;
    status?: JuiceArrivalStatus;
}
const P = { ink: '#131724', steel: '#394b5b', seam: '#25354d', rim: '#82959d',
    copper: '#9a6652', copperLight: '#be8b67', gold: '#d7ac60', light: '#f6d896',
    wine: '#583341', fold: '#402a37', purple: '#613f7e', purpleLight: '#a675ba' };
function r(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    c.fillStyle = color; c.fillRect(x, y, w, h);
}
function dumbbell(c: CanvasRenderingContext2D, x: number, y: number) {
    r(c, x, y + 5, 19, 3, P.rim);
    for (const dx of [2, 14]) { r(c, x + dx, y, 3, 13, P.gold); r(c, x + dx - 2, y + 3, 2, 7, P.copperLight); }
}
function rivet(c: CanvasRenderingContext2D, x: number, y: number) {
    r(c, x, y, 2, 2, P.ink); r(c, x, y, 1, 1, P.light);
}

/** Riveted annex with an open, warm stage sightline, no implied step/platform. */
export function drawJuiceFactoryArrival(c: CanvasRenderingContext2D, s: JuiceArrivalPlacement): void {
    if (!Number.isFinite(s.doorX) || !Number.isFinite(s.floorY)) return;
    const x = Math.round(s.doorX), y = Math.round(s.floorY);
    if (x + 72 <= 0 || x - 72 >= c.canvas.width || y <= 0 || y - 112 >= c.canvas.height) return;
    const status = s.status ?? 'open';
    c.save(); c.translate(x, y);
    r(c, -72, -104, 144, 104, P.ink);
    r(c, -69, -101, 138, 101, P.steel);
    // Corrugated blue factory skin; the burgundy interior belongs to the stage.
    for (let xx = -65; xx < 69; xx += 8) { r(c, xx, -63, 2, 63, P.seam); r(c, xx + 2, -63, 1, 63, '#4e6170'); }
    r(c, -72, -104, 144, 4, P.rim); r(c, -70, -100, 140, 2, P.seam);
    for (const xx of [-70, 64]) {
        r(c, xx, -99, 6, 99, P.ink); r(c, xx + 1, -98, 2, 98, P.rim);
        for (let yy = -93; yy < -5; yy += 16) rivet(c, xx + 3, yy);
    }
    // Pipes stop at a sealed inspection glass: never a fruit/ingredient depiction.
    r(c, -60, -64, 7, 54, P.ink); r(c, -59, -64, 5, 53, P.copper);
    r(c, -59, -63, 1, 52, P.copperLight);
    r(c, -59, -15, 31, 6, P.copper); r(c, -59, -15, 31, 1, P.copperLight);
    r(c, -63, -45, 13, 25, P.ink); r(c, -61, -43, 9, 21, '#293440');
    r(c, -60, -35, 7, 12, P.purple); r(c, -60, -36, 7, 2, P.purpleLight);
    r(c, -60, -42, 1, 16, '#82959d'); r(c, -57, -30, 2, 2, P.purpleLight);
    for (const yy of [-47, -21]) r(c, -63, yy, 13, 3, P.rim);
    // Championship marquee, crown and dumbbells match CalabrezzoStageArt.
    r(c, -64, -96, 128, 31, P.ink); r(c, -62, -94, 124, 27, P.wine);
    r(c, -60, -93, 120, 1, P.copperLight);
    pixelText(c, 'CALABREZZO', 0, -89, P.light, 1, 'center');
    pixelText(c, 'CAMPEONATO DE SHAPE', 0, -77, P.gold, 1, 'center');
    r(c, -9, -108, 18, 4, P.gold); r(c, -9, -111, 3, 5, P.gold);
    r(c, -2, -112, 4, 6, P.light); r(c, 6, -111, 3, 5, P.gold);
    for (const xx of [-60, 58]) { rivet(c, xx, -89); rivet(c, xx, -70); }
    dumbbell(c, -46, -60); dumbbell(c, 27, -60);
    // Deep lintel with a warm fixed lamp. No pulsing or moving beam.
    r(c, -24, -51, 48, 51, P.ink); r(c, -23, -50, 46, 4, P.rim);
    r(c, -21, -46, 5, 46, P.copper); r(c, 16, -46, 5, 46, P.copper);
    r(c, -20, -45, 1, 45, P.copperLight); r(c, 16, -45, 1, 45, P.copperLight);
    r(c, -16, -46, 32, 46, '#262231');
    r(c, -14, -44, 28, 43, '#39313c');
    for (const xx of [-15, 9]) {
        r(c, xx, -44, 6, 39, P.wine); r(c, xx + 2, -43, 2, 37, P.fold); r(c, xx, -22, 6, 2, P.gold);
    }
    r(c, -8, -6, 16, 5, '#705041'); r(c, -6, -5, 12, 1, P.gold);
    r(c, -6, -55, 12, 3, P.ink); r(c, -4, -53, 8, 1, P.light);
    // Closed is structurally distinct; complete adds a laurel/check-like ribbon.
    if (status === 'closed') {
        r(c, -16, -46, 32, 46, P.seam);
        for (let yy = -44; yy < 0; yy += 5) r(c, -15, yy, 30, 1, P.rim);
        r(c, -4, -22, 8, 9, P.ink); r(c, -2, -20, 4, 4, P.gold);
    }
    if (status === 'complete') {
        r(c, 35, -40, 12, 13, P.gold); r(c, 36, -27, 4, 7, P.wine); r(c, 42, -27, 4, 7, P.wine);
        pixelText(c, 'V', 38, -37, P.ink);
    }
    pixelText(c, status === 'closed' ? 'FECHADO' : status === 'complete' ? 'CONCLUÍDO' : 'SALÃO', 0, -63, P.light, 1, 'center');
    // Flush threshold stays above the actual support line. Runtime paints floor next.
    r(c, -24, -2, 48, 2, P.rim); r(c, -16, -2, 32, 1, P.light);
    c.restore();
}

/** Separate grounded wayfinding prop. Direction changes arrow, never mirrors text. */
export function drawJuiceArrivalSign(c: CanvasRenderingContext2D, x: number, floorY: number, direction: 'left' | 'right'): void {
    if (!Number.isFinite(x) || !Number.isFinite(floorY)) return;
    c.save(); c.translate(Math.round(x), Math.round(floorY));
    r(c, -3, -24, 6, 24, P.ink); r(c, -2, -24, 2, 24, P.rim);
    r(c, -24, -40, 48, 24, P.ink); r(c, -22, -38, 44, 20, P.wine);
    r(c, -21, -37, 42, 1, P.copperLight);
    pixelText(c, 'SALÃO', 0, -35, P.light, 1, 'center');
    pixelText(c, direction === 'left' ? '← SHAPE' : 'SHAPE →', 0, -25, P.gold, 1, 'center');
    rivet(c, -21, -34); rivet(c, 19, -34); c.restore();
}

/** Adapter for the runtime-owned interaction rect. It never creates a trigger.
 * The agreed 24×40 rect (1776,184) resolves to door centre (1788,224).
 */
export function drawJuiceArrivalAtPortal(c: CanvasRenderingContext2D,
    portal: { x: number; y: number; width: number; height: number },
    camera: { x: number; y: number }, status: JuiceArrivalStatus = 'open'): void {
    if (![portal.x, portal.y, portal.width, portal.height, camera.x, camera.y].every(Number.isFinite)
        || portal.width <= 0 || portal.height <= 0) return;
    drawJuiceFactoryArrival(c, { doorX: portal.x + portal.width / 2 - camera.x,
        floorY: portal.y + portal.height - camera.y, status });
}
