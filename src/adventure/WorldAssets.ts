import { PixelGrid, type PixelFrame } from '../graphics/pixels';
import { BOSS_FRAMES, SPRITE_PALETTE } from '../graphics/sprites';
export const WORLD_PALETTE = { ...SPRITE_PALETTE, N: '#365d70', n: '#22384f', E: '#6e9ca6', D: '#b6d6cb', I: '#f5e7b7', i: '#c9ac73', V: '#a65ad9', v: '#683b93', Q: '#e0b4f1', U: '#3e73bb', u: '#253c73', Z: '#a8e6ef' };
export type BossPose = 'idle' | 'walk' | 'windup' | 'smash' | 'shoot' | 'hurt' | 'dead';
function calabrezzo(pose: BossPose, frame = 0): PixelFrame {
    const g = new PixelGrid(48, 56), dy = (pose === 'smash' ? 3 : pose === 'windup' ? -2 : 0) + (pose === 'idle' ? frame % 2 : 0);
    const step = pose === 'walk' ? (frame % 2 ? 2 : -2) : 0;
    // Boots, compact legs and a broad lifting belt anchor the silhouette.
    g.rect(11 - step, 45, 11, 10, 'K').rect(29 + step, 45, 9, 10, 'K').rect(13 - step, 45, 7, 6, 'n').rect(30 + step, 45, 6, 6, 'N').rect(9 - step, 52, 14, 3, 'K').rect(28 + step, 52, 13, 3, 'K').rect(11 - step, 52, 8, 1, 'E').rect(30 + step, 52, 8, 1, 'E');
    g.rect(9, 21 + dy, 30, 26, 'K').rect(10, 22 + dy, 28, 21, 'I').rect(12, 22 + dy, 10, 4, 'W').rect(33, 25 + dy, 5, 19, 'i');
    g.rect(12, 29 + dy, 24, 13, 'O').rect(14, 30 + dy, 8, 2, 'F').rect(31, 31 + dy, 5, 10, 'o');
    g.rect(12, 42 + dy, 25, 4, 'K').rect(23, 42 + dy, 7, 4, 'y').rect(24, 43 + dy, 5, 2, 'Y');
    // Product emblem: a violet drop framed in cream.
    g.rect(22, 30 + dy, 9, 9, 'I').rect(25, 31 + dy, 3, 2, 'V').rect(24, 33 + dy, 5, 4, 'V').rect(25, 34 + dy, 2, 2, 'Q');
    const ay = pose === 'windup' ? 7 - frame % 2 * 2 : pose === 'shoot' ? 14 + frame * 2 : 25 + dy;
    for (const [x, light] of [[2, 'f'], [37, 'S']] as const) {
        g.rect(x, ay, 9, 19, 'K').rect(x + 1, ay + 1, 7, 16, 'S').rect(x + 1, ay + 1, 3, 8, light).rect(x + 5, ay + 5, 2, 11, 's').rect(x - 1, ay + 13, 11, 9, 'K').rect(x, ay + 14, 9, 6, 'n').rect(x + 1, ay + 14, 5, 2, 'E');
    }
    const hy = 6 + dy;
    g.rect(14, hy, 22, 19, 'K').rect(15, hy + 2, 20, 15, 'S').rect(16, hy + 3, 11, 5, 'f').rect(31, hy + 6, 4, 10, 's');
    g.rect(13, hy - 2, 24, 5, 'h').rect(15, hy - 4, 19, 4, 'h').rect(16, hy - 3, 11, 2, 'a');
    g.rect(17, hy + 7, 6, 3, 'W').rect(27, hy + 7, 6, 3, 'W').rect(20, hy + 7, 2, 3, 'K').rect(30, hy + 7, 2, 3, 'K');
    g.line(16, hy + 5, 23, hy + 6, 'h').line(27, hy + 6, 34, hy + 4, 'h');
    g.rect(21, hy + 12, 10, 4, 'K').rect(22, hy + 12, 8, 2, 'W').rect(22, hy + 17, 11, 2, 's');
    if (pose === 'hurt' || pose === 'dead') {
        g.line(17, hy + 7, 22, hy + 10, 'K').line(22, hy + 7, 17, hy + 10, 'K').line(28, hy + 7, 32, hy + 10, 'K').line(32, hy + 7, 28, hy + 10, 'K');
        g.rect(23, hy + 12, 5, 4, 'K');
    }
    return g.finish();
}
function biel(pose: BossPose, frame = 0): PixelFrame {
    const g = new PixelGrid(48, 56), dy = (pose === 'smash' ? 3 : pose === 'windup' ? -2 : 0) + (pose === 'idle' ? frame % 2 : 0), step = pose === 'walk' ? (frame % 2 ? 2 : -2) : 0;
    g.rect(9 - step, 42, 12, 12, 'K').rect(27 + step, 42, 12, 12, 'K').rect(11 - step, 44, 8, 8, 'N').rect(29 + step, 44, 8, 8, 'N').rect(8 - step, 51, 14, 4, 'K').rect(27 + step, 51, 14, 4, 'K').rect(10 - step, 51, 9, 1, 'E').rect(29 + step, 51, 9, 1, 'E');
    g.rect(6, 22 + dy, 35, 24, 'K').rect(8, 23 + dy, 31, 20, 'N').rect(10, 24 + dy, 9, 4, 'E').rect(34, 26 + dy, 5, 17, 'n');
    g.rect(11, 23 + dy, 5, 18, 'Y').rect(30, 23 + dy, 5, 18, 'Y').rect(10, 36 + dy, 27, 4, 'Y').rect(12, 37 + dy, 24, 1, 'B').rect(21, 27 + dy, 6, 5, 'n');
    const ay = pose === 'windup' ? 5 - frame % 2 * 2 : pose === 'shoot' ? 12 + frame * 2 : 27 + dy;
    for (const x of [0, 38]) {
        g.rect(x, ay, 10, 19, 'K').rect(x + 1, ay + 1, 8, 12, 'N').rect(x + 1, ay + 1, 3, 7, 'E').rect(x, ay + 12, 11, 9, 'K').rect(x + 1, ay + 13, 9, 6, 'i').rect(x + 2, ay + 13, 6, 2, 'I');
    }
    const hy = 5 + dy;
    g.rect(12, hy + 1, 24, 21, 'K').rect(13, hy + 3, 22, 16, 'S').rect(14, hy + 4, 12, 5, 'f').rect(31, hy + 7, 4, 11, 's');
    g.rect(11, hy, 27, 5, 'Y').rect(14, hy - 3, 21, 4, 'Y').rect(16, hy - 4, 17, 2, 'B').rect(22, hy - 3, 5, 6, 'y').rect(11, hy + 3, 28, 2, 'K');
    g.rect(15, hy + 8, 7, 3, 'W').rect(26, hy + 8, 7, 3, 'W').rect(18, hy + 8, 3, 3, 'K').rect(28, hy + 8, 3, 3, 'K');
    g.rect(16, hy + 6, 7, 2, 'h').rect(26, hy + 6, 7, 2, 'h');
    g.rect(15, hy + 14, 19, 5, 'h').rect(20, hy + 14, 10, 2, 'K').rect(21, hy + 14, 8, 1, 'W').rect(18, hy + 19, 13, 2, 'h');
    if (pose === 'hurt' || pose === 'dead') {
        g.line(16, hy + 8, 21, hy + 11, 'K').line(21, hy + 8, 16, hy + 11, 'K').line(27, hy + 8, 32, hy + 11, 'K').line(32, hy + 8, 27, hy + 11, 'K');
    }
    return g.finish();
}
const poses: BossPose[] = ['idle', 'walk', 'windup', 'smash', 'shoot', 'hurt', 'dead'];
export const CALABREZZO = Object.fromEntries(poses.map(p => [p, calabrezzo(p)])) as Record<BossPose, PixelFrame>;
export const BIEL = Object.fromEntries(poses.map(p => [p, biel(p)])) as Record<BossPose, PixelFrame>;
export const BOSS_WALKS = { biel: [biel('walk', 0), biel('walk', 1)], calabrezzo: [calabrezzo('walk', 0), calabrezzo('walk', 1)] };
export function bossFrame(who: string, pose: BossPose): PixelFrame { return who === 'biel' ? BIEL[pose] : who === 'calabrezzo' ? CALABREZZO[pose] : pose === 'walk' ? BOSS_FRAMES.walk[0] : BOSS_FRAMES[pose]; }
function barrel(frame: number, pressure = false) {
    const g = new PixelGrid(18, 20);
    g.rect(3, 1, 12, 18, 'K').rect(1, 4, 16, 12, 'K').rect(3, 2, 12, 16, 'N').rect(2, 5, 14, 10, 'N').rect(4, 3, 3, 13, 'E').rect(12, 4, 3, 12, 'n');
    g.rect(2, 4, 14, 2, 'i').rect(2, 14, 14, 2, 'i').rect(3, 4, 12, 1, 'I').rect(3, 14, 12, 1, 'I');
    g.rect(6, 7, 7, 6, 'V').rect(7 + frame % 2, 8, 2, 3, 'Q');
    if (pressure)
        g.rect(7, 0, 4, 3, 'Y').rect(8, 0, 2, 1, 'W').line(2, 6, 14, 13, 'Y');
    return g.finish();
}
export const BARRELS = [0, 1, 2, 3].map(i => barrel(i));
export const PRESSURE_BARRELS = [0, 1, 2, 3].map(i => barrel(i, true));
export const SEALS = [0, 1, 2, 3].map(i => { const g = new PixelGrid(16, 18); g.rect(4, 0, 3, 5, 'R').rect(9, 0, 3, 5, 'r').rect(3, 5, 10, 10, 'y').rect(1, 7, 14, 6, 'y').rect(3, 6, 10, 8, 'Y').rect(4, 6, 8, 1, 'B').rect(6, 8, 4, 5, 'I').rect(5, 9, 6, 2, 'I').dot(4 + i * 2, 6, 'W'); return g.finish(); });
type EnemyLook = 'helmet' | 'loader' | 'charger' | 'rail' | 'agitator';
type EnemyPose = 'walk' | 'warning' | 'attack' | 'rest' | 'stunned' | 'bare';
const enemyPoses: EnemyPose[] = ['walk', 'warning', 'attack', 'rest', 'stunned', 'bare'];
function enemy(kind: EnemyLook, pose: EnemyPose, f: number): PixelFrame {
    const g = new PixelGrid(36, 36), warning = pose === 'warning', attack = pose === 'attack', rest = pose === 'rest' || pose === 'stunned', step = pose === 'walk' ? (f - 1) * 2 : 0;
    if (kind === 'helmet') {
        const dy = rest ? 2 : f % 2;
        g.rect(8 - step, 28, 8, 7, 'K').rect(22 + step, 28, 8, 7, 'K').rect(9 - step, 29, 6, 3, 'i').rect(23 + step, 29, 5, 3, 'i');
        g.rect(7, 14 + dy, 23, 15, 'K').rect(9, 15 + dy, 19, 12, 'N').rect(10, 15 + dy, 4, 12, 'Y').rect(23, 15 + dy, 3, 12, 'Y').rect(10, 24 + dy, 16, 2, 'I');
        g.rect(4, 18 + dy, 5, 11, 'S').rect(28, 18 + dy, 5, 11, 's').rect(3, 26 + dy, 7, 4, 'i').rect(27, 26 + dy, 7, 4, 'i');
        g.rect(10, 4 + dy, 17, 13, 'K').rect(12, 6 + dy, 13, 10, 'S').rect(12, 6 + dy, 5, 4, 'f').rect(13, 9 + dy, 10, 4, 'n').rect(14, 10 + dy, 3, 1, 'Z').rect(20, 10 + dy, 2, 1, 'Z');
        g.rect(17, 15 + dy, 6, 1, 'h');
        if (pose !== 'bare' && pose !== 'stunned')
            g.rect(8, 2 + dy, 22, 7, 'K').rect(9, 2 + dy, 20, 5, 'Y').rect(13, 0 + dy, 12, 4, 'B').rect(17, 1 + dy, 3, 5, 'y').rect(6, 7 + dy, 26, 3, 'y').rect(8, 7 + dy, 23, 1, 'I');
    }
    else if (kind === 'charger') {
        const lean = attack ? -3 : warning ? 2 : 0, dy = rest ? 3 : 0;
        g.rect(6 - step, 28, 10, 7, 'K').rect(23 + step, 28, 10, 7, 'K').rect(7 - step, 28, 8, 3, 'n').rect(24 + step, 28, 7, 3, 'n');
        g.rect(5 + lean, 12 + dy, 27, 18, 'K').rect(7 + lean, 13 + dy, 23, 14, 'R').rect(9 + lean, 14 + dy, 8, 4, 'L').rect(25 + lean, 15 + dy, 5, 12, 'r').rect(6 + lean, 26 + dy, 25, 4, 'n').rect(17 + lean, 26 + dy, 7, 3, 'Y');
        g.rect(8 + lean, 1 + dy, 20, 14, 'K').rect(10 + lean, 3 + dy, 16, 10, 'S').rect(9 + lean, 0 + dy, 19, 4, 'h').rect(11 + lean, 2 + dy, 8, 2, 'a').rect(11 + lean, 7 + dy, 5, 3, 'W').rect(20 + lean, 7 + dy, 5, 3, 'W').dot(11 + lean, 8 + dy, 'K').dot(20 + lean, 8 + dy, 'K');
        g.line(10 + lean, 5 + dy, 16 + lean, 6 + dy, 'h').line(20 + lean, 6 + dy, 26 + lean, 4 + dy, 'h');
        g.rect(1, attack ? 14 : 18, 8, 11, 'K').rect(2, attack ? 15 : 19, 6, 8, 'S').rect(28, 16 + dy, 7, 11, 'K').rect(29, 17 + dy, 5, 8, 's');
        if (rest)
            g.rect(16, 11 + dy, 6, 3, 'K');
    }
    else if (kind === 'loader') {
        const lift = warning ? f * 2 : 0;
        g.rect(8, 28, 8, 7, 'K').rect(23, 28, 8, 7, 'K').rect(6, 16, 25, 15, 'K').rect(8, 17, 21, 11, 'u').rect(8, 18, 4, 10, 'U').rect(24, 18, 3, 10, 'N').rect(13, 23, 11, 5, 'I').rect(16, 24, 4, 3, 'V');
        g.rect(15, 7, 16, 13, 'K').rect(17, 9, 12, 9, 'S').rect(16, 5, 17, 5, 'U').rect(14, 8, 20, 3, 'n').rect(18, 12, 9, 3, 'K').rect(19, 12, 7, 1, 'Z');
        if (pose !== 'attack' && pose !== 'stunned') {
            g.stamp(BARRELS[f % 4], 2, 4 - lift).rect(2, 19 - lift, 9, 5, 'S').rect(19, 18 - lift, 8, 5, 's');
        }
        else {
            g.rect(0, 16, 14, 6, 'S').rect(23, 18, 10, 6, 's');
        }
    }
    else if (kind === 'rail') {
        g.rect(15, 0, 4, 9, 'K').rect(7, 1, 20, 6, 'K').rect(8, 2, 18, 3, 'E').rect(10 + f % 2, 2, 3, 3, 'n').rect(22 - f % 2, 2, 3, 3, 'n');
        g.rect(4, 9, 28, 21, 'K').rect(6, 11, 24, 16, 'N').rect(7, 11, 22, 3, 'E').rect(7, 17, 22, 8, 'n').rect(10 + (warning ? f : 0), 19, 5, 3, warning ? 'Y' : 'Z').rect(21, 19, 5, 3, 'Z');
        g.rect(3, 26, 8, 5, 'Y').rect(25, 26, 8, 5, 'Y').rect(1, 30, 7, 4, 'K').rect(28, 30, 7, 4, 'K');
        g.rect(15, 27, 7, 3, 'i');
    }
    else {
        const dy = warning ? f % 2 : 0;
        g.rect(7, 26, 22, 8, 'K').rect(9, 27, 18, 5, 'N').rect(11, 29, 3, 2, 'E').rect(23, 29, 3, 2, 'E');
        g.rect(11, 9 + dy, 14, 19, 'K').rect(13, 10 + dy, 10, 16, 'V').rect(14, 11 + dy, 3, 12, 'Q').rect(15, 6 + dy, 6, 4, 'i');
        g.rect(14, 15 + dy, 8, 6, 'n').rect(15, 16 + dy, 2, 2, warning ? 'Y' : 'Z').rect(20, 16 + dy, 2, 2, warning ? 'Y' : 'Z');
        if (attack) {
            g.rect(0, 20 + f % 3, 36, 4, 'I').rect(2, 21 + f % 3, 32, 1, 'Y').rect(14, 9, 6, 24, 'i').rect(16, 10, 2, 21, 'I');
        }
        else {
            g.rect(8, 21, 20, 4, 'i').rect(10, 21, 16, 1, 'I');
        }
    }
    return g.finish();
}
export const FOE_FRAMES = Object.fromEntries((['helmet', 'loader', 'charger', 'rail', 'agitator'] as EnemyLook[]).map(kind => [kind, enemyPoses.flatMap(p => [0, 1, 2].map(f => enemy(kind, p, f)))])) as Record<EnemyLook, PixelFrame[]>;
export function foeFrame(kind: EnemyLook, phase: string, time: number, armor = true): PixelFrame {
    const pose: EnemyPose = kind === 'helmet' && !armor ? 'bare' : enemyPoses.includes(phase as EnemyPose) ? phase as EnemyPose : phase === 'recoil' ? 'attack' : 'walk';
    return FOE_FRAMES[kind][enemyPoses.indexOf(pose) * 3 + Math.floor(time / (phase === 'attack' ? 75 : phase === 'warning' ? 130 : 190)) % 3];
}
export const BOSS_LOOPS = { biel: { idle: [biel('idle', 0), biel('idle', 1)], windup: [biel('windup', 0), biel('windup', 1)], shoot: [biel('shoot', 0), biel('shoot', 1), biel('shoot', 2)], smash: [biel('smash', 0), biel('windup', 1), biel('smash', 2)] }, calabrezzo: { idle: [calabrezzo('idle', 0), calabrezzo('idle', 1)], windup: [calabrezzo('windup', 0), calabrezzo('windup', 1)], shoot: [calabrezzo('shoot', 0), calabrezzo('shoot', 1), calabrezzo('shoot', 2)], smash: [calabrezzo('smash', 0), calabrezzo('windup', 1), calabrezzo('smash', 2)] } };
