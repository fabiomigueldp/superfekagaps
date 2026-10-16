import { box as r, type Point } from '../../WorldPainting';

export interface GuairaPipePalette {
    edge: string; brass: string; light: string; shade: string;
    water: string; glint: string; dry: string;
}
export const GUAIRA_PIPE_COLORS: Readonly<GuairaPipePalette> = Object.freeze({
    edge: '#735b4b', brass: '#b99465', light: '#d4b680', shade: '#997650',
    water: '#68b6bf', glint: '#b7dfd3', dry: '#bd9165',
});

/** Split wall saddle: anchors and gasket grip the metal edges while the full
 * three-pixel sight channel stays untouched. Also fits vertical risers. */
export function drawGuairaPipeSaddle(c: CanvasRenderingContext2D, x: number, y: number,
    vertical = false, p: Readonly<GuairaPipePalette> = GUAIRA_PIPE_COLORS) {
    c.save(); x=Math.round(x); y=Math.round(y);
    const at=(along:number,across:number,w:number,h:number,color:string)=>
        r(c,x+(vertical?across:along),y+(vertical?along:across),vertical?h:w,vertical?w:h,color);
    at(-6,-9,13,4,'#a48b6b'); at(-6,6,13,4,'#8f795f');
    at(-5,-9,11,1,'#bda380'); at(-5,9,11,1,'#7d6a56');
    at(-3,-6,7,3,p.edge); at(-3,4,7,3,p.edge);
    at(-2,-6,5,2,p.brass); at(-2,5,5,2,p.shade);
    at(-2,-6,5,1,p.light);
    for(const side of [-1,1]) {
        at(side*4,-8,1,2,p.edge); at(side*4,7,1,2,p.edge);
        at(side*4,-8,1,1,p.light); at(side*4,7,1,1,p.brass);
    }
    c.restore();
}
const clock = (time: number, reduced: boolean) => reduced || !Number.isFinite(time) ? 0 : Math.max(0, time);

/** Compile a pixel-centred route once. Distance continues through each bend;
 * a shared corner belongs to one step, never two independent animation loops. */
export function guairaPipeRoute(vertices: readonly Point[]): readonly Point[] {
    const points: Point[] = [];
    for (let i = 0; i < vertices.length; i++) {
        const [x, y] = vertices[i];
        if (![x, y].every(Number.isInteger)) throw new Error('Pipe routes require integer pixels');
        if (!i) { points.push([x, y]); continue; }
        const [px, py] = vertices[i - 1];
        if (px !== x && py !== y) throw new Error('Pipe routes require orthogonal joints');
        const dx = Math.sign(x - px), dy = Math.sign(y - py), length = Math.abs(x - px) + Math.abs(y - py);
        for (let step = 1; step <= length; step++) points.push([px + dx * step, py + dy * step]);
    }
    return points;
}

/** Compile the shallow bank-to-gate spans on the world pixel grid, once.
 * Keeping their source-to-outlet order makes the reflection follow the real supply. */
export function guairaInclinedPipeRoute(from: Point, to: Point): readonly Point[] {
    if (![...from, ...to].every(Number.isInteger)) throw new Error('Pipe routes require integer pixels');
    const dx = to[0]-from[0], dy = to[1]-from[1], length = Math.abs(dx);
    if (!length || Math.abs(dy)>length) throw new Error('Inclined bank pipes require a shallow horizontal span');
    return Array.from({ length: length+1 }, (_, i) =>
        [from[0]+Math.sign(dx)*i, Math.round(from[1]+dy*i/length)] as Point);
}

/** Same recessed glass and bronze joints as the workshop pipes, following a sloping bank.
 * Draw structure first and glass last, so a collar cannot accidentally block the water. */
export function drawGuairaInclinedPipe(c: CanvasRenderingContext2D, route: readonly Point[],
    cx: number, cy: number, wet: boolean, time: number, reduced: boolean,
    palette: Readonly<GuairaPipePalette> = GUAIRA_PIPE_COLORS) {
    if (!route.length) return;
    cx = Math.round(cx); cy = Math.round(cy);
    const p = palette;
    c.save();
    // Merge horizontal pixel runs. The stepped silhouette never depends on subpixel camera motion.
    const bands = (paint: (x: number, y: number, width: number) => void) => {
        for (let first=0; first<route.length;) {
            let end=first+1;
            while (end<route.length && route[end][1]===route[first][1]) end++;
            const x=Math.min(route[first][0],route[end-1][0])-cx, y=route[first][1]-cy;
            if (x+end-first>=0 && x<320 && y+6>=23 && y-6<180) paint(x,y,end-first);
            first=end;
        }
    };
    bands((x,y,w) => {
        r(c,x,y-4,w,9,p.edge); r(c,x,y-3,w,7,p.brass);
        r(c,x,y-3,w,1,p.light); r(c,x,y+3,w,1,p.shade);
    });
    const collars = [5, route.length-6];
    for (let d=38; d<route.length-20; d+=38) collars.push(d);
    for (const centre of collars) for (let d=Math.max(0,centre-2); d<=Math.min(route.length-1,centre+2); d++) {
        const [wx,wy]=route[d], x=wx-cx, y=wy-cy;
        if (x<0 || x>=320 || y+6<23 || y-6>=180) continue;
        r(c,x,y-5,1,11,p.edge);
        if (Math.abs(d-centre)<2) {
            r(c,x,y-4,1,9,p.brass); r(c,x,y-4,1,1,p.light);
            if (d===centre) { r(c,x,y-3,1,1,p.light); r(c,x,y+3,1,1,p.edge); }
        }
    }
    bands((x,y,w) => r(c,x,y-1,w,3,wet?p.water:p.dry));
    if (wet) drawGuairaPipeFlow(c,route,cx,cy,time,reduced,p.glint);
    c.restore();
}

/** One unbroken flow along a complete route, behind valves and cylinder covers.
 * Safe inspection glass uses muted colours, never the damaging jet palette. */
export function drawGuairaPipeFlow(c: CanvasRenderingContext2D, route: readonly Point[],
    cx: number, cy: number, time: number, reduced: boolean, color = GUAIRA_PIPE_COLORS.glint) {
    const travel = Math.floor(clock(time, reduced) / 100) % 20;
    const x = Math.round(cx), y = Math.round(cy);
    c.save();
    for (let head = travel - 20; head < route.length; head += 20)
        for (let d = Math.max(0, head); d < Math.min(route.length, head + 3); d++) {
            const [px, py] = route[d];
            if (px - x >= 0 && px - x < 320 && py - y >= 23 && py - y < 180)
                r(c, px - x, py - y, 1, 1, color);
        }
    c.restore();
}

/** Nine-pixel bronze pipe, with a continuous recessed three-pixel sight glass.
 * Joined networks disable localFlow and paint one full route after the fittings. */
export function drawGuairaPipe(c: CanvasRenderingContext2D, x: number, y: number, length: number,
    wet: boolean, time: number, reduced: boolean, vertical = false, direction: -1 | 1 = 1,
    localFlow = true, palette: Readonly<GuairaPipePalette> = GUAIRA_PIPE_COLORS) {
    if (![x, y, length].every(Number.isFinite)) return;
    x = Math.round(x); y = Math.round(y); length = Math.round(length);
    if (length < 7) return;
    const p = palette;
    const at = (along: number, across: number, width: number, height: number, color: string) =>
        r(c, x + (vertical ? across : along), y + (vertical ? along : across),
            vertical ? height : width, vertical ? width : height, color);
    c.save();
    at(0, 0, length, 9, p.edge); at(0, 1, length, 7, p.brass);
    at(1, 1, length - 2, 1, p.light); at(1, 7, length - 2, 1, p.shade);
    for (let offset = 22; offset < length - 6; offset += 40) {
        at(offset, -1, 5, 11, p.edge); at(offset + 1, 0, 3, 9, p.brass);
        at(offset + 1, 0, 2, 1, p.light); at(offset + 3, 1, 1, 7, p.shade);
        at(offset + 1, 1, 1, 1, p.light); at(offset + 1, 7, 1, 1, p.edge);
    }
    at(0, 3, length, 3, wet ? p.water : p.dry);
    if (wet && localFlow) {
        const drift = Math.floor(clock(time, reduced) / 140) % 20;
        for (let offset = -20; offset < length + 20; offset += 20) {
            const head = offset + direction * drift, start = Math.max(0, head), end = Math.min(length, head + 3);
            if (end > start) at(start, 4, end - start, 1, p.glint);
        }
    }
    c.restore();
}

/** Rounded quarter-turn, open at the bottom and right by default. */
export function drawGuairaPipeElbow(c: CanvasRenderingContext2D, x: number, y: number, wet: boolean,
    left = false, top = false, palette: Readonly<GuairaPipePalette> = GUAIRA_PIPE_COLORS) {
    if (![x, y].every(Number.isFinite)) return;
    const rows = ['___kkkkkk', '_kkHHHHHH', '_kHbbbbbb', 'kkbwwwwww', 'kHbwwwwww',
        'kHbwwwwww', 'kHbwwwbbk', 'kHbwwwbk_', 'kHbwwwk__'];
    const colors: Record<string, string> = { k: palette.edge, H: palette.light, b: palette.brass, w: wet ? palette.water : palette.dry };
    c.save(); x = Math.round(x); y = Math.round(y);
    rows.forEach((row, yy) => [...row].forEach((key, xx) => {
        if (colors[key]) r(c, x + (left ? 8 - xx : xx), y + (top ? 8 - yy : yy), 1, 1, colors[key]);
    }));
    c.restore();
}
