import { DESTRUCTION_SITES } from './HypotheticalDevastation';
import { smoothMotion } from './HypotheticalMotion';

/** One clock for the wall, the falling material, its landing and the quieter sounds.
 * Nothing here advances simulation: an unseen/paused street keeps the same pose. */
export const SCENIC_FRACTURE = 6;
const PIECES = [
    { delay: 8, duration: 29, drift: -13, roof: true },
    { delay: 12, duration: 31, drift: 17, roof: true },
    { delay: 4, duration: 22, drift: -9, roof: false },
    { delay: 0, duration: 18, drift: 5, roof: false },
    { delay: 7, duration: 24, drift: 12, roof: false },
] as const;

export function masonryFall(index: number, piece: number, age: number) {
    const site = DESTRUCTION_SITES[index], p = PIECES[piece];
    const delay = SCENIC_FRACTURE + p.delay + (site.kind === 'bite' && piece < 2 ? 4 : 0);
    const duration = p.duration + Math.round((site.height - 54) / 8);
    const t = Math.max(0, Math.min(duration, age - delay)), u = t / duration;
    // The centre fails first. Roof sections retain their weight for a beat longer.
    const drop = p.roof ? site.height - 9 : site.height * .58 - 4;
    const direction = site.kind === 'bite' ? -1 : 1;
    return { dx: p.drift * u * direction, dy: drop * u * u,
        landed: age >= delay + duration, landAt: delay + duration, delay,
        shake: age >= 0 && age < SCENIC_FRACTURE ? Math.sin(age * 2) * (1 - age / SCENIC_FRACTURE) : 0 };
}

/** Reactions are damped impulses, not perpetual shaking after an impact. */
export function scenicRecoil(age: number, delay = 0, amplitude = 1, period = 7, decay = 35) {
    const t = age - delay;
    return t < 0 || t > decay * 7 ? 0 : Math.sin(t / period) * Math.exp(-t / decay) * amplitude;
}

export function craneLoad(age: number) {
    const release = 12, land = 39, t = Math.max(0, age - release);
    const u = Math.min(1, t / (land - release));
    const bounce = t >= land - release && t < land - release + 12
        ? Math.sin(Math.PI * (t - land + release) / 12) * 3 : 0;
    return { release, land, drop: 41 * u * u - bounce,
        sway: scenicRecoil(age, 2, 5, 6, 28) * (1 - u),
        ropeLift: 17 * smoothMotion((age - release) / 10),
        split: smoothMotion((age - land) / 12), broken: age >= release };
}

export function bastionCloth(age: number) {
    // The left fastening survives. The free end catches, swings and comes to rest.
    const loose = smoothMotion((age - 16) / 20);
    return { loose, drop: 25 * loose, swing: scenicRecoil(age, 16, 7, 5, 30) * loose };
}

export function arsenalPressure(age: number) {
    if (age < 8) return 0;
    return smoothMotion((age - 8) / 6) * (1 - .7 * smoothMotion((age - 28) / 70));
}

/** Small chips inherit a material, bounce once and stay on the rear street. */
export function scenicChip(index: number, chip: number, age: number) {
    const site = DESTRUCTION_SITES[index], group = chip % PIECES.length;
    const landing = masonryFall(index, group, 0).landAt;
    const born = chip < 5 ? 1 + chip % 3 : landing;
    const t = Math.max(0, age - born), flight = 16 + chip % 4 * 3;
    const u = Math.min(1, t / flight), from = site.width * (.18 + (chip * 7 % 13) / 20);
    const drift = ((chip * 13 + index * 7) % 39 - 15) * (site.kind === 'bite' ? -1 : 1);
    const height = chip < 5 ? 29 + chip % 3 * 9 : 3;
    const lift = chip < 5 ? 9 : 8 + chip % 3 * 3;
    const fall = -height * (1 - u * u) - 4 * lift * u * (1 - u);
    const bounceAge = t - flight;
    const bounce = bounceAge > 0 && bounceAge < 9 ? Math.sin(Math.PI * bounceAge / 9) * 2 : 0;
    return { visible: age >= born, x: from + drift * u, y: Math.min(-2, fall - bounce - 2),
        landed: bounceAge >= 9, material: chip % 4, born };
}

export function scenicLandingCues(index: number) {
    // Two large falls, with an extra wooden load in the dock district.
    return [masonryFall(index, 3, 0).landAt, masonryFall(index, 1, 0).landAt,
        ...(index === 2 ? [craneLoad(0).land] : [])];
}
