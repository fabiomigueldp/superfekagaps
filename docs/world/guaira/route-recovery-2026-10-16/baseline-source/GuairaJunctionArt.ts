import { box as r, pixelLine as line, roof } from '../../../WorldPainting';
import type { WorldLevel, WorldObjects } from '../../../WorldPhysics';
import { pixelText } from '../../../../graphics/BitmapFont';
import { supportsStanding, isOneWayTile } from '../../../../world/tileRules';
import { drawGuairaWorker } from '../GuairaWorkerArt';
import { drawGuairaRicePlant } from '../GuairaRiceArt';
import { drawGuairaClayGrain, drawGuairaPlaster, drawGuairaTimber } from '../GuairaMaterials';
import { drawJunctionPipe as pipe, drawJunctionElbow, drawJunctionCylinder, drawJunctionIntake } from './GuairaJunctionHardwareArt';
import { drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaPipeRoute } from '../GuairaPipeArt';
import { GUAIRA_JUNCTION as G, type JunctionRouting, type WaterOutlet } from './GuairaJunctionModel';
import { drawGuairaLandscape, drawGuairaTree, drawGuairaFieldBank, drawGuairaAwning, sceneryTime } from '../GuairaScenery';

const P = Object.freeze({ ink: '#4c4144', sky: '#e9c69c', earth: '#b66f50', earthDark: '#875342',
    sand: '#edc78d', wood: '#94785b', bronze: '#b99465', pipe: '#735b4b', dry: '#bd9165',
    water: '#68b6bf', waterShade: '#377783', waterLight: '#b7dfd3', deck: '#eed4a0', iron: '#6c817c',
    green: '#829353', darkGreen: '#586c48', warning: '#f2be72' });

const SUPPLY_ROUTES = {
    a: guairaPipeRoute([[150,280],[304,280],[304,298],[284,298],[284,404],[304,404]]),
    b: guairaPipeRoute([[150,280],[304,280],[304,204],[636,204],[636,404],[656,404]]),
};

function scene(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save(); c.beginPath(); c.rect(0, 23, 320, 157); c.clip();
    draw(Math.round(cx), Math.round(cy)); c.restore();
}

function sign(c: CanvasRenderingContext2D, x: number, y: number, label: string, width: number, supportY: number) {
    r(c, x + Math.floor(width / 2), y + 14, 2, supportY - y - 14, P.wood); r(c, x, y, width, 14, P.pipe);
    r(c, x + 1, y + 1, width - 2, 11, '#d5b68a'); pixelText(c, label, x + 4, y + 4, P.ink);
}

/** Backdrop only: every usable edge is rendered by terrain/objects from the engine. */
export function drawJunctionBackground(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reduced: boolean, routing: JunctionRouting) {
    scene(c, cx, cy, (cameraX, cameraY) => {
        const t = sceneryTime(time, reduced);
        drawGuairaLandscape(c, cameraX, cameraY, t, reduced, 'junction');
        drawGuairaFieldBank(c, 8 - cameraX, 284 - cameraY, 182, 400 - cameraY);
        drawGuairaTree(c, 125 - cameraX, 289 - cameraY, 75, t, 125, true);
        drawGuairaTree(c, 718 - cameraX, 206 - cameraY, 61, t, 718, true);
        for (const [left, right] of [[752, G.exitGapStartX], [G.exitGapEndX, 964]])
            drawGuairaFieldBank(c, left - cameraX, 166 - cameraY, right - left, 208 - cameraY);
        // The dry neighbourhood and the irrigated rows share an ordinary working landscape.
        const hx = 24 - cameraX, hy = 228 - cameraY;
        r(c, hx, hy, 94, 61, '#c8a784'); r(c, hx + 3, hy + 3, 88, 58, '#e0c29a');
        drawGuairaPlaster(c, hx + 3, hy + 3, 88, 58, 3);
        roof(c, hx - 6, hy - 16, 106, 18); r(c, hx + 19, hy + 25, 20, 36, '#796454');
        r(c, hx + 60, hy + 18, 20, 20, '#749a90'); r(c, hx + 69, hy + 18, 2, 20, '#d7b98b');
        drawGuairaAwning(c, hx + 17, hy + 23, 24, t, 41);
        for (let row = 0; row < 3; row++) for (let x = 760 + row % 2 * 6; x < 956; x += 20) {
            if (x >= G.exitGapStartX && x < G.exitGapEndX) continue;
            const y = 168 + row * 10;
            line(c, x - cameraX, y - cameraY, x + 17 - cameraX, y - cameraY, '#89a89a', 2);
            drawGuairaRicePlant(c, x + 8 - cameraX, y - cameraY, t, x + 8, row, 11 + Math.floor(x / 20) % 4, true);
            r(c, x + 7 - cameraX, y - cameraY, 4, 1, '#779674');
        }
        // One intake, one bifurcation. Distinct A/B labels are redundant with colour.
        pipe(c, 132 - cameraX, 276 - cameraY, 176, true, t, reduced, false, 1, false);
        drawJunctionIntake(c,120-cameraX,250-cameraY,t,reduced);
        sign(c, 112 - cameraX, 227 - cameraY, 'AGUA LIMPA', 70, 253 - cameraY);
        // Fixed side feeds enter the buried base manifolds beside the rams.
        // The yard masks their underground bends, including while a deck docks.
        const a = routing.supplied === 'a', b = routing.supplied === 'b';
        pipe(c, 300 - cameraX, 284 - cameraY, 10, a, t, reduced, true, 1, false);
        drawJunctionElbow(c,300-cameraX,294-cameraY,a,true,true);
        pipe(c, 289 - cameraX, 294 - cameraY, 11, a, t, reduced, false, -1, false);
        drawJunctionElbow(c,280-cameraX,294-cameraY,a);
        pipe(c, 280 - cameraX, 303 - cameraY, 97, a, t, reduced, true, 1, false);
        drawJunctionElbow(c,280-cameraX,400-cameraY,a,false,true);
        pipe(c, 289 - cameraX, 400 - cameraY, 16, a, t, reduced, false, 1, false);
        // Fixed pipe trestles land on the middle patio. Its real terrain masks
        // their feet; they neither move with a lift nor create a new ledge.
        for(const xx of [410,550]) {
            r(c,xx-3-cameraX,208-cameraY,7,48,'#8f8067');
            r(c,xx-2-cameraX,209-cameraY,3,46,'#b39b74');
            line(c,xx-cameraX,226-cameraY,xx+9-cameraX,209-cameraY,'#8f8067',2);
            r(c,xx-6-cameraX,250-cameraY,13,6,'#927b5f');
        }
        pipe(c, 309 - cameraX, 200 - cameraY, 323, b, t, reduced, false, 1, false);
        pipe(c, 300 - cameraX, 209 - cameraY, 75, routing.supplied === 'b', t, reduced, true, -1, false);
        pipe(c, 632 - cameraX, 209 - cameraY, 191, b, t, reduced, true, 1, false);
        drawJunctionElbow(c,300-cameraX,200-cameraY,b);
        drawJunctionElbow(c,632-cameraX,200-cameraY,b,true);
        drawJunctionElbow(c,632-cameraX,400-cameraY,b,false,true);
        pipe(c, 641 - cameraX, 400 - cameraY, 16, b, t, reduced, false, 1, false);
        drawGuairaPipeFlow(c, SUPPLY_ROUTES[routing.supplied], cameraX, cameraY, time, reduced);
        for(const xx of [410,550])drawGuairaPipeSaddle(c,xx-cameraX,204-cameraY);
        drawGuairaPipeSaddle(c,193-cameraX,280-cameraY);
        // Bolted, gasketed selector casing around the unchanged A/B readout.
        for(const x of [299,309])r(c,x-cameraX,268-cameraY,2,27,P.pipe);
        r(c,289-cameraX,275-cameraY,4,11,P.pipe);
        r(c, 291 - cameraX, 270 - cameraY, 26, 23, P.pipe);
        r(c, 293 - cameraX, 272 - cameraY, 22, 19, P.bronze);
        r(c,294-cameraX,272-cameraY,20,1,'#d4b680');
        r(c,314-cameraX,273-cameraY,1,17,'#997650');
        r(c,298-cameraX,275-cameraY,11,12,'#a7855d');
        for(const x of [294,312])for(const y of [274,288]) {
            r(c,x-cameraX,y-cameraY,2,2,P.pipe);r(c,x-cameraX,y-cameraY,1,1,'#e0c391');
        }
        pixelText(c, routing.supplied.toUpperCase(), 301 - cameraX, 277 - cameraY, routing.warning ? P.warning : P.ink);
        // A guided spool travels towards the requested outlet during the native
        // warning. The letter and wet branch still show the actual supply.
        r(c, 319-cameraX, 272-cameraY, 9, 21, P.pipe);
        r(c, 321-cameraX, 274-cameraY, 5, 17, '#a7855d');
        const from = routing.supplied === 'a' ? 288 : 276;
        const to = routing.selected === 'a' ? 288 : 276;
        const progress = routing.warning ? 1 - routing.warningRemaining / G.warningMs : 1;
        const spoolY = Math.round(from + (to-from) * Math.max(0, Math.min(1, progress)));
        line(c, 315-cameraX, 282-cameraY, 323-cameraX, spoolY-cameraY, P.pipe, 2);
        r(c, 320-cameraX, spoolY-1-cameraY, 7, 3, routing.warning ? P.warning : '#d4b680');
        r(c, 322-cameraX, spoolY-cameraY, 3, 1, P.pipe);
        r(c, 275 - cameraX, 314 - cameraY, 7, 2, P.wood);
        sign(c, 257 - cameraX, 308 - cameraY, 'A', 18, 322 - cameraY);
        sign(c, 631 - cameraX, 180 - cameraY, 'B', 18, 200 - cameraY);
        sign(c, 42 - cameraX, 264 - cameraY, 'BAIRRO', 47, 296 - cameraY);
        sign(c, 862 - cameraX, 166 - cameraY, 'ARROZAL', 53, 200 - cameraY);
        // This reward is an authored A-side choice, not a third water outlet.
        // Hang the clue below its perch: the fixed HUD otherwise covers a sign
        // above the coins while Feka is deciding from raised A.
        for (const x of [179, 218]) r(c, x - cameraX, G.maintenanceY + 8 - cameraY, 2, 8, P.wood);
        r(c, 170 - cameraX, 192 - cameraY, 64, 13, P.pipe);
        r(c, 171 - cameraX, 193 - cameraY, 62, 11, '#d5b68a');
        pixelText(c, 'A: MOEDAS', 174 - cameraX, 196 - cameraY, P.ink);
        sign(c, 517 - cameraX, 214 - cameraY, 'B: SIGA', 52, 248 - cameraY);
        // The bitmap font has no '<' glyph. Draw the return arrow in pixels.
        sign(c, 472 - cameraX, 359 - cameraY, '  ENTRADA', 70, 392 - cameraY);
        line(c, 477 - cameraX, 365 - cameraY, 484 - cameraX, 365 - cameraY, P.ink);
        line(c, 480 - cameraX, 362 - cameraY, 477 - cameraX, 365 - cameraY, P.ink);
        line(c, 477 - cameraX, 365 - cameraY, 480 - cameraX, 368 - cameraY, P.ink);
        sign(c, 104 - cameraX, 366 - cameraY, 'DEGRAU', 48, 392 - cameraY);
        // Supporting posts stay behind the open recovery route; no painted ledge.
        for (const [x, top] of [[40,304],[200,304],[404,256],[552,256],[768,208],[920,208]]) {
            r(c, x - cameraX, top + 9 - cameraY, 8, 391 - top, '#a58d74');
            r(c, x + 1 - cameraX, top + 10 - cameraY, 2, 387 - top, '#c0a17a');
        }
        // Low rails mark the two real terrace lips without painting over the gap.
        for (const x of [G.exitGapStartX - 7, G.exitGapEndX + 3]) {
            r(c, x - cameraX, G.terraceY - 10 - cameraY, 3, 10, P.wood);
            r(c, x - 1 - cameraX, G.terraceY - 11 - cameraY, 5, 2, P.deck);
        }
        // Dry service yard meets every lower sign and the real recovery floor.
        r(c, 0, G.recoveryY - 8 - cameraY, 320, 8, '#bda078');
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
                    r(c, px, py, 16, 16, P.earth);
                    drawGuairaClayGrain(c, px, py, x, y);
                    if (!supportsStanding(level.data.tiles[y - 1]?.[x] ?? 0)) {
                        r(c, px, py, 16, 2, P.sand); r(c, px, py + 2, 16, 2, '#c88f5c');
                    }
                }
            }
    });
}

export function drawJunctionObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, _time: number, reduced: boolean, routing: JunctionRouting) {
    scene(c, cx, cy, (cameraX, cameraY) => {
        for (const b of objects.bodies) {
            const x = Math.round(b.x) - cameraX, y = Math.round(b.y) - cameraY;
            if (x > 322 || x + b.width < -2) continue;
            if (b.kind === 'switch') {
                // Raised border and ↓ shape identify an impact plate independently of state.
                r(c, x - 2, y + 4, b.width + 4, 4, P.pipe); r(c, x, y + 2, b.width, 4, P.bronze);
                r(c, x + 2, y + 1, b.width - 4, 2, routing.warning ? P.warning : P.deck);
                pixelText(c, 'A/B', x + 13, y - 8, P.ink);
                r(c, x + 4, y - 5, 1, 4, P.ink); r(c, x + 2, y - 2, 5, 1, P.ink); r(c, x + 3, y - 1, 3, 1, P.ink);
                continue;
            }
            const outlet: WaterOutlet = b.id === G.liftAId ? 'a' : 'b';
            drawJunctionCylinder(c,b,cameraX,cameraY,G.recoveryY);
            r(c, x, y, b.width, 2, P.deck); r(c, x, y + 2, b.width, 4, '#a38961');
            drawGuairaTimber(c, x, y + 2, b.width, 4, outlet === 'a' ? 3 : 4);
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
        for (const [x, y, kind, deckId] of [[108,296,'pump',G.liftAId],[421,248,'pump',G.liftBId],[848,200,'rice',G.liftBId]] as const) {
            if (x <= cameraX - 20 || x >= cameraX + 340) continue;
            const deck = objects.get(deckId)!;
            const moving = Math.abs(deck.y - (deck.active ? deck.to!.y : G.dockY)) > .01;
            const extension = (G.dockY - deck.y) / (G.dockY - deck.to!.y);
            // Adapt the existing attention poses to this worker's actual deck.
            // Warning uses "notice"; motion follows real target progress in either
            // direction, then raised/docked decks relax/resume ordinary work.
            drawGuairaWorker(c, x - cameraX, y - cameraY, kind, {
                activeTimeMs: objects.time, valveActive: routing.warning || moving || deck.active,
                bridgeRise: routing.warning ? 0 : deck.active ? extension : 1 - extension, reducedMotion: reduced,
            });
        }
    });
}
