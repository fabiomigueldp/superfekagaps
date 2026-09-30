import { PixelGrid, type PixelFrame } from '../graphics/pixels';
import { SPRITE_PALETTE } from '../graphics/sprites';
export const WORLD_PALETTE = { ...SPRITE_PALETTE, N: '#365d70', n: '#22384f', E: '#6e9ca6', D: '#b6d6cb', I: '#f5e7b7', i: '#c9ac73', V: '#a65ad9', v: '#683b93', Q: '#e0b4f1', U: '#3e73bb', u: '#253c73', Z: '#a8e6ef' };
export type BossPose = 'idle' | 'walk' | 'windup' | 'smash' | 'shoot' | 'recover' | 'hurt' | 'dead';
/** Small raster primitives keep authored anatomy on the native grid. */
function ellipse(g: PixelGrid, x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) {
        const d = Math.sqrt(Math.max(0, 1 - ((j + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        g.rect(Math.ceil(x + w / 2 - d), y + j, Math.floor(d * 2), 1, color);
    }
}
function shape(g: PixelGrid, points: number[][], color: string) {
    for (let y = Math.min(...points.map(p => p[1])); y < Math.max(...points.map(p => p[1])); y++) {
        const cuts: number[] = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5))
                cuts.push(a[0] + (y + .5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        cuts.sort((a, b) => a - b);
        for (let i = 0; i < cuts.length; i += 2)
            g.rect(Math.ceil(cuts[i]), y, Math.ceil(cuts[i + 1]) - Math.ceil(cuts[i]), 1, color);
    }
}
function arm(g: PixelGrid, points: number[][], skin: string, light: string, shade: string, glove = false) {
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1], n = Math.max(1, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
        for (let j = 0; j <= n; j++) {
            const x = a[0] + (b[0] - a[0]) * j / n, y = a[1] + (b[1] - a[1]) * j / n;
            ellipse(g, x - 5, y - 5, 11, 11, 'K');
        }
        for (let j = 0; j <= n; j++) {
            const x = a[0] + (b[0] - a[0]) * j / n, y = a[1] + (b[1] - a[1]) * j / n;
            ellipse(g, x - 4, y - 4, 9, 9, skin);
            g.rect(x - 3, y - 3, 3, 3, light);
            g.rect(x + 3, y, 1, 3, shade);
        }
    }
    const [x, y] = points[points.length - 1];
    ellipse(g, x - 5, y - 4, 11, 9, 'K');
    ellipse(g, x - 4, y - 3, 9, 7, glove ? 'n' : skin);
    g.rect(x - 3, y - 3, 5, 2, glove ? 'E' : light);
    g.rect(x - 2, y + 1, 1, 2, glove ? 'N' : shade).rect(x + 1, y + 1, 1, 2, glove ? 'N' : shade);
}
function boots(g: PixelGrid, pose: BossPose, f: number, trouser: string, light: string) {
    const step = pose === 'walk' ? (f % 2 ? 2 : -2) : 0, bend = pose === 'recover' || pose === 'smash' || pose === 'dead' ? 2 : 0;
    shape(g, [[13, 40 + bend], [25, 40 + bend], [22 - step, 53], [10 - step, 53]], 'K');
    shape(g, [[28, 40 + bend], [39, 40 + bend], [40 + step, 53], [29 + step, 53]], 'K');
    g.rect(14, 42 + bend, 7, 8 - bend, trouser).rect(29, 42 + bend, 7, 8 - bend, trouser).rect(14, 43 + bend, 3, 5, light).rect(29, 43 + bend, 3, 5, light);
    g.rect(7 - step, 51, 16, 5, 'K').rect(27 + step, 51, 16, 5, 'K').rect(9 - step, 51, 10, 2, 'n').rect(29 + step, 51, 10, 2, 'n').rect(8 - step, 54, 14, 1, 'E').rect(28 + step, 54, 14, 1, 'E');
}
function face(g: PixelGrid, x: number, y: number, green: boolean, pose: BossPose, beard = false) {
    const skin = green ? 'G' : 'S', shade = green ? 'g' : 's', light = green ? 'l' : 'f';
    ellipse(g, x - 2, y + 4, 26, 17, 'K');
    ellipse(g, x, y, 23, 23, 'K');
    ellipse(g, x + 1, y + 2, 21, 19, skin);
    g.rect(x + 3, y + 3, 13, 6, light).rect(x + 18, y + 8, 3, 11, shade).rect(x + 5, y + 20, 12, 2, shade);
    // Nose and pupils point left; both friends share the scale, not the face silhouette.
    g.rect(x - 2, y + 11, 5, 5, shade).rect(x - 2, y + 11, 4, 3, light);
    if (pose === 'hurt' || pose === 'dead') {
        for (const xx of [x + 3, x + 13])
            g.line(xx, y + 9, xx + 4, y + 12, 'K').line(xx + 4, y + 9, xx, y + 12, 'K');
    }
    else if (pose === 'recover') {
        g.line(x + 2, y + 11, x + 6, y + 10, 'K').line(x + 12, y + 10, x + 17, y + 11, 'K');
    }
    else {
        g.rect(x + 2, y + 9, 6, 4, 'W').rect(x + 12, y + 9, 6, 4, 'W').rect(x + 2, y + 10, 2, 3, 'K').rect(x + 12, y + 10, 2, 3, 'K');
        g.line(x + 1, y + 6, x + 8, y + 8, 'h').line(x + 12, y + 8, x + 19, y + 6, 'h');
    }
    if (beard) {
        shape(g, [[x + 1, y + 15], [x + 7, y + 17], [x + 12, y + 15], [x + 21, y + 13], [x + 20, y + 22], [x + 6, y + 24], [x + 1, y + 20]], 'h');
        g.rect(x + 3, y + 17, 12, 2, 'K').rect(x + 4, y + 17, 9, 1, 'I').rect(x + 7, y + 21, 5, 1, 'a');
    }
    else {
        g.rect(x + 4, y + 16, 12, 4, 'K').rect(x + 5, y + 16, 9, 1, 'W');
        if (pose === 'recover')
            g.rect(x + 6, y + 17, 6, 3, shade);
    }
}
function calabrezzo(pose: BossPose, f = 0, cold = false): PixelFrame {
    const g = new PixelGrid(48, 56), dy = pose === 'windup' ? -1 : pose === 'smash' || pose === 'recover' ? 2 : pose === 'idle' ? f % 2 : 0;
    boots(g, pose, f, 'n', 'N');
    const back = pose === 'windup' ? [[36, 26], [42, 18], [33, 11]] : pose === 'shoot' ? [[36, 26], [41, 32], [39, 37]] : [[36, 26 + dy], [41, 32 + dy], [37, 40 + dy]];
    arm(g, back, 'S', 'f', 's', true);
    // Broad shoulders narrow into the lifting belt, unlike Biel's square overalls.
    shape(g, [[12, 22 + dy], [34, 21 + dy], [40, 27 + dy], [34, 44 + dy], [18, 44 + dy], [8, 29 + dy]], 'K');
    shape(g, [[13, 23 + dy], [33, 22 + dy], [37, 27 + dy], [32, 42 + dy], [18, 42 + dy], [11, 29 + dy]], 'I');
    shape(g, [[12, 29 + dy], [35, 28 + dy], [33, 42 + dy], [18, 42 + dy]], 'O');
    g.rect(15, 29 + dy, 7, 2, 'F').rect(31, 31 + dy, 3, 10, 'o');
    g.rect(19, 24 + dy, 10, 3, 'S').rect(20, 25 + dy, 8, 2, 's');
    ellipse(g, 22, 31 + dy, 9, 10, 'I');
    shape(g, [[26, 32 + dy], [29, 37 + dy], [28, 39 + dy], [24, 39 + dy], [23, 37 + dy]], 'V');
    g.rect(25, 36 + dy, 1, 2, 'Q');
    g.rect(16, 42 + dy, 19, 5, 'K').rect(24, 42 + dy, 7, 5, 'y').rect(25, 43 + dy, 5, 3, 'Y').rect(26, 44 + dy, 3, 1, 'I');
    face(g, 18, 5 + dy, false, pose);
    shape(g, [[17, 11 + dy], [16, 5 + dy], [20, 1 + dy], [31, 2 + dy], [34, 5 + dy], [38, 6 + dy], [37, 13 + dy], [33, 10 + dy], [29, 6 + dy], [22, 7 + dy]], 'h');
    g.line(20, 4 + dy, 29, 3 + dy, 'a').rect(19, 5 + dy, 3, 2, 'a');
    if (cold) {
        g.rect(17, 24 + dy, 17, 4, 'Z').rect(18, 25 + dy, 14, 1, 'W').rect(31, 27 + dy, 5, 10, 'E').rect(32, 28 + dy, 2, 7, 'Z');
    }
    const front = pose === 'windup' ? [[12, 27], [7, 19 - f], [8, 10 - f * 2]] : pose === 'shoot' ? [[13, 27], [7, 26 + f], [3 + f * 2, 24 + f * 2]] : pose === 'recover' ? [[12, 29 + dy], [9, 37], [17, 44]] : pose === 'hurt' ? [[12, 26], [6, 22], [3, 17]] : [[12, 26 + dy], [7, 32 + dy], [9, 39 + dy]];
    arm(g, front, 'S', 'f', 's', true);
    if (pose === 'windup')
        g.stamp(barrel(0, cold), 0, Math.max(0, 4 - f * 2));
    if (pose === 'recover')
        g.rect(40, 14 + f, 2, 3, 'Z').dot(41, 13 + f, 'W');
    return g.finish();
}
function biel(pose: BossPose, f = 0): PixelFrame {
    const g = new PixelGrid(48, 56), dy = pose === 'recover' ? 2 : pose === 'idle' ? f % 2 : 0;
    boots(g, pose, f, 'N', 'E');
    arm(g, [[38, 27 + dy], [43, 32 + dy], [40, 39 + dy]], 'N', 'E', 'n', true);
    shape(g, [[10, 23 + dy], [37, 23 + dy], [41, 30 + dy], [39, 47], [10, 47], [7, 31 + dy]], 'K');
    g.rect(10, 25 + dy, 28, 19 - dy, 'N').rect(11, 26 + dy, 10, 4, 'E').rect(34, 27 + dy, 4, 17 - dy, 'n');
    g.rect(14, 24 + dy, 4, 18 - dy, 'Y').rect(30, 24 + dy, 4, 18 - dy, 'Y').rect(11, 38, 26, 4, 'Y').rect(12, 38, 24, 1, 'B').rect(23, 38, 5, 5, 'K').rect(24, 39, 3, 2, 'I');
    g.rect(20, 29 + dy, 8, 6, 'n').rect(20, 29 + dy, 8, 1, 'D').dot(24, 32 + dy, 'I');
    face(g, 14, 5 + dy, false, pose, true);
    ellipse(g, 11, 1 + dy, 28, 11, 'K');
    ellipse(g, 13, 2 + dy, 24, 9, 'Y');
    g.rect(17, 2 + dy, 14, 2, 'B').rect(23, 1 + dy, 4, 9, 'y').rect(24, 2 + dy, 2, 7, 'I').rect(9, 10 + dy, 30, 3, 'K').rect(10, 10 + dy, 28, 2, 'Y').rect(11, 10 + dy, 25, 1, 'B');
    const a = pose === 'windup' ? [[11, 28], [5, 23], [6, 15 - f * 2]] : pose === 'shoot' ? [[11, 28], [5, 32], [3 + f * 2, 29 + f]] : pose === 'recover' ? [[12, 29], [10, 37], [16, 42]] : [[11, 28 + dy], [6, 34 + dy], [8, 41 + dy]];
    arm(g, a, 'N', 'E', 'n');
    // One-handed industrial remote: distinct from Calabrezzo's overhand throw.
    if (pose === 'windup' || pose === 'shoot') {
        const yy = pose === 'windup' ? 9 - f * 2 : 25 + f;
        g.rect(1, yy, 10, 10, 'K').rect(2, yy + 1, 8, 7, 'i').rect(3, yy + 2, 3, 2, 'Y').rect(7, yy + 2, 2, 3, 'R').rect(4, yy - 6, 2, 6, 'K').dot(4, yy - 6, 'E');
    }
    if (pose === 'recover')
        g.rect(37, 17 + f, 2, 3, 'Z');
    return g.finish();
}
function joao(pose: BossPose, f = 0): PixelFrame {
    const g = new PixelGrid(48, 56), dy = pose === 'windup' ? -2 : pose === 'smash' ? 4 : pose === 'recover' ? 2 : pose === 'idle' ? f % 2 : 0;
    boots(g, pose, f, 'p', 'P');
    arm(g, pose === 'windup' ? [[38, 26], [43, 17], [39, 9]] : [[38, 27 + dy], [43, 33 + dy], [40, 40 + dy]], 'G', 'l', 'g');
    ellipse(g, 8, 20 + dy, 33, 29, 'K');
    ellipse(g, 10, 22 + dy, 29, 24, 'P');
    ellipse(g, 12, 23 + dy, 17, 8, 'H');
    g.rect(35, 30 + dy, 3, 12, 'p');
    g.line(15, 41 + dy, 30, 43 + dy, 'p');
    g.rect(13, 43 + dy, 24, 4, 'p').rect(23, 42 + dy, 7, 5, 'K').rect(24, 43 + dy, 5, 3, 'Y').rect(25, 44 + dy, 2, 1, 'B');
    face(g, 14, 5 + dy, true, pose);
    shape(g, [[13, 12 + dy], [12, 5 + dy], [17, 1 + dy], [24, 1 + dy], [26, 3 + dy], [33, 2 + dy], [37, 7 + dy], [35, 13 + dy], [31, 8 + dy], [24, 8 + dy], [20, 6 + dy], [16, 8 + dy]], 'h');
    g.rect(17, 3 + dy, 6, 2, 'a').rect(27, 5 + dy, 5, 1, 'a');
    const hand = pose === 'windup' ? [[12, 26], [7, 18], [9, 7 - f]] : pose === 'smash' ? [[12, 28 + dy], [6, 38 + dy], [5 + f, 45 + Math.min(f, 1)]] : pose === 'shoot' ? [[12, 26], [6, 24], [3, 24]] : pose === 'recover' ? [[12, 29 + dy], [9, 37], [18, 43]] : [[12, 26 + dy], [6, 33 + dy], [9, 40 + dy]];
    arm(g, hand, 'G', 'l', 'g');
    if (pose === 'recover')
        g.rect(39, 16 + f, 2, 3, 'Z');
    return g.finish();
}
const poses: BossPose[] = ['idle', 'walk', 'windup', 'smash', 'shoot', 'recover', 'hurt', 'dead'];
const frames = (make: (p: BossPose, f?: number) => PixelFrame) => Object.fromEntries(poses.map(p => [p, make(p)])) as Record<BossPose, PixelFrame>;
export const CALABREZZO = frames(calabrezzo), BIEL = frames(biel), JOAO = frames(joao);
export const BOSS_WALKS = { joao: [joao('walk', 0), joao('walk', 1)], biel: [biel('walk', 0), biel('walk', 1)], calabrezzo: [calabrezzo('walk', 0), calabrezzo('walk', 1)] };
const loops = (make: (p: BossPose, f?: number) => PixelFrame) => Object.fromEntries(poses.map(p => [p, [0, 1, 2].map(f => make(p, f))])) as Record<BossPose, PixelFrame[]>;
export const BOSS_LOOPS = { joao: loops(joao), biel: loops(biel), calabrezzo: loops(calabrezzo), calabrezzoCold: loops((p, f) => calabrezzo(p, f, true)) };
export function bossFrame(who: string, pose: BossPose): PixelFrame { return (who === 'biel' ? BIEL : who === 'calabrezzo' ? CALABREZZO : JOAO)[pose]; }
function barrel(frame: number, pressure = false) {
    const g = new PixelGrid(20, 20);
    ellipse(g, 2, 2, 16, 17, 'K');
    ellipse(g, 3, 3, 14, 15, 'v');
    g.rect(4, 6, 12, 9, 'V').rect(4, 7, 2, 6, 'Q').rect(14, 6, 2, 9, 'v');
    ellipse(g, 4, 2, 12, 6, 'K');
    ellipse(g, 5, 3, 10, 4, 'N');
    g.rect(7, 3, 6, 1, 'D');
    for (const yy of [5, 14])
        g.rect(2, yy, 16, 3, 'K').rect(3, yy, 14, 2, 'i').rect(4, yy, 10, 1, 'I').dot(5, yy + 1, 'N').dot(14, yy + 1, 'N');
    g.rect(7, 9, 5, 3, 'I').dot(9, 8, 'I').dot(9, 10, 'v');
    if (pressure)
        g.rect(8, 0, 4, 3, 'K').rect(9, 0, 2, 2, 'Y').line(4, 7, 13, 12, 'Y').line(5, 7, 14, 12, 'Y').dot(11, 4, 'W');
    const base = g.finish();
    if (!frame) return base;
    // Eight baked raster orientations: metal hoops rotate with the keg.
    const rotated = new PixelGrid(20, 20), angle = frame * Math.PI / 4;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        const sx = Math.round(9.5 + (x - 9.5) * Math.cos(angle) + (y - 9.5) * Math.sin(angle));
        const sy = Math.round(9.5 - (x - 9.5) * Math.sin(angle) + (y - 9.5) * Math.cos(angle));
        rotated.dot(x, y, base[sy]?.[sx] ?? '_');
    }
    return rotated.finish();
}
export const BARRELS = Array.from({ length: 8 }, (_, i) => barrel(i));
export const PRESSURE_BARRELS = Array.from({ length: 8 }, (_, i) => barrel(i, true));
export const SEALS = [0, 1, 2, 3].map(i => { const g = new PixelGrid(16, 18); g.rect(4, 0, 3, 5, 'R').rect(9, 0, 3, 5, 'r').rect(3, 5, 10, 10, 'y').rect(1, 7, 14, 6, 'y').rect(3, 6, 10, 8, 'Y').rect(4, 6, 8, 1, 'B').rect(6, 8, 4, 5, 'I').rect(5, 9, 6, 2, 'I').dot(4 + i * 2, 6, 'W'); return g.finish(); });
type EnemyLook = 'helmet' | 'loader' | 'charger' | 'rail' | 'agitator';
type EnemyPose = 'walk' | 'warning' | 'attack' | 'rest' | 'stunned' | 'bare';
const enemyPoses: EnemyPose[] = ['walk', 'warning', 'attack', 'rest', 'stunned', 'bare'];
function enemy(kind: EnemyLook, pose: EnemyPose, f: number): PixelFrame {
    const g = new PixelGrid(kind === 'agitator' ? 40 : 36, 36), warning = pose === 'warning', attack = pose === 'attack', rest = pose === 'rest' || pose === 'stunned';
    const step = pose === 'walk' || kind === 'charger' && attack ? (f - 1) * 2 : 0;
    if (kind === 'helmet') {
        const dy = pose === 'stunned' ? 2 : pose === 'walk' ? f % 2 : 0;
        g.rect(12 - step, 27, 5, 7, 'K').rect(21 + step, 27, 5, 7, 'K').rect(10 - step, 32, 8, 3, 'K').rect(21 + step, 32, 8, 3, 'K').rect(11 - step, 32, 6, 1, 'i').rect(22 + step, 32, 5, 1, 'I');
        ellipse(g, 10, 16 + dy, 18, 16, 'K');
        ellipse(g, 12, 17 + dy, 14, 13, 'N');
        g.rect(13, 19 + dy, 3, 9, 'Y').rect(22, 19 + dy, 2, 9, 'Y').rect(13, 26 + dy, 11, 2, 'I').rect(17, 22 + dy, 4, 3, 'n');
        ellipse(g, 8, 21 + dy, 5, 8, 'K');
        ellipse(g, 9, 22 + dy, 3, 5, 'S');
        ellipse(g, 25, 20 + dy, 5, 8, 'K');
        ellipse(g, 26, 21 + dy, 3, 5, 's');
        g.rect(8, 27 + dy, 5, 3, 'i').rect(26, 26 + dy, 4, 3, 'I');
        ellipse(g, 11, 8 + dy, 16, 13, 'K');
        ellipse(g, 12, 9 + dy, 14, 11, 'S');
        g.rect(13, 10 + dy, 6, 3, 'f').rect(13, 13 + dy, 11, 4, 'n').rect(14, 14 + dy, 3, 1, 'Z').rect(20, 14 + dy, 2, 1, 'Z').rect(15, 19 + dy, 6, 1, 's');
        if (pose !== 'bare' && pose !== 'stunned') {
            ellipse(g, 10, 1 + dy, 18, 12, 'K');
            ellipse(g, 11, 2 + dy, 16, 10, 'Y');
            g.rect(14, 2 + dy, 9, 3, 'B').rect(18, 1 + dy, 3, 10, 'y').rect(18, 2 + dy, 1, 8, 'I').rect(7, 11 + dy, 22, 3, 'K').rect(8, 11 + dy, 20, 2, 'Y').rect(9, 11 + dy, 18, 1, 'B');
        }
        else {
            g.rect(12, 9 + dy, 14, 3, 'h').rect(14, 8 + dy, 9, 2, 'a');
            if (pose === 'stunned')
                g.rect(14, 14 + dy, 3, 2, 'K').rect(20, 14 + dy, 2, 2, 'K');
        }
    }
    else if (kind === 'charger') {
        const lean = attack ? -5 : warning ? 3 : 0, dy = rest ? 3 : attack ? 2 : 0;
        g.rect(8 - step, 27, 7, 7, 'K').rect(23 + step, 27, 7, 7, 'K').rect(5 - step, 32, 11, 3, 'K').rect(22 + step, 32, 11, 3, 'K').rect(7 - step, 32, 7, 1, 'E').rect(23 + step, 32, 7, 1, 'E');
        shape(g, [[8 + lean, 13 + dy], [24 + lean, 11 + dy], [31, 20 + dy], [28, 30], [9, 30], [4, 22 + dy]], 'K');
        ellipse(g, 6 + lean, 14 + dy, 23, 15, 'R');
        g.rect(10 + lean, 14 + dy, 10, 3, 'L').rect(24 + lean, 19 + dy, 4, 8, 'r').rect(8, 28, 20, 3, 'n').rect(17, 28, 6, 3, 'Y');
        ellipse(g, 10 + lean, 2 + dy, 18, 15, 'K');
        ellipse(g, 11 + lean, 4 + dy, 16, 12, 'S');
        g.rect(12 + lean, 5 + dy, 9, 3, 'f').rect(10 + lean, 2 + dy, 17, 4, 'h').rect(12 + lean, 1 + dy, 9, 2, 'a');
        g.rect(11 + lean, 8 + dy, 6, 3, 'W').rect(20 + lean, 8 + dy, 5, 3, 'W').dot(11 + lean, 9 + dy, 'K').dot(20 + lean, 9 + dy, 'K').line(10 + lean, 6 + dy, 17 + lean, 8 + dy, 'h').line(20 + lean, 8 + dy, 26 + lean, 6 + dy, 'h').rect(13 + lean, 13 + dy, 8, 2, rest ? 'K' : 's');
        ellipse(g, attack ? 0 : 3, attack ? 18 : 20 + dy, 10, 10, 'K');
        ellipse(g, attack ? 1 : 4, attack ? 19 : 21 + dy, 8, 7, 'S');
        g.rect(attack ? 2 : 5, attack ? 19 : 21 + dy, 4, 2, 'f');
        ellipse(g, 27, 19 + dy, 8, 10, 'K');
        ellipse(g, 28, 20 + dy, 6, 7, 's');
        if (rest)
            g.rect(29, 10 + f, 2, 3, 'Z');
    }
    else if (kind === 'loader') {
        const bob = rest ? f % 2 : 0, lift = warning ? f * 2 : 0;
        g.rect(13, 27, 6, 7, 'K').rect(25, 27, 6, 7, 'K').rect(10, 32, 10, 3, 'K').rect(24, 32, 10, 3, 'K').rect(12, 32, 6, 1, 'E').rect(25, 32, 6, 1, 'E');
        ellipse(g, 12, 17 + bob, 20, 15, 'K');
        ellipse(g, 14, 18 + bob, 16, 12, 'u');
        g.rect(15, 20 + bob, 3, 8, 'U').rect(22, 23 + bob, 6, 6, 'I').rect(23, 24 + bob, 4, 2, 'i').dot(26, 27 + bob, 'V');
        ellipse(g, 17, 7 + bob, 16, 14, 'K');
        ellipse(g, 18, 8 + bob, 14, 12, 'S');
        g.rect(18, 10 + bob, 5, 3, 'f').rect(18, 12 + bob, 12, 4, 'K').rect(18, 12 + bob, 5, 3, 'Y').rect(25, 12 + bob, 4, 3, 'Y').dot(19, 12 + bob, 'I').dot(26, 12 + bob, 'I').rect(19, 18 + bob, 6, 1, 's');
        ellipse(g, 17, 3 + bob, 17, 9, 'n');
        g.rect(20, 4 + bob, 10, 3, 'U').rect(15, 9 + bob, 19, 3, 'K').rect(16, 9 + bob, 17, 1, 'E');
        if (!attack && pose !== 'stunned') {
            g.stamp(BARRELS[0], 1, 7 - lift);
            ellipse(g, 3, 23 - lift, 10, 6, 'K');
            ellipse(g, 4, 23 - lift, 8, 4, 'S');
            ellipse(g, 18, 22 - lift, 9, 6, 'K');
            ellipse(g, 19, 23 - lift, 7, 3, 'S');
        }
        else {
            g.rect(1 + f, 19 + f, 17, 7, 'K').rect(2 + f, 20 + f, 15, 5, 'S').rect(3 + f, 20 + f, 7, 1, 'f');
            ellipse(g, 26, 23, 8, 6, 'K');
            ellipse(g, 27, 24, 6, 4, 's');
        }
    }
    else if (kind === 'rail') {
        g.rect(9, 3, 18, 3, 'K').rect(16, 4, 4, 10, 'K').rect(17, 5, 2, 8, 'E');
        for (const xx of [8, 24]) {
            ellipse(g, xx, 0, 6, 7, 'K');
            ellipse(g, xx + 1, 1, 4, 5, 'E');
            g.dot(xx + 2 + f % 2, 3, 'I');
        }
        shape(g, [[8, 11], [27, 11], [31, 16], [29, 29], [7, 29], [4, 16]], 'K');
        g.rect(8, 13, 19, 14, 'N').rect(9, 13, 17, 3, 'E').rect(6, 17, 23, 7, 'n');
        g.rect(10, 18, 5, 4, warning ? 'Y' : 'Z').rect(21, 18, 5, 4, warning ? 'Y' : 'Z').rect(10, 18, 2, 4, 'K').rect(21, 18, 2, 4, 'K').dot(11, 18, 'I');
        g.rect(13, 25, 11, 3, 'E').rect(15, 26, 7, 1, 'n');
        const brake = warning ? 2 : 0;
        g.rect(4, 24, 4, 8, 'Y').rect(27, 24, 4, 8, 'Y').rect(3 - brake, 30, 7, 4, 'K').rect(26 + brake, 30, 7, 4, 'K').rect(4 - brake, 30, 5, 1, 'i').rect(27 + brake, 30, 5, 1, 'i');
    }
    else {
        const dy = warning ? f % 2 : 0;
        ellipse(g, 10, 26, 21, 9, 'K');
        g.rect(12, 27, 17, 6, 'N').rect(13, 28, 3, 3, 'E').rect(25, 28, 3, 3, 'E');
        ellipse(g, 11, 15 + dy, 18, 15, 'K');
        ellipse(g, 13, 16 + dy, 14, 12, 'V');
        g.rect(14, 17 + dy, 3, 8, 'Q').rect(24, 18 + dy, 3, 7, 'v');
        ellipse(g, 13, 8 + dy, 14, 13, 'K');
        ellipse(g, 14, 9 + dy, 12, 10, 'i');
        ellipse(g, 16, 10 + dy, 8, 7, 'I');
        g.line(20, 15 + dy, warning ? 22 : 17, warning ? 11 + dy : 14 + dy, 'K');
        g.rect(15, 7 + dy, 10, 3, 'N').rect(16, 7 + dy, 8, 1, 'D');
        g.rect(16, 19 + dy, 8, 4, 'n').rect(17, 20 + dy, 2, 1, warning ? 'Y' : 'Z').rect(22, 20 + dy, 1, 1, 'Z');
        if (attack) {
            g.rect(0, 22 + f % 2, 40, 5, 'K').rect(1, 23 + f % 2, 38, 3, 'I').rect(2, 23 + f % 2, 11, 1, 'Y').rect(26, 24 + f % 2, 12, 1, 'i');
            ellipse(g, 16, 21, 8, 8, 'N');
            g.rect(19, 22, 2, 5, 'E');
        }
        else {
            g.rect(10, 24, 20, 4, 'K').rect(11, 24, 18, 2, 'i').rect(12, 24, 7, 1, 'I');
            ellipse(g, 17, 23, 6, 6, 'N');
        }
    }
    return g.finish();
}
export const FOE_FRAMES = Object.fromEntries((['helmet', 'loader', 'charger', 'rail', 'agitator'] as EnemyLook[]).map(kind => [kind, enemyPoses.flatMap(p => [0, 1, 2].map(f => enemy(kind, p, f)))])) as Record<EnemyLook, PixelFrame[]>;
export function foeFrame(kind: EnemyLook, phase: string, time: number, armor = true): PixelFrame {
    const pose: EnemyPose = phase === 'stunned' ? 'stunned' : kind === 'helmet' && !armor ? 'bare' : enemyPoses.includes(phase as EnemyPose) ? phase as EnemyPose : phase === 'recoil' ? 'attack' : 'walk';
    return FOE_FRAMES[kind][enemyPoses.indexOf(pose) * 3 + (phase === 'warning' ? Math.min(2, Math.floor(time / 260)) : Math.floor(time / (phase === 'attack' ? 75 : 190)) % 3)];
}
