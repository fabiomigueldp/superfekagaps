import type { Rect } from '../../types';
import { clamp, overlaps } from '../types';

export type JuiceAttack = 'dash' | 'fan' | 'pounce';
export type JuicePhase = 'intro' | 'rest' | 'warning' | 'attack' | 'recover' | 'hurt' | 'defeated';
export interface JuiceDrop extends Rect { vx: number; vy: number; life: number; }
export interface JuiceEvent { kind: 'warning' | 'launch' | 'splash' | 'hit' | 'defeated'; x: number; y: number; }
export interface JuiceArena { left: number; right: number; floor: number; }

/** Standalone experimental encounter. No campaign, storage or renderer side effects. */
export class JuiceMinibossModel implements Rect {
    x: number;
    y: number;
    width = 30;
    height = 30;
    readonly maxHealth = 6;
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
    events: JuiceEvent[] = [];
    private fromX = 0;
    private toX = 0;
    private emitted = false;
    constructor(readonly arena: JuiceArena = { left: 16, right: 304, floor: 224 }) {
        if (arena.right - arena.left < 160) throw new Error('The experimental arena needs dodge space');
        this.x = arena.right - 48;
        this.y = arena.floor - this.height;
    }
    get enraged() { return this.health <= 3; }
    get warningMs() { return this.enraged ? 500 : 650; }
    get attackMs() { return this.attack === 'dash' ? 430 : this.attack === 'pounce' ? 700 : 560; }
    get recoveryMs() { return this.attack === 'pounce' ? 950 : this.enraged ? 620 : 780; }
    get vulnerable() { return this.phase === 'recover'; }
    get progress() {
        const duration = this.phase === 'warning' ? this.warningMs : this.phase === 'attack' ? this.attackMs : this.recoveryMs;
        return clamp(this.phaseTime / duration, 0, 1);
    }
    get hazards(): Rect[] {
        if (this.phase === 'defeated' || this.phase === 'hurt') return [];
        return this.drops.map(d => ({ x: d.x, y: d.y, width: d.width, height: d.height }));
    }
    /** One launch description drives both the visible warning and the projectiles. */
    get fanLaunch() {
        const x = this.x + this.width / 2, y = this.y + 12;
        const aim = Math.atan2(this.targetY - y, this.targetX - x);
        return { x, y, vectors: [-.42, -.21, 0, .21, .42].map(offset => {
            const angle = aim + offset;
            return { vx: Math.cos(angle) * .14, vy: Math.sin(angle) * .14 - .015 };
        }) };
    }
    private enter(phase: JuicePhase) { this.phase = phase; this.phaseTime = 0; }
    private emit(kind: JuiceEvent['kind']) { this.events.push({ kind, x: this.x + this.width / 2, y: this.y + this.height }); }
    private warn(player: Rect) {
        const sequence: JuiceAttack[] = this.enraged ? ['dash', 'pounce', 'fan', 'dash'] : ['dash', 'fan', 'pounce'];
        this.attack = sequence[this.cycle++ % sequence.length];
        const playerCenter = player.x + player.width / 2;
        // Landing clamps protect dodge space, but must not turn corners into blind spots.
        this.targetX = this.attack === 'fan' ? playerCenter
            : clamp(playerCenter, this.arena.left + 30, this.arena.right - 30);
        this.targetY = player.y + player.height / 2;
        this.facing = this.targetX < this.x + this.width / 2 ? -1 : 1;
        this.fromX = this.x;
        this.toX = this.attack === 'dash'
            ? (this.facing < 0 ? this.arena.left + 8 : this.arena.right - this.width - 8)
            : clamp(this.targetX - this.width / 2, this.arena.left + 8, this.arena.right - this.width - 8);
        this.emitted = false;
        this.enter('warning');
        this.emit('warning');
    }
    /** Fixed-step internals prevent a delayed render from skipping the warning phase. */
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
    private tick(dt: number, player: Rect) {
        this.time += dt;
        this.phaseTime += dt;
        if (this.phase === 'defeated') return;
        for (const d of this.drops) {
            d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 0.00012 * dt; d.life -= dt;
        }
        this.drops = this.drops.filter(d => d.life > 0 && d.y < this.arena.floor && d.x > this.arena.left - 20 && d.x < this.arena.right + 20);
        switch (this.phase) {
            case 'intro': if (this.phaseTime >= 850) this.enter('rest'); break;
            case 'rest': if (this.phaseTime >= (this.enraged ? 220 : 340)) this.warn(player); break;
            case 'warning': if (this.phaseTime >= this.warningMs) { this.enter('attack'); this.emit('launch'); } break;
            case 'hurt': if (this.phaseTime >= 550) this.enter('rest'); break;
            case 'recover': if (this.phaseTime >= this.recoveryMs) this.enter('rest'); break;
            case 'attack': {
                const t = clamp(this.phaseTime / this.attackMs, 0, 1);
                if (this.attack === 'dash') {
                    const ease = t * t * (3 - 2 * t);
                    this.x = this.fromX + (this.toX - this.fromX) * ease;
                } else if (this.attack === 'pounce') {
                    this.x = this.fromX + (this.toX - this.fromX) * t;
                    this.y = this.arena.floor - this.height - Math.sin(t * Math.PI) * 88;
                } else if (!this.emitted && this.phaseTime >= 80) {
                    this.emitted = true;
                    const fan = this.fanLaunch;
                    for (const vector of fan.vectors) {
                        this.drops.push({ x: fan.x - 4, y: fan.y - 4, width: 8, height: 8, ...vector, life: 1700 });
                    }
                }
                if (t >= 1) {
                    this.y = this.arena.floor - this.height;
                    this.enter('recover');
                    this.emit('splash');
                }
                break;
            }
        }
    }
    contact(player: Rect, previous: Rect, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' | 'defeated' {
        if (['intro', 'hurt', 'defeated'].includes(this.phase) || !overlaps(player, this)) return 'none';
        if (falling && previous.y + previous.height <= this.y + 10) {
            if (!this.vulnerable) return 'bounce';
            this.health--;
            this.drops = [];
            this.enter(this.health === 0 ? 'defeated' : 'hurt');
            this.emit(this.health === 0 ? 'defeated' : 'hit');
            return this.health === 0 ? 'defeated' : 'hit';
        }
        return this.vulnerable ? 'none' : 'hurt';
    }
}
