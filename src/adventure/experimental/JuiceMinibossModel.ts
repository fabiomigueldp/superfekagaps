import type { Rect } from '../../types';
import { clamp, overlaps } from '../types';
import { geyserBands } from './JuiceFluid';

export type JuiceAttack = 'dash' | 'fan' | 'pounce';
export type JuicePhase = 'intro' | 'rest' | 'warning' | 'attack' | 'recover' | 'hurt' | 'enrage' | 'defeated';
export interface JuiceDrop extends Rect { vx: number; vy: number; life: number; }
export interface JuiceGeyser extends Rect {
    phase: 'warning' | 'active' | 'recede';
    phaseTime: number;
    progress: number;
    /** Pressure time at shutoff, including attacks that end before 520ms. */
    releaseTime?: number;
}
export interface JuiceEvent {
    kind: 'warning' | 'launch' | 'spit' | 'splash' | 'hit' | 'enrage' | 'geyser-warning' | 'geyser' | 'defeated';
    x: number;
    y: number;
}
export interface JuiceArena { left: number; right: number; floor: number; }

/** Standalone encounter: the same locked geometry drives warnings and collision. */
export class JuiceMinibossModel implements Rect {
    x: number;
    y: number;
    width = 38;
    height = 40;
    readonly maxHealth = 6;
    readonly enrageMs = 1200;
    readonly fanReleaseMs = 80;
    readonly geyserWarningMs = 900;
    readonly geyserActiveMs = 520;
    readonly geyserRecedeMs = 460;
    health = this.maxHealth;
    phase: JuicePhase = 'intro';
    attack: JuiceAttack = 'dash';
    phaseTime = 0;
    time = 0;
    cycle = 0;
    facing: -1 | 1 = -1;
    targetX = 0;
    targetY = 0;
    drops: JuiceDrop[] = [];
    geysers: JuiceGeyser[] = [];
    events: JuiceEvent[] = [];
    private fromX = 0;
    private toX = 0;
    private emitted = false;
    private pendingEnrage = false;
    constructor(readonly arena: JuiceArena = { left: 16, right: 304, floor: 224 }) {
        if (arena.right - arena.left < 160) throw new Error('The experimental arena needs dodge space');
        this.x = arena.right - this.width - 10;
        this.y = arena.floor - this.height;
    }
    get enraged() { return this.health <= 2; }
    get warningMs() { return this.enraged ? this.geyserWarningMs : 680; }
    get attackMs() { return this.attack === 'dash' ? (this.enraged ? 400 : 460) : this.attack === 'pounce' ? 700 : 600; }
    get recoveryMs() { return this.attack === 'pounce' ? 1100 : this.enraged ? 800 : 900; }
    get vulnerable() { return this.phase === 'recover'; }
    get progress() {
        const duration = this.phase === 'warning' ? this.warningMs : this.phase === 'attack' ? this.attackMs
            : this.phase === 'enrage' ? this.enrageMs : this.phase === 'hurt' ? 550 : this.recoveryMs;
        return clamp(this.phaseTime / duration, 0, 1);
    }
    get hazards(): Rect[] {
        if (['intro', 'enrage', 'defeated', 'hurt'].includes(this.phase)) return [];
        return [...this.drops.map(d => ({ x: d.x, y: d.y, width: d.width, height: d.height })),
            ...this.geysers.filter(g => g.phase === 'active').flatMap(geyserBands)];
    }
    /** One launch description drives both the visible warning and the projectiles. */
    get fanLaunch() {
        const x = this.x + this.width / 2, y = this.y + this.height * .55;
        const aim = Math.atan2(this.targetY - y, this.targetX - x);
        const count = this.enraged ? 9 : 7, speed = this.enraged ? .16 : .145;
        return { x, y, vectors: Array.from({ length: count }, (_, i) => {
            const angle = aim + (i - (count - 1) / 2) * .21;
            return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - .015 };
        }) };
    }
    /** Five permanent floor vents let players learn the arena before it erupts. */
    get ventCenters() {
        const inset = 32, span = this.arena.right - this.arena.left - inset * 2;
        return Array.from({ length: 5 }, (_, i) => this.arena.left + inset + span * i / 4);
    }
    private enter(phase: JuicePhase) { this.phase = phase; this.phaseTime = 0; }
    private emit(kind: JuiceEvent['kind'], x = this.x + this.width / 2, y = this.y + this.height) {
        this.events.push({ kind, x, y });
    }
    private warnGeysers(playerCenter: number) {
        // The future landing/recovery zone always stays open. Vents never chase.
        const landing = this.toX + this.width / 2;
        const choices = this.ventCenters.filter(x => Math.abs(x - landing) >= 48);
        choices.sort((a, b) => Math.abs(a - playerCenter) - Math.abs(b - playerCenter));
        const first = choices[0];
        const second = choices.filter(x => Math.abs(x - first) >= 96)
            .sort((a, b) => Math.abs(b - first) - Math.abs(a - first))[0];
        this.geysers = [first, second].filter((x): x is number => x !== undefined).map(x => ({
            x: x - 11, y: this.arena.floor - 64, width: 22, height: 64,
            phase: 'warning', phaseTime: 0, progress: 0,
        }));
        for (const geyser of this.geysers) this.emit('geyser-warning', geyser.x + geyser.width / 2, this.arena.floor);
    }
    private warn(player: Rect) {
        const sequence: JuiceAttack[] = this.enraged ? ['fan', 'pounce', 'fan', 'dash'] : ['dash', 'fan', 'pounce'];
        this.attack = sequence[this.cycle++ % sequence.length];
        const playerCenter = player.x + player.width / 2;
        this.targetX = this.attack === 'fan' ? playerCenter
            : clamp(playerCenter, this.arena.left + 30, this.arena.right - 30);
        this.targetY = player.y + player.height / 2;
        this.facing = this.targetX < this.x + this.width / 2 ? -1 : 1;
        this.fromX = this.x;
        this.toX = this.attack === 'dash'
            ? (this.facing < 0 ? this.arena.left + 8 : this.arena.right - this.width - 8)
            : this.attack === 'fan' ? this.x
            : clamp(this.targetX - this.width / 2, this.arena.left + 8, this.arena.right - this.width - 8);
        this.emitted = false;
        this.enter('warning');
        this.emit('warning');
        if (this.enraged) this.warnGeysers(playerCenter);
    }
    /** Fixed-step internals prevent a delayed render from skipping anticipation. */
    update(dt: number, player: Rect) {
        this.events = [];
        if (!Number.isFinite(dt) || dt <= 0) return;
        let remaining = Math.min(dt, 100);
        while (remaining > 0) {
            const step = Math.min(remaining, 1000 / 120);
            this.tick(step, player);
            remaining -= step;
        }
    }
    private tickGeysers(dt: number) {
        for (const g of this.geysers) {
            g.phaseTime += dt;
            const duration = g.phase === 'warning' ? this.geyserWarningMs
                : g.phase === 'active' ? this.geyserActiveMs : this.geyserRecedeMs;
            g.progress = clamp(g.phaseTime / duration, 0, 1);
            if (g.phaseTime < duration) continue;
            if (g.phase === 'warning') {
                g.phase = 'active'; g.phaseTime = 0; g.progress = 0;
                this.emit('geyser', g.x + g.width / 2, this.arena.floor);
            } else if (g.phase === 'active') {
                g.releaseTime = g.phaseTime;
                g.phase = 'recede'; g.phaseTime = 0; g.progress = 0;
            }
        }
        this.geysers = this.geysers.filter(g => g.phase !== 'recede' || g.phaseTime < this.geyserRecedeMs);
    }
    private tick(dt: number, player: Rect) {
        this.time += dt;
        this.phaseTime += dt;
        if (this.phase === 'defeated') return;
        for (const d of this.drops) {
            d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 0.00012 * dt; d.life -= dt;
        }
        this.drops = this.drops.filter(d => d.life > 0 && d.y + d.height < this.arena.floor && d.x > this.arena.left - 20 && d.x < this.arena.right + 20);
        this.tickGeysers(dt);
        switch (this.phase) {
            case 'intro': if (this.phaseTime >= 850) this.enter('rest'); break;
            case 'rest': if (this.phaseTime >= (this.enraged ? 260 : 340)) this.warn(player); break;
            case 'warning': if (this.phaseTime >= this.warningMs) { this.enter('attack'); this.emit('launch'); } break;
            case 'hurt': if (this.phaseTime >= 550) {
                if (this.pendingEnrage) {
                    this.pendingEnrage = false; this.cycle = 0; this.enter('enrage'); this.emit('enrage');
                } else this.enter('rest');
            } break;
            case 'enrage': if (this.phaseTime >= this.enrageMs) this.enter('rest'); break;
            case 'recover': if (this.phaseTime >= this.recoveryMs) this.enter('rest'); break;
            case 'attack': {
                const t = clamp(this.phaseTime / this.attackMs, 0, 1);
                if (this.attack === 'dash') {
                    const ease = t * t * (3 - 2 * t);
                    this.x = this.fromX + (this.toX - this.fromX) * ease;
                } else if (this.attack === 'pounce') {
                    this.x = this.fromX + (this.toX - this.fromX) * t;
                    this.y = this.arena.floor - this.height - Math.sin(t * Math.PI) * 88;
                } else if (!this.emitted && this.phaseTime >= this.fanReleaseMs) {
                    this.emitted = true;
                    const fan = this.fanLaunch;
                    this.emit('spit', fan.x, fan.y);
                    for (const vector of fan.vectors) {
                        this.drops.push({ x: fan.x - 4, y: fan.y - 4, width: 8, height: 8, ...vector, life: 1700 });
                    }
                }
                if (t >= 1) {
                    this.y = this.arena.floor - this.height;
                    // Recovery is a clear invitation: all floor jets lose collision.
                    for (const g of this.geysers) if (g.phase !== 'recede') {
                        g.releaseTime = g.phase === 'active' ? g.phaseTime : 0;
                        g.phase = 'recede'; g.phaseTime = 0; g.progress = 0;
                    }
                    this.enter('recover'); this.emit('splash');
                }
                break;
            }
        }
    }
    contact(player: Rect, previous: Rect, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' | 'defeated' {
        if (['intro', 'enrage', 'hurt', 'defeated'].includes(this.phase) || !overlaps(player, this)) return 'none';
        if (falling && previous.y + previous.height <= this.y + 10) {
            if (!this.vulnerable) return 'bounce';
            this.health--;
            this.drops = []; this.geysers = [];
            this.pendingEnrage = this.health === 2;
            this.enter(this.health === 0 ? 'defeated' : 'hurt');
            this.emit(this.health === 0 ? 'defeated' : 'hit');
            return this.health === 0 ? 'defeated' : 'hit';
        }
        return this.vulnerable ? 'none' : 'hurt';
    }
}
