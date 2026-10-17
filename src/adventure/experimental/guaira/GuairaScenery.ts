import { box as r, pixelLine as line, polygon, oval } from '../../WorldPainting';
import { drawGuairaDistantSettlement } from './GuairaDistantScenery';

export type GuairaLandscape = 'village' | 'junction' | 'rice' | 'corral' | 'heights' | 'town';

/** Only the host's simulation clock drives scenery: pause, hitstop and reduced
 * motion cannot leave a second animation loop running behind the level. */
export const sceneryTime = (time: number, reduced = false) => reduced || !Number.isFinite(time) ? 0 : Math.max(0, time);
const finite = (n: number) => Number.isFinite(n) ? n : 0;
const wrap = (n: number, span: number) => ((n % span) + span) % span;
const SKY = ['#bdd0c2', '#c1d2c3', '#c5d4c4', '#cbd6c4', '#d1d8c3', '#d6dac1', '#dad9bd',
    '#ded7b8', '#e1d5b3', '#e3d2ae', '#e5d0a9', '#e6cda4', '#e7cba1', '#e7c99f'];

/** A travelling breeze, sampled in world space; the roots never move. */
export function guairaBreeze(time: number, worldX: number, strength = 1) {
    const t = sceneryTime(time);
    return Math.round(strength * (Math.sin(t / 2400 - worldX / 113) * .72 + Math.sin(t / 5700 + worldX / 219) * .28));
}

const PROFILES = {
    village: { ridge: 102, seed: 0, sun: 247, fields: false },
    junction: { ridge: 126, seed: 83, sun: 224, fields: true },
    rice: { ridge: 117, seed: 171, sun: 267, fields: true },
    corral: { ridge: 94, seed: 254, sun: 226, fields: true },
    heights: { ridge: 147, seed: 368, sun: 250, fields: true },
    town: { ridge: 117, seed: 452, sun: 60, fields: false },
} as const;

function cloud(c: CanvasRenderingContext2D, x: number, y: number, w: number, tall: boolean) {
    // Rounded stepped lobes have a shared underside; no detached cloud pixels.
    const h = tall ? 14 : 9;
    oval(c, x + 7, y - 4, w * .46, h, '#efe4c3');
    oval(c, x + w * .36, y - h + 3, w * .37, h + 7, '#efe4c3');
    oval(c, x, y, w, 10, '#efe4c3');
    r(c, x + 8, y + 8, w - 17, 2, '#ddd7b7');
    r(c, x + 16, y + 7, w - 28, 1, '#e6ddbc');
}

/** A distant flock crosses the whole view, with long quiet gaps. A bird glides
 * between short wing strokes; its centre follows a continuous, shallow arc. */
export function guairaBirds(kind: GuairaLandscape, cx: number, cy: number, time: number, reduced = false) {
    if (reduced) return [];
    const t = sceneryTime(time), elapsed = t + PROFILES[kind].seed * 137;
    // The entire repeat happens well outside the view, including at the ends
    // of scrolling stages. Camera motion cannot reset a flock mid-flight.
    const lead = wrap(elapsed * .014 - finite(cx) * .035, 1274) - 80;
    const flock: Array<{ x: number; y: number; wing: number; index: number }> = [];
    for (let i = 0; i < 3; i++) {
        const x = Math.round(lead - i * 12), y = Math.round(47 - finite(cy) * .035 + i * 4 + Math.sin(elapsed / 5700 + i * .6) * 2);
        if (x < -9 || x > 329) continue;
        const beat = wrap(t + i * 170, 3800);
        const wing = beat < 620 ? Math.round(Math.sin(beat / 620 * Math.PI * 2) * 2) : -1;
        flock.push({ x, y, wing, index: i });
    }
    return flock;
}

function birds(c: CanvasRenderingContext2D, kind: GuairaLandscape, cx: number, cy: number, t: number, reduced: boolean) {
    for (const { x, y, wing } of guairaBirds(kind, cx, cy, t, reduced)) {
        line(c, x - 3, y + wing, x - 1, y, '#8f9e8b');
        r(c, x, y, 2, 1, '#8f9e8b');
        line(c, x + 2, y, x + 4, y + wing, '#8f9e8b');
    }
}

/** Continuous land masses extend to the bottom of the viewport. Parallax is
 * applied to complete layers, never to individual pieces of a landmark. */
export function drawGuairaLandscape(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reduced: boolean, kind: GuairaLandscape) {
    const x = Math.round(finite(cx)), y = Math.round(finite(cy)), t = sceneryTime(time, reduced), p = PROFILES[kind];
    c.save(); c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    r(c, 0, 0, 320, 180, '#e7c99f');
    for (let i = 0; i < SKY.length; i++) r(c, 0, i * 8, 320, 8, SKY[i]);
    const sunX = p.sun - Math.round(x * .025), sunY = 35 - Math.round(y * .025);
    oval(c, sunX - 3, sunY - 3, 26, 26, '#e5ddbb');
    oval(c, sunX, sunY, 20, 20, '#f3e3b5');
    for (const [offset, yy, width, speed] of [[38,49,64,1],[301,65,82,.7],[493,38,48,.8]] as const) {
        const xx = wrap(offset + p.seed - x * .075 + t / 1350 * speed, 680) - 100;
        if (xx + width < -1 || xx > 321) continue;
        cloud(c, Math.round(xx), Math.round(yy - y * .04), width, width > 70);
    }
    birds(c, kind, x, y, t, reduced);
    const horizon = Math.round(p.ridge - y * .18), shift = Math.round(x * .13) + p.seed;
    const ridge = [[0,15],[23,13],[46,3],[64,2],[78,8],[99,11],[124,25],[148,23],[170,9],[201,5],[224,9],[252,30],[281,29],[307,15],[336,13],[359,27],[384,15]] as const;
    for (let n = Math.floor(shift / 384) - 1; n <= Math.floor((shift + 320) / 384); n++) {
        const left = n * 384 - shift;
        polygon(c, [...ridge.map(([xx, yy]) => [left + xx, horizon - 28 + yy] as const), [left + 384,180], [left,180]], '#b8b39a');
        polygon(c, [[left + 64,horizon - 26],[left + 78,horizon - 20],[left + 99,horizon - 17],[left + 124,horizon - 3],[left + 100,horizon - 6]], '#c8bea0');
    }
    const near = horizon + 9, shift2 = Math.round(x * .27) + p.seed;
    const hills = [[0,9],[27,7],[54,0],[79,1],[108,12],[143,16],[176,8],[204,4],[232,10],[268,13],[300,7],[336,9]] as const;
    for (let n = Math.floor(shift2 / 336) - 1; n <= Math.floor((shift2 + 320) / 336); n++) {
        const left = n * 336 - shift2;
        polygon(c, [...hills.map(([xx, yy]) => [left + xx, near + yy] as const), [left + 336,180], [left,180]], p.fields ? '#a5aa86' : '#c0ab87');
        if (p.fields) {
            polygon(c, [[left + 22,near + 19],[left + 120,near + 20],[left + 143,near + 29],[left,near + 28]], '#b7b38b');
            polygon(c, [[left + 157,near + 23],[left + 244,near + 19],[left + 277,near + 27],[left + 169,near + 31]], '#8fa58b');
            line(c, left + 172, near + 25, left + 254, near + 23, '#afbc9d');
        }
        // A few rooted treelines soften the horizon, each silhouette stays attached.
        for (const [dx, dy, h] of [[31,9,12],[39,8,9],[214,8,14],[226,9,10]] as const) {
            r(c, left + dx, near + dy - h + 6, 2, h - 4, '#929e7d');
            oval(c, left + dx - 4, near + dy - h, 10, 9, '#929e7d');
        }
    }
    drawGuairaDistantSettlement(c, x, y, t, kind);
    c.restore();
}

const CANOPIES = [
    [[-27,11,32,18,1],[-10,0,34,24,.5],[9,9,28,20,1],[-14,18,35,16,.3]],
    [[-23,17,29,23,1],[-15,4,28,28,.5],[3,0,25,25,.5],[7,20,29,23,1],[-10,26,30,18,.3]],
    [[-30,14,29,21,1],[-20,1,32,25,.5],[4,7,30,27,.7],[-10,21,33,21,.3]],
] as const;

/** Broken, overlapping leaf masses instead of concentric ellipse highlights. */
function foliage(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: string, leaf: string, light: string) {
    const shape = [[.04,.4],[.14,.24],[.28,.2],[.33,.06],[.55,0],[.75,.09],
        [.82,.25],[.94,.3],[1,.57],[.94,.75],[.77,.86],[.51,1],[.26,.91],[.08,.74],[0,.57]] as const;
    polygon(c, shape.map(([xx, yy]) => [x + Math.round(xx * w), y + Math.round(yy * h)] as const), dark);
    polygon(c, [[x+2,y+Math.round(h*.4)],[x+Math.round(w*.2),y+Math.round(h*.25)],
        [x+Math.round(w*.35),y+2],[x+Math.round(w*.57),y+1],[x+Math.round(w*.76),y+Math.round(h*.16)],
        [x+w-4,y+Math.round(h*.4)],[x+w-5,y+h-6],[x+Math.round(w*.5),y+h-4],[x+4,y+h-7]], leaf);
    r(c, x + Math.round(w * .36), y + 3, Math.round(w * .22), 2, light);
    r(c, x + Math.round(w * .24), y + 5, 3, 2, light);
    r(c, x + Math.round(w * .68), y + Math.round(h * .55), 2, 2, light);
}

/** Orchard silhouettes vary with their fixed world position, never per frame.
 * Trunk, branch junctions and soil shadow stay fixed; only outer leaves breathe. */
export function drawGuairaTree(c: CanvasRenderingContext2D, x: number, root: number, h: number, time: number, worldX: number, muted = false) {
    if (x < -45 || x > 365 || root - h > 180 || root < 0) return;
    const crown = root - h, sway = guairaBreeze(time, worldX, 2);
    const dark = muted ? '#8a9875' : '#708455', leaf = muted ? '#a0aa7d' : '#8d9e61', light = muted ? '#b4b48a' : '#b0b779';
    oval(c, x - 17, root - 2, 37, 5, muted ? '#b09c78' : '#ac8b63');
    polygon(c, [[x - 3,root],[x + 4,root],[x + 2,crown + 14],[x - 2,crown + 13]], '#8f795a');
    line(c, x, root - 3, x, crown + 14, '#b49a6a', 2);
    line(c, x, crown + 29, x - 13, crown + 13, '#8f795a', 2);
    line(c, x + 1, crown + 25, x + 15, crown + 8, '#8f795a', 2);
    const scale = Math.max(.85, Math.min(1.1, h / 72)), variant = Math.abs(Math.floor(worldX / 17)) % CANOPIES.length;
    for (const [dx, dy, w, hh, movement] of CANOPIES[variant]) {
        const xx = x + Math.round(dx * scale) + Math.round(sway * movement), yy = crown + Math.round(dy * scale);
        foliage(c, xx, yy, Math.round(w * scale), Math.round(hh * scale), dark, leaf, light);
    }
}

/** Soft earthen footings join a planted terrace to the hillside beneath it.
 * Sloped edges and muted colours cannot masquerade as the real platform cap. */
export function drawGuairaFieldBank(c: CanvasRenderingContext2D, x: number, top: number, width: number, bottom: number) {
    const end = Math.max(top + 16, bottom);
    if (x + width + 10 < 0 || x - 10 >= 320 || top >= 180 || end <= 0) return;
    // Clip the drawing, not its vertices: a viewport-clamped base changes the
    // slope every time the camera rises. Include both flared feet in culling.
    polygon(c, [[x + 4,top],[x + width - 5,top],[x + width + 10,end],[x - 10,end]], '#b7a078');
    polygon(c, [[x + width - 17,top + 3],[x + width - 5,top],[x + width + 10,end],[x + width - 7,end]], '#aa956f');
}

/** A small roof sparrow rests for most of its cycle. The occasional head turn
 * and tail lift stay attached to the same body and fixed feet. No particles. */
export function drawGuairaPerchedBird(c: CanvasRenderingContext2D, x: number, feet: number, time: number, worldX: number, facing: -1 | 1 = 1) {
    if (x < -9 || x > 329 || feet < 0 || feet - 8 >= 180) return;
    const phase = wrap(sceneryTime(time) + worldX * 71, 17200);
    const look = phase > 11800 && phase < 13700 ? -facing : facing;
    const tail = phase > 14800 && phase < 15300 ? 1 : 0;
    const feather = '#85886b', wing = '#a4a181', chest = '#c3b58c';
    line(c, x - facing * 2, feet - 3, x - facing * 5, feet - 4 - tail, feather);
    oval(c, x - 3, feet - 5, 7, 4, feather);
    r(c, x - 1, feet - 4, 3, 2, wing);
    r(c, x + (facing > 0 ? 2 : -2), feet - 3, 2, 2, chest);
    r(c, x + look - 1, feet - 7, 3, 3, feather);
    r(c, x + look * 3, feet - 5, 1, 1, '#b69a70');
    r(c, x + look, feet - 6, 1, 1, '#686e59');
    r(c, x - 1, feet - 1, 1, 1, '#8e7a5e');
    r(c, x + 2, feet - 1, 1, 1, '#8e7a5e');
}

/** Cloth is secured along the lintel. The weighted lower seam moves gently. */
export function drawGuairaAwning(c: CanvasRenderingContext2D, x: number, y: number, w: number, time: number, worldX: number) {
    const sway = guairaBreeze(time, worldX);
    r(c, x - 1, y, w + 2, 2, '#947959');
    polygon(c, [[x,y + 2],[x + w,y + 2],[x + w + 2,y + 9 + sway],[x - 2,y + 9 + sway]], '#9b9d76');
    for (let dx = 4; dx < w - 2; dx += 8)
        polygon(c, [[x + dx,y + 2],[x + dx + 3,y + 2],[x + dx + 4,y + 9 + sway],[x + dx,y + 9 + sway]], '#bfbd91');
    r(c, x - 2, y + 9 + sway, w + 4, 2, '#868b69');
}
