import {smoothMotion} from './HypotheticalMotion';

type BirdState='perch'|'alert'|'flight'|'arrive'|'fall'|'rest'|'gone';
export interface YardBird {
    id:number; kind:number; state:BirdState; x:number; y:number; vx:number; vy:number;
    facing:number; phase:number; born:number; since:number; launchAt:number;
    startX:number; startY:number; perchX:number; perchY:number; direction:number;
    angle:number; spin:number; hitAt:number; landedAt:number; bounces:number;
}
export interface YardFeather {x:number;y:number;vx:number;vy:number;born:number;seed:number}
export const FLOCK_VOLLEYS = [
    {beat:42,shots:[72,77,82,104,109,132,137],duration:182},
    {beat:40,shots:[68,73,78,98,103,126,131,136],duration:180},
    {beat:44,shots:[76,81,106,111,116,140,145],duration:190},
] as const;
export const OPENING_FLOCK_SHOTS:readonly number[]=[76,81,86,104,109,114];

/** Takeoff accelerates into a shallow bank. This same trajectory supplies the
 * gun's lead, the bird's body and its actual projectile intersection. */
export function flockFlightPoint(b:YardBird,age:number){
    const t=Math.max(0,age),pace=.29+(b.id%3)*.045;
    const bank=smoothMotion((t-16)/46);
    return {x:b.startX+b.direction*(t*pace+t*t*.0022),
        y:b.startY-(28+(b.id%3)*7)*smoothMotion(t/62)-t*.12
            +Math.sin(t*.075+b.phase)*bank*2};
}

/** Wildlife lives on the secondary clock. New flocks arrive from outside the
 * shot after a quiet interval; fallen actors are never put back on the eave. */
export class AftermathFlock {
    birds:YardBird[]=[];
    remains:YardBird[]=[];
    feathers:YardFeather[]=[];
    landings:Array<{x:number;y:number}>=[];
    takeoffs:number[]=[];
    flights=0;lastScatter=-10000;lastNoise=-10000;nextVisit=0;
    private serial=0;
    private seed:number;
    constructor(readonly origin:number,readonly district:number){
        this.seed=(district+7)*0x45d9f3b;
        for(let i=0;i<4;i++)this.birds.push(this.make(i,0,false,0));
    }
    private random(){let n=this.seed;n^=n<<13;n^=n>>>17;n^=n<<5;this.seed=n>>>0;return (this.seed+.5)/4294967296;}
    private make(i:number,tick:number,arriving:boolean,viewX:number):YardBird {
        const id=this.serial++,eave=this.district===3?326+i*8:340+i*10;
        const perchX=this.origin+(arriving?eave:i<2?264+i*14:this.district===3?334+(i-2)*10:344+(i-2)*9);
        // Feet end five pixels below the body; match the actual surviving eave.
        const perchY=arriving||i>=2?(this.district===3?-36:-50):-33;
        const direction=perchX<viewX+160?1:-1;
        const x=arriving?viewX+(direction===1?-32:352)+i*13*-direction:perchX;
        const y=arriving?perchY-45-i*5:perchY;
        return {id,kind:(id+this.district)%3===0?1:0,state:arriving?'arrive':'perch',
            x,y,vx:0,vy:0,facing:arriving?direction:(i%2?1:-1),phase:this.random()*Math.PI*2,
            born:tick,since:tick+i*13,launchAt:0,startX:x,startY:y,perchX,perchY,direction,
            angle:0,spin:0,hitAt:-1,landedAt:-1,bounces:0};
    }
    perched(visible:(x:number)=>boolean){return this.birds.filter(b=>b.state==='perch'&&visible(b.x));}
    scatter(tick:number,sourceX:number,viewX:number,nearX=sourceX,radius=Infinity){
        this.lastNoise=tick;
        const available=this.birds.filter(b=>(b.state==='perch'||b.state==='arrive')&&Math.abs(b.x-nearX)<=radius);
        if(!available.length)return false;
        this.lastScatter=tick;this.flights++;
        this.nextVisit=tick+940+Math.floor(this.random()*540);
        for(const [i,b] of available.entries()){
            b.state='alert';b.since=tick;b.launchAt=tick+3+i*5+Math.floor(this.random()*3);
            b.startX=b.x;b.startY=b.y;
            // The near edge bends the escape back across the courtyard. A flock
            // never instantly reverses direction halfway through a visible arc.
            b.direction=b.x>viewX+238?-1:b.x<viewX+82?1:Math.sign(b.x-sourceX)||1;
            b.facing=b.direction;
        }
        return true;
    }
    target(actorX:number,facing:number,visible:(x:number)=>boolean,current:number){
        const eligible=this.birds.filter(b=>(b.state==='flight'||b.state==='alert'||b.state==='perch')
            &&visible(b.x)&&(b.x-actorX)*facing>32&&b.y>-99);
        const held=eligible.find(b=>b.id===current);
        return held??eligible.sort((a,b)=>Math.abs(a.x-actorX)-Math.abs(b.x-actorX)||a.id-b.id)[0];
    }
    lead(b:YardBird,tick:number,actorX:number){
        if(b.state!=='flight')return {x:b.x,y:b.y};
        let time=Math.hypot(b.x-actorX,b.y+54)/7.6;
        let p=flockFlightPoint(b,tick-b.launchAt+time);
        time=Math.hypot(p.x-actorX,p.y+54)/7.6;
        p=flockFlightPoint(b,tick-b.launchAt+time);
        return p;
    }
    strike(x0:number,y0:number,x1:number,y1:number,tick:number){
        const dx=x1-x0,dy=y1-y0,length=dx*dx+dy*dy;
        let hit:YardBird|undefined,first=2;
        for(const b of this.birds){
            if(b.state!=='flight')continue;
            const t=Math.max(0,Math.min(1,((b.x-x0)*dx+(b.y-y0)*dy)/Math.max(1,length)));
            if(Math.hypot(b.x-x0-dx*t,b.y-y0-dy*t)<4.5&&t<first){first=t;hit=b;}
        }
        if(!hit)return;
        hit.state='fall';hit.since=tick;hit.hitAt=tick;
        hit.vx=hit.vx*.64+Math.sign(dx)*.38;hit.vy=Math.max(-.6,hit.vy*.3)-.24;
        hit.spin=Math.sign(dx)*(.055+(hit.id%3)*.014);
        for(let i=0;i<7;i++){
            const spread=(i-3)*.55;
            this.feathers.push({x:hit.x,y:hit.y,vx:Math.sin(spread)*(.6+i%3*.2)+hit.vx*.3,
                vy:-.8-Math.cos(spread)*.6,born:tick,seed:hit.id*7+i});
        }
        this.feathers=this.feathers.slice(-42);
        return {x:hit.x,y:hit.y};
    }
    update(tick:number,enabled:boolean,viewX:number){
        this.landings=[];this.takeoffs=[];
        for(const b of this.birds){
            const oldX=b.x,oldY=b.y;
            if(b.state==='alert'&&tick>=b.launchAt){b.state='flight';b.since=tick;this.takeoffs.push(b.x);}
            if(b.state==='flight'){
                const p=flockFlightPoint(b,tick-b.launchAt);b.x=p.x;b.y=p.y;
                b.angle=Math.atan2(b.y-oldY,Math.max(.2,Math.abs(b.x-oldX)))*.18;
                if(tick-b.launchAt>270)b.state='gone';
            }else if(b.state==='arrive'){
                const t=Math.max(0,Math.min(1,(tick-b.since)/128)),ease=smoothMotion(t);
                b.x=b.startX+(b.perchX-b.startX)*ease;
                b.y=b.startY+(b.perchY-b.startY)*ease-Math.sin(Math.PI*t)*7;
                if(t===1){b.state='perch';b.since=tick;b.angle=0;}
            }else if(b.state==='fall'){
                b.vx*=.991;b.vy+=.075;b.x+=b.vx;b.y+=b.vy;
                b.angle+=b.spin;b.spin*=.993;
                if(b.y>=-4){
                    b.y=-4;
                    if(!b.bounces){b.vy=-Math.min(.75,b.vy*.16);b.vx*=.48;b.spin*=.3;b.bounces++;
                        this.landings.push({x:b.x,y:b.y});}
                    else{b.state='rest';b.landedAt=tick;b.vx=0;b.vy=0;b.angle=b.facing*.2;}
                }
            }
            if(b.state!=='fall'&&b.state!=='rest'){b.vx=b.x-oldX;b.vy=b.y-oldY;}
        }
        this.remains.push(...this.birds.filter(b=>b.state==='rest'));
        this.remains=this.remains.filter(b=>tick-b.landedAt<1500).slice(-8);
        this.birds=this.birds.filter(b=>b.state!=='gone'&&b.state!=='rest');
        for(const p of this.feathers){p.vx*=.979;p.vy=Math.min(.34,p.vy+.026);p.x+=p.vx;p.y=Math.min(-3,p.y+p.vy);}
        this.feathers=this.feathers.filter(p=>tick-p.born<112);
        // No new actors are authored in an unseen street or during a landmark.
        if(enabled&&!this.birds.length&&tick>=this.nextVisit&&tick-this.lastNoise>110){
            const eave=this.origin+344;
            if(eave>viewX+18&&eave<viewX+302){
                const count=3+Math.floor(this.random()*2);
                for(let i=0;i<count;i++)this.birds.push(this.make(i,tick,true,viewX));
            }
        }
    }
}
