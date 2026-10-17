import type { FoeSpec } from './types';
import { overlaps } from './types';
import type { Rect } from '../types';
import type { WorldLevel, WorldObjects } from './WorldPhysics';
import { isSolidTile } from '../world/tileRules';
export type FoePhase = 'walk' | 'rest' | 'warning' | 'attack' | 'recoil' | 'stunned';
/** Each family has a readable anticipation, a committed action, and a punishable recovery. */
export class WorldFoe implements Rect {
    x: number;
    y: number;
    width = 16;
    height = 20;
    vx = -.55;
    vy = 0;
    dead = false;
    deadTimer = 0;
    timer = 0;
    age = 0;
    flash = 0;
    phase: FoePhase = 'walk';
    hp = 1;
    homeX: number;
    facing = -1;
    armor = true;
    /** Actual travel drives feet and wheels; idle time cannot make them slide. */
    distance = 0;
    motionX = 0;
    private railOrigin: number;
    private throws = 0;
    constructor(readonly spec: FoeSpec) {
        this.x = this.homeX = this.railOrigin = spec.x;
        if (spec.kind === 'helmet') {
            this.width = 18;
            this.height = 23;
            this.hp = 2;
        }
        if (spec.kind === 'charger') {
            this.width = 25;
            this.height = 27;
        }
        if (spec.kind === 'loader') {
            this.width = 22;
            this.height = 25;
            this.phase = 'rest';
        }
        if (spec.kind === 'agitator') {
            this.width = 24;
            this.height = 23;
            this.phase = 'rest';
        }
        if (spec.kind === 'rail') {
            this.width = 22;
            this.height = 22;
            this.vx = .9;
        }
        this.y = spec.y - this.height;
    }
    private enter(phase: FoePhase) { this.phase = phase; this.timer = 0; }
    get canal() { return this.spec.behavior === 'canal'; }
    get warningDuration() { return this.spec.kind === 'minion' ? 450 : this.spec.kind === 'loader' ? 850 : this.spec.kind === 'rail' ? 550 : 800; }
    get highThrow() { return this.canal && this.throws % 2 === 1; }
    /** A moving trolley locks its roof; braking exposes the rider. Ground
     * pounds still break either guard, using the campaign's ordinary contact. */
    get blocksStomp() {
        return this.spec.kind === 'charger' && !['rest', 'stunned'].includes(this.phase)
            || this.canal && this.spec.kind === 'rail' && this.phase === 'walk';
    }
    get sweepReach() {
        return this.canal ? Math.round(4 + 8 * Math.max(0, Math.min(1, this.timer / 150, (950 - this.timer) / 180))) : 8;
    }
    private sees(player: Rect, level: WorldLevel) {
        const from = this.x + this.width / 2, to = player.x + player.width / 2;
        const y = this.y + this.height / 2, dy = player.y + player.height / 2 - y;
        const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 8));
        for (let i = 1; i < steps; i++)
            if (isSolidTile(level.getTile(level.worldToCol(from + (to - from) * i / steps), level.worldToRow(y + dy * i / steps)))) return false;
        return true;
    }
    update(dt: number, level: WorldLevel, objects: WorldObjects, player: Rect): void {
        if (!Number.isFinite(dt) || dt < 0 || dt === 0 && this.canal) return;
        const oldX = this.x;
        this.step(dt, level, objects, player);
        this.motionX = this.x - oldX;
        this.distance += Math.abs(this.motionX);
    }
    private step(dt: number, level: WorldLevel, objects: WorldObjects, player: Rect): void {
        this.age += dt;
        this.flash = Math.max(0, this.flash - dt);
        if (this.dead) {
            this.deadTimer += dt;
            return;
        }
        this.timer += dt;
        const kind = this.spec.kind, step = dt / (1000 / 60);
        const front = this.spec.guardFacing === undefined || (player.x + player.width / 2 - this.x - this.width / 2) * this.spec.guardFacing >= 0;
        const nearby = front && Math.abs(player.x - this.x) < 170 && Math.abs(player.y - this.y) < 60 && (!this.canal || this.sees(player, level));
        if (kind === 'rail') {
            if (this.phase === 'warning') {
                if (this.timer >= 550)
                    this.enter('walk');
            }
            else {
                if (this.canal) {
                    const target = this.homeX + Math.sign(this.vx) * (this.spec.range ?? 48);
                    const duration = Math.abs(target - this.railOrigin) / .9 * (1000 / 60);
                    const progress = Math.min(1, this.timer / Math.max(1, duration));
                    this.x = this.railOrigin + (target - this.railOrigin) * progress * progress * (3 - 2 * progress);
                } else this.x += this.vx * step;
                if (Math.abs(this.x - this.homeX) >= (this.spec.range ?? 48)) {
                    this.x = this.homeX + Math.sign(this.x - this.homeX) * (this.spec.range ?? 48);
                    this.vx = -this.vx;
                    this.railOrigin = this.x;
                    this.enter('warning');
                }
            }
            this.facing = Math.sign(this.vx);
            return;
        }
        if (kind === 'agitator') {
            if (this.phase === 'rest' && this.timer > 1550)
                this.enter('warning');
            else if (this.phase === 'warning' && this.timer > 800)
                this.enter('attack');
            else if (this.phase === 'attack' && this.timer > 950)
                this.enter('rest');
            return;
        }
        if (kind === 'loader') {
            if (this.phase === 'rest' && this.timer > 1500 && nearby) {
                this.facing = player.x < this.x ? -1 : 1;
                this.enter('warning');
            }
            else if (this.phase === 'warning' && this.timer > 850) {
                const barrel = objects.spawnBarrel(this.x + (this.facing < 0 ? -14 : this.width), this.y - 4, this.facing);
                barrel.vy = -2.5;
                if (this.highThrow) { barrel.vy = -4.8; barrel.vx = this.facing * 2.1; }
                this.throws++;
                this.enter('recoil');
            }
            else if (this.phase === 'recoil' && this.timer > 400)
                this.enter('rest');
            return;
        }
        if (this.phase === 'stunned') {
            if (this.timer > 700) {
                if (this.canal && kind === 'helmet' && !this.armor) this.vx = Math.sign(this.vx) * .9;
                this.enter('walk');
            }
            return;
        }
        if (this.canal && kind === 'minion') {
            if (this.phase === 'walk' && nearby && (player.x + player.width / 2 - this.x - this.width / 2) * this.facing > 0 &&
                // A descending gap jump must not make the patrol stop under
                // the landing. Challenge a grounded approach on the same bank.
                Math.abs(player.x - this.x) < 52 && Math.abs(player.y + player.height - this.y - this.height) < 1) {
                this.enter('warning');
            } else if (this.phase === 'warning' && this.timer >= this.warningDuration) this.enter('attack');
            else if (this.phase === 'attack' && this.timer >= 240) this.enter('rest');
            else if (this.phase === 'rest' && this.timer >= 900) this.enter('walk');
        }
        if (kind === 'charger') {
            if (this.phase === 'walk' && nearby) {
                this.facing = player.x < this.x ? -1 : 1;
                this.vx = this.facing;
                this.enter('warning');
            }
            else if (this.phase === 'warning' && this.timer >= 800)
                this.enter('attack');
            else if (this.phase === 'attack' && this.timer >= 720)
                this.enter('rest');
            else if (this.phase === 'rest' && this.timer >= 1400)
                this.enter('walk');
        }
        let dx = (kind === 'charger' ? (this.phase === 'attack' ? this.facing * 3.2 : 0) : this.vx) * step;
        if (this.canal && kind === 'charger' && this.phase === 'attack') {
            // Integrate the ramp rather than multiplying the end-of-step speed.
            const travel = (ms: number) => {
                const t = Math.max(0, Math.min(720, ms));
                return (t < 120 ? t * t / 240 : t > 600 ? 600 - (720 - t) ** 2 / 240 : t - 60) * 3.8 / (1000 / 60);
            };
            dx = this.facing * (travel(this.timer) - travel(this.timer - dt));
        }
        if (this.canal && kind === 'minion' && this.phase !== 'walk') {
            dx = this.phase === 'attack' ? this.facing * 1.2 * step : 0;
            const limit = this.spec.range ?? 48;
            dx = Math.max(this.homeX - limit, Math.min(this.homeX + limit, this.x + dx)) - this.x;
        }
        this.vy = Math.min(8, this.vy + .4 * step);
        const direction = dx > 0 ? 1 : -1, foot = this.y + this.height;
        const cliff = dx !== 0 && this.vy < 1 && level.getTile(level.worldToCol(this.x + (direction > 0 ? this.width + 5 : -5)), level.worldToRow(foot + 5)) === 0;
        const result = level.resolveCollision(this, { x: cliff ? 0 : dx, y: this.vy * step }, this);
        this.x = result.position.x;
        this.y = result.position.y;
        this.vy = result.velocity.y;
        if (kind === 'charger') {
            if (this.phase === 'attack' && (cliff || dx !== 0 && result.velocity.x === 0)) {
                this.enter('rest');
                this.flash = 100;
            }
        }
        else if (!(this.canal && kind === 'minion' && this.phase !== 'walk') && (result.velocity.x === 0 || cliff || Math.abs(this.x - this.homeX) > (this.spec.range ?? 48)))
            this.vx = -this.vx;
        if (kind !== 'charger')
            this.facing = Math.sign(this.vx);
    }
    get danger(): Rect | null {
        if (this.spec.kind === 'agitator' && this.phase === 'attack') return { x: this.x - this.sweepReach, y: this.y + 9, width: this.width + this.sweepReach * 2, height: 12 };
        if (this.canal && this.spec.kind === 'minion' && this.phase === 'attack' && this.timer >= 50 && this.timer < 190)
            return { x: this.facing < 0 ? this.x - 8 : this.x + this.width - 2, y: this.y + 10, width: 10, height: 8 };
        return null;
    }
    contact(player: Rect, previous: Rect, falling: boolean, pound: boolean): 'none' | 'hurt' | 'bounce' | 'kill' {
        if (this.dead)
            return 'none';
        if (this.danger && overlaps(player, this.danger))
            return 'hurt';
        if (!overlaps(player, this))
            return 'none';
        if (falling && previous.y + previous.height <= this.y + 9) {
            if (this.spec.kind === 'helmet' && this.armor && !pound) {
                this.armor = false;
                this.hp = 1;
                this.flash = 250;
                this.enter('stunned');
                return 'bounce';
            }
            if (this.blocksStomp && !pound) {
                this.flash = 100;
                return 'bounce';
            }
            if (this.spec.kind === 'agitator' && this.phase === 'attack')
                return 'hurt';
            this.dead = true;
            this.deadTimer = 0;
            return 'kill';
        }
        if (this.phase === 'stunned' || this.spec.kind === 'agitator' && this.phase !== 'attack')
            return 'none';
        return 'hurt';
    }
}
