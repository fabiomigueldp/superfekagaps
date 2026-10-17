import { box as r, pixelLine as line, polygon, roof } from '../../../WorldPainting';
import { jetCycle } from '../../../WorldMachineState';
import type { WorldLevel, WorldObjects } from '../../../WorldPhysics';
import { pixelText } from '../../../../graphics/BitmapFont';
import { drawGalleryTerrain, drawWorkshopWallBay, drawWorkshopToolNiche } from '../gallery/GuairaGalleryArt';
import { GUAIRA_RELIEF as G, reliefOpen } from './GuairaReliefStage';
import { drawReliefFlow } from './GuairaReliefFlow';
import { drawWorkshopClerestory, drawWorkshopRoofFrame } from '../GuairaWorkshopArt';
import { drawGuairaPipe, drawGuairaPipeElbow, drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaPipeRoute } from '../GuairaPipeArt';

/** Guaíra's plaster, clay and worn brass; liquid colours belong to the native jet. */
export const RELIEF_MATERIAL_COLORS = Object.freeze({
    ink: '#493c43', wall: '#dfbe96', plaster: '#e3c49a', shade: '#c29b79',
    recess: '#ac8c70', recessLight: '#ba9978', brass: '#b58a54', light: '#e2bb79',
    pipe: '#6d584c', pipeShade: '#8c7157', gauge: '#edba62', safe: '#80afa7',
    water: '#40b8cb', waterShade: '#329eb7', foam: '#c6f0df', mist: '#cad6c4',
});
const P = RELIEF_MATERIAL_COLORS;
const PIPE = Object.freeze({ edge: P.pipe, brass: P.brass, light: P.light, shade: P.pipeShade,
    water: P.safe, glint: '#b4c5ac', dry: '#aa8d67' });
const FEED_ROUTE = guairaPipeRoute([[264,250],[264,308],[447,308],[447,335]]);
const RETURN_ROUTE = guairaPipeRoute([[264,250],[264,279],[344,279],[344,289]]);

function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save(); c.beginPath(); c.rect(0, 23, 320, 157); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    draw(Number.isFinite(cx) ? Math.round(cx) : 0, Number.isFinite(cy) ? Math.round(cy) : 0);
    c.restore();
}

/** Background hardware has a dark edge and inset sheen, never a landing cap. */
function pipe(c: CanvasRenderingContext2D, x: number, y: number, length: number, vertical = false, wet = false) {
    drawGuairaPipe(c, x, y, length, wet, 0, true, vertical, 1, false, PIPE);
}

/** One quiet opening explains the water's purpose without adding scenery actors. */
function irrigationWindow(c: CanvasRenderingContext2D, x: number, y: number) {
    // Uneven masonry reveal gives the crop view a real opening in the workshop.
    r(c, x - 5, y - 7, 102, 65, '#ba9476');
    r(c, x - 3, y - 5, 98, 61, '#d0ac87');
    r(c, x, y, 92, 56, P.recess);
    r(c, x + 3, y + 3, 86, 50, '#d6dac1');
    polygon(c, [[x + 3,y + 22],[x + 23,y + 12],[x + 40,y + 18],
        [x + 63,y + 16],[x + 88,y + 24],[x + 89,y + 53],[x + 3,y + 53]], '#b8b39a');
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
    r(c,left+3,top+2,2,65,'#c9ab85');r(c,left+width-5,top+3,2,64,'#a1876a');
    for(const yy of [top+13,top+54]) {
        r(c,left+2,yy,5,5,P.pipeShade);r(c,left+width-7,yy,5,5,P.pipeShade);
        r(c,left+3,yy+1,2,1,'#cfb58c');r(c,left+width-6,yy+1,2,1,'#cfb58c');
    }
    for (const yy of [top + 15, top + 56]) for (const xx of [left + 2,left + width - 3])
        r(c, xx, yy, 1, 2, P.light);
    pipe(c, left + 20, top + 74, 25, true, true);
    pipe(c, left + 20, top + 99, 29, true, !open);
    drawGuairaPipeSaddle(c,left+24,top+83,true,PIPE);
    // Recessed sight glass is neutral; it never borrows the jet's damage palette.
    r(c, left + 17, top + 16, 14, 45, P.pipeShade);
    r(c, left + 19, top + 18, 10, 41, '#b4ae8e');
    r(c, left + 20, top + 19, 2, 37, '#dad0aa');
    // The open relief leaves only a shallow residue in this inspection glass.
    r(c, left + 24, top + (open ? 48 : 21), 3, open ? 5 : 32, P.safe);
    for (let yy = 0; yy < 4; yy++) r(c, left + 27, top + 23 + yy * 8, 2, 1, P.pipeShade);
    // A mechanical flap remains open after the burst, even with reduced motion.
    const flapY = top + 66;
    r(c, left + 18, flapY - 4, 13, 9, P.pipeShade);
    line(c, left + 21, flapY + (open ? 3 : -1), left + 29,
        flapY + (open ? -3 : -1), P.light, 2);
    // Keep the collector's label beside the lid, outside the reward/jump arc.
    pixelText(c, 'ALIVIO', left + width + 8, top - 31, P.pipe);
    if (open) pixelText(c, 'ABERTO', left + width + 8, top - 43, P.pipe);
}

/** Recessed wall brackets support the real one-way planks. Their short lower
 * edges never imitate a second landing or obscure the pipe and water below. */
function maintenanceBrackets(c: CanvasRenderingContext2D, x: number, y: number, left: number, right: number, top: number) {
    for (const anchor of [left + 7, right - 10]) {
        r(c, anchor - x, top + 7 - y, 4, 28, P.recess);
        r(c, anchor + 1 - x, top + 8 - y, 1, 25, '#c3a27e');
        line(c, anchor - 5 - x, top + 8 - y, anchor + 1 - x, top + 25 - y, P.pipeShade, 2);
        r(c, anchor - 2 - x, top + 29 - y, 8, 6, P.pipeShade);
        r(c, anchor - 1 - x, top + 30 - y, 6, 4, P.brass);
        r(c, anchor + 1 - x, top + 31 - y, 2, 1, P.light);
    }
}

/** The broken lid chooses the real outlet. A single simulation-clock flow runs
 * from the collector to the grate, or into the screened pressure return. */
export function drawReliefBackground(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number,
    time = 0, reducedMotion = false) {
    layer(c, cx, cy, (x, y) => {
        const open = reliefOpen(level);
        r(c, 0, 23, 320, 157, P.wall);
        r(c, 0, 296 - y, 320, 88, '#d2ad87');
        drawWorkshopClerestory(c, 286 - x, 44 - y, 70, time, reducedMotion, true);
        drawWorkshopClerestory(c, 421 - x, 34 - y, 65, time, reducedMotion);
        drawWorkshopClerestory(c, 570 - x, 42 - y, 70, time, reducedMotion);
        // Deep plaster bays organise the cutaway into a repair wall, water
        // service wall and field-facing inspection wall. None is walkable.
        // The vertical reveals meet the actual floor, so no jamb hangs over a
        // jump corridor. Background-only inner shadows give them their depth.
        drawWorkshopWallBay(c, 16 - x, 153 - y, 171, 183);
        drawWorkshopWallBay(c, 303 - x, 194 - y, 204, 142);
        drawWorkshopWallBay(c, 518 - x, 138 - y, G.width * 16 - 526, 198);
        drawWorkshopRoofFrame(c, x, y, 6, 752, 18, 143);
        // Field light falls only on the inspection wall beyond the live jet.
        // Keep the mullion gap and stop short of the real floor's pale cap.
        for (const [left, right] of [[536,573],[578,614]] as const) {
            polygon(c, [[left - x,323 - y],[right - x,323 - y],
                [right - 3 - x,332 - y],[left - 3 - x,332 - y]], '#d9b68e');
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
        irrigationWindow(c, 530 - x, 272 - y);
        maintenanceBrackets(c, x, y, G.gantryStart, G.gantryEnd, G.gantryY);
        maintenanceBrackets(c, x, y, G.landingStart, G.landingEnd, G.landingY);
        maintenanceBrackets(c, x, y, G.returnStart, G.returnEnd, G.returnY);
        pixelText(c, 'SALTO', G.gantryStart + 17 - x, G.gantryY + 13 - y, P.pipe);
        pixelText(c, 'SACADA', G.landingStart + 10 - x, G.landingY - 38 - y, P.pipeShade);
        // Old mineral traces hug the return outlet and feed joints. These dry,
        // broken vertical stains never borrow cyan, foam or a landing edge;
        // draw before hardware so pipe silhouettes and labels remain intact.
        for (const [xx, yy, height] of [[292,289,9],[303,291,6],[341,289,8],
            [286,312,10],[403,312,7],[445,322,8]] as const) {
            r(c, xx - x, yy - y, 3, height, '#bfa180');
            r(c, xx + 1 - x, yy + height - y, 1, 2, '#c6aa88');
        }
        reliefCollector(c, x, y, open);
        pipe(c, 269 - x, 304 - y, 174, false, !open);
        drawGuairaPipeElbow(c, 260 - x, 304 - y, !open, false, true, PIPE);
        drawGuairaPipeElbow(c, 443 - x, 304 - y, !open, true, false, PIPE);
        pipe(c, 443 - x, 313 - y, 23, true, !open);
        // One screened return explains the alternate path taken by released water.
        pipe(c, 264 - x, 275 - y, 30, false, open);
        // A real three-way fitting: the dry return must not paint across the
        // live vertical feed, and opening the return isolates its lower port.
        r(c, 260-x, 275-y, 9, 9, P.pipe);
        r(c, 261-x, 276-y, 7, 7, P.brass);
        r(c, 261-x, 276-y, 1, 6, P.light);
        r(c, 263-x, 275-y, 3, 5, P.safe);
        r(c, 263-x, 280-y, 3, 4, open ? PIPE.dry : P.safe);
        r(c, 266-x, 278-y, 3, 3, open ? P.safe : PIPE.dry);
        // Recessed stone seat, cast frame and a lower sump make the screened
        // return a destination, with water turning down behind its last bar.
        r(c,289-x,273-y,61,22,'#b79a77');
        r(c,290-x,274-y,59,20,P.pipeShade);
        r(c, 291 - x, 275 - y, 57, 18, P.recess);
        r(c, 294 - x, 277 - y, 51, 13, '#a08e73');
        if (open) {
            // The waterline meets the actual pipe mouth instead of floating
            // six pixels below it. Bars are painted over the moving water.
            r(c, 291 - x, 278 - y, 54, 3, P.safe);
            r(c,294-x,281-y,51,9,'#688f87');
            r(c,296-x,288-y,47,2,'#5b7f77');
            r(c,343-x,280-y,3,10,P.safe);
        }
        drawGuairaPipeFlow(c, open ? RETURN_ROUTE : FEED_ROUTE, x, y, time, reducedMotion, PIPE.glint);
        drawGuairaPipeSaddle(c,380-x,308-y,false,PIPE);
        for (let xx = 297; xx < 347; xx += 8) {
            r(c, xx - x, 276 - y, 2, 15, P.pipeShade);
            r(c, xx - x, 277 - y, 1, 3, '#c3a17c');
        }
        r(c, 294-x, 290-y, 51, 2, P.pipeShade);
        for(const xx of [292,346])for(const yy of [276,291]) {
            r(c,xx-x,yy-y,1,1,'#d0b38a');
        }
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
        pixelText(c, 'SAIDA', G.returnStart + 7 - x, G.returnY - 26 - y, P.pipeShade);
        line(c, G.returnEnd + 12 - x, G.returnY + 40 - y, G.returnEnd + 12 - x, G.returnY + 49 - y, P.pipeShade);
        line(c, G.returnEnd + 9 - x, G.returnY + 46 - y, G.returnEnd + 12 - x, G.returnY + 49 - y, P.pipeShade);
        line(c, G.returnEnd + 15 - x, G.returnY + 46 - y, G.returnEnd + 12 - x, G.returnY + 49 - y, P.pipeShade);
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
        pixelText(c, b.active ? '0' : s.phase === 'charging' || s.phase === 'rising' || s.danger ? '!' : '-', gaugeX + 2, gaugeY - 9, P.ink);
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
