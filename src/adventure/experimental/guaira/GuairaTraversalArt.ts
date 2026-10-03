import { drawGuairaWindPump, drawGuairaChannelFlow, drawGuairaRiceFlow, drawGuairaSluiceFlow, drawGuairaPoolFlow } from './GuairaWaterworksArt';
import { box as r, pixelLine as line, polygon, oval, roof } from '../../WorldPainting';
import type { WorldLevel, WorldObjects } from '../../WorldPhysics';
import { drawGuairaWorker } from './GuairaWorkerArt';
import { supportsStanding } from '../../../world/tileRules';

/** Authored scenery only. The stage and WorldObjects remain the collision/state authority. */
export const GUAIRA_TRAVERSAL_ART = Object.freeze({
    width: 1536, height: 288, floorY: 224, pitLeft: 416, pitRight: 624,
    valveId: 'guaira-valve', bridgeId: 'guaira-bridge',
    workerFeet: Object.freeze([{ x: 304, y: 216 }, { x: 720, y: 204 }]),
});

const P = {
    ink: '#493c43', earth: '#b86b4c', earthLight: '#d68b5b', earthDark: '#874a3e',
    dust: '#e8b17c', plaster: '#e3c49a', plasterShade: '#bf967d', tile: '#b76656',
    leaf: '#7e9851', leafShade: '#526e48', leafLight: '#b2ba6b',
    water: '#63b6bf', waterShade: '#326f81', waterLight: '#b0dcce',
    wood: '#997454', woodLight: '#d1ac77', woodShade: '#695449', bronze: '#b78a56',
} as const;

const visible = (x: number, width: number, cx: number) => x + width >= cx - 2 && x <= cx + 322;
const clock = (time: number, reducedMotion: boolean) => reducedMotion || !Number.isFinite(time) ? 0 : Math.max(0, time);

/** Every layer restores caller state; round camera once so the art never shimmers between pixels. */
function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save();
    c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    draw(Number.isFinite(cx) ? Math.round(cx) : 0, Number.isFinite(cy) ? Math.round(cy) : 0);
    c.restore();
}

function cactus(c: CanvasRenderingContext2D, x: number, y: number, h: number, arms = true) {
    oval(c, x - 8, y - 2, 20, 4, '#aa7053');
    r(c, x - 1, y - h + 2, 7, h - 2, P.leafShade);
    r(c, x, y - h, 5, h - 2, P.leaf);
    r(c, x + 1, y - h + 2, 1, h - 3, P.leafLight);
    if (arms) {
        r(c, x - 8, y - h + 13, 8, 5, P.leafShade);
        r(c, x - 8, y - h + 7, 4, 9, P.leaf);
        r(c, x - 7, y - h + 8, 1, 7, P.leafLight);
        r(c, x + 5, y - h + 19, 9, 4, P.leafShade);
        r(c, x + 10, y - h + 11, 4, 10, P.leaf);
        r(c, x + 11, y - h + 12, 1, 8, P.leafLight);
    }
    for (let yy = 7; yy < h; yy += 8) r(c, x + 4, y - yy, 1, 2, '#cfce89');
}

function pot(c: CanvasRenderingContext2D, x: number, y: number, w = 8) {
    polygon(c, [[x, y - 8], [x + w, y - 8], [x + w - 1, y], [x + 2, y]], '#985544');
    r(c, x, y - 9, w, 2, '#d99363');
    r(c, x + 2, y - 6, 2, 5, '#bf7952');
}

function house(c: CanvasRenderingContext2D, x: number, floor: number, w: number, h: number, variant: number) {
    const top = floor - h;
    oval(c, x - 4, floor - 2, w + 9, 5, '#ad7559');
    r(c, x + 4, top + 16, w - 8, h - 16, P.plasterShade);
    r(c, x + 5, top + 16, w - 18, h - 19, P.plaster);
    r(c, x + 6, top + 20, w - 21, 2, '#efd6ae');
    r(c, x + w - 16, top + 19, 8, h - 22, '#c7a17f');
    roof(c, x, top, w, 17);
    // Staggered baked clay courses, rather than an unbroken colored slab.
    for (let xx = 8; xx < w - 9; xx += 8) r(c, x + xx, top + 8, 6, 1, '#d58568');
    r(c, x + 14, floor - 29, 15, 26, '#816257');
    r(c, x + 16, floor - 27, 11, 24, '#604e4b');
    r(c, x + 17, floor - 26, 2, 23, '#92725c');
    r(c, x + 25, floor - 17, 1, 2, '#c7a575');
    r(c, x + 12, floor - 3, 20, 3, '#b78d70');
    const wx = x + w - 35;
    r(c, wx - 1, top + 29, 19, 19, '#b08a70');
    r(c, wx, top + 29, 16, 15, '#4d7372');
    r(c, wx + 2, top + 31, 5, 10, '#86a59a');
    r(c, wx + 9, top + 31, 5, 10, '#688f88');
    r(c, wx + 7, top + 30, 2, 13, '#d5b98d');
    r(c, wx - 3, top + 29, 3, 17, '#a77959');
    r(c, wx + 16, top + 29, 3, 17, '#9d7156');
    r(c, wx - 3, top + 45, 22, 2, '#edd0a2');
    // Small repairs tell the place's age without turning the facade into noise.
    r(c, x + 6, floor - 10, 6, 5, '#d0a67e');
    r(c, x + w - 23, floor - 7, 9, 4, '#c39775');
    if (variant === 0) {
        pot(c, x + w - 6, floor, 9);
        line(c, x + w - 2, floor - 9, x + w - 3, floor - 17, P.leafShade);
        line(c, x + w - 2, floor - 12, x + w + 2, floor - 16, P.leaf);
        r(c, x + 10, top + 21, 10, 4, '#c09d79');
    } else {
        r(c, x + 7, floor - 31, 4, 24, '#9f7e61');
        r(c, x + 7, floor - 30, 1, 22, '#d8b187');
        r(c, x + w - 12, floor - 12, 3, 10, '#b87b53');
        pot(c, x + w - 9, floor, 7);
    }
}

function riceTerrace(c: CanvasRenderingContext2D, x: number, y: number, width: number, row: number, time: number, reducedMotion: boolean, wet: boolean) {
    // Shallow flooded beds echo the island's stone borders. Their grey, broken
    // rims stay softer than the continuous cream edge of real supporting tiles.
    r(c, x, y + 5, width, 10, '#8c9273');
    r(c, x + 2, y + 6, width - 4, 6, '#83aaa0');
    r(c, x + 3, y + 6, width - 6, 1, '#acc3ac');
    r(c, x, y + 13, width, 3, '#9c987b');
    for (let xx = 0; xx < width; xx += 19) {
        const w = Math.min(18, width - xx);
        r(c, x + xx + 1, y + 12, w - 1, 2, '#b5b19a');
        r(c, x + xx + 2, y + 12, Math.min(9, w - 2), 1, '#c5c1a7');
        r(c, x + xx + w - 1, y + 14, 1, 2, '#818c75');
    }
    r(c, x, y + 5, 3, 8, '#a9ac92');
    r(c, x + width - 3, y + 5, 3, 8, '#969e84');
    drawGuairaRiceFlow(c, x, y, width, wet, time, reducedMotion, row);
    // Alternating planted clumps leave water between their feet. Neighbouring
    // beds offset their groups; a single repeating grass glyph cannot emerge.
    const clumps = [[8, 14, -3], [20, 11, 3], [31, 16, -2], [47, 12, 4]] as const;
    for (let group = -row * 17; group < width; group += 57) for (const [offset, height, lean] of clumps) {
        const xx = group + offset;
        if (xx < 6 || xx > width - 7) continue;
        const sway = Math.floor(time / 1200 + group / 57 + row) % 4 === 0 ? 1 : 0;
        const root = y + 10, tip = root - height;
        r(c, x + xx - 2, root, 6, 2, '#6f9180');
        polygon(c, [[x + xx - 1,root],[x + xx - 6,tip + 4],[x + xx - 3,tip + 5],[x + xx + 2,root]], '#587c53');
        polygon(c, [[x + xx,root],[x + xx + lean + sway,tip],[x + xx + lean + 2 + sway,tip + 2],[x + xx + 3,root]], '#799951');
        polygon(c, [[x + xx + 1,root],[x + xx + 7 + sway,tip + 4],[x + xx + 6,tip + 8],[x + xx + 3,root]], '#6f9251');
        line(c, x + xx + 1, root - 2, x + xx + lean + 1 + sway, tip + 2, '#a3b56b');
        line(c, x + xx + 2, root - 3, x + xx + 5 + sway, tip + 6, '#96ab61');
        r(c, x + xx + 4, root + 1, 3, 1, '#a6c1ab');
    }
}

/** Broad clay seams and sloping facets continue across tiles, like the map's cut island. */
function cutBank(c: CanvasRenderingContext2D, left: number, right: number, cx: number, cy: number, irrigated: boolean) {
    const x = left - cx, w = right - left;
    r(c, x, 228 - cy, w, 60, irrigated ? '#b5865f' : '#ba7754');
    const seam = [[0,0],[29,2],[61,1],[96,5],[131,3],[168,7],[206,4],[243,5],[280,1],[318,3],[359,0]] as const;
    for (let block = left - 35; block < right; block += 359) {
        for (const [base, color] of [[241, irrigated ? '#ac7c58' : '#b06a4e'], [267, irrigated ? '#a27454' : '#a76149']] as const) {
            const edge = seam.map(([sx, sy]) => [block + sx - cx, base + sy - cy] as const);
            polygon(c, [...edge, [block + 359 - cx, 288 - cy], [block - cx, 288 - cy]], color);
        }
        for (const [dx, dy, span] of [[18,247,46],[103,250,58],[234,244,51],[312,252,37]] as const) {
            polygon(c, [[block + dx - cx,dy - cy],[block + dx + span - cx,dy + 4 - cy],
                [block + dx + span - 13 - cx,283 - cy],[block + dx + 12 - cx,288 - cy]], irrigated ? '#b2825b' : '#b67150');
            line(c, block + dx + 5 - cx, dy + 2 - cy, block + dx + span - 8 - cx, dy + 5 - cy, irrigated ? '#bc9167' : '#c08158');
        }
        for (const [dx, dy, span] of [[5,235,18],[76,264,23],[181,235,26],[267,276,17],[325,256,15]] as const) {
            r(c, block + dx - cx, dy - cy, span, 1, irrigated ? '#c3996c' : '#cf9266');
            r(c, block + dx + span - 5 - cx, dy + 1 - cy, 8, 1, irrigated ? '#b68a60' : '#c48359');
        }
    }
}

/** Sunburnt township and fields sit behind the quiet y216–224 running strip. */
export function drawGuairaTraversalBackground(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reducedMotion: boolean, waterActive = false) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const t = clock(time, reducedMotion);
        r(c, 0, 0, 320, 180, '#e5b585');
        r(c, 0, 0, 320, 29, '#eac799');
        r(c, 0, 29, 320, 32, '#e7bd8d');
        const sunX = 236 - Math.round(cameraX * .06), sunY = 29 - Math.round(cameraY * .07);
        oval(c, sunX, sunY, 19, 19, '#f3d6a3');
        // Low, irregular tablelands retain the warm geography at every camera stop.
        for (let i = -1; i < 5; i++) {
            const x = i * 108 - Math.round(cameraX * .16) % 108, y = 94 - Math.round(cameraY * .22);
            polygon(c, [[x - 14,y + 14],[x + 8,y + 11],[x + 14,y + 2],[x + 44,y],[x + 58,y + 14],[x + 90,y + 16],[x + 116,y + 38],[x - 14,y + 38]], '#c69978');
            r(c, x + 17, y + 4, 25, 2, '#d4a982');
        }
        const horizon = 167 - cameraY;
        r(c, 0, horizon, 320, 58, '#c38b61');
        for (let x = -Math.round(cameraX * .45) % 58 - 58; x < 320; x += 58) {
            polygon(c, [[x,horizon + 8],[x + 17,horizon + 1],[x + 42,horizon + 3],[x + 65,horizon + 18],[x + 65,horizon + 26],[x,horizon + 26]], '#c99465');
            r(c, x + 21, horizon + 8, 8, 1, '#d6a270');
        }
        // Street landmarks do not borrow the bright top edge used by solid platforms.
        if (visible(14, 30, cameraX)) cactus(c, 22 - cameraX, 211 - cameraY, 43);
        if (visible(44, 90, cameraX)) house(c, 46 - cameraX, 207 - cameraY, 76, 66, 0);
        if (visible(130, 26, cameraX)) {
            cactus(c, 137 - cameraX, 209 - cameraY, 28);
            cactus(c, 150 - cameraX, 210 - cameraY, 16, false);
        }
        if (visible(166, 100, cameraX)) house(c, 168 - cameraX, 205 - cameraY, 88, 77, 1);
        if (visible(271, 32, cameraX)) drawGuairaWindPump(c, 286 - cameraX, 186 - cameraY, t, reducedMotion);
        if (visible(277, 53, cameraX)) {
            r(c, 280 - cameraX, 206 - cameraY, 15, 8, '#9e755a');
            r(c, 280 - cameraX, 206 - cameraY, 15, 2, '#c49e72');
            r(c, 284 - cameraX, 208 - cameraY, 1, 5, '#d1b381');
        }
        // Reservoir is visibly upstream of the sluice, higher than the destination canal.
        if (visible(469, 132, cameraX)) {
            const x = 481 - cameraX, y = 149 - cameraY;
            polygon(c, [[x - 14,y + 55],[x - 4,y + 18],[x + 14,y + 4],[x + 82,y + 4],[x + 109,y + 49],[x + 117,y + 64]], '#b77756');
            oval(c, x, y, 83, 24, '#ae8a69');
            oval(c, x + 3, y + 1, 77, 19, '#d4ba91');
            oval(c, x + 7, y + 4, 69, 12, P.waterShade);
            oval(c, x + 9, y + 4, 65, 9, '#83c0bb');
            r(c, x + 15, y + 7, 18, 1, '#c5dfc8');
            r(c, x + 60, y + 8, 7, 1, '#c5dfc8');
        }
        // Three stepped rice plots, with earth berms and a continuous service bank.
        for (const plot of [{ x: 650, y: 174, w: 134 }, { x: 788, y: 163, w: 128 }, { x: 919, y: 154, w: 103 }, { x: 1032, y: 166, w: 78 }, { x: 1370, y: 136, w: 144 }]) {
            if (!visible(plot.x, plot.w, cameraX)) continue;
            riceTerrace(c, plot.x - cameraX, plot.y - cameraY, plot.w, 0, t, reducedMotion, waterActive);
            riceTerrace(c, plot.x - cameraX, plot.y + 18 - cameraY, plot.w, 1, t, reducedMotion, waterActive);
        }
        if (visible(694, 52, cameraX)) {
            pot(c, 703 - cameraX, 210 - cameraY, 10);
        }
        // A shaded farm shed and open corral mark the route's end, leaving the exit lane clear.
        if (visible(976, 176, (cameraX - 416))) {
            house(c, 987 - (cameraX - 416), 205 - (cameraY + 32), 57, 55, 1);
            for (const x of [1054, 1087, 1120]) {
                r(c, x - (cameraX - 416), 188 - (cameraY + 32), 3, 26, '#92745b');
                r(c, x - (cameraX - 416), 189 - (cameraY + 32), 1, 23, '#c4a77b');
            }
            r(c, 1054 - (cameraX - 416), 194 - (cameraY + 32), 69, 2, '#b7976d');
            r(c, 1054 - (cameraX - 416), 204 - (cameraY + 32), 69, 2, '#a38361');
            r(c, 1081 - (cameraX - 416), 175 - (cameraY + 32), 50, 11, '#9e795b');
            r(c, 1082 - (cameraX - 416), 176 - (cameraY + 32), 48, 8, '#d0b082');
            // Carved horn-and-gate pictogram points to Ossabravo; no new interaction target.
            line(c, 1092 - (cameraX - 416), 178 - (cameraY + 32), 1095 - (cameraX - 416), 181 - (cameraY + 32), P.woodShade);
            line(c, 1098 - (cameraX - 416), 178 - (cameraY + 32), 1095 - (cameraX - 416), 181 - (cameraY + 32), P.woodShade);
            r(c, 1094 - (cameraX - 416), 180 - (cameraY + 32), 3, 3, P.woodShade);
            line(c, 1105 - (cameraX - 416), 180 - (cameraY + 32), 1121 - (cameraX - 416), 180 - (cameraY + 32), P.woodShade);
            line(c, 1118 - (cameraX - 416), 177 - (cameraY + 32), 1121 - (cameraX - 416), 180 - (cameraY + 32), P.woodShade);
            line(c, 1118 - (cameraX - 416), 183 - (cameraY + 32), 1121 - (cameraX - 416), 180 - (cameraY + 32), P.woodShade);
        }
        // A low-contrast, unbroken strip separates decorative bases from walkable terrain.
        for (const [left, right] of [[0, 416], [624, 704], [976, 1120]]) {
            const x = Math.max(left, cameraX), end = Math.min(right, cameraX + 320);
            if (end > x) r(c, x - cameraX, 217 - cameraY, end - x, 7, '#cd9668');
        }
        for (let wx = Math.floor(cameraX / 32) * 32; wx < cameraX + 320; wx += 32) {
            if ((wx >= 416 && wx < 624) || wx >= 704) continue;
            r(c, wx + 4 - cameraX, 221 - cameraY, 8, 1, '#d8a679');
        }
    });
}

/** Paint only existing supporting tiles; the open sluice remains a real, visible gap. */
export function drawGuairaTraversalTerrain(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number, _time: number, _reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const startCol = Math.max(0, level.worldToCol(cameraX)), endCol = Math.min(level.data.width - 1, level.worldToCol(cameraX + 319));
        const startRow = Math.max(0, level.worldToRow(cameraY)), endRow = Math.min(level.data.height - 1, level.worldToRow(cameraY + 179));
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            const tile = level.data.tiles[row]?.[col];
            if (!supportsStanding(tile ?? 0)) continue;
            const wx = level.colToWorldX(col), wy = level.rowToWorldY(row), x = wx - cameraX, y = wy - cameraY;
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0), rice = wx >= 624;
            r(c, x, y, 16, 16, rice ? '#aa764f' : '#a55f47');
            if (top) {
                r(c, x, y + 3, 16, 13, rice ? '#b47e52' : P.earth);
                r(c, x, y, 16, 2, rice ? '#dcc28b' : '#f0be83');
                r(c, x, y + 2, 16, 2, rice ? '#c8a66d' : '#d8915f');
            }
            if (col === 25 || col === 39) {
                const edge = col === 25 ? x + 12 : x;
                r(c, edge, y + (top ? 4 : 0), 4, top ? 12 : 16, '#765346');
                r(c, edge + (col === 25 ? 0 : 3), y + (top ? 4 : 0), 1, top ? 12 : 16, '#d2b28a');
            }
        }
        // Mask the authored geology with the real solid tiles. Preserve every
        // walkable cap and retaining edge, including changed test geometry.
        c.save(); c.beginPath();
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            if (!supportsStanding(level.data.tiles[row]?.[col] ?? 0)) continue;
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0);
            const left = !supportsStanding(level.data.tiles[row]?.[col - 1] ?? 0);
            const right = !supportsStanding(level.data.tiles[row]?.[col + 1] ?? 0);
            c.rect(level.colToWorldX(col) - cameraX + (left ? 4 : 0), level.rowToWorldY(row) - cameraY + (top ? 4 : 0),
                16 - (left ? 4 : 0) - (right ? 4 : 0), 16 - (top ? 4 : 0));
        }
        c.clip();
        if (visible(0, 416, cameraX)) cutBank(c, 0, 416, cameraX, cameraY, false);
        if (visible(624, 912, cameraX)) cutBank(c, 624, 1536, cameraX, cameraY, true);
        c.restore();
    });
}

function channel(c: CanvasRenderingContext2D, left: number, right: number, y: number, wet: boolean, time: number, reducedMotion: boolean, direction: -1 | 1) {
    const w = right - left;
    r(c, left, y, w, 8, '#a98564');
    r(c, left, y + 1, w, 5, wet ? P.waterShade : '#97684e');
    r(c, left, y + 2, w, 3, wet ? P.water : '#b8865e');
    r(c, left, y + 7, w, 1, '#d6b486');
    drawGuairaChannelFlow(c, left, right, y, wet, time, reducedMotion, direction);
    if (!wet) for (let xx = 5; xx < w - 8; xx += 25) {
        line(c, left + xx, y + 1, left + xx + 3, y + 4, '#805a47');
        r(c, left + xx + 2, y + 4, 5, 1, '#805a47');
    }
}

/** Recessed distribution pipes join the sluice shoulders to the two open canals. */
function distributionBranch(c: CanvasRenderingContext2D, bankX: number, sluiceX: number, cx: number, cy: number) {
    // The sloped bronze silhouette has no pale horizontal edge to imply a landing.
    line(c, bankX - cx, 207 - cy, sluiceX - cx, 195 - cy, '#72584d', 7);
    line(c, bankX + 1 - cx, 208 - cy, sluiceX + 1 - cx, 196 - cy, '#a07b56', 5);
    line(c, bankX + 1 - cx, 208 - cy, sluiceX + 1 - cx, 196 - cy, '#c09a6b', 1);
    for (const fraction of [0, .48, 1]) {
        const x = Math.round(bankX + (sluiceX - bankX) * fraction) - cx;
        const y = Math.round(207 - 12 * fraction) - cy;
        r(c, x, y - 1, 4, 9, '#806651');
        r(c, x + 1, y, 2, 7, '#b39368');
        r(c, x + 1, y + 1, 1, 1, '#d0af7d');
    }
}

/** Pure projection of the actual valve/lift, including the intermediate rising position. */
export function drawGuairaTraversalObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, time: number, reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const t = clock(time, reducedMotion), valve = objects.get(GUAIRA_TRAVERSAL_ART.valveId), bridge = objects.get(GUAIRA_TRAVERSAL_ART.bridgeId);
        const wet = !!bridge?.active;
        const rise = bridge ? Math.max(0, Math.min(1, (336 - bridge.y) / 112)) : 0;
        // Public branch becomes cyan all the way back through the dry neighborhood.
        if (visible(78, 338, cameraX)) channel(c, 78 - cameraX, 416 - cameraX, 207 - cameraY, wet, t, reducedMotion, -1);
        if (visible(624, 70, cameraX)) channel(c, 624 - cameraX, 694 - cameraX, 207 - cameraY, wet, t, reducedMotion, 1);
        if (visible(976, 144, cameraX)) channel(c, 976 - cameraX, 1120 - cameraX, 207 - cameraY, wet, t, reducedMotion, 1);
        // The final canal uses the same water and hoist language as the lesson.
        const finalBridge = objects.get('guaira-rice-bridge');
        if (visible(1120, 240, cameraX)) {
            r(c, 1120 - cameraX, 264 - cameraY, 240, 24, P.waterShade);
            drawGuairaPoolFlow(c, 1120 - cameraX, 1360 - cameraX, 264 - cameraY, !!finalBridge?.active, t, reducedMotion);
            for (const wx of [1123, 1355]) {
                r(c, wx - cameraX, 189 - cameraY, 2, 91, '#8a7964');
                for (let yy = 192; yy < Math.min(279, finalBridge?.y ?? 279); yy += 7)
                    r(c, wx - cameraX, yy - cameraY, 2, 2, '#b1a18a');
            }
        }
        // Workers stand in front of the shallow background channel, behind Feka's path.
        const workerState = { activeTimeMs: time, valveActive: !!valve?.active, bridgeRise: rise, reducedMotion };
        if (visible(296, 24, cameraX)) drawGuairaWorker(c, 304 - cameraX, 216 - cameraY, 'pump', workerState);
        if (visible(712, 24, cameraX)) drawGuairaWorker(c, 720 - cameraX, 204 - cameraY, 'rice', workerState);
        if (visible(400, 240, cameraX)) {
            // Both branches pass behind the gate masonry, chains and real moving deck.
            distributionBranch(c, 411, 500, cameraX, cameraY);
            distributionBranch(c, 623, 541, cameraX, cameraY);
            // Pit back wall and vertical sluice have no misleading horizontal landing lip.
            const x = 498 - cameraX, top = 175 - cameraY;
            r(c, x, top, 50, 85, '#92745f');
            r(c, x + 6, top + 5, 38, 80, '#705950');
            r(c, x + 9, top + 6, 32, 78, '#a08164');
            r(c, x + 1, top + 1, 4, 83, '#c3ac89');
            r(c, x + 45, top + 1, 4, 83, '#b49b7a');
            // Lifted gate tracks real bridge height; animation does not advance simulation.
            const gateY = top + 14 - Math.round(rise * 11);
            for (let yy = 0; yy < 35; yy += 7) {
                r(c, x + 8, gateY + yy, 34, 6, yy % 14 === 0 ? '#a7825d' : '#926c50');
                r(c, x + 9, gateY + yy, 32, 1, '#c4a074');
            }
            r(c, x + 13, gateY, 3, 33, '#665951');
            r(c, x + 35, gateY, 3, 33, '#665951');
            r(c, x + 23, top - 9, 3, 44, P.bronze);
            r(c, x + 14, top - 10, 20, 3, '#745d4f');
            r(c, x + 14, top - 11, 20, 1, '#d7b580');
            // Water stays below the service deck and cannot be mistaken for walkable ground.
            if (wet) {
                const spillY = gateY + 35;
                r(c, x + 10, spillY, 30, 269 - cameraY - spillY, P.waterShade);
                r(c, x + 13, spillY, 23, 269 - cameraY - spillY, P.water);
                r(c, x + 14, spillY, 3, 269 - cameraY - spillY, '#8bcec7');
                drawGuairaSluiceFlow(c, x, spillY, 265 - cameraY, wet, t, reducedMotion);
                r(c, 424 - cameraX, 265 - cameraY, 192, 23, P.waterShade);
                r(c, 428 - cameraX, 265 - cameraY, 184, 3, P.water);
                drawGuairaPoolFlow(c, 428 - cameraX, 612 - cameraX, 265 - cameraY, wet, t, reducedMotion, x + 25);
            } else {
                r(c, 424 - cameraX, 265 - cameraY, 192, 23, '#8c5e4b');
                for (let xx = 432; xx < 610; xx += 31) {
                    line(c, xx - cameraX, 269 - cameraY, xx + 7 - cameraX, 276 - cameraY, '#684b42');
                    line(c, xx + 7 - cameraX, 276 - cameraY, xx + 3 - cameraX, 284 - cameraY, '#684b42');
                }
            }
            // Hoist chains flank the deck and never cover a central landing silhouette.
            for (const wx of [420, 617]) {
                r(c, wx - cameraX, 193 - cameraY, 2, 86, '#8a7964');
                for (let yy = 195; yy < Math.min(279, bridge?.y ?? 279); yy += 7) r(c, wx - cameraX, yy - cameraY, 2, 2, '#b1a18a');
            }
        }
        for (const bridge of [objects.get(GUAIRA_TRAVERSAL_ART.bridgeId), objects.get('guaira-rice-bridge')]) if (bridge && visible(bridge.x, bridge.width, cameraX)) {
            const x = Math.round(bridge.x) - cameraX, y = Math.round(bridge.y) - cameraY, w = Math.round(bridge.width), h = Math.round(bridge.height);
            r(c, x, y, w, h, P.woodShade);
            r(c, x, y, w, 2, '#ead19b');
            r(c, x, y + 2, w, Math.max(0, h - 5), P.wood);
            for (let xx = 0; xx < w; xx += 13) {
                r(c, x + xx, y + 2, 1, Math.max(0, h - 5), '#6b5142');
                r(c, x + xx + 2, y + 3, Math.min(8, w - xx - 2), 1, P.woodLight);
            }
            r(c, x, y + h - 3, w, 3, '#716359');
            for (const xx of [2, w - 9]) {
                r(c, x + xx, y + 2, 7, Math.max(0, h - 2), '#68878a');
                r(c, x + xx + 2, y + 4, 2, 2, '#b2c4b2');
            }
        }
        for (const valve of [objects.get(GUAIRA_TRAVERSAL_ART.valveId), objects.get('guaira-rice-valve')]) if (valve && visible(valve.x - 4, valve.width + 8, cameraX)) {
            const x = Math.round(valve.x) - cameraX, y = Math.round(valve.y) - cameraY, w = Math.round(valve.width), h = Math.round(valve.height);
            r(c, x, y, w, h, P.ink);
            r(c, x + 2, y + 1, w - 4, Math.max(1, h - 3), valve.active ? '#5c9c8c' : '#bb8151');
            r(c, x + 3, y + 1, w - 6, 1, valve.active ? '#b0dec6' : '#f1cf8e');
            // A stout treadle with a recessed valve emblem, entirely inside its real body.
            const mx = x + Math.floor(w / 2);
            r(c, mx - 4, y + 2, 9, 3, '#735846');
            r(c, mx - 3, y + 2, 7, 1, '#edcb88');
            r(c, mx, y + 2, 1, Math.min(4, h - 2), '#edcb88');
            r(c, x + 3, y + h - 2, w - 6, 1, '#685248');
            // A static downward marker connects the jump instruction to the real
            // pressure plate, not the nearby worker or the gap. It disappears
            // when solved and never moves or changes the collision body.
            if (!valve.active) {
                r(c, mx - 2, y - 15, 5, 8, P.ink);
                r(c, mx - 5, y - 9, 11, 3, P.ink);
                r(c, mx - 3, y - 6, 7, 2, P.ink);
                r(c, mx - 1, y - 4, 3, 2, P.ink);
                r(c, mx - 1, y - 14, 3, 7, '#ffe7a3');
                r(c, mx - 4, y - 8, 9, 1, '#ffe7a3');
                r(c, mx - 2, y - 7, 5, 2, '#ffe7a3');
                r(c, mx, y - 5, 1, 2, '#ffe7a3');
            }
        }
    });
}
