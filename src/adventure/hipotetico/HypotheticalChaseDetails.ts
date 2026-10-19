import { CHASE_GAPS, CHASE_WIDTH } from './HypotheticalLayout';

export const CHASE_DECK_Y = 224;
export const CHASE_WATER_Y = 240;
export type ChaseMaterial = 'stone' | 'timber' | 'iron';
const unit = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = unit(v); return t * t * (3 - 2 * t); };

export function chaseMaterialAt(x: number): ChaseMaterial {
    return x >= 3360 ? 'iron' : x >= 1120 && x < 2240 ? 'timber' : 'stone';
}

export function chaseCollapsedEdge(pursuerX: number) {
    return Math.max(0, Math.min(CHASE_WIDTH, Math.floor((pursuerX - 32) / 16) * 16));
}

/** Real banks only: neither a gap nor a collapsed tile can stop a projectile. */
export function chaseDeckSpans(pursuerX: number) {
    const spans: Array<{ x: number; y: number; width: number; height: number }> = [];
    const edge = chaseCollapsedEdge(pursuerX);
    let start = edge;
    for (const [a, z] of CHASE_GAPS) {
        if (a * 16 > start) spans.push({ x: start, y: CHASE_DECK_Y, width: a * 16 - start, height: 64 });
        start = Math.max(start, z * 16);
    }
    if (start < CHASE_WIDTH) spans.push({ x: start, y: CHASE_DECK_Y, width: CHASE_WIDTH - start, height: 64 });
    return spans;
}

/** Contact hold, two failing joints, then a detached beam and a bouncing load. */
export function chaseRuinAt(age: number) {
    const t = Math.max(0, age - 4), loadTime = Math.max(0, age - 9);
    const loadLand = Math.sqrt(31 / .09), after = Math.max(0, loadTime - loadLand);
    return {
        leftTurn: ease(t / 29) * 1.45,
        rightTurn: ease((t - 5) / 33) * 1.4,
        postDrop: ease((t - 29) / 20) * 27,
        beamX: t * .45,
        beamDrop: t * t * .055,
        beamTurn: ease(t / 36) * .8,
        loadDrop: Math.min(31, loadTime * loadTime * .09) - (after < 12 ? Math.sin(after / 12 * Math.PI) * 2 : 0),
        dust: age > 8 && age < 60 ? Math.sin(unit((age - 8) / 52) * Math.PI) : 0,
    };
}

/** The bottom of the falling piece meets the water before its splash begins. */
export function chaseDebrisAt(age: number) {
    const fall = Math.max(0, age - 2), contact = 2 + (-.3 + Math.sqrt(.09 + 4 * .075 * (CHASE_WATER_Y - CHASE_DECK_Y - 5))) / .15;
    return { shift: fall * .14, drop: fall * fall * .075, tilt: Math.min(5, fall * .3), splashAge: age - contact };
}
