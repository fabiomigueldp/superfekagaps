import { smoothMotion } from './HypotheticalMotion';

/** All positions are native pixels, relative to the distant street's baseline. */
export const BACKDROP_RIG = { width: 192, height: 128, scale: .6875, x: 92, y: 122 } as const;
export interface Bystander { x: number; shelter: number; escaped: boolean; fleeing: boolean; hitAt: number | null; color: number }
export interface DistantShot { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number }
export interface DistantImpact { x: number; y: number; born: number }

/** Background action has its own geometry; its bullets never enter Feka's collision layer. */
export class HypotheticalBackdrop {
    x = -80; tick = 0; muzzle = 0; heat = 0; targetX = 100; targetY = -8;
    shots: DistantShot[] = []; impacts: DistantImpact[] = [];
    events: ('distant-shot' | 'distant-hit')[] = [];
    readonly people: Bystander[];
    constructor(readonly wide = false) {
        this.people = [78, 144, 105, 208, 169, 259, 225, 288].map((x, i) => {
            x += wide ? Math.min(2, Math.floor(i / 2)) * 416 : 0;
            return { x, shelter: i < 6 ? x + 22 : (wide ? 1280 : 320) + 12 + i * 4,
                escaped: false, fleeing: i >= 6, hitAt: null, color: i % 4 };
        });
    }
    private target = -1;
    get casualties() { return this.people.filter(p => p.hitAt !== null).length; }
    get recoil() { return 3.5 * smoothMotion(this.muzzle / 5); }
    get shoulder() { return { x: this.x + (7 - this.recoil) * BACKDROP_RIG.scale, y: -78 * BACKDROP_RIG.scale }; }
    get angle() {
        const s = this.shoulder, local = this.tick % 400;
        const start = local >= 154 ? 154 : 98, age = local - start;
        const weight = this.tick >= 1200 || this.target < 0 || age < 0 || age > 40 ? 0
            : age < 12 ? smoothMotion(age / 12) : age <= 28 ? 1 : 1 - smoothMotion((age - 28) / 12);
        return -.12 + (Math.atan2(this.targetY - s.y, Math.max(1, this.targetX - s.x)) + .12) * weight;
    }
    get barrel() { const s = this.shoulder, a = this.angle; return { x: s.x + Math.cos(a) * 31 * BACKDROP_RIG.scale, y: s.y + Math.sin(a) * 31 * BACKDROP_RIG.scale }; }
    cancel() { this.shots = []; this.muzzle = 0; this.events = []; }
    update(tick: number) {
        this.tick = tick; this.events = [];
        this.x = -80 + (this.wide ? tick * 1.04 : (tick % 400) * 1.25);
        this.muzzle = Math.max(0, this.muzzle - 1); this.heat = Math.max(0, this.heat - .006);
        this.impacts = this.impacts.filter(p => tick - p.born < 28);
        for (const p of this.people) if (p.hitAt === null && !p.escaped && tick > 50) {
            p.x = Math.min(p.shelter, p.x + (p.fleeing ? .48 : .3));
            if (p.fleeing && p.x > (this.wide ? 1286 : 326)) p.escaped = true;
        }
        for (const s of this.shots) {
            s.px = s.x; s.py = s.y; s.x += s.vx; s.y += s.vy; s.life--;
            const person = this.people.find(p => !p.escaped && p.hitAt === null &&
                Math.min(s.px, s.x) <= p.x + 4 && Math.max(s.px, s.x) >= p.x - 4 &&
                Math.max(s.py, s.y) >= -13 && Math.min(s.py, s.y) <= -2);
            if (person || s.y >= -1) {
                if (person) person.hitAt = tick;
                this.impacts.push({ x: person?.x ?? s.x, y: person ? -8 : -1, born: tick });
                if (this.impacts.length > 18) this.impacts.shift();
                this.events.push('distant-hit'); s.life = 0;
            }
        }
        this.shots = this.shots.filter(s => s.life > 0 && s.x < (this.wide ? 1310 : 350));
        const pass = Math.floor(tick / 400), local = tick % 400;
        // Two short, visible attacks per crossing. Survivors flee through the far gate.
        if (pass < 3 && (local === 98 || local === 154)) {
            const barrel = this.barrel;
            const available = this.people.map((p, i) => ({ p, i })).filter(({ p }) =>
                !p.fleeing && p.hitAt === null && p.x > barrel.x + 18);
            available.sort((a, b) => a.p.x - b.p.x);
            this.target = available[0]?.i ?? -1;
            if (this.target >= 0) this.targetX = this.people[this.target].x;
        }
        if (pass < 3 && this.target >= 0 && [110, 118, 126, 166, 174, 182].includes(local)) {
            this.muzzle = 5; this.heat = Math.min(1, this.heat + .23);
            const m = this.barrel, a = this.angle;
            this.shots.push({ x: m.x, y: m.y, px: m.x, py: m.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, life: 70 });
            this.events.push('distant-shot');
        }
    }
}
