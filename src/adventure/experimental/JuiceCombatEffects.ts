import type { JuiceMinibossModel } from './JuiceMinibossModel';

type EffectKind = 'landing' | 'hit' | 'spit' | 'drip' | 'defeat';
interface Effect { kind: EffectKind; x: number; y: number; at: number; facing: number; }
const LIFE: Record<EffectKind, number> = { landing: 420, hit: 310, spit: 180, drip: 360, defeat: 850 };

/** Bounded cosmetic pool, sampled analytically from the boss's simulation clock. */
export class JuiceCombatEffects {
    private bursts: Effect[] = [];
    get size() { return this.bursts.length; }
    add(kind: EffectKind, x: number, y: number, at: number, facing = 1) {
        this.bursts.push({ kind, x, y, at, facing });
        if (this.bursts.length > 24) this.bursts.splice(0, this.bursts.length - 24);
    }
    advance(time: number) { this.bursts = this.bursts.filter(e => time - e.at < LIFE[e.kind]); }
    draw(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number, reducedMotion: boolean) {
        if (reducedMotion) return;
        c.save();
        for (const e of this.bursts) {
            const age = Math.max(0, (b.time - e.at) / LIFE[e.kind]);
            if (age >= 1) continue;
            const x = e.x - cx, y = e.y - cy;
            if (e.kind === 'hit') {
                const r = 3 + age * 15;
                c.globalAlpha = (1 - age) ** 2; c.strokeStyle = '#fff1ce'; c.lineWidth = 1;
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3 - .4;
                    c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
                    c.lineTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); c.stroke();
                }
            } else if (e.kind === 'spit') {
                c.globalAlpha = .7 * (1 - age); c.strokeStyle = '#ed99f1'; c.lineWidth = 1.5;
                c.beginPath(); c.ellipse(x + e.facing * (4 + age * 9), y, 2 + age * 3, 4 + age * 7, 0, -Math.PI / 2, Math.PI / 2, e.facing < 0); c.stroke();
            } else {
                const small = e.kind === 'drip', defeat = e.kind === 'defeat', spread = small ? 9 : defeat ? 45 : 30;
                c.globalAlpha = (1 - age) * (small ? .6 : .65); c.strokeStyle = '#bf6cdd'; c.lineWidth = small ? 1 : 1.5;
                c.beginPath(); c.ellipse(x, y - 1, 3 + age * spread, 1 + age * (small ? 1 : 4), 0, 0, Math.PI * 2); c.stroke();
                const count = small ? 3 : defeat ? 10 : 6;
                for (let i = 0; i < count; i++) {
                    const direction = i % 2 ? 1 : -1;
                    const px = x + direction * (3 + age * (spread * .5 + i * 2));
                    const py = y - Math.sin(age * Math.PI) * (small ? 4 + i : 9 + i % 4 * 4);
                    c.fillStyle = i % 3 ? '#bc64d8' : '#f0b7f5';
                    const size = small ? 1 : i % 3 === 0 ? 2 : 1.5;
                    c.fillRect(Math.round(px), Math.round(py), size, size + .5);
                }
            }
        }
        c.restore();
    }
}
