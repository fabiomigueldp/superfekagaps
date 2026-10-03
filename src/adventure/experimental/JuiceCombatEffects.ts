import type { JuiceGeyser, JuiceMinibossModel } from './JuiceMinibossModel';
import { drawFluidGeyser, drawFluidImpact, fluidDrop } from './JuiceFluid';

type EffectKind = 'landing' | 'hit' | 'spit' | 'drip' | 'defeat' | 'geyser';
interface Effect { kind: EffectKind; x: number; y: number; at: number; facing: number; geyser?: JuiceGeyser; }
const LIFE: Record<EffectKind, number> = { landing: 720, hit: 310, spit: 200, drip: 480, defeat: 950, geyser: 460 };

/** Bounded cosmetic pool, sampled analytically from the boss's simulation clock. */
export class JuiceCombatEffects {
    private bursts: Effect[] = [];
    get size() { return this.bursts.length; }
    private push(effect: Effect) {
        this.bursts.push(effect);
        if (this.bursts.length > 24) this.bursts.splice(0, this.bursts.length - 24);
    }
    add(kind: Exclude<EffectKind, 'geyser'>, x: number, y: number, at: number, facing = 1) {
        this.push({ kind, x, y, at, facing });
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
    advance(time: number) { this.bursts = this.bursts.filter(e => time - e.at + (e.geyser?.phaseTime ?? 0) < LIFE[e.kind]); }
    draw(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number, reducedMotion: boolean) {
        if (reducedMotion) return;
        c.save();
        for (const e of this.bursts) {
            const age = Math.max(0, (b.time - e.at) / LIFE[e.kind]);
            if (age >= 1) continue;
            c.globalAlpha = 1;
            const x = e.x - cx, y = e.y - cy;
            if (e.kind === 'geyser') {
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
                c.globalAlpha = 1 - age;
                for (let i = 0; i < 3; i++) fluidDrop(c, x + e.facing * (5 + age * (9 + i * 3)),
                    y + (i - 1) * (2 + age * 6), 1.5 - age * .6, e.facing * 90, (i - 1) * 30, true);
            } else {
                c.globalAlpha = 1;
                drawFluidImpact(c, x, y, b.time - e.at, e.kind === 'drip' ? 'small' : e.kind,
                    e.x * .37 + e.at * .003, LIFE[e.kind]);
            }
        }
        c.restore();
    }
}
