import type { Rect, Vector2 } from '../types';
import type { MechanismSpec } from './types';

type Machine = MechanismSpec & { active: boolean; timer: number; firedAt?: number; jetOpenedAt?: number };
export type JetPhase = 'idle' | 'charging' | 'rising' | 'flowing' | 'falling' | 'venting';
export interface JetCycle {
    phase: JetPhase;
    pressure: number;
    height: number;
    /** The visible liquid, above the outlet. Cosmetic mist never hurts. */
    danger: Rect | null;
    vent: number;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Opening a stopped valve starts a complete, authored warning before pressure returns. */
export function jetCycleTick(b: Machine, time: number): number {
    const period = Math.max(1, b.period ?? 4200);
    const elapsed = !b.active && b.jetOpenedAt !== undefined
        ? Math.max(0, time - b.jetOpenedAt) + period * 1000 / 4200
        : time + (b.phase ?? 0);
    return ((elapsed % period + period) % period) / period * 4200;
}

export function jetCycle(b: Machine, time: number): JetCycle {
    const t = jetCycleTick(b, time);
    let phase: JetPhase = 'idle', pressure = .08, height = 0, vent = 0;
    if (!b.active) {
        if (t >= 1000 && t < 1800) {
            phase = 'charging';
            pressure = .2 + (t - 1000) / 800 * .8;
        } else if (t >= 1800 && t < 2500) {
            phase = t < 1920 ? 'rising' : t < 2330 ? 'flowing' : 'falling';
            const amount = t < 1920 ? (t - 1800) / 120 : t < 2330 ? 1 : (2500 - t) / 170;
            height = Math.round(Math.max(0, b.height - 4) * clamp(amount));
            pressure = .75 + amount * .25;
        } else if (t >= 2500 && t < 2850) {
            phase = 'venting';
            vent = 1 - (t - 2500) / 350;
            pressure = vent * .25;
        }
    }
    const danger = height > 0 ? { x: b.x, y: b.y + b.height - 4 - height, width: b.width, height } : null;
    return { phase, pressure, height, danger, vent };
}

export type CannonPose = 'idle' | 'charge' | 'fire' | 'recoil' | 'reload' | 'seat';
export function cannonCycle(b: Machine, time: number) {
    const elapsed = b.firedAt === undefined ? Infinity : Math.max(0, time - b.firedAt);
    const pose: CannonPose = elapsed < 80 ? 'fire' : elapsed < 260 ? 'recoil' : elapsed < 610 ? 'reload' : elapsed < 850 ? 'seat' : b.timer <= 650 ? 'charge' : 'idle';
    return { pose, elapsed };
}

/** Shared by the cannon artwork and projectile spawn, facing either direction. */
export function cannonMuzzle(b: MechanismSpec): Vector2 {
    const dir = b.direction ?? -1;
    return { x: b.x + b.width / 2 + dir * 20, y: b.y + b.height - 8 };
}
