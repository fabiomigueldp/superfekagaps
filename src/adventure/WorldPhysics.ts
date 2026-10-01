import { Level } from '../world/Level';
import type { LevelData, Rect, Vector2 } from '../types';
import type { MechanismSpec } from './types';
import { overlaps } from './types';
import { cannonMuzzle, jetCycle } from './WorldMachineState';
/** Pixels per fixed physics step, also used by the visible conveyor tread. */
export const BELT_CARRY_SPEED = 1.2;
export interface MovingBody extends MechanismSpec {
    px: number;
    py: number;
    active: boolean;
    timer: number;
    home?: Vector2;
    firedAt?: number;
    brokenAt?: number;
    hitAt?: number;
    beltOffset: number;
    changedAt?: number;
    /** A manual valve restart; boss-authored phase resets remain independent. */
    jetOpenedAt?: number;
    observedActive: boolean;
}
export class WorldLevel extends Level {
    bodies: MovingBody[] = [];
    constructor(data: LevelData) { super(structuredClone(data)); }
    override resolveCollision(rect: Rect, velocity: Vector2, previous: Rect = rect) {
        const result = super.resolveCollision(rect, velocity, previous);
        const bottom = previous.y + previous.height;
        let landing = Infinity;
        for (const body of this.bodies) {
            if (!['platform', 'lift', 'swing', 'support'].includes(body.kind))
                continue;
            const next = { ...rect, x: result.position.x, y: result.position.y };
            if (velocity.y >= 0 && bottom <= body.py + 3 && next.y + next.height >= body.y && next.x + next.width > body.x && next.x < body.x + body.width && body.y < landing) {
                landing = body.y;
                result.position.y = body.y - rect.height;
                result.velocity.y = 0;
                result.grounded = true;
            }
        }
        for (const body of this.bodies) {
            if (body.kind !== 'target' || body.active)
                continue;
            const next = { ...rect, x: result.position.x, y: result.position.y };
            if (!overlaps(next, body))
                continue;
            if (previous.y + previous.height <= body.y + 1 && velocity.y >= 0) {
                result.position.y = body.y - rect.height;
                result.velocity.y = 0;
                result.grounded = true;
            }
            else if (previous.x + previous.width <= body.x + 1 && velocity.x > 0) {
                result.position.x = body.x - rect.width;
                result.velocity.x = 0;
            }
            else if (previous.x >= body.x + body.width - 1 && velocity.x < 0) {
                result.position.x = body.x + body.width;
                result.velocity.x = 0;
            }
            else if (previous.y >= body.y + body.height - 1 && velocity.y < 0) {
                result.position.y = body.y + body.height;
                result.velocity.y = 0;
            }
        }
        return result;
    }
    resolveBarrel(rect: Rect, velocity: Vector2) { return super.resolveCollision(rect, velocity, rect); }
    transport(rect: Rect): Vector2 {
        const body = this.bodies.find(b => ['platform', 'lift', 'swing', 'support'].includes(b.kind) && Math.abs(rect.y + rect.height - b.py) < 3 && rect.x + rect.width > b.px && rect.x < b.px + b.width);
        if (!body)
            return { x: rect.x, y: rect.y };
        const moved = super.resolveCollision(rect, { x: body.x - body.px, y: body.y - body.py }, rect);
        return moved.position;
    }
    beltAt(rect: Rect): MovingBody | undefined { return this.bodies.find(b => b.kind === 'belt' && Math.abs(rect.y + rect.height - (b.y + b.height)) < 5 && rect.x + rect.width > b.x && rect.x < b.x + b.width); }
}
export interface Barrel extends Rect {
    vx: number;
    vy: number;
    life: number;
    pressurized: boolean;
    returned: boolean;
    boss: boolean;
    rotation: number;
    landedAt?: number;
    /** Presentation markers for launcher kegs only, on the simulation clock. */
    launchedAt?: number;
    landingPoint?: Vector2;
}
export class WorldObjects {
    bodies: MovingBody[];
    barrels: Barrel[] = [];
    time = 0;
    events: {
        kind: string;
        x: number;
        y: number;
    }[] = [];
    constructor(specs: MechanismSpec[]) { this.bodies = specs.map(s => ({ ...structuredClone(s), px: s.x, py: s.y, home:{x:s.x,y:s.y}, active: false, observedActive: false, beltOffset: 0, timer: s.kind === 'launcher' ? 1200 : 0 })); }
    get(id: string) { return this.bodies.find(b => b.id === id); }
    private recordChange(b: MovingBody) {
        if (b.active === b.observedActive) return;
        b.changedAt = this.time;
        b.observedActive = b.active;
    }
    activate(id: string): boolean {
        const button = this.get(id);
        if (!button || button.timer > 0)
            return false;
        button.timer = 400;
        button.active = !button.active;
        this.recordChange(button);
        const target = this.get(button.link ?? '');
        if (target) {
            target.active = !target.active;
            this.recordChange(target);
            if (target.kind === 'jet') target.jetOpenedAt = target.active ? undefined : this.time;
            this.events.push({ kind: 'switch', x: button.x, y: button.y });
        }
        return !!target;
    }
    pound(x: number, y: number): boolean {
        let activated = false;
        for (const b of this.bodies)
            if (b.kind === 'switch' && Math.abs(y - (b.y + b.height)) < 12 && x >= b.x - 8 && x <= b.x + b.width + 8)
                activated = this.activate(b.id) || activated;
        return activated;
    }
    spawnBarrel(x: number, y: number, direction = -1, pressurized = false, boss = false) { const barrel: Barrel = { x, y, width: 14, height: 16, vx: direction * 1.8, vy: 0, life: 13000, pressurized, returned: false, boss, rotation: 0 }; this.barrels.push(barrel); return barrel; }
    jetState(b: MovingBody): 'off' | 'warning' | 'active' {
        const cycle = jetCycle(b, this.time);
        return cycle.danger ? 'active' : cycle.phase === 'charging' ? 'warning' : 'off';
    }
    jetDanger(b: MovingBody): Rect | null { return jetCycle(b, this.time).danger; }
    update(dt: number, level: WorldLevel, playerX: number): void {
        const beforeTime = this.time;
        this.time += dt;
        this.events = [];
        for (const b of this.bodies) {
            b.px = b.x;
            b.py = b.y;
            this.recordChange(b);
            if (b.kind === 'belt')
                b.beltOffset += (b.direction ?? 1) * (b.active ? -1 : 1) * BELT_CARRY_SPEED * dt / (1000 / 60);
            if (b.kind === 'jet' && Math.abs(b.x - playerX) < 220) {
                const before = jetCycle(b, beforeTime), now = jetCycle(b, this.time);
                const reopened = !b.active && b.jetOpenedAt !== undefined && beforeTime <= b.jetOpenedAt && this.time > b.jetOpenedAt;
                if (now.phase === 'charging' && (before.phase !== 'charging' || reopened))
                    this.events.push({ kind: 'pressure', x: b.x + b.width / 2, y: b.y + b.height - 4 });
                if (now.danger && !before.danger)
                    this.events.push({ kind: 'jet', x: b.x + b.width / 2, y: b.y + b.height - 4 });
            }
            if (b.kind !== 'launcher' || Math.abs(b.x - playerX) < 480) {
                const before = b.timer;
                b.timer = Math.max(0, b.timer - dt);
                if (b.kind === 'launcher' && before > 650 && b.timer <= 650 && Math.abs(b.x - playerX) < 220)
                    this.events.push({kind:'warning',x:b.x,y:b.y});
            }
            if (b.to) {
                // Original coordinates stay immutable, even after a checkpoint rebuild.
                const home = (b as MovingBody & {
                    home?: Vector2;
                });
                home.home ??= { x: b.x, y: b.y };
                let targetX = home.home.x, targetY = home.home.y;
                if (b.kind === 'platform' || b.kind === 'swing' || (b.kind === 'lift' && !b.gated && !this.bodies.some(s => s.link === b.id))) {
                    const p = (1 - Math.cos(this.time / (b.period ?? 5000) * Math.PI * 2)) / 2;
                    targetX = home.home.x + (b.to.x - home.home.x) * p;
                    targetY = home.home.y + (b.to.y - home.home.y) * p;
                }
                else if (b.active) {
                    targetX = b.to.x;
                    targetY = b.to.y;
                }
                const max = dt * .055;
                b.x += Math.max(-max, Math.min(max, targetX - b.x));
                b.y += Math.max(-max, Math.min(max, targetY - b.y));
            }
            if (b.kind === 'launcher' && b.timer === 0 && Math.abs(b.x - playerX) < 480) {
                const muzzle = cannonMuzzle(b), direction = b.direction ?? -1;
                const keg = this.spawnBarrel(muzzle.x - (direction < 0 ? 14 : 0), muzzle.y - 8, direction, b.pressurized);
                keg.launchedAt = this.time;
                b.firedAt = this.time;
                if (Math.abs(b.x - playerX) < 220)
                    this.events.push({ kind: 'cannon', x: muzzle.x, y: muzzle.y });
                b.timer = b.period ?? 3200;
            }
        }
        level.bodies = this.bodies;
        for (const p of this.barrels) {
            p.life -= dt;
            const belt = this.bodies.find(b => b.kind === 'belt' && p.x + p.width > b.x && p.x < b.x + b.width && Math.abs(p.y + p.height - (b.y + b.height)) < 6);
            if (belt) {
                const dir = (belt.direction ?? 1) * (belt.active ? -1 : 1);
                p.vx = dir * 2.1;
                if (dir > 0)
                    p.returned = true;
            }
            p.vy = Math.min(8, p.vy + .35);
            const result = level.resolveBarrel(p, { x: p.vx, y: p.vy });
            if (result.grounded && p.vy > 2) {
                p.landedAt = this.time;
                if (p.launchedAt !== undefined)
                    p.landingPoint = { x: result.position.x + p.width / 2, y: result.position.y + p.height };
                if (Math.abs(p.x - playerX) < 220)
                    this.events.push({ kind: 'barrelLand', x: p.x + p.width / 2, y: result.position.y + p.height });
            }
            if (result.velocity.x === 0 && p.vx !== 0) {
                p.life = 0;
                if (Math.abs(p.x - playerX) < 220)
                    this.events.push({ kind: 'barrelBreak', x: p.x + p.width / 2, y: p.y + p.height / 2 });
            }
            p.rotation += (result.position.x - p.x) / 8;
            p.x = result.position.x;
            p.y = result.position.y;
            p.vy = result.velocity.y;
            for (const target of this.bodies)
                if (target.kind === 'target' && !target.active && overlaps(p, target)) {
                    p.life = 0;
                    target.hitAt = this.time;
                    if (!target.pressurized || p.pressurized) {
                        target.active = true;
                        target.brokenAt = this.time;
                        this.events.push({ kind: 'break', x: target.x, y: target.y });
                    } else this.events.push({ kind: 'hit', x: target.x, y: target.y });
                }
            if (p.y > level.data.height * 16 || Math.abs(p.x - playerX) > 900)
                p.life = 0;
        }
        this.barrels = this.barrels.filter(p => p.life > 0);
    }
}
