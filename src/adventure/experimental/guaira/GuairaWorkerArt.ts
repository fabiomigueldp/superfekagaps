import { ART } from '../../../graphics/palette';
import { PixelGrid, type PixelFrame, type PixelPalette } from '../../../graphics/pixels';

export type GuairaWorkerKind = 'pump' | 'rice' | 'inspector';

/** A read-only projection of the mechanism and the existing simulation clock. */
export interface GuairaWorkerVisualState {
    readonly activeTimeMs: number;
    readonly valveActive: boolean;
    readonly bridgeRise: number;
    readonly reducedMotion: boolean;
}

/** Half-open limits relative to the original feet anchor, including the shadow. */
export const GUAIRA_WORKER_BOUNDS = Object.freeze({ left: -8, top: -29, right: 16, bottom: 0 });

const PALETTE: PixelPalette = Object.freeze({
    _: null, K: '#493c43', S: ART.skin, s: ART.skinDark, L: ART.skinLight,
    H: '#e2c48a', h: '#ab895f', T: '#628d80', t: '#46685f',
    B: '#607b88', b: '#405d6a', W: '#ded2af', Y: '#b89b6f',
});

type Pose = 'rest' | 'prepare' | 'reach' | 'press' | 'work' | 'release' | 'recover' | 'blink' | 'notice' | 'watch' | 'open';

/** Boots and trouser cuffs are identical in every pose: neither person slides. */
function base(rice: boolean, lowered: boolean): PixelGrid {
    const g = new PixelGrid(24, 29), dy = lowered ? 1 : 0;
    g.rect(6, 24, 5, 5, 'K').rect(14, 24, 5, 5, 'K');
    g.rect(7, 22, 4, 5, 'b').rect(14, 22, 4, 5, 'B');
    g.rect(7, 27, 3, 1, 'h').rect(15, 27, 3, 1, 'h');
    g.rect(7, 13 + dy, 11, 10 - dy, 'K').rect(8, 14 + dy, 9, 8 - dy, rice ? 'W' : 'T');
    g.rect(8, 21, 9, 3, 'B').rect(11, 22, 3, 3, 'K');
    g.rect(11, 15 + dy, 2, 6 - dy, rice ? 'Y' : 't').dot(14, 17 + dy, rice ? 'H' : 'W');
    g.rect(9, 14 + dy, 2, 1, 'W').dot(16, 20, rice ? 'Y' : 't');
    g.rect(8, 24, 1, 2, 'B').rect(15, 24, 1, 2, 'b');
    return g;
}

/** Neutral, compact faces share Feka's palette; hat and gaze are redrawn, never rotated. */
function head(g: PixelGrid, dx: number, dy: number, lookLeft: boolean, blink = false): void {
    g.rect(7 + dx, 8 + dy, 10, 7, 'K').rect(8 + dx, 8 + dy, 8, 6, 'S');
    g.rect(8 + dx, 8 + dy, 7, 3, 'L').rect(11 + dx, 13 + dy, 3, 1, 's');
    g.dot((lookLeft ? 9 : 14) + dx, 10 + dy, blink ? 's' : 'K');
    g.dot((lookLeft ? 8 : 15) + dx, 12 + dy, 'L');
    g.rect(6 + dx, 4 + dy, 12, 5, 'h').rect(8 + dx, 2 + dy, 8, 5, 'H');
    g.rect(9 + dx, 2 + dy, 5, 1, 'W');
    g.rect(3 + dx, 7 + dy, 18, 2, 'K').rect(4 + dx, 6 + dy, 17, 2, 'H');
    g.rect(9 + dx, 5 + dy, 7, 1, 'h').dot(6 + dx, 7 + dy, 'W');
}

function restingArm(g: PixelGrid, rice: boolean): void {
    g.rect(5, 15, 4, 7, 'K').rect(6, 15, 3, 5, rice ? 'W' : 'T');
    g.rect(6, 20, 3, 3, 'S').dot(6, 20, 'L');
}

/** The pump keeper inspects and works the existing small spanner. */
function pumpPose(pose: Pose): PixelFrame {
    const work = pose === 'work', reach = pose === 'reach', press = pose === 'press';
    const prepare = pose === 'prepare', release = pose === 'release';
    const notice = pose === 'notice', watch = pose === 'watch', open = pose === 'open';
    const g = base(false, work);
    head(g, work ? 1 : 0, work ? 1 : 0, false, pose === 'blink');

    // Tool movement is only a few pixels; it never resembles an attack or a prompt.
    const tx = reach || press || work || release ? 20 : 21;
    const ty = reach ? 11 : prepare ? 12 : work || release ? 14 : 13;
    g.rect(tx, ty, 2, 11, 'b').rect(tx - 2, ty - 2, 5, 3, 'B');
    g.dot(tx, ty - 1, '_').dot(tx + 1, ty + 1, 'W');
    if (work || press || release) {
        const armY = work ? 16 : 15;
        g.rect(17, armY, 5, 4, 'K').rect(17, armY, 3, 2, 'T').rect(20, armY + 1, 3, 2, 'L');
        g.rect(5, 16, 4, 5, 'K').rect(6, 16, 3, 3, 'T');
        g.rect(8, work ? 18 : 19, 6, 3, 'K').rect(9, work ? 18 : 19, 5, 2, 'S').dot(13, work ? 18 : 19, 'L');
    } else if (reach || prepare) {
        restingArm(g, false);
        const armY = prepare ? 14 : 13;
        g.rect(17, armY, 5, 5, 'K').rect(17, armY + 1, 3, 3, 'T').rect(20, armY, 3, 2, 'L');
    } else {
        g.rect(17, 15, 5, 4, 'K').rect(17, 15, 4, 2, 'T').rect(20, 16, 3, 2, 'L');
        if (notice || watch) {
            // A hand at the hat brim reads as watching the sluice, not directing Feka.
            g.rect(4, 11, 4, 8, 'K').rect(5, 12, 3, 6, 'T');
            g.rect(5, 9, 3, 4, 'S').rect(6, 8, 4, 2, 'L');
            if (watch) g.dot(9, 9, 'S');
        } else if (open) {
            // Relaxed elbow and palm resting on the belt after water is released.
            g.rect(4, 15, 4, 5, 'K').rect(5, 15, 3, 3, 'T');
            g.rect(6, 18, 5, 3, 'K').rect(7, 18, 4, 2, 'S').dot(10, 18, 'L');
        } else restingArm(g, false);
    }
    return Object.freeze(g.finish());
}

/** The rice worker draws the existing rake through a tiny patch beside the bank. */
function ricePose(pose: Pose): PixelFrame {
    const work = pose === 'work', reach = pose === 'reach', press = pose === 'press';
    const prepare = pose === 'prepare', release = pose === 'release';
    const notice = pose === 'notice', watch = pose === 'watch', open = pose === 'open';
    const g = base(true, work);
    // During the lift, this worker looks left toward the same mechanism.
    head(g, work ? 1 : 0, work ? 1 : 0, notice || watch || open, pose === 'blink');
    const shaftTop = reach || prepare ? 22 : work || release ? 20 : 21;
    const rakeY = reach ? 25 : 26;
    g.line(shaftTop, work ? 14 : press || release ? 13 : 12, 23, rakeY, 'Y');
    g.rect(19, rakeY, 5, 2, 'b');
    for (const x of [19, 21, 23]) g.dot(x, rakeY + 2, 'b');
    g.rect(17, work ? 16 : 15, 5, 4, 'K');
    g.rect(17, work ? 16 : 15, 4, 2, 'W').rect(20, work ? 17 : 16, 3, 2, 'L');
    if (work || reach || press || release) {
        g.rect(5, 16, 4, 5, 'K').rect(6, 16, 3, 3, 'W');
        g.rect(8, work ? 19 : 18, 6, 3, 'K').rect(9, work ? 19 : 18, 5, 2, 'S');
    } else if (notice || watch) {
        // A small hat adjustment and an attentive gaze, with the rake planted.
        g.rect(4, 12, 4, 7, 'K').rect(5, 12, 3, 5, 'W');
        g.rect(4, 9, 3, 4, 'S').rect(5, 8, 4, 2, 'L');
        if (watch) g.dot(8, 9, 'S');
    } else if (open) {
        g.rect(4, 15, 4, 6, 'K').rect(5, 15, 3, 4, 'W');
        g.rect(7, 19, 4, 3, 'K').rect(7, 19, 3, 2, 'S');
    } else restingArm(g, true);
    return Object.freeze(g.finish());
}

/** A paper ledger stays in the supporting hand while the other hand writes.
 * Watching the lift is a change of gaze, never a pointing command for Feka. */
function inspectorPose(pose: Pose): PixelFrame {
    const writing = pose === 'reach' || pose === 'press' || pose === 'work';
    const turning = pose === 'prepare' || pose === 'release';
    const watch = pose === 'notice' || pose === 'watch';
    const g = base(false, false);
    head(g, writing ? 1 : 0, writing ? 1 : watch ? -1 : 0, false, pose === 'blink');
    // Inspector's light vest distinguishes the clipboard from the pump keeper.
    g.rect(8, 15, 2, 6, 'W').rect(15, 15, 2, 6, 'W').dot(9, 19, 'h');
    const x = writing ? 14 : turning ? 15 : 16, y = writing ? 14 : turning ? 15 : 16;
    g.rect(x, y, 8, 8, 'K').rect(x + 1, y + 1, 6, 6, 'h');
    g.rect(x + 1, y + 1, 5, 5, 'W').rect(x + 3, y, 2, 2, 'b');
    g.rect(x + 2, y + 3, 3, 1, 'Y').rect(x + 2, y + 5, 2, 1, 'Y');
    // Far hand supports the outer edge. Pencil and fingertips remain attached.
    g.rect(x + 5, y + 4, 3, 2, 'S').dot(x + 5, y + 4, 'L');
    if (writing || turning) {
        g.rect(5, 16, 4, 5, 'K').rect(6, 16, 3, 3, 'T');
        const pen = pose === 'press' || pose === 'release' ? 1 : pose === 'work' ? 2 : 0;
        g.line(8, 19, x + 1 + pen, y + 4, 'K').line(8, 20, x + 2 + pen, y + 5, 'S');
        g.rect(x, y + 3 + pen, 3, 2, 'L').line(x + 2, y + 1 + pen, x + 4, y + 4 + pen, 'h');
    } else restingArm(g, false);
    return Object.freeze(g.finish());
}

const POSES: readonly Pose[] = ['rest', 'prepare', 'reach', 'press', 'work', 'release', 'recover', 'blink', 'notice', 'watch', 'open'];
const FRAMES: Readonly<Record<GuairaWorkerKind, Readonly<Record<Pose, PixelFrame>>>> = Object.freeze({
    pump: Object.freeze(Object.fromEntries(POSES.map(pose => [pose, pumpPose(pose)])) as Record<Pose, PixelFrame>),
    rice: Object.freeze(Object.fromEntries(POSES.map(pose => [pose, ricePose(pose)])) as Record<Pose, PixelFrame>),
    inspector: Object.freeze(Object.fromEntries(POSES.map(pose => [pose, inspectorPose(pose)])) as Record<Pose, PixelFrame>),
});

/** State selects the reaction directly, so restored checkpoints need no past event. */
function poseFor(kind: GuairaWorkerKind, state: GuairaWorkerVisualState): Pose {
    const time = Number.isFinite(state.activeTimeMs) ? Math.max(0, state.activeTimeMs) : 0;
    const rise = Number.isFinite(state.bridgeRise) ? Math.max(0, Math.min(1, state.bridgeRise)) : 0;
    if (state.valveActive) {
        if (rise < 1) return rise < .3 ? 'notice' : 'watch';
        if (state.reducedMotion) return 'open';
        // Occasional glance at the working canal; mostly hold the relaxed pose.
        return (time + (kind === 'rice' ? 1900 : 0)) % 6200 < 760 ? 'watch' : 'open';
    }
    if (state.reducedMotion) return 'rest';
    const beat = (time + (kind === 'rice' ? 730 : kind === 'inspector' ? 390 : 0)) % 3600;
    if (beat < 1400) return 'rest';
    if (beat < 1580) return 'prepare';
    if (beat < 1840) return 'reach';
    if (beat < 2020) return 'press';
    if (beat < 2300) return 'work';
    if (beat < 2480) return 'release';
    if (beat < 2680) return 'reach';
    if (beat < 2860) return 'prepare';
    if (beat < 3020) return 'recover';
    if (beat < 3100) return 'blink';
    return 'rest';
}

/**
 * Draw behind Feka in the existing object layer. Coordinates are the unchanged feet
 * anchor after camera subtraction. No event, timer, animation state or game mutation.
 * A held activeTimeMs freezes every pixel, including after traversal completion.
 */
export function drawGuairaWorker(c: CanvasRenderingContext2D, x: number, feetY: number,
    kind: GuairaWorkerKind, state: GuairaWorkerVisualState): void {
    if (!Number.isFinite(x) || !Number.isFinite(feetY)) return;
    const frame = FRAMES[kind][poseFor(kind, state)], px = Math.round(x), py = Math.round(feetY);
    c.save();
    // Keep the subdued grounding shadow wholly above the quiet running strip.
    c.fillStyle = '#9c7558'; c.fillRect(px - 3, py - 1, 19, 1);
    frame.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
            const color = PALETTE[row[xx]];
            if (color) { c.fillStyle = color; c.fillRect(px + xx - 8, py + yy - 29, 1, 1); }
        }
    });
    c.restore();
}
