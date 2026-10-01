import { ART } from '../graphics/palette';

export type CombatCue = 'helmetLoss' | 'blockedStomp';
export interface WorldSpark {
    x: number; y: number; vx: number; vy: number; life: number; color: string;
}
interface CombatTone {
    frequency: number; duration: number; type: OscillatorType; volume: number; at: number;
}

/** Brief inharmonic metal tones; successful attacks keep their existing low square hit. */
export function combatTones(kind: string): readonly CombatTone[] | null {
    if (kind === 'blockedStomp') return [
        { frequency: 1240, duration: .075, type: 'sine', volume: .16, at: 0 },
        { frequency: 1870, duration: .055, type: 'sine', volume: .065, at: 0 }
    ];
    if (kind === 'helmetLoss') return [
        { frequency: 820, duration: .09, type: 'triangle', volume: .17, at: 0 },
        { frequency: 2110, duration: .065, type: 'sine', volume: .065, at: 0 },
        { frequency: 540, duration: .1, type: 'triangle', volume: .12, at: .065 },
        { frequency: 1390, duration: .075, type: 'sine', volume: .045, at: .065 }
    ];
    return null;
}

/** Presentation only: emitted into the existing fixed-step spark pool and pixel painter. */
export function combatSparks(kind: CombatCue, x: number, y: number): WorldSpark[] {
    const helmet = kind === 'helmetLoss', count = helmet ? 6 : 4;
    return Array.from({ length: count }, (_, i) => {
        const side = i % 2 ? 1 : -1, pair = Math.floor(i / 2);
        return {
            x: x + side * (2 + pair * 2), y: y - pair,
            vx: side * (helmet ? .9 + pair * .5 : .85 + pair * .4),
            vy: helmet ? -1.8 - pair * .35 : -.75 - pair * .5,
            life: helmet ? 240 + pair * 40 : 150 + pair * 40,
            color: helmet && pair === 1 ? ART.goldLight : i % 2 ? ART.paper : ART.muted
        };
    });
}
