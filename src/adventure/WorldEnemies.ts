import type { FoeSpec } from './types';
import { overlaps } from './types';
import type { Rect } from '../types';
import type { WorldLevel, WorldObjects } from './WorldPhysics';
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
    constructor(readonly spec: FoeSpec) {
        this.x = this.homeX = spec.x;
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
    update(dt: number, level: WorldLevel, objects: WorldObjects, player: Rect): void {
        this.age += dt;
        this.flash = Math.max(0, this.flash - dt);
        if (this.dead) {
            this.deadTimer += dt;
            return;
        }
        this.timer += dt;
        const kind = this.spec.kind, step = dt / (1000 / 60), nearby = Math.abs(player.x - this.x) < 170 && Math.abs(player.y - this.y) < 60;
        if (kind === 'rail') {
            if (this.phase === 'warning') {
                if (this.timer >= 550)
                    this.enter('walk');
            }
            else {
                this.x += this.vx * step;
                if (Math.abs(this.x - this.homeX) >= (this.spec.range ?? 48)) {
                    this.x = this.homeX + Math.sign(this.x - this.homeX) * (this.spec.range ?? 48);
                    this.vx = -this.vx;
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
                this.enter('recoil');
            }
            else if (this.phase === 'recoil' && this.timer > 400)
                this.enter('rest');
            return;
        }
        if (this.phase === 'stunned') {
            if (this.timer > 700)
                this.enter('walk');
            return;
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
        const dx = (kind === 'charger' ? (this.phase === 'attack' ? this.facing * 3.2 : 0) : this.vx) * step;
        this.vy = Math.min(8, this.vy + .4 * step);
        const direction = dx > 0 ? 1 : -1, foot = this.y + this.height;
        const cliff = dx !== 0 && this.vy < 1 && level.getTile(level.worldToCol(this.x + (direction > 0 ? this.width + 5 : -5)), level.worldToRow(foot + 5)) === 0;
        const result = level.resolveCollision(this, { x: cliff ? 0 : dx, y: this.vy * step }, this);
        this.x = result.position.x;
        this.y = result.position.y;
        this.vy = result.velocity.y;
        if (kind === 'charger') {
            if (this.phase === 'attack' && (cliff || result.velocity.x === 0)) {
                this.enter('rest');
                this.flash = 100;
            }
        }
        else if (result.velocity.x === 0 || cliff || Math.abs(this.x - this.homeX) > (this.spec.range ?? 48))
            this.vx = -this.vx;
        if (kind !== 'charger')
            this.facing = Math.sign(this.vx);
    }
    get danger(): Rect | null { return this.spec.kind === 'agitator' && this.phase === 'attack' ? { x: this.x - 8, y: this.y + 9, width: this.width + 16, height: 12 } : null; }
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
            if (this.spec.kind === 'charger' && !['rest', 'stunned'].includes(this.phase) && !pound) {
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
