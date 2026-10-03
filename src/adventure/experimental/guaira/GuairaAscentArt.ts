import { box as r, pixelLine as line, polygon, roof } from '../../WorldPainting';
import type { WorldLevel, WorldObjects, MovingBody } from '../../WorldPhysics';
import { ART } from '../../../graphics/palette';
import { PixelGrid, type PixelFrame, type PixelPalette } from '../../../graphics/pixels';
import { pixelText } from '../../../graphics/BitmapFont';
import { isOneWayTile, supportsStanding } from '../../../world/tileRules';

/** Scenery is presentation only. Tiles and WorldObjects own every supporting surface. */
export const GUAIRA_ASCENT_ART = Object.freeze({
    width: 1344, height: 400, departureY: 304, terraceY: 144, recoveryY: 368,
    plankId: 'guaira-plank', liftId: 'guaira-service-lift', serviceId: 'guaira-inspection-carriage',
    workerFeet: Object.freeze([{ x: 166, y: 296 }, { x: 571, y: 295 }]),
});

const P = {
    ink: '#493c43', earth: '#b86b4c', earthLight: '#d68b5b', earthDark: '#874a3e',
    dust: '#e8b17c', plaster: '#e3c49a', plasterShade: '#bf967d', tile: '#b76656',
    leaf: '#7e9851', leafShade: '#526e48', leafLight: '#b2ba6b',
    water: '#63b6bf', waterShade: '#326f81', waterLight: '#b0dcce',
    wood: '#997454', woodLight: '#d1ac77', woodShade: '#695449', bronze: '#b78a56',
    deck: '#f2d69b', iron: '#687776', ironDark: '#4e5c5c',
} as const;

const visible = (x: number, w: number, cx: number) => x + w >= cx - 2 && x <= cx + 322;
const artTime = (t: number, reduced: boolean) => reduced || !Number.isFinite(t) ? 0 : Math.max(0, t);

// Round the origin before the local scan conversion; tiny odd wheels must not shimmer on scroll.
function oval(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    const ox = Math.round(x), oy = Math.round(y);
    for (let j = 0; j < h; j++) {
        const half = Math.sqrt(Math.max(0, 1 - ((j + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        r(c, ox + Math.ceil(w / 2 - half), oy + j, Math.floor(half * 2), 1, color);
    }
}

function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save();
    c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    draw(Number.isFinite(cx) ? Math.round(cx) : 0, Number.isFinite(cy) ? Math.round(cy) : 0);
    c.restore();
}

function cactus(c: CanvasRenderingContext2D, x: number, y: number, h: number) {
    r(c, x, y - h + 2, 6, h - 2, P.leafShade);
    r(c, x + 1, y - h, 4, h - 2, P.leaf);
    r(c, x + 2, y - h + 2, 1, h - 5, P.leafLight);
    r(c, x - 6, y - h + 14, 7, 4, P.leafShade);
    r(c, x - 6, y - h + 8, 3, 8, P.leaf);
    r(c, x + 5, y - h + 19, 8, 4, P.leafShade);
    r(c, x + 10, y - h + 13, 3, 8, P.leaf);
}

function sign(c: CanvasRenderingContext2D, x: number, y: number, w: number, rows: readonly string[]) {
    const h = rows.length * 8 + 5;
    r(c, x + 5, y + h, 2, 8, '#a58a68');
    r(c, x + w - 7, y + h, 2, 8, '#a58a68');
    r(c, x, y, w, h, '#967257');
    r(c, x + 1, y + 1, w - 2, h - 2, '#d7b787');
    r(c, x + 2, y + 2, w - 4, 1, '#e4c79a');
    rows.forEach((text, i) => pixelText(c, text, x + 4, y + 4 + i * 8, '#624f48'));
}

function house(c: CanvasRenderingContext2D, x: number, floor: number, w: number, h: number) {
    const top = floor - h;
    r(c, x + 4, top + 14, w - 8, h - 14, P.plasterShade);
    r(c, x + 5, top + 15, w - 18, h - 16, P.plaster);
    roof(c, x, top, w, 16);
    r(c, x + 13, floor - 27, 16, 26, '#9a765e');
    r(c, x + 15, floor - 26, 12, 25, '#6c5750');
    r(c, x + 16, floor - 24, 2, 22, '#90715b');
    r(c, x + 25, floor - 15, 1, 2, '#d6b488');
    r(c, x + w - 30, top + 29, 16, 15, '#648a83');
    r(c, x + w - 28, top + 31, 5, 10, '#91aaa0');
    r(c, x + w - 23, top + 30, 2, 13, '#d7bb8c');
    r(c, x + w - 32, top + 44, 20, 2, '#bc9a78');
    r(c, x + 7, floor - 8, 7, 4, '#caa47e');
    r(c, x + w - 18, floor - 5, 8, 4, '#bc9677');
}

const WORKER_PALETTE: PixelPalette = Object.freeze({
    _: null, K: P.ink, S: ART.skin, s: ART.skinDark, L: ART.skinLight,
    H: '#e2c48a', h: '#ab895f', T: '#628d80', t: '#46685f',
    B: '#607b88', b: '#405d6a', W: '#ded2af', Y: '#b89b6f',
});

function makeWorker(inspector: boolean): PixelFrame {
    const g = new PixelGrid(24, 29);
    g.rect(6,24,5,5,'K').rect(14,24,5,5,'K').rect(7,22,4,5,'b').rect(14,22,4,5,'B');
    g.rect(7,13,11,10,'K').rect(8,14,9,8,'T').rect(8,21,9,3,'B');
    g.rect(7,8,10,7,'K').rect(8,8,8,6,'S').rect(8,8,7,3,'L').dot(14,10,'K');
    g.rect(11,13,3,1,'s').dot(15,12,'L');
    g.rect(6,4,12,5,'h').rect(8,2,8,5,'H').rect(3,7,18,2,'K').rect(4,6,17,2,'H');
    g.rect(5,15,4,7,'K').rect(6,15,3,5,'T').rect(6,20,3,3,'S');
    g.rect(17,15,5,4,'K').rect(17,15,4,2,'T').rect(20,16,3,2,'L');
    g.rect(11,15,2,6,'t').dot(14,17,'W');
    if (inspector) {
        g.rect(18,16,6,9,'K').rect(19,17,4,7,'Y').rect(20,18,2,1,'W').rect(20,20,2,1,'W');
    } else {
        g.rect(21,13,2,11,'b').rect(19,11,5,3,'B').dot(21,12,'_');
    }
    return Object.freeze(g.finish());
}
const WORKERS = Object.freeze([makeWorker(false), makeWorker(true)]);

function worker(c: CanvasRenderingContext2D, x: number, y: number, index: number) {
    const frame = WORKERS[index];
    oval(c, x - 3, y - 1, 22, 3, '#a17e60');
    frame.forEach((row, yy) => [...row].forEach((key, xx) => {
        const color = WORKER_PALETTE[key];
        if (color) r(c, x + xx - 8, y + yy - frame.length, 1, 1, color);
    }));
}

function pipe(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
    r(c, x, y, w, 9, '#72584d');
    r(c, x, y + 1, w, 7, '#ab8157');
    r(c, x + 1, y + 2, w - 2, 2, '#d8b178');
    r(c, x + 1, y + 6, w - 2, 1, '#82624c');
    for (let xx = 9; xx < w - 3; xx += 27) {
        r(c, x + xx, y - 1, 4, 11, '#826652');
        r(c, x + xx + 1, y, 2, 8, '#c7a16d');
    }
}

/** The closed public gate and the working private sight glass remain distinct in every state. */
function bureau(c: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
    const x = 858 - cx, y = 38 - cy;
    // A handsome but quiet civic facade, set twelve pixels back from the playable terrace.
    r(c, x + 3, y + 20, 153, 72, '#b6977c');
    r(c, x + 5, y + 20, 137, 69, '#dfc096');
    r(c, x + 8, y + 23, 130, 3, '#ecd2aa');
    roof(c, x - 2, y + 5, 161, 19);
    polygon(c, [[x + 51,y + 7],[x + 78,y - 6],[x + 104,y + 7]], '#bc795e');
    polygon(c, [[x + 57,y + 7],[x + 78,y - 2],[x + 98,y + 7]], '#e3c49a');
    r(c, x + 69, y + 5, 18, 12, '#b68d69');
    polygon(c, [[x + 78,y + 7],[x + 74,y + 13],[x + 75,y + 16],[x + 81,y + 16],[x + 82,y + 13]], '#709b99');
    r(c, x + 33, y + 27, 81, 11, '#bb9777');
    pixelText(c, 'CASA DA VAZAO', x + 37, y + 29, '#65564e');
    for (const wx of [x + 17, x + 118]) {
        r(c, wx, y + 39, 15, 25, '#8e8777');
        r(c, wx + 2, y + 41, 11, 21, '#668b87');
        r(c, wx + 3, y + 42, 3, 18, '#91b4a7');
        r(c, wx + 7, y + 41, 1, 21, '#c4ae87');
        r(c, wx - 1, y + 64, 17, 2, '#b79978');
    }
    r(c, x + 56, y + 56, 35, 35, '#a07859');
    r(c, x + 58, y + 57, 31, 34, '#715a4c');
    for (let dx = 60; dx < 89; dx += 7) r(c, x + dx, y + 58, 1, 32, '#92745a');
    r(c, x + 73, y + 58, 1, 32, '#b59264');
    r(c, x + 69, y + 73, 10, 2, '#caa168');
    r(c, x + 72, y + 71, 4, 5, '#80694e');
    // A masonry cistern supports the intake down to the terrace. Its muted curved
    // body and base stay behind the plumbing; neither uses the playable deck edge.
    polygon(c, [[790 - cx,72 - cy],[835 - cx,72 - cy],[835 - cx,119 - cy],
        [830 - cx,128 - cy],[795 - cx,128 - cy],[790 - cx,119 - cy]], '#af9172');
    r(c, 792 - cx, 74 - cy, 35, 44, '#c5a882');
    r(c, 793 - cx, 76 - cy, 6, 42, '#d1b690');
    r(c, 828 - cx, 75 - cy, 5, 44, '#a48668');
    for (const [yy, joint] of [[84,808],[96,799],[108,810]]) {
        r(c, 794 - cx, yy - cy, 35, 1, '#b39876');
        r(c, joint - cx, yy - 9 - cy, 1, 9, '#b39876');
    }
    r(c, 790 - cx, 119 - cy, 45, 8, '#baa07c');
    r(c, 786 - cx, 127 - cy, 53, 6, '#a98c6c');
    r(c, 789 - cx, 128 - cy, 47, 3, '#c0a17a');
    // Intake -> fork -> private tank. Cyan is contained inside a real bronze pipe.
    oval(c, 787 - cx, 65 - cy, 51, 14, '#ae9375');
    oval(c, 790 - cx, 66 - cy, 45, 10, '#d0b892');
    oval(c, 794 - cx, 68 - cy, 37, 6, P.waterShade);
    r(c, 798 - cx, 68 - cy, 28, 3, P.water);
    r(c, 820 - cx, 76 - cy, 8, 28, '#9a7755');
    r(c, 821 - cx, 77 - cy, 2, 25, '#d7ad73');
    pipe(c, 820 - cx, 99 - cy, 178);
    // The observation window visibly carries clean water to the private tank.
    r(c, 955 - cx, 100 - cy, 22, 7, P.ironDark);
    r(c, 957 - cx, 101 - cy, 18, 5, P.waterShade);
    r(c, 958 - cx, 102 - cy, 16, 3, P.water);
    r(c, 959 - cx + Math.floor(t / 260) % 9, 102 - cy, 5, 1, P.waterLight);
    line(c, 965 - cx, 103 - cy, 970 - cx, 103 - cy, P.waterLight);
    line(c, 968 - cx, 101 - cy, 970 - cx, 103 - cy, P.waterLight);
    line(c, 968 - cx, 105 - cy, 970 - cx, 103 - cy, P.waterLight);
    r(c, 992 - cx, 95 - cy, 23, 35, '#896e56');
    r(c, 994 - cx, 96 - cy, 18, 32, '#b89161');
    r(c, 997 - cx, 98 - cy, 3, 29, '#d4b17d');
    for (const yy of [97,121]) r(c, 993 - cx, yy - cy, 21, 3, '#7d6a56');
    oval(c, 992 - cx, 92 - cy, 23, 7, '#cfad79');
    oval(c, 995 - cx, 93 - cy, 17, 3, P.water);
    sign(c, 948 - cx, 77 - cy, 72, ['PARTICULAR']);
    // Public branch: shut shutter, cross brace and dry cracked trough. No victory implied.
    r(c, 820 - cx, 108 - cy, 8, 21, '#977858');
    r(c, 821 - cx, 109 - cy, 2, 18, '#c7a377');
    r(c, 815 - cx, 111 - cy, 18, 12, '#66594b');
    r(c, 817 - cx, 112 - cy, 14, 10, '#ad7659');
    line(c, 818 - cx, 113 - cy, 829 - cx, 120 - cy, '#d4ae7b', 2);
    line(c, 829 - cx, 113 - cy, 818 - cx, 120 - cy, '#d4ae7b', 2);
    r(c, 823 - cx, 115 - cy, 3, 4, '#655c4d');
    r(c, 778 - cx, 128 - cy, 70, 5, '#ad8764');
    r(c, 780 - cx, 129 - cy, 66, 2, '#947051');
    line(c, 790 - cx, 129 - cy, 794 - cx, 131 - cy, '#745846');
    line(c, 803 - cx, 129 - cy, 806 - cx, 131 - cy, '#745846');
    pixelText(c, 'BAIRRO', 780 - cx, 116 - cy, '#685a4e');
    r(c, 777 - cx, 133 - cy, 247, 11, '#c99870');
}

/** Warm township below a pale, quiet sky. All scenery sits behind the running strip. */
export function drawGuairaAscentBackground(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const t = artTime(time, reducedMotion);
        r(c, 0, 0, 320, 180, '#e6bc8f');
        r(c, 0, 0, 320, 36, '#ebcda4');
        r(c, 0, 36, 320, 33, '#e8c397');
        oval(c, 250 - Math.round(cameraX * .08), 40 - Math.round(cameraY * .05), 19, 19, '#f2d7a8');
        for (let i = -1; i < 5; i++) {
            const x = i * 116 - Math.round(cameraX * .13) % 116, y = 124 - Math.round(cameraY * .3);
            polygon(c, [[x - 8,y + 18],[x + 12,y + 9],[x + 18,y],[x + 50,y + 2],[x + 63,y + 17],[x + 89,y + 14],[x + 121,y + 38],[x - 8,y + 38]], '#c99b79');
            r(c, x + 21, y + 4, 22, 2, '#d7ad85');
        }
        // The low distant irrigated valley has muted banks; no bright walkable ledges.
        const valley = 246 - Math.round(cameraY * .64);
        r(c, 0, valley, 320, 154, '#c49269');
        for (let i = -1; i < 7; i++) {
            const x = i * 73 - Math.round(cameraX * .4) % 73;
            polygon(c, [[x,valley + 10],[x + 26,valley + 3],[x + 74,valley + 8],[x + 75,valley + 22],[x,valley + 24]], '#aaa071');
            r(c, x + 7, valley + 14, 48, 4, '#95ab86');
            r(c, x + 12, valley + 15, 35, 1, '#a5b995');
        }
        // Dry cut earth behind the two recoverable pits, explicitly separate from the canal.
        for (const [left, right] of [[224,496],[656,768]]) if (visible(left, right - left, cameraX)) {
            const x = left - cameraX, w = right - left;
            r(c, x, 315 - cameraY, w, 53, '#bd8b66');
            r(c, x + 4, 324 - cameraY, w - 8, 9, '#a18b6d');
            r(c, x + 6, 326 - cameraY, w - 12, 3, '#83aaa1');
            for (let xx = left + 12; xx < right - 15; xx += 30) {
                r(c, xx - cameraX, 337 - cameraY, 4, 3, '#b17c5b');
                line(c, xx - cameraX, 350 - cameraY, xx + 5 - cameraX, 356 - cameraY, '#a97656');
            }
            r(c, x, 361 - cameraY, w, 7, '#d1a278');
        }
        if (visible(0, 224, cameraX)) {
            house(c, 10 - cameraX, 289 - cameraY, 68, 63);
            cactus(c, 101 - cameraX, 293 - cameraY, 39);
            for (const wx of [111,137,161]) {
                r(c, wx - cameraX, 269 - cameraY, 3, 26, '#a18a68');
                r(c, wx - cameraX, 270 - cameraY, 1, 23, '#c7ad7d');
            }
            r(c, 111 - cameraX, 276 - cameraY, 53, 2, '#b79b70');
            r(c, 111 - cameraX, 286 - cameraY, 53, 2, '#ac8f68');
            sign(c, 146 - cameraX, 243 - cameraY, 66, ['ELA VAI', 'E VOLTA']);
            r(c, -cameraX, 296 - cameraY, 224, 8, '#cb9467');
        }
        if (visible(496, 160, cameraX)) {
            // Maintenance nook stays behind and away from the checkpoint and boarding lip.
            house(c, 539 - cameraX, 288 - cameraY, 56, 60);
            sign(c, 579 - cameraX, 246 - cameraY, 70, ['ELEVADOR', 'MANUTENCAO']);
            r(c, 588 - cameraX, 284 - cameraY, 18, 11, '#9d7858');
            r(c, 590 - cameraX, 285 - cameraY, 14, 2, '#ccb087');
            r(c, 594 - cameraX, 288 - cameraY, 5, 3, '#d0b488');
            r(c, 496 - cameraX, 296 - cameraY, 160, 8, '#cb9467');
        }
        if (visible(1088, 256, cameraX)) bureau(c, cameraX - 320, cameraY, t);
        if (visible(768, 320, cameraX)) {
            house(c, 778 - cameraX, 136 - cameraY, 56, 60);
            sign(c, 823 - cameraX, 104 - cameraY, 54, ['VAZAO']);
            pipe(c, 884 - cameraX, 181 - cameraY, 196);
            sign(c, 943 - cameraX, 196 - cameraY, 83, ['INSPECAO']);
            r(c, 883 - cameraX, 232 - cameraY, 202, 8, '#c99870');
        }
    });
}

/** Larger quiet strata give the terrace the same terracotta mass as the diorama. */
function cutEarth(c: CanvasRenderingContext2D, left: number, right: number, top: number, cx: number, cy: number) {
    const x = left - cx, y = top - cy, w = right - left;
    r(c, x, y + 4, w, 400 - top - 4, '#ba8059');
    const seam = [[0,0],[31,2],[68,1],[105,6],[141,4],[181,10],[222,7],[261,8],[300,4]] as const;
    for (const [depth, color] of [[22,'#b47754'],[55,'#ab6d50'],[102,'#a7674d'],[160,'#a15f49'],[218,'#975b48']] as const) {
        if (top + depth > 400) continue;
        const edge = seam.map(([sx, sy]) => [x + sx, y + depth + sy] as const);
        polygon(c, [...edge, [x + 300,400 - cy],[x,400 - cy]], color);
    }
    // Sloping clay planes cross the tile grid. They end in soft, broken seams;
    // there are no isolated bright shelves for a player to mistake as support.
    for (const [dx, depth, span, height] of [[13,34,48,53],[86,41,63,77],[185,32,52,65],
        [30,121,55,63],[128,151,67,66],[218,117,40,81],[7,209,40,43]] as const) {
        if (top + depth > 400) continue;
        polygon(c, [[x + dx,y + depth],[x + dx + span,y + depth + 7],
            [x + dx + span - 17,y + depth + height],[x + dx + 10,y + depth + height + 9]],
        depth < 100 ? '#b67753' : '#ab6c50');
        line(c, x + dx + 4, y + depth + 2, x + dx + span - 10, y + depth + 7, depth < 100 ? '#c18a60' : '#b57b57');
    }
    for (const [dx, depth, span] of [[9,12,21],[96,16,16],[193,17,27],[51,47,16],[161,82,23],
        [14,92,18],[91,135,22],[213,160,14],[51,188,24],[139,229,27]] as const) {
        r(c, x + dx, y + depth, span, 1, depth < 50 ? '#c99568' : '#bc805b');
        r(c, x + dx + span - 3, y + depth + 1, 6, 1, '#b87d58');
    }
}

/** Only real supporting tiles receive a pale top. One-way recovery steps remain thin boards. */
export function drawGuairaAscentTerrain(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number, _time: number, _reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const startCol = Math.max(0, level.worldToCol(cameraX)), endCol = Math.min(level.data.width - 1, level.worldToCol(cameraX + 319));
        const startRow = Math.max(0, level.worldToRow(cameraY)), endRow = Math.min(level.data.height - 1, level.worldToRow(cameraY + 179));
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile)) continue;
            const wx = level.colToWorldX(col), wy = level.rowToWorldY(row), x = wx - cameraX, y = wy - cameraY;
            if (isOneWayTile(tile)) {
                r(c, x, y, 16, 2, P.deck);
                r(c, x, y + 2, 16, 4, '#ad8257');
                r(c, x, y + 6, 16, 2, '#705849');
                r(c, x + 3, y + 3, 10, 1, '#d0ad78');
                r(c, x + 1, y + 2, 1, 5, '#715e4e');
                continue;
            }
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0), terrace = wy < 304;
            r(c, x, y, 16, 16, terrace ? '#ab805b' : '#aa664b');
            if (top) {
                r(c, x, y + 3, 16, 13, terrace ? '#bb9467' : '#bd7750');
                r(c, x, y, 16, 2, terrace ? '#eed4a0' : '#f1c189');
                r(c, x, y + 2, 16, 2, terrace ? '#d3b27f' : '#d89563');
            }
            // Retaining edges come from actual neighboring tiles, never from scenic assumptions.
            const left = !supportsStanding(level.data.tiles[row]?.[col - 1] ?? 0), right = !supportsStanding(level.data.tiles[row]?.[col + 1] ?? 0);
            if (left || right) {
                const edge = left ? x : x + 13;
                r(c, edge, y + (top ? 4 : 0), 3, top ? 12 : 16, '#86644f');
                r(c, edge + 1, y + (top ? 4 : 0), 1, top ? 12 : 16, '#c7a47b');
            }
        }
        // Scenery is clipped to existing solid interiors. Caps, side retainers,
        // one-way boards and every empty recovery space retain their own pixels.
        c.save(); c.beginPath();
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile) || isOneWayTile(tile)) continue;
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0);
            const left = !supportsStanding(level.data.tiles[row]?.[col - 1] ?? 0);
            const right = !supportsStanding(level.data.tiles[row]?.[col + 1] ?? 0);
            c.rect(level.colToWorldX(col) - cameraX + (left ? 3 : 0), level.rowToWorldY(row) - cameraY + (top ? 4 : 0),
                16 - (left ? 3 : 0) - (right ? 3 : 0), 16 - (top ? 4 : 0));
        }
        c.clip();
        for (const [left, right, top] of [[0,224,304],[496,656,304],[768,880,144],[1088,1344,144]]) {
            if (visible(left, right - left, cameraX)) cutEarth(c, left, right, top, cameraX, cameraY);
        }
        c.restore();
    });
}

/** Mechanical support follows the real body, including adjusted width, endpoints and intermediate y. */
function deck(c: CanvasRenderingContext2D, body: MovingBody, cx: number, cy: number, lift: boolean) {
    const x = Math.round(body.x) - cx, y = Math.round(body.y) - cy, w = Math.round(body.width), h = Math.round(body.height);
    r(c, x, y, w, h, P.woodShade);
    r(c, x, y, w, Math.min(2, h), P.deck);
    r(c, x, y + 2, w, Math.max(0, h - 4), P.wood);
    for (let dx = 0; dx < w; dx += 13) {
        r(c, x + dx, y + 2, 1, Math.max(0, h - 4), '#705344');
        r(c, x + dx + 2, y + 3, Math.min(8, w - dx - 2), 1, P.woodLight);
    }
    r(c, x, y + Math.max(2, h - 2), w, Math.min(2, h), P.ironDark);
    for (const dx of [3, w - 8]) {
        r(c, x + dx, y + 2, 5, Math.max(0, h - 2), lift ? P.bronze : P.iron);
        r(c, x + dx + 1, y + 3, 2, 1, '#d6c59a');
    }
}

export function drawGuairaAscentObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, _time: number, _reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const lift = objects.get(GUAIRA_ASCENT_ART.liftId);
        for (const plank of [objects.get(GUAIRA_ASCENT_ART.plankId), objects.get(GUAIRA_ASCENT_ART.serviceId)]) if (plank) {
            const from = plank.home ?? { x: plank.x, y: plank.y }, to = plank.to ?? from;
            const left = Math.min(from.x, to.x), right = Math.max(from.x, to.x) + plank.width, railY = from.y + plank.height + 12;
            if (visible(left - 12, right - left + 24, cameraX)) {
                // Recessed, dark guide rail under the carriage; bright top belongs only to its body.
                r(c, left - cameraX, railY - cameraY, right - left, 2, '#927956');
                r(c, left - cameraX, railY + 2 - cameraY, right - left, 1, '#b69870');
                for (const endpoint of [left, right]) {
                    r(c, endpoint - 2 - cameraX, railY - 6 - cameraY, 4, 14, '#8c7155');
                    r(c, endpoint - 1 - cameraX, railY - 5 - cameraY, 2, 12, '#b6996d');
                    r(c, endpoint - 4 - cameraX, railY - 5 - cameraY, 8, 2, '#9b7b56');
                    r(c, endpoint - 4 - cameraX, railY + 5 - cameraY, 8, 2, '#9b7b56');
                }
                for (const wx of [plank.x + 13, plank.x + plank.width - 16]) {
                    r(c, wx - cameraX, plank.y + plank.height - cameraY, 3, 10, '#756c58');
                    oval(c, wx - 2 - cameraX, plank.y + plank.height + 7 - cameraY, 7, 6, '#685f51');
                    r(c, wx - cameraX, plank.y + plank.height + 9 - cameraY, 2, 2, '#c6ac7d');
                }
            }
            if (visible(plank.x, plank.width, cameraX)) deck(c, plank, cameraX, cameraY, false);
        }
        if (lift) {
            const from = lift.home ?? { x: lift.x, y: lift.y }, to = lift.to ?? from;
            const top = Math.min(from.y, to.y), bottom = Math.max(from.y, to.y), left = from.x, right = from.x + lift.width;
            if (visible(left - 12, lift.width + 24, cameraX)) {
                // Thin guides and cables flank an open central silhouette. No false roof or rungs.
                for (const [wx, cable] of [[left - 7,left + 5],[right + 5,right - 6]]) {
                    r(c, wx - cameraX, top - 17 - cameraY, 3, bottom - top + 35, '#a58c68');
                    r(c, wx + 1 - cameraX, top - 16 - cameraY, 1, bottom - top + 33, '#c2aa80');
                    r(c, cable - cameraX, top - 13 - cameraY, 1, Math.max(0, lift.y - top + 13), '#7d7665');
                    for (const yy of [top,bottom]) {
                        r(c, wx - 3 - cameraX, yy - 4 - cameraY, 9, 10, '#8c755a');
                        r(c, wx - 2 - cameraX, yy - 3 - cameraY, 7, 2, '#c3a272');
                        r(c, wx - cameraX, yy + 1 - cameraY, 2, 2, '#d6bf91');
                    }
                    oval(c, cable - 4 - cameraX, top - 21 - cameraY, 9, 9, '#8c7356');
                    oval(c, cable - 2 - cameraX, top - 19 - cameraY, 5, 5, '#c6a777');
                    r(c, cable - cameraX, top - 18 - cameraY, 1, 3, '#766650');
                }
                // Brackets travel with the body and stay entirely below its walkable top.
                for (const wx of [lift.x + 3,lift.x + lift.width - 7]) {
                    r(c, wx - cameraX, lift.y + lift.height - cameraY, 4, 11, '#806d54');
                    line(c, wx - cameraX, lift.y + lift.height + 9 - cameraY, wx + (wx < lift.x + lift.width / 2 ? 12 : -10) - cameraX, lift.y + lift.height - cameraY, '#a99167', 2);
                }
            }
            if (visible(lift.x, lift.width, cameraX)) deck(c, lift, cameraX, cameraY, true);
        }
        GUAIRA_ASCENT_ART.workerFeet.forEach((p, i) => { if (visible(p.x - 8, 24, cameraX)) worker(c, p.x - cameraX, p.y - cameraY, i); });
    });
}
