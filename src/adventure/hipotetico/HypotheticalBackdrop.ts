import { dinosaurFootAnchor, riderBend, smoothMotion } from './HypotheticalMotion';
import { devastationAt,DESTRUCTION_SITES,SCENIC_STARTS,SCENIC_END } from './HypotheticalDevastation';
import {SIEGE_SECTORS,SIEGE_WIDTH} from './HypotheticalSiege';
import { bystanderIntersection } from './HypotheticalBystanderMotion';
import { gunRecoil, type GunImpact } from './HypotheticalGunfire';
import {OPENING} from './HypotheticalOpening';
import {scenicLandingCues} from './HypotheticalScenicMotion';
import {HypotheticalAftermath} from './HypotheticalAftermath';
import {AFTERMATH_SCALE} from './HypotheticalAftermathHandling';
import {HypotheticalHelicopter} from './HypotheticalHelicopter';
import {arrivalBeat} from './HypotheticalHelicopterTiming';

/** All positions are native pixels, relative to the distant street's baseline. */
export const BACKDROP_RIG = { width: 192, height: 160, scale: AFTERMATH_SCALE, x: 92, y: 148 } as const;
/** The rear street has vertical parallax, so high foreground jumps do not hide its action. */
export const backdropBaseline=(cameraY:number)=>116+(64-cameraY)*.22;
export type BystanderClothes = 'workcoat' | 'star-shirt' | 'scarf' | 'satchel';
export interface Bystander {
    x:number; shelter:number; escaped:boolean; fleeing:boolean; hitAt:number|null; color:number;
    distance:number; velocity:number; alertAt:number; speed:number; district:number; clothes:BystanderClothes;
    stoppedAt:number|null; threatenedAt:number|null; startledAt:number|null;
    originX:number; reactionTimes:number[];
    appearance?:number; depth?:number; exitAtShelter?:boolean; runTicks?:number;
    belonging?:'parcel'|'papers';
    opening?:boolean;capturedAt?:number;captureX?:number;
}
export interface DistantShot { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number; age:number }
export interface DistantImpact extends GunImpact {}
export interface BloodContact {x:number;y:number;born:number;direction:number;actor:number;floor:number}

/** Background action has its own geometry; its bullets never enter Feka's collision layer. */
export class HypotheticalBackdrop {
    x = -80; tick = 0; muzzle = 0; heat = 0; targetX = 100; targetY = -7;
    shots: DistantShot[] = []; impacts: DistantImpact[] = [];
    casings:Array<{x:number;y:number;born:number}>=[];
    events: ('distant-shot' | 'distant-hit' | 'distant-debris' | 'distant-thud' | 'break')[] = [];
    breaches:number[]=DESTRUCTION_SITES.map(()=>-1); travel=0; velocity=0;
    blood:BloodContact[]=[];
    footfalls:Array<{x:number;born:number}>=[];
    readonly people: Bystander[];
    readonly aftermath = new HypotheticalAftermath();
    readonly helicopter = new HypotheticalHelicopter();
    get displayX(){return this.aftermath.active?this.aftermath.x:this.x;}
    constructor(readonly wide = false) {
        const clothes:BystanderClothes[]=['workcoat','star-shirt','star-shirt','scarf','satchel','star-shirt','star-shirt','workcoat'];
        this.people = [224, 262, 224, 262, 224, 262, 94, 118].map((x, i) => {
            const district=Math.min(2,Math.floor(i/2));
            x += wide ? SIEGE_SECTORS[district].origin : 0;
            return { x, shelter: i < 6 ? x + 22 : (wide ? SIEGE_WIDTH : 320) + 12 + i * 4,
                escaped: false, fleeing: i >= 6, hitAt: null, color: i % 4,distance:0,velocity:0,
                district:Math.min(2,Math.floor(i/2)),clothes:clothes[i],stoppedAt:null,threatenedAt:null,startledAt:null,
                originX:x,reactionTimes:[],
                alertAt:i<6?SCENIC_STARTS[district]+38+i%2*8:arrivalBeat(1050+(i-6)*12),speed:i<6?.5:(i===6?.82:.94) };
        });
        // A courtyard crowd has two real exits, staggered reactions and distinct silhouettes.
        // These runners share the same shot geometry as the rest of the street.
        const crowd=[
            {x:154,shelter:116,alertAt:30,runTicks:68,clothes:'workcoat',belonging:'parcel'},
            {x:188,shelter:116,alertAt:40,runTicks:70,clothes:'star-shirt',belonging:'papers'},
            {x:206,shelter:322,alertAt:48,runTicks:140,clothes:'scarf'},
            {x:238,shelter:322,alertAt:58,runTicks:112,clothes:'star-shirt'},
            {x:286,shelter:322,alertAt:34,runTicks:64,clothes:'satchel'},
            {x:305,shelter:322,alertAt:70,runTicks:56,clothes:'star-shirt'},
        ] as const;
        for(const [i,p] of crowd.entries())this.people.push({...p,belonging:'belonging' in p?p.belonging:undefined,
            originX:p.x,escaped:false,fleeing:true,hitAt:null,color:(i+1)%4,distance:0,velocity:0,speed:1,
            district:0,stoppedAt:null,threatenedAt:null,startledAt:null,reactionTimes:[],
            appearance:i+1,depth:i%2?-2:-4,exitAtShelter:true});
        const plaza=[
            {x:344,shelter:378,alertAt:412,runTicks:68,clothes:'workcoat'},
            {x:368,shelter:378,alertAt:424,runTicks:50,clothes:'star-shirt'},
            {x:396,shelter:378,alertAt:418,runTicks:64,clothes:'scarf'},
            {x:414,shelter:548,alertAt:410,runTicks:150,clothes:'star-shirt'},
            {x:438,shelter:460,alertAt:410,runTicks:68,clothes:'star-shirt',exposed:true},
            {x:474,shelter:496,alertAt:418,runTicks:68,clothes:'star-shirt',exposed:true},
            {x:492,shelter:548,alertAt:414,runTicks:94,clothes:'satchel'},
            {x:514,shelter:548,alertAt:438,runTicks:70,clothes:'workcoat'},
        ] as const;
        for(const [i,p] of plaza.entries()){
            const exposed='exposed' in p;
            this.people.push({...p,alertAt:arrivalBeat(p.alertAt),originX:p.x,escaped:false,fleeing:!exposed,hitAt:null,color:i%4,distance:0,velocity:0,
                speed:1,district:0,stoppedAt:null,threatenedAt:null,startledAt:null,reactionTimes:[],
                appearance:7+i,depth:exposed?0:i%2?-2:-4,exitAtShelter:!exposed,belonging:i===2?'papers':i===7?'parcel':undefined});
        }
        this.people.push({x:170,originX:170,shelter:180,escaped:false,fleeing:true,hitAt:null,color:1,
            distance:0,velocity:0,alertAt:OPENING.notice,speed:.22,district:0,clothes:'star-shirt',
            stoppedAt:null,threatenedAt:null,startledAt:null,reactionTimes:[],appearance:17,depth:0,
            belonging:'papers',opening:true});
        if(wide)for(let i=0;i<4;i++){
            const x=SIEGE_SECTORS[3].origin+220+i*24;
            this.people.push({x,originX:x,shelter:i<2?x+22:SIEGE_SECTORS[3].origin+354,
                escaped:false,fleeing:i>=2,hitAt:null,color:i,distance:0,velocity:0,
                alertAt:SCENIC_STARTS[3]+38+i*9,speed:.9,district:3,
                clothes:i%2?'workcoat':'star-shirt',stoppedAt:null,threatenedAt:null,startledAt:null,
                reactionTimes:[],appearance:10+i,exitAtShelter:i>=2,runTicks:86+i*12});
        }
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
        const s = this.shoulder,{local,district} = this.motion,plaza=district===0&&local>=404;
        const start = plaza?(local>=444?444:404):local >= 146 ? 146 : 90, age = local - start,hold=36;
        const weight = this.tick >= SCENIC_END || this.target < 0 || age < 0 || age > hold+14 ? 0
            : age < 20 ? smoothMotion(age / 20) : age <= hold ? 1 : 1 - smoothMotion((age - hold) / 14);
        return -.12 + (Math.atan2(this.targetY - s.y, Math.max(1, this.targetX - s.x)) + .12) * weight;
    }
    get barrel() { const s = this.shoulder, a = this.angle; return { x: s.x + Math.cos(a) * 31 * BACKDROP_RIG.scale, y: s.y + Math.sin(a) * 31 * BACKDROP_RIG.scale }; }
    cancel() { this.shots = []; this.muzzle = 0; this.events = []; }
    update(tick: number) {
        this.tick = tick; this.events = [];
        const oldX=this.x,oldTravel=this.travel,m=this.motion;
        this.x=m.x;this.velocity=this.x-oldX;this.travel+=Math.abs(this.velocity);
        this.helicopter.update(tick,this.x);
        if(m.local===m.impactTick&&this.breaches[m.siteIndex]<0){
            this.breaches[m.siteIndex]=tick;this.events.push('break');
        }
        // Quieter secondary sounds belong to actual wall/roof/cargo landings.
        const brokenAt=this.breaches[m.siteIndex];
        if(brokenAt>=0&&scenicLandingCues(m.siteIndex).includes(tick-brokenAt))this.events.push('distant-debris');
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
            if(p.capturedAt!==undefined){
                if(tick<=OPENING.occluded){
                    const old=p.x,u=smoothMotion((tick-p.capturedAt)/(OPENING.occluded-OPENING.clamp));
                    p.x=p.captureX!+(m.x+48*BACKDROP_RIG.scale-p.captureX!)*u;p.depth=-6*u;
                    p.velocity=p.x-old;p.distance+=Math.abs(p.velocity);
                }
                continue;
            }
            if(p.hitAt!==null||p.escaped||tick<=p.alertAt+6)continue;
            const old=p.x,age=tick-p.alertAt-6;
            p.x=p.exitAtShelter?p.originX+(p.shelter-p.originX)*smoothMotion(age/p.runTicks!)
                :p.fleeing?Math.min(p.shelter,p.x+p.speed*smoothMotion(age/14))
                :p.originX+(p.shelter-p.originX)*smoothMotion(age/68);
            p.velocity=p.x-old;p.distance+=Math.abs(p.velocity);
            if(p.x===p.shelter&&p.stoppedAt===null)p.stoppedAt=tick;
            if (p.exitAtShelter?p.x===p.shelter:p.fleeing&&p.x>(this.wide?SIEGE_WIDTH+6:326))p.escaped=true;
        }
        if(tick===OPENING.clamp){
            const actor=this.people.find(p=>p.opening)!;actor.capturedAt=tick;actor.captureX=actor.x;
            this.events.push('distant-thud');
        }
        if(tick===OPENING.contact){
            this.events.push('distant-thud');
            for(const p of this.people)if(!p.opening&&p.district===0&&p.originX<336&&!p.escaped&&p.hitAt===null){
                p.reactionTimes.push(tick+3+p.color%3);p.startledAt=tick;
            }
        }
        for (const s of this.shots) {
            s.px = s.x; s.py = s.y; s.x += s.vx; s.y += s.vy; s.life--;s.age++;
            const contact = this.people.map(p=>({p,at:bystanderIntersection(p,tick,s)}))
                .filter(v=>v.at!==null).sort((a,b)=>a.at!-b.at!)[0];
            const person=contact?.p;
            if (person || s.y >= -1) {
                if (person) person.hitAt = tick;
                const t=contact?.at??Math.max(0,Math.min(1,(-1-s.py)/s.vy));
                if(person)this.blood.push({x:s.px+s.vx*t,y:s.py+s.vy*t,born:tick,direction:Math.sign(s.vx)||1,
                    actor:this.people.indexOf(person),floor:(person.depth??0)-1});
                this.impacts.push({ x:s.px+s.vx*t,y:s.py+s.vy*t,born:tick,nx:person?-1:0,ny:person?0:-1,
                    fromX:s.px,fromY:s.py,material:person?'cloth':'stone' });
                if (this.impacts.length > 18) this.impacts.shift();
                this.events.push('distant-hit'); s.life = 0;
            }
        }
        this.shots = this.shots.filter(s => s.life > 0 && s.x < (this.wide ? SIEGE_WIDTH+30 : 600));
        const pass = m.district, local = m.local;
        // The fictional villain prefers the red-star shirts within the current group.
        // Each burst commits to an escape destination after a visible shoulder/aim tell.
        if (tick < SCENIC_END && (local === 90 || local === 146 || pass===0&&(local===404||local===444))) {
            const barrel = this.barrel;
            const available = this.people.map((p, i) => ({ p, i })).filter(({ p }) =>
                !p.fleeing && !p.escaped && p.district===pass && p.hitAt === null && p.x > barrel.x + 18
                &&(pass!==0||(local<360?p.originX<336:p.originX>=336)));
            available.sort((a, b) => Number(b.p.clothes==='star-shirt')-Number(a.p.clothes==='star-shirt')||a.p.x-b.p.x);
            this.target = available[0]?.i ?? -1;
            if (this.target >= 0){
                const p=this.people[this.target];this.targetX=p.shelter;this.targetY=-7;p.threatenedAt=tick;
            }
        }
        const volley=pass===0?[110,116,122,128,166,172,178,184,424,429,434,464,469,474]:[110,118,126,166,174,182];
        if (tick < SCENIC_END && this.target >= 0 && volley.includes(local)) {
            this.muzzle = 5; this.heat = Math.min(1, this.heat + .23);
            const m = this.barrel, a = this.angle;
            this.shots.push({ x: m.x, y: m.y, px: m.x, py: m.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, life: 70,age:0 });
            const shoulder=this.shoulder,scale=BACKDROP_RIG.scale;
            this.casings.push({x:shoulder.x+(Math.cos(a)*9+Math.sin(a)*2)*scale,
                y:shoulder.y+(Math.sin(a)*9-Math.cos(a)*2)*scale,born:tick});
            this.events.push('distant-shot');
            for(const p of this.people)if(!p.escaped&&p.hitAt===null&&p.capturedAt===undefined&&p.district===pass&&tick>=p.alertAt){
                p.startledAt=tick;p.reactionTimes.push(tick+2+p.color%3);
            }
        }
    }
}
