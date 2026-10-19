import { dinosaurFootAnchor, riderBend, smoothMotion } from './HypotheticalMotion';
import { devastationAt, DEVASTATION } from './HypotheticalDevastation';
import { bystanderIntersection } from './HypotheticalBystanderMotion';
import { gunRecoil, type GunImpact } from './HypotheticalGunfire';

/** All positions are native pixels, relative to the distant street's baseline. */
export const BACKDROP_RIG = { width: 192, height: 160, scale: .6875, x: 92, y: 148 } as const;
/** The rear street has vertical parallax, so high foreground jumps do not hide its action. */
export const backdropBaseline=(cameraY:number)=>152+(64-cameraY)*.22;
export type BystanderClothes = 'workcoat' | 'star-shirt' | 'scarf' | 'satchel';
export interface Bystander {
    x:number; shelter:number; escaped:boolean; fleeing:boolean; hitAt:number|null; color:number;
    distance:number; velocity:number; alertAt:number; speed:number; district:number; clothes:BystanderClothes;
    stoppedAt:number|null; threatenedAt:number|null; startledAt:number|null;
    originX:number; reactionTimes:number[];
}
export interface DistantShot { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number; age:number }
export interface DistantImpact extends GunImpact {}

/** Background action has its own geometry; its bullets never enter Feka's collision layer. */
export class HypotheticalBackdrop {
    x = -80; tick = 0; muzzle = 0; heat = 0; targetX = 100; targetY = -7;
    shots: DistantShot[] = []; impacts: DistantImpact[] = [];
    casings:Array<{x:number;y:number;born:number}>=[];
    events: ('distant-shot' | 'distant-hit' | 'break')[] = [];
    breaches=[-1,-1,-1]; travel=0; velocity=0;
    footfalls:Array<{x:number;born:number}>=[];
    readonly people: Bystander[];
    constructor(readonly wide = false) {
        const clothes:BystanderClothes[]=['workcoat','star-shirt','star-shirt','scarf','satchel','star-shirt','star-shirt','workcoat'];
        this.people = [224, 262, 224, 262, 224, 262, 94, 118].map((x, i) => {
            x += wide ? Math.min(2, Math.floor(i / 2)) * 416 : 0;
            return { x, shelter: i < 6 ? x + 22 : (wide ? 1280 : 320) + 12 + i * 4,
                escaped: false, fleeing: i >= 6, hitAt: null, color: i % 4,distance:0,velocity:0,
                district:Math.min(2,Math.floor(i/2)),clothes:clothes[i],stoppedAt:null,threatenedAt:null,startledAt:null,
                originX:x,reactionTimes:[],
                alertAt:i<6?Math.floor(i/2)*400+38+i%2*8:650+(i-6)*12,speed:i<6?.5:(i===6?.82:.94) };
        });
    }
    private target = -1;
    get aimedPerson(){return this.people[this.target]??null;}
    get casualties() { return this.people.filter(p => p.hitAt !== null).length; }
    get motion(){return devastationAt(this.tick);}
    get stride(){return Math.min(1,Math.abs(this.velocity)/1.2);}
    get recoil() { return gunRecoil(this.muzzle); }
    get shoulder() {
        const m=this.motion,s=BACKDROP_RIG.scale;
        return {x:this.x+(7-this.recoil+m.tuck*10+riderBend(14,m.riderLean))*s,
            y:m.lift+(-78+m.compression+m.riderDrop)*s};
    }
    get angle() {
        const s = this.shoulder, local = this.tick % 400;
        const start = local >= 146 ? 146 : 90, age = local - start;
        const weight = this.tick >= 1200 || this.target < 0 || age < 0 || age > 50 ? 0
            : age < 20 ? smoothMotion(age / 20) : age <= 36 ? 1 : 1 - smoothMotion((age - 36) / 14);
        return -.12 + (Math.atan2(this.targetY - s.y, Math.max(1, this.targetX - s.x)) + .12) * weight;
    }
    get barrel() { const s = this.shoulder, a = this.angle; return { x: s.x + Math.cos(a) * 31 * BACKDROP_RIG.scale, y: s.y + Math.sin(a) * 31 * BACKDROP_RIG.scale }; }
    cancel() { this.shots = []; this.muzzle = 0; this.events = []; }
    update(tick: number) {
        this.tick = tick; this.events = [];
        const oldX=this.x,oldTravel=this.travel,m=this.motion;
        this.x=m.x;this.velocity=this.x-oldX;this.travel+=Math.abs(this.velocity);
        if(m.local===DEVASTATION.impact&&this.breaches[m.district]<0){
            this.breaches[m.district]=tick;this.events.push('break');
        }
        this.footfalls=this.footfalls.filter(p=>tick-p.born<28);
        const pace=Math.PI*11*BACKDROP_RIG.scale;
        if(Math.floor(this.travel/pace)>Math.floor(oldTravel/pace)&&m.lift===0){
            const foot=dinosaurFootAnchor(this.travel/(BACKDROP_RIG.scale*11),Math.floor(this.travel/pace)%2===1,this.stride,m.tuck,m.brace);
            this.footfalls.push({x:this.x+(foot[0]+3)*BACKDROP_RIG.scale,born:tick});
        }
        this.muzzle = Math.max(0, this.muzzle - 1); this.heat = Math.max(0, this.heat - .006);
        this.impacts = this.impacts.filter(p => tick - p.born < 80);
        this.casings = this.casings.filter(p => tick - p.born < 64);
        for (const p of this.people) {
            p.velocity=0;
            p.reactionTimes=p.reactionTimes.filter(at=>tick-at<32);
            if(p.hitAt!==null||p.escaped||tick<=p.alertAt+6)continue;
            const old=p.x,age=tick-p.alertAt-6;
            p.x=p.fleeing?Math.min(p.shelter,p.x+p.speed*smoothMotion(age/14))
                :p.originX+(p.shelter-p.originX)*smoothMotion(age/68);
            p.velocity=p.x-old;p.distance+=p.velocity;
            if(p.x===p.shelter&&p.stoppedAt===null)p.stoppedAt=tick;
            if (p.fleeing && p.x > (this.wide ? 1286 : 326)) p.escaped = true;
        }
        for (const s of this.shots) {
            s.px = s.x; s.py = s.y; s.x += s.vx; s.y += s.vy; s.life--;s.age++;
            const contact = this.people.map(p=>({p,at:bystanderIntersection(p,tick,s)}))
                .filter(v=>v.at!==null).sort((a,b)=>a.at!-b.at!)[0];
            const person=contact?.p;
            if (person || s.y >= -1) {
                if (person) person.hitAt = tick;
                const t=contact?.at??Math.max(0,Math.min(1,(-1-s.py)/s.vy));
                this.impacts.push({ x:s.px+s.vx*t,y:s.py+s.vy*t,born:tick,nx:person?-1:0,ny:person?0:-1,
                    fromX:s.px,fromY:s.py,material:person?'cloth':'stone' });
                if (this.impacts.length > 18) this.impacts.shift();
                this.events.push('distant-hit'); s.life = 0;
            }
        }
        this.shots = this.shots.filter(s => s.life > 0 && s.x < (this.wide ? 1310 : 350));
        const pass = Math.floor(tick / 400), local = tick % 400;
        // The fictional villain prefers the red-star shirts within the current group.
        // Each burst commits to an escape destination after a visible shoulder/aim tell.
        if (pass < 3 && (local === 90 || local === 146)) {
            const barrel = this.barrel;
            const available = this.people.map((p, i) => ({ p, i })).filter(({ p }) =>
                !p.fleeing && !p.escaped && p.district===pass && p.hitAt === null && p.x > barrel.x + 18);
            available.sort((a, b) => Number(b.p.clothes==='star-shirt')-Number(a.p.clothes==='star-shirt')||a.p.x-b.p.x);
            this.target = available[0]?.i ?? -1;
            if (this.target >= 0){
                const p=this.people[this.target];this.targetX=p.shelter;this.targetY=-7;p.threatenedAt=tick;
            }
        }
        if (pass < 3 && this.target >= 0 && [110, 118, 126, 166, 174, 182].includes(local)) {
            this.muzzle = 5; this.heat = Math.min(1, this.heat + .23);
            const m = this.barrel, a = this.angle;
            this.shots.push({ x: m.x, y: m.y, px: m.x, py: m.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, life: 70,age:0 });
            const shoulder=this.shoulder,scale=BACKDROP_RIG.scale;
            this.casings.push({x:shoulder.x+(Math.cos(a)*9+Math.sin(a)*2)*scale,
                y:shoulder.y+(Math.sin(a)*9-Math.cos(a)*2)*scale,born:tick});
            this.events.push('distant-shot');
            for(const p of this.people)if(!p.escaped&&p.hitAt===null&&p.district===pass){
                p.startledAt=tick;p.reactionTimes.push(tick+2+p.color%3);
            }
        }
    }
}
