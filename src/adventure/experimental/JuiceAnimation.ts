import type { JuiceMinibossModel } from './JuiceMinibossModel';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Authored action poses, sampled without changing the combat clock or hitbox. */
export function juicePose(b: JuiceMinibossModel, reducedMotion = false) {
    const t = reducedMotion ? 0 : b.time / 1000, ms = b.phaseTime, f = b.facing;
    const breath = Math.sin(t * 4.2) * .012;
    let sx = 1 - breath * .4, sy = 1 + breath, lean = Math.sin(t * 2.6) * .5;
    let mouth = .78 + Math.sin(t * 4.2) * .025, eyelid = 1;
    const charged = b.attack === 'fan' ? { sx: 1.08, sy: 1.035, lean: -f * 2.2, mouth: 1.14 }
        : b.attack === 'pounce' ? { sx: 1.10, sy: .84, lean: -f * 1.2, mouth: .66 }
        : { sx: 1.06, sy: .91, lean: -f * 3, mouth: .72 };
    if (b.phase === 'warning') {
        const windup = ease(b.progress);
        sx = mix(sx, charged.sx, windup); sy = mix(sy, charged.sy, windup);
        lean = mix(lean, charged.lean, windup); mouth = mix(mouth, charged.mouth, windup);
    } else if (b.phase === 'attack') {
        if (b.attack === 'fan') {
            const release = Math.max(0, ms - b.fanReleaseMs);
            const deflate = ease(release / 210), recoil = Math.sin(clamp(release / 180) * Math.PI);
            sx = mix(charged.sx, 1, deflate) - recoil * .025;
            sy = mix(charged.sy, 1, deflate) + recoil * .045;
            lean = mix(charged.lean, 0, deflate) - f * recoil * 2.2;
            mouth = mix(charged.mouth, .78, deflate) + recoil * .12;
        } else if (b.attack === 'dash') {
            const launch = ease(ms / 95), brake = ease((b.progress - .68) / .32);
            sx = mix(charged.sx, mix(1.15, 1.06, brake), launch);
            sy = mix(charged.sy, mix(.89, .94, brake), launch);
            lean = mix(charged.lean, f * mix(3, 1, brake), launch); mouth = .72;
        } else {
            const launch = ease(ms / 95), fall = ease((b.progress - .65) / .35);
            sx = mix(charged.sx, mix(.97, .94, fall), launch);
            sy = mix(charged.sy, mix(1.065, 1.13, fall), launch);
            lean = mix(charged.lean, f * (1 - fall), launch); mouth = mix(.66, .95, launch);
        }
    } else if (b.phase === 'recover') {
        const settle = 1 - ease(ms / 250);
        if (b.attack === 'pounce') {
            // Compression follows contact. The skirt responds after the dome,
            // then the whole mass rebounds with a decaying elastic oscillation.
            const rest = ease(ms / 520), compression = Math.sin(clamp(ms / 155) * Math.PI) * Math.exp(-ms / 330);
            const after = Math.max(0, ms - 155);
            const wobble = Math.sin(after / 43) * Math.exp(-after / 150) * ease(after / 55);
            sx = mix(.94, 1, rest) + compression * .40 + wobble * .045;
            sy = mix(1.13, 1, rest) - compression * .48 - wobble * .055;
            lean = f * Math.sin(clamp(ms / 250) * Math.PI) * Math.exp(-ms / 230) * 1.4;
        } else {
            sx = 1 + (b.attack === 'dash' ? .06 : 0) * settle;
            sy = 1 - (b.attack === 'dash' ? .06 : 0) * settle;
            lean = b.attack === 'dash' ? f * settle : 0;
        }
        mouth = mix(b.attack === 'pounce' ? .95 : b.attack === 'dash' ? .72 : .78, .67, ease(ms / 180));
        eyelid = 1 - .25 * ease(ms / 110);
    } else if (b.phase === 'hurt') {
        const recoil = 1 - ease(ms / 420);
        sx = 1 + recoil * .075; sy = 1 - recoil * .07;
        lean = -f * recoil * 3; mouth = .64 + .14 * (1 - recoil); eyelid = 1 - recoil * .72;
    } else if (b.phase === 'enrage') {
        const inhale = ease(ms / 460), roar = ease((ms - 460) / 220), settle = ease((ms - 840) / 360);
        sx = mix(1 + inhale * .07 - roar * .10, 1, settle);
        sy = mix(1 - inhale * .06 + roar * .115, 1, settle);
        lean = 0; mouth = mix(.78 - inhale * .18 + roar * .66, .78, settle);
        eyelid = 1 - inhale * .22 * (1 - roar);
    } else if (b.phase === 'defeated') {
        const sink = ease((ms - 90) / 700);
        sx = 1 + sink * .42; sy = 1 - sink * .92;
        lean = -f * (1 - sink) * 1.6; mouth = .56; eyelid = 1 - sink * .85;
    }
    return { sx, sy, lean, mouth, eyelid, surface: Math.sin(t * 3.6) * .8 };
}
