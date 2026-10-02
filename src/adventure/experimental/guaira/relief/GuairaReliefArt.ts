import { box as r, pixelLine as line, polygon, roof } from '../../../WorldPainting';
import { jetCycle } from '../../../WorldMachineState';
import type { WorldLevel, WorldObjects } from '../../../WorldPhysics';
import { pixelText } from '../../../../graphics/BitmapFont';
import { drawGalleryTerrain, drawWorkshopWallBay, drawWorkshopToolNiche } from '../gallery/GuairaGalleryArt';
import { GUAIRA_RELIEF as G, reliefOpen } from './GuairaReliefStage';
import { drawReliefFlow } from './GuairaReliefFlow';

/** Guaíra's plaster, clay and worn brass; liquid colours belong to the native jet. */
export const RELIEF_MATERIAL_COLORS = Object.freeze({
    ink: '#493c43', wall: '#dfbe96', plaster: '#e3c49a', shade: '#c29b79',
    recess: '#ac8c70', recessLight: '#ba9978', brass: '#b58a54', light: '#e2bb79',
    pipe: '#6d584c', pipeShade: '#8c7157', gauge: '#edba62', safe: '#80afa7',
    water: '#40b8cb', waterShade: '#329eb7', foam: '#c6f0df', mist: '#cad6c4',
});
const P = RELIEF_MATERIAL_COLORS;

function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save(); c.beginPath(); c.rect(0, 23, 320, 157); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    draw(Number.isFinite(cx) ? Math.round(cx) : 0, Number.isFinite(cy) ? Math.round(cy) : 0);
    c.restore();
}

/** Background hardware has a dark edge and inset sheen, never a landing cap. */
function pipe(c: CanvasRenderingContext2D, x: number, y: number, length: number, vertical = false) {
    const width = vertical ? 10 : length, height = vertical ? length : 10;
    r(c, x, y, width, height, P.pipe);
    r(c, x + 1, y + 1, width - 2, height - 2, P.brass);
    r(c, x + 2, y + 2, vertical ? 2 : width - 4, vertical ? height - 4 : 2, P.light);
    r(c, x + (vertical ? 7 : 2), y + (vertical ? 2 : 7), vertical ? 2 : width - 4,
        vertical ? height - 4 : 2, P.pipeShade);
    for (let d = 22; d < length - 9; d += 39) {
        const xx = x + (vertical ? -1 : d), yy = y + (vertical ? d : -1);
        r(c, xx, yy, vertical ? 12 : 4, vertical ? 4 : 12, P.pipe);
        r(c, xx + 1, yy + 1, vertical ? 10 : 2, vertical ? 2 : 10, P.brass);
        r(c, xx + 2, yy + 1, 1, 1, P.light);
    }
}

/** One quiet opening explains the water's purpose without adding scenery actors. */
function irrigationWindow(c: CanvasRenderingContext2D, x: number, y: number) {
    // Uneven masonry reveal gives the crop view a real opening in the workshop.
    r(c, x - 5, y - 7, 102, 65, '#ba9476');
    r(c, x - 3, y - 5, 98, 61, '#d0ac87');
    r(c, x, y, 92, 56, P.recess);
    r(c, x + 3, y + 3, 86, 50, '#e9c89e');
    polygon(c, [[x + 3,y + 22],[x + 23,y + 12],[x + 40,y + 18],
        [x + 63,y + 16],[x + 88,y + 24],[x + 89,y + 53],[x + 3,y + 53]], '#c5a07a');
    for (const yy of [34, 46]) {
        r(c, x + 5, y + yy, 81, 4, '#809b88');
        r(c, x + 7, y + yy, 77, 1, '#a8b9a0');
        for (let xx = 12; xx < 84; xx += 17) {
            line(c, x + xx, y + yy, x + xx - 3, y + yy - 8, '#7c8d5f');
            line(c, x + xx, y + yy, x + xx + 2, y + yy - 10, '#8d9d68');
        }
    }
    r(c, x + 44, y + 2, 3, 52, '#b49a77');
    r(c, x + 2, y + 26, 88, 2, '#b49a77');
    // Thick inner left/top shadows stay inside the aperture; no external ledge.
    r(c, x + 3, y + 3, 3, 47, '#b59878');
    r(c, x + 6, y + 3, 81, 2, '#c4a17d');
    r(c, x - 4, y + 13, 3, 2, '#ad886f');
    r(c, x + 93, y + 30, 3, 2, '#ad886f');
    // Irrigation stains belong only to the inside lower corners of the opening.
    r(c, x + 4, y + 48, 6, 4, '#92a087');
    r(c, x + 82, y + 47, 5, 5, '#92a087');
}

/** The collector sits directly under all three real brittle tiles. Breaking any
 * one exposes the same chamber; no rim or highlight bridges the missing tile. */
function reliefCollector(c: CanvasRenderingContext2D, x: number, y: number, open: boolean) {
    const left = G.lidStart - x, top = G.lidY + 16 - y, width = G.lidEnd - G.lidStart;
    r(c, left, top, width, 77, P.recess);
    r(c, left + 3, top, width - 6, 72, P.recessLight);
    polygon(c, [[left + 3,top + 70],[left + width - 3,top + 70],
        [left + 30,top + 88],[left + 18,top + 88]], P.recess);
    // Slim sides and diagonal lower shoulders read as an inset pressure vessel.
    r(c, left + 1, top, 2, 69, P.pipeShade);
    r(c, left + width - 3, top, 2, 69, P.pipeShade);
    for (const yy of [top + 15, top + 56]) for (const xx of [left + 2,left + width - 3])
        r(c, xx, yy, 1, 2, P.light);
    pipe(c, left + 19, top + 74, 68, true);
    // Recessed sight glass is neutral; it never borrows the jet's damage palette.
    r(c, left + 17, top + 16, 14, 45, P.pipeShade);
    r(c, left + 19, top + 18, 10, 41, '#b4ae8e');
    r(c, left + 20, top + 19, 2, 37, '#dad0aa');
    r(c, left + 24, top + 21, 3, 32, open ? '#9caa90' : '#bca376');
    for (let yy = 0; yy < 4; yy++) r(c, left + 27, top + 23 + yy * 8, 2, 1, P.pipeShade);
    // A mechanical flap remains open after the burst, even with reduced motion.
    const flapY = top + 66;
    r(c, left + 18, flapY - 4, 13, 9, P.pipeShade);
    line(c, left + 21, flapY + (open ? 3 : -1), left + 29,
        flapY + (open ? -3 : -1), P.light, 2);
    pixelText(c, 'ALIVIO', left + 5, top - 31, P.pipe);
    if (open) pixelText(c, 'ABERTO', left + 5, top - 43, P.pipe);
}

/** Static, warm workshop cutaway. The cap-to-grate pipe remains continuous as the
 * camera follows between the high repair route and the low timed crossing. */
export function drawReliefBackground(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number) {
    layer(c, cx, cy, (x, y) => {
        const open = reliefOpen(level);
        r(c, 0, 23, 320, 157, P.wall);
        r(c, 0, 296 - y, 320, 88, '#d2ad87');
        // Deep plaster bays organise the cutaway into a repair wall, water
        // service wall and field-facing inspection wall. None is walkable.
        // The vertical reveals meet the actual floor, so no jamb hangs over a
        // jump corridor. Background-only inner shadows give them their depth.
        drawWorkshopWallBay(c, 16 - x, 153 - y, 171, 183);
        drawWorkshopWallBay(c, 303 - x, 194 - y, 204, 142);
        drawWorkshopWallBay(c, 518 - x, 202 - y, 116, 134);
        // Field light falls only on the inspection wall beyond the live jet.
        // Keep the mullion gap and stop short of the real floor's pale cap.
        for (const [left, right] of [[536,573],[578,614]] as const) {
            polygon(c, [[left - x,291 - y],[right - x,291 - y],
                [right - 10 - x,328 - y],[left - 10 - x,328 - y]], '#d9b68e');
        }
        drawWorkshopToolNiche(c, 357 - x, 220 - y);
        // Broad hand-smoothed patches, few and low contrast, keep jump paths quiet.
        for (const [xx, yy, w, h] of [[29,243,28,17],[76,179,25,11],[192,188,17,8],
            [319,197,25,13],[535,237,33,17],[587,312,27,8]] as const) {
            r(c, xx - x, yy - y, w, h, '#d4af89');
            r(c, xx + 4 - x, yy - 2 - y, w - 11, 2, '#d4af89');
        }
        // Workshop eave and title sit above the playable ascent, without a shelf.
        roof(c, 19 - x, 100 - y, 161, 14);
        r(c, 26 - x, 116 - y, 146, 27, P.plaster);
        pixelText(c, 'OFICINA DAS AGUAS', 34 - x, 126 - y, '#8c7157');
        pixelText(c, 'OFICINA', 25 - x, 222 - y, P.pipeShade);
        pixelText(c, 'DAS AGUAS', 20 - x, 233 - y, P.pipeShade);
        irrigationWindow(c, 530 - x, 240 - y);
        // Old mineral traces hug the return outlet and feed joints. These dry,
        // broken vertical stains never borrow cyan, foam or a landing edge;
        // draw before hardware so pipe silhouettes and labels remain intact.
        for (const [xx, yy, height] of [[292,289,9],[303,291,6],[341,289,8],
            [286,312,10],[403,312,7],[445,322,8]] as const) {
            r(c, xx - x, yy - y, 3, height, '#bfa180');
            r(c, xx + 1 - x, yy + height - y, 1, 2, '#c6aa88');
        }
        reliefCollector(c, x, y, open);
        pipe(c, 264 - x, 304 - y, 184);
        pipe(c, 442 - x, 308 - y, 28, true);
        // One screened return explains the alternate path taken by released water.
        pipe(c, 265 - x, 275 - y, 35);
        r(c, 291 - x, 278 - y, 57, 16, P.recess);
        r(c, 294 - x, 280 - y, 51, 11, '#a08e73');
        if (open) {
            r(c, 268 - x, 279 - y, 29, 2, P.safe);
            r(c, 295 - x, 285 - y, 49, 3, P.safe);
            r(c, 298 - x, 285 - y, 15, 1, '#b4c5ac');
        }
        for (let xx = 297; xx < 347; xx += 8) r(c, xx - x, 279 - y, 2, 13, P.pipeShade);
        pixelText(c, 'RETORNO', 298 - x, 266 - y, P.pipeShade);
        // A tiny valve flag on the same pipe gives the low camera persistent state.
        r(c, 318 - x, 300 - y, 22, 18, P.pipe);
        r(c, 320 - x, 302 - y, 18, 14, P.brass);
        line(c, 324 - x, 309 - y, 334 - x, 309 + (open ? 4 : -4) - y, P.light, 2);
        // Flat painted route labels are deliberately separate from actual caps.
        pixelText(c, 'ALIVIO', 58 - x, 268 - y, P.pipeShade);
        line(c, 99 - x, 273 - y, 103 - x, 267 - y, P.pipeShade);
        line(c, 103 - x, 267 - y, 107 - x, 273 - y, P.pipeShade);
        pixelText(c, 'INTERVALO', 189 - x, 323 - y, P.pipeShade);
        pixelText(c, 'INSPECAO', 551 - x, 310 - y, P.pipeShade);
    });
}

/** Gallery's actual tile reader retains pale safe caps and branching brittle clay. */
export const drawReliefTerrain = drawGalleryTerrain;

/** Native gameplay-owned envelope and shutdown snapshot. No independent art clock. */
export function drawReliefObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, reducedMotion: boolean) {
    layer(c, cx, cy, (x, y) => {
        const b = objects.get(G.jetId);
        if (!b) return;
        const s = jetCycle(b, objects.time), left = b.x - x, mouth = G.floor - y;
        r(c, left, mouth, b.width, 15, P.pipe); r(c, left, mouth, b.width, 2, P.light);
        for (let dx = 4; dx < b.width - 3; dx += 8) r(c, left + dx, mouth + 3, 4, 4, P.brass);
        const gaugeX = left - 17, gaugeY = mouth - 48;
        // Readout physically straddles the same feed pipe at world y304.
        r(c, gaugeX + 3, gaugeY + 35, 4, 13, P.pipe);
        r(c, gaugeX + 4, gaugeY + 36, 2, 11, P.brass);
        r(c, gaugeX, gaugeY, 10, 40, P.pipe); r(c, gaugeX + 1, gaugeY + 1, 8, 38, P.brass);
        for (let i = 0; i < 8; i++) {
            r(c, gaugeX + 2, gaugeY + 33 - i * 4, 5, 3,
                !b.active && s.pressure * 8 > i ? P.gauge : P.pipe);
            r(c, gaugeX + 7, gaugeY + 34 - i * 4, 1, 1, P.light);
        }
        pixelText(c, b.active ? '0' : s.phase === 'charging' || s.danger ? '!' : '-', gaugeX + 2, gaugeY - 9, P.ink);
        if (b.active) {
            line(c, gaugeX + 2, gaugeY + 29, gaugeX + 6, gaugeY + 33, P.light);
            line(c, gaugeX + 6, gaugeY + 33, gaugeX + 7, gaugeY + 29, P.light);
        }
        // Native jet paint retained from the gameplay prototype, inside danger.
        if (s.danger) {
            drawReliefFlow(c, s.danger, objects.time, x, y, reducedMotion, P);
        }
        // Same native shutdown snapshot, visibly harmless sparse pale drops only.
        const shutdown = b.jetShutdown;
        if (!reducedMotion && b.active && shutdown) {
            const age = objects.time - shutdown.at;
            if (age >= 0 && age < 300) for (let i = 0; i < 5; i++)
                r(c, left + 12 + i * 23, mouth - Math.round(shutdown.height * (i + 1) / 6 * (1 - age / 300)), 2, 1, P.mist);
        }
    });
}
