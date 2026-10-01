import type { MechanismSpec } from './types';
import { jetCycle, jetCycleTick } from './WorldMachineState';

type Geyser = MechanismSpec & { active: boolean; timer: number; jetOpenedAt?: number };
export type GeyserPose = 'rest' | 'anticipation' | 'bubble' | 'pressure' | 'eruption' | 'sustain' | 'retract' | 'settle' | 'closed';

/** Presentation only. The existing 800 ms warning and 700 ms danger window are unchanged. */
export function geyserPresentation(b: Geyser, time: number) {
    const cycle = jetCycle(b, time);
    const tick = jetCycleTick(b, time);
    let pose: GeyserPose = 'rest', progress = 0;
    if (b.active) pose = 'closed';
    else if (cycle.phase === 'charging') {
        const charge = (cycle.pressure - .2) / .8;
        pose = charge < .45 ? 'bubble' : 'pressure';
        progress = charge < .45 ? charge / .45 : (charge - .45) / .55;
    } else if (cycle.phase === 'rising') {
        pose = 'eruption'; progress = (tick - 1800) / 120;
    } else if (cycle.phase === 'flowing') {
        pose = 'sustain'; progress = (tick - 1920) / 410;
    } else if (cycle.phase === 'falling') {
        pose = 'retract'; progress = (tick - 2330) / 170;
    } else if (cycle.phase === 'venting') {
        pose = 'settle'; progress = 1 - cycle.vent;
    } else if (tick >= 820 && tick < 1000) {
        pose = 'anticipation'; progress = (tick - 820) / 180;
    }
    return { ...cycle, pose, progress, tick };
}

/** Small pale arcs are harmless; their flight and impact are one continuous motion. */
export function geyserDroplet(age: number, originX: number, originY: number, floor: number, direction: number, spread: number) {
    if (age < 0 || age > 1) return null;
    const flight = .78;
    const p = Math.min(1, age / flight);
    const x = originX + direction * (2 + p * spread);
    const y = originY + (floor - originY) * p * p - Math.sin(Math.PI * p) * 9;
    return { x, y, impact: age >= flight, progress: age >= flight ? (age - flight) / (1 - flight) : p };
}
