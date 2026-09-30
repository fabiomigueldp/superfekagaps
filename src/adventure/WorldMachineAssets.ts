import { PixelGrid, type PixelFrame } from '../graphics/pixels';
import type { CannonPose } from './WorldMachineState';

export type MachineSkin = 'factory' | 'cold' | 'oven';
function ellipse(g: PixelGrid, x: number, y: number, w: number, h: number, color: string) {
    for (let row = 0; row < h; row++) {
        const half = Math.sqrt(Math.max(0, 1 - ((row + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        g.rect(Math.ceil(x + w / 2 - half), y + row, Math.floor(half * 2), 1, color);
    }
}
function bolt(g: PixelGrid, x: number, y: number) { g.rect(x, y, 2, 2, 'K').dot(x, y, 'D'); }
function dial(g: PixelGrid, x: number, y: number, pressure: number) {
    ellipse(g, x, y, 9, 9, 'K');
    ellipse(g, x + 1, y + 1, 7, 7, 'I');
    g.dot(x + 2, y + 2, 'E').dot(x + 6, y + 2, 'O');
    const a = Math.PI * (1.15 + pressure * .7);
    g.line(x + 4, y + 4, x + 4 + Math.cos(a) * 3, y + 4 + Math.sin(a) * 3, 'n');
    g.dot(x + 4, y + 4, 'K');
}
function nozzle(skin: MachineSkin, stage: number): PixelFrame {
    const g = new PixelGrid(36, 28), heat = skin === 'oven', cold = skin === 'cold';
    // The outlet is at (18,12); the machine sits partly inside the floor.
    g.rect(3, 16, 30, 10, 'K').rect(4, 17, 28, 8, heat ? 'o' : 'n');
    g.rect(5, 18, 26, 2, heat ? 'O' : 'N').rect(2, 25, 32, 3, 'K').rect(3, 25, 30, 1, 'E');
    g.rect(7, 11, 4, 10, 'K').rect(8, 12, 2, 8, 'E');
    ellipse(g, 8, 9, 20, 10, 'K');
    ellipse(g, 9, 9, 18, 8, heat ? 'y' : 'N');
    g.rect(10, 14, 16, 5, heat ? 'O' : 'E').rect(11, 15, 14, 1, heat ? 'F' : 'D');
    ellipse(g, 8, 7, 20, 8, 'K');
    ellipse(g, 9, 8, 18, 6, heat ? 'Y' : 'D');
    ellipse(g, 11, 9, 14, 4, 'K');
    g.rect(13, 10, 10, 2, stage > 1 ? (heat ? 'F' : 'V') : 'v');
    if (stage === 1) g.rect(14, 9, 3, 2, heat ? 'O' : 'Q').rect(21, 10, 2, 1, 'Q');
    if (stage === 3) g.rect(12, 11, 4, 1, heat ? 'Y' : 'Q');
    for (const x of [6, 28]) bolt(g, x, 19);
    // A shutoff wheel and a readable pressure dial frame the mouth.
    g.rect(29, 11, 2, 10, 'K');
    ellipse(g, 26, 8, 9, 9, 'K');
    ellipse(g, 27, 9, 7, 7, heat ? 'O' : 'Y');
    ellipse(g, 29, 11, 3, 3, 'n');
    if (stage % 2) g.line(28, 10, 32, 14, 'I').line(32, 10, 28, 14, 'I');
    else g.line(30, 9, 30, 15, 'I').line(27, 12, 33, 12, 'I');
    dial(g, 0, 6, [.08, .65, 1, .25][stage]);
    g.rect(14, 21, 8, 3, 'K').rect(15, 22, stage === 2 ? 6 : stage === 1 ? 4 : 2, 1, stage === 1 ? 'Y' : 'l');
    if (cold) {
        g.rect(9, 7, 7, 1, 'Z').rect(22, 8, 4, 1, 'W');
        g.rect(5, 17, 5, 2, 'Z').rect(6, 19, 2, 3, 'Z').dot(6, 22, 'W');
        g.rect(27, 18, 5, 2, 'W').rect(30, 20, 1, 3, 'Z');
    }
    if (heat) {
        g.rect(11, 20, 2, 4, 'K').rect(23, 20, 2, 4, 'K');
        g.rect(12, 21, 1, 2, stage === 2 ? 'Y' : 'O');
    }
    return g.finish();
}
function cannon(cold: boolean, pose: CannonPose): PixelFrame {
    const g = new PixelGrid(48, 40), charged = pose === 'charge', empty = ['fire', 'recoil', 'reload'].includes(pose);
    const offset = pose === 'recoil' ? 4 : pose === 'fire' ? 2 : pose === 'reload' ? 2 : 0;
    // Left-facing pneumatic barrel launcher. The fixed outlet is (4,20).
    g.rect(9, 27, 31, 10, 'K').rect(10, 28, 29, 7, 'N').rect(10, 28, 29, 2, 'E');
    g.rect(7, 36, 35, 4, 'K').rect(8, 36, 33, 2, 'n').rect(10, 38, 4, 1, 'D').rect(36, 38, 4, 1, 'D');
    for (const x of [12, 33]) {
        ellipse(g, x, 29, 8, 8, 'K'); ellipse(g, x + 1, 30, 6, 6, 'E');
        g.rect(x + 3, 32, 2, 2, 'n');
    }
    // Accumulator and external hose, clearly separate from the firing tube.
    g.rect(35, 8, 10, 22, 'K').rect(36, 10, 8, 17, cold ? 'u' : 'v');
    g.rect(37, 11, 2, 14, cold ? 'Z' : 'Q').rect(36, 9, 8, 2, 'Y').rect(36, 26, 8, 2, 'y');
    g.line(42, 9, 42, 5, 'K').line(30, 5, 42, 5, 'K').rect(30, 5, 2, 8, 'K');
    g.line(31, 6, 41, 6, 'E');
    // Loading chute: an empty dark window during recoil, a fresh keg during seating.
    g.rect(22, 2, 13, 17, 'K').rect(23, 3, 11, 12, 'n').rect(22, 2, 13, 2, 'D');
    if (!empty || pose === 'reload') {
        const yy = pose === 'reload' ? 3 : pose === 'seat' ? 9 : 8;
        ellipse(g, 24, yy, 9, 11, 'v');
        g.rect(24, yy + 2, 9, 2, 'Y').rect(24, yy + 8, 9, 2, 'y').rect(25, yy + 4, 2, 3, 'Q');
    }
    g.rect(22, 4, 2, 12, 'E').rect(33, 4, 2, 12, 'N');
    // Long chamber, top reflection, brass collars and dark recessed muzzle.
    g.rect(5 + offset, 12, 31, 16, 'K').rect(6 + offset, 13, 29 - offset, 14, 'N');
    g.rect(7 + offset, 13, 27 - offset, 3, 'E').rect(8 + offset, 14, 23 - offset, 1, 'D');
    g.rect(8 + offset, 24, 26 - offset, 3, 'n');
    for (const xx of [9 + offset, 29]) {
        g.rect(xx, 12, 3, 16, 'y').rect(xx, 13, 2, 3, 'I').rect(xx, 17, 2, 7, 'Y');
        bolt(g, xx, 24);
    }
    ellipse(g, 1 + offset, 10, 10, 20, 'K');
    ellipse(g, 2 + offset, 11, 8, 18, cold ? 'Z' : 'D');
    ellipse(g, 3 + offset, 13, 6, 14, 'n');
    ellipse(g, 3 + offset, 15, 4, 10, 'K');
    if (charged) g.rect(4, 17, 2, 5, 'V').dot(4, 17, 'Q');
    if (pose === 'fire') g.rect(5 + offset, 17, 2, 5, 'Q');
    g.rect(15 + offset, 18, 10, 6, 'K').rect(16 + offset, 19, 8 - offset, 4, 'v');
    g.rect(17 + offset, 20, 2, 2, 'Q');
    dial(g, 35, 16, charged ? 1 : empty ? .1 : .4);
    g.rect(25, 30, 4, 4, 'K').rect(26, 30, 2, 3, charged ? 'Y' : 'l');
    if (cold) {
        g.rect(13, 11, 6, 2, 'Z').rect(14, 13, 1, 3, 'Z');
        g.rect(24, 1, 10, 1, 'W').rect(36, 8, 7, 2, 'Z');
        g.rect(11, 28, 6, 1, 'W').rect(12, 29, 2, 2, 'Z');
    }
    return g.finish();
}

export const NOZZLES = Object.fromEntries((['factory', 'cold', 'oven'] as const).map(skin => [skin, [0, 1, 2, 3].map(n => nozzle(skin, n))])) as Record<MachineSkin, PixelFrame[]>;
const poses: CannonPose[] = ['idle', 'charge', 'fire', 'recoil', 'reload', 'seat'];
export const CANNONS = Object.fromEntries((['factory', 'cold'] as const).map(skin => [skin, Object.fromEntries(poses.map(p => [p, cannon(skin === 'cold', p)]))])) as Record<'factory' | 'cold', Record<CannonPose, PixelFrame>>;
