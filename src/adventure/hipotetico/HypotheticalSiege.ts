import type { FoeSpec } from '../types';

/** The garrison exists from load. Crossing a threshold wakes the next patrol;
 * defeating it opens its physical gate, never teleports Feka or creates a wave. */
export const SIEGE_APPROACH = 256;
const ORIGINAL_SECTORS = [
    { name: 'PORTARIA', origin: 0, trigger: 96, gate: 352, checkpoint: 48,
        guards: [{ kind: 'minion', x: 180, y: 224 }, { kind: 'helmet', x: 276, y: 224 }],
        platforms: [{ x: 120, y: 184, width: 48 }, { x: 244, y: 168, width: 64 }] },
    { name: 'CAIS DE CARGA', origin: 416, trigger: 464, gate: 768, checkpoint: 432,
        guards: [{ kind: 'charger', x: 570, y: 224 }, { kind: 'loader', x: 658, y: 156 }, { kind: 'minion', x: 720, y: 224 }],
        platforms: [{ x: 478, y: 188, width: 56 }, { x: 560, y: 196, width: 40 }, { x: 624, y: 156, width: 80 }] },
    { name: 'ARSENAL', origin: 832, trigger: 880, gate: 1184, checkpoint: 848,
        guards: [{ kind: 'helmet', x: 938, y: 224 }, { kind: 'minion', x: 1092, y: 224 },
            { kind: 'loader', x: 986, y: 160 }, { kind: 'loader', x: 1124, y: 176 }],
        platforms: [{ x: 870, y: 188, width: 56 }, { x: 972, y: 160, width: 64 }, { x: 1098, y: 176, width: 56 }] },
] as const;
export const SIEGE_SECTORS = ORIGINAL_SECTORS.map((s,i)=>({...s,
    origin:s.origin+(i?SIEGE_APPROACH:0),trigger:s.trigger+SIEGE_APPROACH,gate:s.gate+SIEGE_APPROACH,
    checkpoint:s.checkpoint+SIEGE_APPROACH,
    guards:s.guards.map(g=>({...g,x:g.x+SIEGE_APPROACH})),
    platforms:s.platforms.map(p=>({...p,x:p.x+SIEGE_APPROACH}))}));
export const SIEGE_WIDTH = 1280+SIEGE_APPROACH;
export const SIEGE_EXIT = 1240+SIEGE_APPROACH;
export const SIEGE_GATE_TICKS = 72;
export const SIEGE_UNLOCK_TICKS = 14;
export const SIEGE_LIFT_TICKS = 50;
export const SIEGE_LOCK_TICKS = 18;
/** Short optional upper routes connect the cleared post to the next approach. */
export const SIEGE_LINKS = [
    { id: 'siege-link-0', x: 384+SIEGE_APPROACH, y: 180, width: 40, height: 7, kind: 'support' as const },
    { id: 'siege-link-1', x: 800+SIEGE_APPROACH, y: 184, width: 48, height: 7, kind: 'support' as const },
];
export function siegeGarrison(sector: number): FoeSpec[] {
    return SIEGE_SECTORS[sector].guards.map((g, i) => ({ ...g, id: `hipotetico:garrison:${sector}:${i}`, range: 352, behavior: 'canal' }));
}

export class HypotheticalSiege {
    cleared: number;
    active = false;
    entered: number;
    openedThisTick = false;
    releasedThisTick = false;
    gateTicks: number[];
    remaining: number[];
    lockTicks: number[][];
    constructor(cleared = 0) {
        this.cleared = Math.max(0, Math.min(3, Math.floor(cleared)));
        this.entered = Math.min(2, this.cleared);
        this.gateTicks = SIEGE_SECTORS.map((_, i) => i < this.cleared ? SIEGE_GATE_TICKS : 0);
        this.remaining = SIEGE_SECTORS.map((s, i) => i < this.cleared ? 0 : s.guards.length);
        this.lockTicks = SIEGE_SECTORS.map((s, i) => s.guards.map(() => i < this.cleared ? SIEGE_LOCK_TICKS : 0));
    }
    get sector() { return SIEGE_SECTORS[Math.min(2, this.cleared)]; }
    get currentSector() { return SIEGE_SECTORS[this.entered]; }
    get checkpoint() { return this.cleared === 3 ? 1212+SIEGE_APPROACH : this.sector.checkpoint; }
    gateHeight(index: number) {
        // The latch retracts before the motor lifts. The last eight ticks let
        // the drum settle; its collision never bounces back onto the player.
        const u = Math.max(0, Math.min(1, (this.gateTicks[index] - SIEGE_UNLOCK_TICKS) / SIEGE_LIFT_TICKS));
        return Math.round(224 * (1 - u * u * (3 - 2 * u)));
    }
    gatePhase(index: number) {
        const t = this.gateTicks[index];
        return t === 0 ? 'locked' : t < SIEGE_UNLOCK_TICKS ? 'unlock'
            : t < SIEGE_UNLOCK_TICKS + SIEGE_LIFT_TICKS ? 'lift' : t < SIEGE_GATE_TICKS ? 'settle' : 'open';
    }
    update(playerX: number, living: number) {
        this.openedThisTick = false;
        this.releasedThisTick = false;
        for (const [i, s] of SIEGE_SECTORS.entries()) for (let j = 0; j < s.guards.length - this.remaining[i]; j++)
            this.lockTicks[i][j] = Math.min(SIEGE_LOCK_TICKS, this.lockTicks[i][j] + 1);
        for (let i = 0; i < this.cleared; i++) this.gateTicks[i] = Math.min(SIEGE_GATE_TICKS, this.gateTicks[i] + 1);
        if (this.cleared === 3) return;
        if (!this.active && playerX >= this.sector.trigger) { this.entered = this.cleared; this.active = true; return; }
        if (this.active) {
            const remaining = Math.max(0, Math.min(this.remaining[this.cleared], Math.floor(living)));
            this.releasedThisTick = remaining < this.remaining[this.cleared];
            this.remaining[this.cleared] = remaining;
        }
        if (this.active && living === 0) {
            this.cleared++; this.active = false; this.openedThisTick = true;
        }
    }
    get passageOpen() { return this.cleared > 0 && this.gateTicks[this.cleared - 1] === SIEGE_GATE_TICKS; }
    canExit(playerX: number) { return this.cleared === 3 && this.passageOpen && playerX >= SIEGE_EXIT; }
}
