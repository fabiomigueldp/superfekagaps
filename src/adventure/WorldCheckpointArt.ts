import { ART } from '../graphics/palette';
import { box, ink } from './WorldPainting';

/** Presentation only. Millisecond ages are never persisted and never gate a reward. */
export interface WorldFlagMotion {
    time?: number;
    reducedMotion?: boolean;
    activationAge?: number | null;
}
export const WORLD_FLAG_HOIST_MS = 450;
const CHECK = ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'];
const READY = ['..##...', '..##...', '..##...', '.......', '..##...', '..##...'];
const STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.'];
const SECRET = ['.####..', '##..##.', '...##..', '..##...', '.......', '..##...'];
const LOCK = ['..###..', '.#...#.', '.#...#.', '#######', '###.###', '#######'];
// Same four-beat, 180 ms cloth cadence as Remastered's Renderer.flagAt.
// A fixed root and small integer folds keep symbols attached to the cloth.
const WAVES = [
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 1, 1, 1, 1, 0, 0, -1, -1, -1, -1],
    [0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 1, 1, 1, 1, 0, 0, -1, -1, -1, -1],
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, -1, -1, -1, -1, 0, 0, 1, 1, 1, 1],
] as const;

function flag(c: CanvasRenderingContext2D, x: number, y: number, goal: boolean,
    reached: boolean, secret: boolean, locked: boolean, motion: WorldFlagMotion) {
    x = Math.round(x); y = Math.round(y);
    const height = goal ? 40 : 35, width = goal ? 22 : 18, clothHeight = goal ? 14 : 12;
    const top = y - height, reduced = !!motion.reducedMotion;
    const age = motion.activationAge;
    const hoisting = reached && !reduced && age != null && age >= 0 && age < WORLD_FLAG_HOIST_MS;
    const restingDrop = goal ? 4 : 7;
    const drop = !reached ? restingDrop : hoisting ? Math.round(restingDrop * (1 - age / WORLD_FLAG_HOIST_MS) ** 2) : 0;
    const wave = WAVES[Math.floor(Math.max(0, motion.time ?? 0) / 180) % WAVES.length];
    const shift = (column: number) => reduced || locked ? 0 : wave[column];
    const color = locked ? '#788b9a' : goal ? secret ? '#b48ddc' : ART.gold : reached ? '#86d2ad' : ART.redLight;
    const light = locked ? '#a7b4bb' : goal ? secret ? '#ead3f4' : ART.goldLight : reached ? ART.tealLight : '#ffd3ab';
    const shade = locked ? '#547187' : goal ? secret ? ART.purple : ART.goldDark : reached ? ART.tealDark : ART.redDark;
    const mark = locked ? LOCK : goal ? secret ? SECRET : STAR : reached ? CHECK : READY;
    // Outlined mast, cap, rope and planted foot echo the Remastered material language.
    box(c, x - 1, top, 4, height, ink);
    box(c, x, top + 1, 1, height - 2, '#f0dbc0');
    box(c, x + 1, top + 2, 1, height - 3, ART.soilTop);
    box(c, x - 2, top - 2, 5, 4, ink);
    box(c, x - 1, top - 1, 3, 2, goal ? ART.goldLight : '#f0dbc0');
    box(c, x - 3, y - 2, 9, 2, ink);
    box(c, x - 2, y - 2, 7, 1, ART.soilTop);
    box(c, x + 3, top + 3, 1, height - 7, '#bea889');
    const clothTop = top + 2 + drop, symbolLeft = Math.floor((width - 7) / 2);
    for (let col = 0; col < width; col++) {
        const yy = clothTop + shift(col), xx = x + 3 + col;
        box(c, xx, yy, 1, clothHeight, ink);
        box(c, xx, yy + 1, 1, clothHeight - 3, color);
        box(c, xx, yy + 1, 1, 1, light);
        box(c, xx, yy + clothHeight - 2, 1, 1, shade);
        // The outer hem and alternating folds survive nearest-neighbour scaling.
        if (col === width - 1) box(c, xx, yy + 2, 1, clothHeight - 4, shade);
        const sx = col - symbolLeft;
        if (sx >= 0 && sx < 7) for (let row = 0; row < mark.length; row++)
            if (mark[row][sx] === '#') box(c, xx, yy + 3 + row, 1, 1, ink);
    }
    // A settled check remains unambiguous even with animation disabled or muted.
    if (goal && reached) {
        box(c, x - 3, y - 12, 9, 7, ink);
        box(c, x - 2, y - 11, 7, 5, light);
        box(c, x - 1, y - 9, 1, 1, ink);
        box(c, x, y - 8, 1, 1, ink);
        box(c, x + 1, y - 9, 1, 1, ink);
        box(c, x + 2, y - 10, 1, 1, ink);
    }
    // One finite glint, no particles, random values, extra canvas or render-time state.
    if (reached && !reduced && age != null && age >= 0 && age < 650) {
        const step = Math.floor(age / 130), distance = 3 + step * 2;
        box(c, x + width + 5 + distance, clothTop + 3, 2, 1, light);
        box(c, x + width + 5, clothTop - distance, 1, 2, light);
        box(c, x - 3 - distance, clothTop + 5, 2, 1, light);
    }
}

/** Ground anchor matches the checkpoint's existing spawn coordinates. */
export function drawWorldCheckpoint(c: CanvasRenderingContext2D, x: number, y: number, reached: boolean, motion: WorldFlagMotion = {}) {
    flag(c, x, y, false, reached, false, false, motion);
}

/** Uses the existing exit rectangle's top-left; drawing never changes its trigger. */
export function drawWorldGoal(c: CanvasRenderingContext2D, x: number, y: number, secret: boolean, locked: boolean,
    complete: boolean, motion: WorldFlagMotion = {}) {
    flag(c, x + 8, y + 40, true, complete, secret, locked, motion);
}
