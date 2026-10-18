import type { FoeSpec } from '../types';

/** The garrison exists from load. Crossing a threshold wakes the next patrol;
 * defeating it opens its physical gate, never teleports Feka or creates a wave. */
export const SIEGE_SECTORS = [
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
export const SIEGE_WIDTH = 1280;
export const SIEGE_EXIT = 1240;
export const SIEGE_GATE_TICKS = 72;
export function siegeGarrison(sector: number): FoeSpec[] {
    return SIEGE_SECTORS[sector].guards.map((g, i) => ({ ...g, id: `hipotetico:garrison:${sector}:${i}`, range: 352, behavior: 'canal' }));
}

export class HypotheticalSiege {
    cleared: number;
    active = false;
    entered: number;
    openedThisTick = false;
    gateTicks: number[];
    constructor(cleared = 0) {
        this.cleared = Math.max(0, Math.min(3, Math.floor(cleared)));
        this.entered = Math.min(2, this.cleared);
        this.gateTicks = SIEGE_SECTORS.map((_, i) => i < this.cleared ? SIEGE_GATE_TICKS : 0);
    }
    get sector() { return SIEGE_SECTORS[Math.min(2, this.cleared)]; }
    get currentSector() { return SIEGE_SECTORS[this.entered]; }
    get checkpoint() { return this.cleared === 3 ? 1212 : this.sector.checkpoint; }
    gateHeight(index: number) {
        const u = this.gateTicks[index] / SIEGE_GATE_TICKS;
        return Math.round(224 * (1 - u * u * (3 - 2 * u)));
    }
    update(playerX: number, living: number) {
        this.openedThisTick = false;
        for (let i = 0; i < this.cleared; i++) this.gateTicks[i] = Math.min(SIEGE_GATE_TICKS, this.gateTicks[i] + 1);
        if (this.cleared === 3) return;
        if (!this.active && playerX >= this.sector.trigger) { this.entered = this.cleared; this.active = true; return; }
        if (this.active && living === 0) {
            this.cleared++; this.active = false; this.openedThisTick = true;
        }
    }
    get passageOpen() { return this.cleared > 0 && this.gateTicks[this.cleared - 1] === SIEGE_GATE_TICKS; }
    canExit(playerX: number) { return this.cleared === 3 && this.passageOpen && playerX >= SIEGE_EXIT; }
}
