import type { JuiceDrop, JuiceDropImpact, JuiceGeyser, JuiceMinibossModel } from './JuiceMinibossModel';
import { drawFluidGeyser, drawFluidImpact, drawFluidProjectile, drawFluidWallImpact, fluidOval, fluidPuddle,
    fluidRibbon, JUICE, liquidChamberFlight, wallSplashMs } from './JuiceFluid';

type EffectKind = 'landing' | 'hit' | 'spit' | 'drip' | 'defeat' | 'geyser' | 'drop' | 'wall';
interface Effect {
    kind: EffectKind; x: number; y: number; at: number; facing: number;
    geyser?: JuiceGeyser; drop?: JuiceDrop; duration?: number;
    impulse?: { vx: number; vy: number };
}
const LIFE: Record<EffectKind, number> = { landing: 1450, hit: 310, spit: 200, drip: 1100, defeat: 1600,
    geyser: 460, drop: 0, wall: 0 };

/** Bounded cosmetic pool, sampled analytically from the boss's simulation clock. */
export class JuiceCombatEffects {
    private bursts: Effect[] = [];
    get size() { return this.bursts.length; }
    private push(effect: Effect) {
        this.bursts.push(effect);
        if (this.bursts.length > 24) {
            // Prefer retiring a floor deposit to cutting off a falling mass.
            const deposit = this.bursts.findIndex(e => e.kind === 'drip' || e.kind === 'hit');
            this.bursts.splice(Math.max(0, deposit), 1);
        }
    }
    add(kind: Exclude<EffectKind, 'geyser' | 'drop' | 'wall'>, x: number, y: number, at: number, facing = 1,
        impulse?: { vx: number; vy: number }) {
        this.push({ kind, x, y, at, facing, impulse });
    }
    impact(drop: JuiceDropImpact, floor: number) {
        this.push({ kind: drop.side ? 'wall' : 'drip', x: drop.x, y: drop.y, at: drop.at,
            facing: drop.side, impulse: { vx: drop.vx, vy: drop.vy },
            duration: drop.side ? wallSplashMs(drop.y, floor) : LIFE.drip });
    }
    /** A stomp stops damage instantly, while the liquid keeps its position and momentum. */
    releaseDrops(drops: readonly JuiceDrop[], b: JuiceMinibossModel) {
        for (const drop of drops) {
            const flight = liquidChamberFlight(drop.x + drop.width / 2, drop.y + drop.height / 2,
                drop.vx * 1000, drop.vy * 1000, drop.width / 2, b.fluidBounds, Infinity);
            this.push({ kind: 'drop', x: drop.x, y: drop.y, at: b.time, facing: 1,
                drop: { ...drop, birth: drop.birth ? { ...drop.birth } : undefined },
                duration: flight.hitTime * 1000 + (flight.side ? wallSplashMs(flight.y, b.arena.floor) : LIFE.drip) });
        }
    }
    /** Combat clears the hazards instantly; their harmless liquid finishes falling. */
    releaseGeysers(geysers: readonly JuiceGeyser[], at: number) {
        for (const g of geysers) if (g.phase !== 'warning') {
            const geyser: JuiceGeyser = { ...g, phase: 'recede',
                releaseTime: g.phase === 'active' ? g.phaseTime : g.releaseTime,
                phaseTime: g.phase === 'active' ? 0 : g.phaseTime };
            this.push({ kind: 'geyser', x: g.x, y: g.y, at, facing: 1, geyser });
        }
    }
    advance(time: number) {
        this.bursts = this.bursts.filter(e => time - e.at + (e.geyser?.phaseTime ?? 0) < (e.duration ?? LIFE[e.kind]));
    }
    draw(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number, reducedMotion: boolean) {
        if (reducedMotion && !this.bursts.some(e => e.kind === 'drop')) return;
        c.save();
        for (const e of this.bursts) {
            if (reducedMotion && e.kind !== 'drop') continue;
            const elapsed = Math.max(0, b.time - e.at), duration = e.duration ?? LIFE[e.kind];
            const age = elapsed / duration;
            if (age >= 1) continue;
            c.globalAlpha = 1;
            const x = e.x - cx, y = e.y - cy;
            if (e.kind === 'drop') {
                if (!e.drop) continue;
                const d = e.drop, radius = d.width / 2;
                const flight = liquidChamberFlight(d.x + radius, d.y + d.height / 2,
                    d.vx * 1000, d.vy * 1000, radius, b.fluidBounds, elapsed / 1000);
                if (!flight.landed) {
                    drawFluidProjectile(c, { ...d, x: flight.x - radius, y: flight.y - d.height / 2,
                        vx: flight.vx / 1000, vy: flight.vy / 1000, life: -1 }, b.time, cx, cy, reducedMotion);
                } else if (reducedMotion && !flight.side) {
                    c.globalAlpha = Math.max(0, 1 - flight.sinceHit / .65);
                    fluidPuddle(c, flight.x - cx, b.arena.floor - cy, 5, 1, e.at, true);
                } else if (flight.side) {
                    drawFluidWallImpact(c, (flight.side < 0 ? b.fluidBounds.left : b.fluidBounds.right) - cx,
                        flight.y - cy, b.arena.floor - cy, flight.sinceHit * 1000, flight.side, e.at, reducedMotion);
                } else {
                    drawFluidImpact(c, flight.x - cx, b.arena.floor - cy, flight.sinceHit * 1000,
                        'small', e.at, LIFE.drip, { vx: flight.vx, vy: flight.vy });
                }
            } else if (e.kind === 'wall') {
                drawFluidWallImpact(c, x, y, b.arena.floor - cy, elapsed, e.facing < 0 ? -1 : 1, e.at);
            } else if (e.kind === 'geyser') {
                if (e.geyser) drawFluidGeyser(c, { ...e.geyser, phaseTime: e.geyser.phaseTime + b.time - e.at }, cx, cy, false);
            } else if (e.kind === 'hit') {
                const r = 3 + age * 15;
                c.globalAlpha = (1 - age) ** 2; c.strokeStyle = '#fff1ce'; c.lineWidth = 1;
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3 - .4;
                    c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
                    c.lineTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); c.stroke();
                }
            } else if (e.kind === 'spit') {
                const pulse = Math.sin(age * Math.PI), speed = Math.hypot(e.impulse?.vx ?? e.facing, e.impulse?.vy ?? 0) || 1;
                const dx = (e.impulse?.vx ?? e.facing) / speed, dy = (e.impulse?.vy ?? 0) / speed;
                fluidRibbon(c, x, y, x + dx * (4 + pulse * 8), y + dy * (4 + pulse * 8), pulse * 2.2, pulse);
                fluidOval(c, x, y + 1, pulse * 3, pulse * 1.6, JUICE.body);
            } else {
                c.globalAlpha = 1;
                drawFluidImpact(c, x, y, b.time - e.at, e.kind === 'drip' ? 'small' : e.kind,
                    e.x * .37 + e.at * .003, duration, e.impulse);
            }
        }
        c.restore();
    }
}
