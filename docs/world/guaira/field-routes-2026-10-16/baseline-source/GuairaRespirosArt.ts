import { box as r, pixelLine as line, roof } from '../../../WorldPainting';
import { jetCycle, type JetCycle } from '../../../WorldMachineState';
import type { MovingBody, WorldLevel, WorldObjects } from '../../../WorldPhysics';
import { pixelText } from '../../../../graphics/BitmapFont';
import { supportsStanding, isOneWayTile } from '../../../../world/tileRules';
import { GUAIRA_RESPIROS as G } from './GuairaRespirosStage';
import { drawGuairaWorker } from '../GuairaWorkerArt';
import { drawGuairaRicePlant } from '../GuairaRiceArt';
import { drawGuairaClayGrain, drawGuairaPlaster } from '../GuairaMaterials';
import { drawGuairaPipe, drawGuairaPipeElbow, drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaPipeRoute, type GuairaPipePalette } from '../GuairaPipeArt';
import { drawGuairaRiceFlow } from '../GuairaWaterworksArt';
import { drawGuairaLandscape, drawGuairaTree, drawGuairaFieldBank, drawGuairaAwning } from '../GuairaScenery';

const P = Object.freeze({
    ink: '#493c43', clay: '#b66f50', clayShade: '#985b45', clayLight: '#cd8c5d',
    dust: '#d8a777', cap: '#f0d29a', stone: '#bda080', stoneShade: '#8d7968',
    brass: '#b58a54', brassLight: '#e2bb79', pipe: '#6d584c', gauge: '#edba62',
    leaf: '#7e9754', leafShade: '#617d52', grain: '#b7be78',
    channel: '#80afa7', channelShade: '#67958e', channelLight: '#bad0b5', mist: '#cad6c4',
});

/** These opaque colours are reserved for the actual pressurised liquid envelope. */
export const RESPIROS_WATER_COLORS = Object.freeze({
    edge: '#267f98', body: '#40b8cb', shade: '#329eb7', light: '#76d7df', foam: '#c6f0df',
});
const W = RESPIROS_WATER_COLORS;
const finite = (value: number) => Number.isFinite(value) ? value : 0;

function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save(); c.beginPath(); c.rect(0, 23, 320, 157); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // Production WorldGame supplies a rounded view. Retaining fractional inputs
    // here also lets the hydraulic envelope conservatively cover direct callers.
    draw(finite(cx), finite(cy)); c.restore();
}

const PIPE: Readonly<GuairaPipePalette> = Object.freeze({
    edge:P.pipe, brass:P.brass, light:'#c6a77a', shade:'#927354',
    water:P.channel, glint:P.channelLight, dry:'#b18b62',
});
const PUMP_FEED = guairaPipeRoute([[104,264],[104,283],[158,283],[158,308]]);
const SERVICE_FEED = guairaPipeRoute([[672,199],[672,279],[702,279],[702,306]]);

function riceBed(c: CanvasRenderingContext2D, x: number, y: number, width: number, row: number, time: number, worldX: number) {
    r(c, x, y + 4, width, 10, '#9e9d78');
    r(c, x + 2, y + 5, width - 4, 6, P.channelShade);
    r(c, x + 3, y + 5, width - 6, 3, P.channel);
    drawGuairaRiceFlow(c,x,y,width,true,time,false,row);
    // Stagger the second row and alternate mature/young clumps. World-based
    // wind bends the upper stem; the lower stem stays planted in the water.
    for (let i = 0, dx = 8 + row * 7; dx < width - 9; i++, dx += 17 + i % 3 * 2) {
        const h = 15 + (i * 3 + row + Math.floor(worldX / 13)) % 6;
        drawGuairaRicePlant(c, x + dx + 1, y + 8, time, worldX + dx + 1, row, h, true);
        r(c, x + dx + 4, y + 9, 4, 1, P.channelLight);
    }
    r(c, x, y + 12, width, 2, '#b4a283');
    for (let dx = 3; dx < width - 7; dx += 23) r(c, x + dx, y + 12, 12, 1, '#c3b08e');
}

/** Harmless channels sit behind the dry walking strip and use a muted green turquoise. */
export function drawRespirosBackground(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reducedMotion: boolean) {
    layer(c, cx, cy, (rawX, rawY) => {
        const cameraX = Math.round(rawX), cameraY = Math.round(rawY), t = reducedMotion ? 0 : finite(time);
        drawGuairaLandscape(c, cameraX, cameraY, t, reducedMotion, 'rice');
        r(c, 0, 231 - cameraY, 320, 64, '#c4946c');
        for (const [x, y, width] of [[120,244,124],[253,234,110],[372,239,120],[502,247,112],[678,240,128],[822,245,148],[980,239,124]] as const) {
            drawGuairaFieldBank(c, x - cameraX, y + 5 - cameraY, width, 295 - cameraY);
            riceBed(c, x - cameraX, y - cameraY, width, 0, t, x);
            riceBed(c, x - cameraX, y + 19 - cameraY, width, 1, t, x);
        }
        // Compact municipal pump house: terracotta roof, patched plaster, sight
        // glass and a bolted feed. No background prop receives a walkable cap.
        const hx = 18 - cameraX, hy = 207 - cameraY;
        drawGuairaTree(c, 5 - cameraX, 282 - cameraY, 70, t, 5, true);
        r(c, hx + 3, hy + 13, 78, 65, '#b79677');
        r(c, hx + 4, hy + 14, 66, 62, '#dac099'); roof(c, hx, hy, 87, 16);
        drawGuairaPlaster(c, hx + 4, hy + 17, 66, 59, 4);
        r(c, hx + 15, hy + 39, 21, 38, '#846b58'); r(c, hx + 17, hy + 40, 17, 35, '#625a50');
        r(c, hx + 18, hy + 40, 2, 35, '#a18763');
        drawGuairaAwning(c, hx + 13, hy + 36, 25, t, 31);
        r(c, hx + 49, hy + 27, 15, 21, '#957b5e'); r(c, hx + 51, hy + 29, 11, 17, '#668f88');
        r(c, hx + 52, hy + 30, 3, 15, '#a8bdaa'); r(c, hx + 55, hy + 29, 2, 17, '#d4b991');
        r(c, hx + 8, hy + 62, 8, 5, '#c3a280'); r(c, hx + 43, hy + 70, 10, 4, '#c3a280');
        r(c, hx + 9, hy + 23, 31, 10, '#b19775'); pixelText(c, 'AGUAS', hx + 11, hy + 25, '#665b4d');
        // One recessed feed leaves the pump wall, rounds both corners and enters
        // the first grate. The native terrain and grate cover its buried end.
        r(c,96-cameraX,260-cameraY,16,8,'#91795f');
        r(c,98-cameraX,261-cameraY,12,2,'#bda17a');
        drawGuairaPipe(c,100-cameraX,264-cameraY,15,true,t,reducedMotion,true,1,false,PIPE);
        drawGuairaPipeElbow(c,100-cameraX,279-cameraY,true,false,true,PIPE);
        drawGuairaPipe(c,109-cameraX,279-cameraY,45,true,t,reducedMotion,false,1,false,PIPE);
        drawGuairaPipeElbow(c,154-cameraX,279-cameraY,true,true,false,PIPE);
        drawGuairaPipe(c,154-cameraX,288-cameraY,21,true,t,reducedMotion,true,1,false,PIPE);
        drawGuairaPipeFlow(c,PUMP_FEED,cameraX,cameraY,t,reducedMotion,PIPE.glint);
        drawGuairaPipeSaddle(c,104-cameraX,272-cameraY,true,PIPE);
        drawGuairaPipeSaddle(c,132-cameraX,283-cameraY,false,PIPE);
        // The path to the corral belongs to this same working landscape.
        const exitOffset = G.finishX - 656;
        const sx = 631 + exitOffset - cameraX, sy = 226 - cameraY;
        r(c, sx + 2, sy + 13, 54, 55, '#b49775'); r(c, sx + 3, sy + 14, 44, 53, '#d5b991');
        roof(c, sx - 2, sy, 62, 16); r(c, sx + 15, sy + 37, 18, 30, '#827157');
        r(c, sx + 17, sy + 39, 14, 28, '#675d4e');
        for (const x of [592,613,638,670,695]) {
            r(c, x + exitOffset - cameraX, 276 - cameraY, 2, 15, '#927b5f');
            r(c, x + exitOffset - cameraX, 280 - cameraY, 20, 2, '#b49a70');
        }
        r(c, 600 + exitOffset - cameraX, 260 - cameraY, 43, 12, '#b59770');
        r(c, 613 + exitOffset - cameraX, 272 - cameraY, 2, 19, '#927b5f');
        pixelText(c, 'CURRAL', 603 + exitOffset - cameraX, 262 - cameraY, '#63594c');
        // A quiet observation bay, behind the checkpoint and the actor. The
        // arrow leads the eye to B's real pressure gauge, not to a timed dash.
        // No bright platform cap, collision, animation or independent clock.
        r(c, 280 - cameraX, 267 - cameraY, 2, 28, '#927b5f');
        r(c, 276 - cameraX, 245 - cameraY, 78, 22, '#b59770');
        pixelText(c, 'PARE E OLHE', 279 - cameraX, 249 - cameraY, '#63594c');
        line(c, 326 - cameraX, 261 - cameraY, 363 - cameraX, 261 - cameraY, P.ink);
        line(c, 359 - cameraX, 257 - cameraY, 363 - cameraX, 261 - cameraY, P.ink);
        line(c, 359 - cameraX, 265 - cameraY, 363 - cameraX, 261 - cameraY, P.ink);
        // Fixed maintenance brackets end at the real dry floor. Bright edges
        // are still painted only from the native one-way tiles below.
        for (const [left, top] of [[608,240],[656,192]]) {
            for (const xx of [left+3,left+27]) {
                r(c,xx-cameraX,top+7-cameraY,3,G.floor-top-7,'#967b5d');
                r(c,xx+1-cameraX,top+8-cameraY,1,G.floor-top-9,'#bfa27a');
            }
            line(c,left+5-cameraX,top+28-cameraY,left+25-cameraX,top+7-cameraY,'#967b5d',2);
        }
        // Authored final refuge stays visibly dry; signs sit behind the runner.
        for (const [x, label] of [[624, 'DOIS RITMOS'], [816, 'ILHA SECA']] as const) {
            r(c, x - 22 - cameraX, 258 - cameraY, 2, 36, P.pipe);
            r(c, x - 28 - cameraX, 240 - cameraY, 74, 18, '#b59770');
            pixelText(c, label, x - 25 - cameraX, 246 - cameraY, '#63594c');
        }
        // Maintenance brackets belong to the real optional one-way shelf.
        for (const x of [G.shelfStart + 5, G.shelfEnd - 6])
            line(c, x - cameraX, G.shelfTop + 7 - cameraY, x + 6 - cameraX, G.floor - cameraY, P.pipe);
        // Quiet ochre separates decorative channels and feet from the real cap.
        r(c, 0, 295 - cameraY, 320, 9, P.dust);
        for (let x = Math.floor(cameraX / 32) * 32; x < cameraX + 320; x += 32)
            r(c, x + 7 - cameraX, 301 - cameraY, 10, 1, '#e2b783');
    });
}

/** Tile authority supplies every cap; the painter never invents a supporting edge. */
export function drawRespirosTerrain(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number) {
    layer(c, cx, cy, (rawX, rawY) => {
        const cameraX = Math.round(rawX), cameraY = Math.round(rawY);
        const firstX = Math.max(0, level.worldToCol(cameraX)), lastX = Math.min(level.data.width - 1, level.worldToCol(cameraX + 319));
        const firstY = Math.max(0, level.worldToRow(cameraY + 23)), lastY = Math.min(level.data.height - 1, level.worldToRow(cameraY + 179));
        for (let row = firstY; row <= lastY; row++) for (let col = firstX; col <= lastX; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile)) continue;
            const x = level.colToWorldX(col) - cameraX, y = level.rowToWorldY(row) - cameraY;
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0);
            if (isOneWayTile(tile)) {
                r(c, x, y, 16, 2, P.cap); r(c, x, y + 2, 16, 5, P.stoneShade); continue;
            }
            r(c, x, y, 16, 16, P.clay);
            drawGuairaClayGrain(c, x, y, col, row);
            if (top) {
                r(c, x, y, 16, 2, P.cap); r(c, x, y + 2, 16, 3, P.stone);
                r(c, x, y + 5, 16, 8, '#a57f5c'); r(c, x + 1, y + 5, 13, 1, '#c5a078');
                r(c, x + 14, y + 5, 1, 8, P.stoneShade);
            }
        }
    });
}

function grate(c: CanvasRenderingContext2D, b: MovingBody, s: JetCycle, cx: number, cy: number) {
    const left = Math.floor(b.x - cx), right = Math.ceil(b.x + b.width - cx);
    const mouth = Math.ceil(b.y + b.height - 4 - cy), width = right - left;
    // Every rail, slot and lower stone face remains below the dangerous liquid.
    r(c, left, mouth, width, 17, P.pipe); r(c, left, mouth, width, 2, P.brassLight);
    r(c, left + 1, mouth + 2, width - 2, 5, P.brass);
    for (let dx = 4; dx < width - 3; dx += 8) {
        r(c, left + dx, mouth + 2, 4, 3, P.pipe); r(c, left + dx, mouth + 5, 4, 1, '#88755b');
    }
    r(c, left + 1, mouth + 7, width - 2, 8, P.stoneShade);
    // Eight recessed segments fill during the native warning. The raised bars
    // and needle are readable in greyscale, with no flashing or separate clock.
    const inset = Math.min(10, Math.floor(width / 5)), meterWidth = Math.max(1, width - inset * 2);
    const fill = Math.max(0, Math.min(1, s.pressure));
    for (let i = 0; i < 8; i++) {
        const x = left + inset + Math.floor(i * meterWidth / 8);
        const end = left + inset + Math.floor((i + 1) * meterWidth / 8) - 1;
        r(c, x, mouth + 9, Math.max(1, end - x), 4, P.pipe);
        const amount = Math.max(0, Math.min(1, fill * 8 - i));
        if (amount > 0) r(c, x, mouth + 12 - Math.ceil(amount * 3), Math.max(1, end - x), Math.ceil(amount * 3), P.gauge);
    }
    for (const x of [left + 2, right - 7]) {
        if (s.phase === 'charging' || s.phase === 'rising' && !s.danger) {
            r(c, x + 2, mouth + 8, 1, 5, P.cap); r(c, x + 1, mouth + 9, 3, 1, P.cap); r(c, x, mouth + 10, 5, 1, P.cap);
        } else if (s.danger) {
            r(c, x + 2, mouth + 8, 1, 3, P.cap); r(c, x + 2, mouth + 12, 1, 1, P.cap);
        } else r(c, x, mouth + 11, 5, 1, P.cap);
    }
    r(c, left, mouth + 16, width, 1, '#765e50');
    // A slim standpipe repeats the pressure readout above the native fallback
    // touch buttons (screen y145–174 at the authored camera). It stands outside
    // the danger, behind the walking lane, and never resembles a platform.
    const gx = left - 12, gy = mouth - 49;
    r(c, gx + 3, gy + 28, 3, 20, P.pipe); r(c, gx + 4, gy + 29, 1, 18, P.brass);
    // The gauge's capillary actually enters the side of the grate, below the
    // liquid envelope. The elbow has no unsupported, bright horizontal ledge.
    r(c,gx+3,mouth-3,3,7,P.pipe); r(c,gx+4,mouth-2,1,5,P.brass);
    r(c,gx+5,mouth+2,8,3,P.pipe); r(c,gx+5,mouth+3,8,1,P.brass);
    r(c,left-2,mouth+1,3,5,P.pipe); r(c,left-1,mouth+2,1,3,P.brass);
    r(c, gx, gy, 9, 29, P.pipe); r(c, gx + 1, gy + 1, 7, 27, P.brass);
    r(c, gx + 2, gy + 2, 4, 24, '#645c50');
    for (let i = 0; i < 8; i++) {
        const amount = Math.max(0, Math.min(1, fill * 8 - i));
        if (amount > 0) r(c, gx + 2, gy + 24 - i * 3 - Math.ceil(amount * 2), 4, Math.ceil(amount * 2), P.gauge);
        r(c, gx + 6, gy + 23 - i * 3, 1, 1, P.cap);
    }
    r(c, gx + 2, gy - 2, 5, 2, P.brassLight);
    // A small enamel plate backs the existing upward warning against the rice.
    // Its complete silhouette stays outside the liquid and above touch controls.
    // The exclamation follows actual danger, including the last falling pixel;
    // a dry dash is deliberately not a promise of a long enough crossing window.
    const px = gx - 2, py = gy - 15;
    r(c, px + 2, py, 9, 13, P.pipe); r(c, px, py + 2, 13, 9, P.pipe);
    r(c, px + 2, py + 1, 9, 11, P.brass); r(c, px + 1, py + 2, 11, 9, P.brass);
    r(c, px + 2, py + 2, 9, 9, P.ink);
    if (s.danger) {
        r(c, px + 5, py + 3, 3, 4, P.cap); r(c, px + 5, py + 9, 3, 2, P.cap);
    } else if (s.phase === 'charging' || s.phase === 'rising') {
        // A zero-height first rising frame still announces imminent discharge.
        r(c, px + 5, py + 3, 3, 1, P.cap); r(c, px + 4, py + 4, 5, 1, P.cap);
        r(c, px + 3, py + 5, 7, 1, P.cap); r(c, px + 5, py + 6, 3, 3, P.cap);
    } else {
        r(c, px + 4, py + 6, 5, 1, P.brassLight);
    }
}

function pressureWater(c: CanvasRenderingContext2D, s: JetCycle, cx: number, cy: number, time: number, reducedMotion: boolean) {
    if (!s.danger) return;
    const d = s.danger, left = Math.floor(d.x - cx), top = Math.floor(d.y - cy);
    const right = Math.ceil(d.x + d.width - cx), bottom = Math.ceil(d.y + d.height - cy);
    const width = right - left, height = bottom - top;
    // Outward rasterisation covers every intersecting pixel, including the
    // first/last 1px danger frame and fractional cameras. Texture never erases it.
    r(c, left, top, width, height, W.body);
    r(c, left, top, 1, height, W.edge); r(c, right - 1, top, 1, height, W.edge);
    const textureTime = reducedMotion || !Number.isFinite(time) ? 0 : Math.max(0,time);
    const drift = Math.floor(textureTime / 70) % 22;
    for (let dx = 4; dx < width - 2; dx += 12) {
        const band = 2 + Math.floor(dx / 12) % 3;
        r(c, left + dx, top, Math.min(band, width - dx - 1), height, W.shade);
        // Upward trails are anchored at the fixed nozzle, not the changing top.
        // Spacing and wrap both use 22px: no backward jump when a cycle repeats.
        for (let yy = bottom + 22 - dx % 22 - drift; yy > top - 22; yy -= 22) {
            const start = Math.max(top+2,yy-8), end = Math.min(bottom,yy);
            if(end>start)r(c,left+dx+band,start,Math.min(2,width-dx-band-1),end-start,W.light);
        }
    }
    // Attached foam stays entirely inside the real height, even during collapse.
    r(c, left, top, width, 1, W.foam);
    if (height > 3) for (let dx = 2; dx < width - 3; dx += 9)
        r(c, left + dx, top + 1, Math.min(4, width - dx - 1), 1, W.light);
}

export function drawRespirosObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, _time: number, reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        // The object clock is the only hydraulic authority. A decorative render
        // time argument, a pause or reduced motion cannot shift either warning.
        const time = objects.time;
        const isolation = objects.get(G.serviceValveId);
        if (isolation) {
            const x=Math.round(isolation.x-cameraX), y=Math.round(isolation.y-cameraY);
            const wet=!objects.get(G.thirdJetId)?.active;
            drawGuairaPipe(c,668-cameraX,199-cameraY,76,wet,time,reducedMotion,true,1,false,PIPE);
            drawGuairaPipeElbow(c,668-cameraX,275-cameraY,wet,false,true,PIPE);
            drawGuairaPipe(c,677-cameraX,275-cameraY,21,wet,time,reducedMotion,false,1,false,PIPE);
            drawGuairaPipeElbow(c,698-cameraX,275-cameraY,wet,true,false,PIPE);
            drawGuairaPipe(c,698-cameraX,284-cameraY,23,wet,time,reducedMotion,true,1,false,PIPE);
            if (wet) drawGuairaPipeFlow(c,SERVICE_FEED,cameraX,cameraY,time,reducedMotion,PIPE.glint);
            drawGuairaPipeSaddle(c,672-cameraX,218-cameraY,true,PIPE);
            r(c,x,y,isolation.width,isolation.height,P.pipe);
            r(c,x+1,y+1,isolation.width-2,6,P.brass);
            r(c,x+2,y+1,isolation.width-4,1,P.brassLight);
            for(const dx of [2,isolation.width-4])r(c,x+dx,y+4,2,2,P.pipe);
            // C is the circuit name, not a keyboard binding. The down arrow
            // shares the same sentada grammar as the other pressure plates.
            pixelText(c,'C',x+6,y+2,P.ink);
            if(isolation.active) {
                r(c,x+16,y+3,9,2,P.pipe); r(c,x+19,y+1,2,6,P.pipe);
            } else {
                r(c,x+19,y+2,2,3,P.cap); r(c,x+17,y+4,6,1,P.cap); r(c,x+18,y+5,4,1,P.cap);
            }
        }
        for (const b of objects.bodies) {
            if (b.kind !== 'jet' || b.x + b.width < cameraX - 2 || b.x > cameraX + 322) continue;
            const s = jetCycle(b, time);
            grate(c, b, s, cameraX, cameraY);
            pressureWater(c, s, cameraX, cameraY, time, reducedMotion);
            if (!reducedMotion && s.vent > 0) {
                // Harmless residual mist is sparse, pale and detached: no cyan
                // core, no floor-covering curtain, and no droplets in the refuge.
                const age = 1 - s.vent, mouth = b.y + b.height - 4;
                for (let n = 0; n < 4; n++) {
                    const x = b.x + (n + 1) * b.width / 5;
                    r(c, x - cameraX, mouth - 5 - Math.round(age * (7 + n)) - cameraY, 2, 1, P.mist);
                }
            }
            // The native valve records the interrupted column once. After
            // isolation only pale, harmless drops remain; no stale danger ink.
            if (!reducedMotion && b.active && b.jetShutdown) {
                const age=time-b.jetShutdown.at;
                if(age>=0 && age<300)for(let n=0;n<4;n++)
                    r(c,b.x+(n+1)*b.width/5-cameraX,
                        b.y+b.height-4-Math.round(b.jetShutdown.height*(n+1)/5*(1-age/300))-cameraY,2,1,P.mist);
            }
        }
        // Friendly existing art remains behind safe banks, well clear of the
        // channels, gauges, centre checkpoint and Feka's feet on the bright cap.
        for (const [x, kind] of [[81, 'pump'], [G.finishX - 26, 'rice']] as const) {
            if (x < cameraX - 20 || x > cameraX + 340) continue;
            drawGuairaWorker(c, x - cameraX, 290 - cameraY, kind,
                { activeTimeMs: time, valveActive: false, bridgeRise: 0, reducedMotion });
        }
    });
}
