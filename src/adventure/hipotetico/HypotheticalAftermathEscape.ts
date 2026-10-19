import type {Bystander} from './HypotheticalBackdrop';
import {bystanderIntersection} from './HypotheticalBystanderMotion';
import {smoothMotion} from './HypotheticalMotion';

export type EscapeKind='rubble'|'hatch'|'fallen';
export interface EscapeEntry {
    kind:EscapeKind; from:number; exit:number; stance:number; person:Bystander;
    begunAt:number; completed:boolean; removedAt:number; hitVelocity:number; marks:Array<{x:number;y:number}>;
}
export const ESCAPE_TIMINGS={
    rubble:{peek:22,run:64,chase:82,runTime:132,shots:[112,117,122,148,153,158,178,183],duration:260},
    hatch:{peek:32,run:76,chase:94,runTime:114,shots:[120,125,130,150,155,160,178,183],duration:256},
    fallen:{peek:0,run:0,chase:0,runTime:1,shots:[],duration:1},
} as const;
export type EscapeCue='distant-grit'|'distant-creak'|'distant-chain'|'distant-thud';
export interface EscapeDust {x:number;y:number;born:number;seed:number}
const pulse=(a:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((a-start)/rise)*(1-smoothMotion((a-hold)/(end-hold)));

/** Finite residents in real hiding places plus already-fallen street casualties.
 * Their clock, fall and opening remain in the street after the director resumes its repertoire. */
export class AftermathEscape {
    readonly entries:EscapeEntry[];
    selected=-1;active=false;age=0;tick=0;actorX=0;velocity=0;
    nextAt=0;nextPerformance=2;
    events:EscapeCue[]=[];dust:EscapeDust[]=[];
    private aim={x:0,y:-15};
    private endingAt=0;
    constructor(readonly origin:number,readonly district:number,streetPeople:readonly Bystander[]=[]){
        const live=(['rubble','hatch'] as const).map((kind,i)=>{
            const from=origin+(kind==='rubble'?206:238),exit=origin+(district===3?338:354);
            const person:Bystander={x:from,originX:from,shelter:exit,escaped:false,fleeing:true,
                hitAt:null,color:(district+i)%4,distance:0,velocity:0,alertAt:Number.MAX_SAFE_INTEGER,
                speed:1,district,clothes:'star-shirt',stoppedAt:null,threatenedAt:null,startledAt:null,
                reactionTimes:[],appearance:20+district*2+i,depth:-4,exitAtShelter:true};
            return {kind,from,exit,stance:from-78,person,begunAt:-1,completed:false,removedAt:-1,hitVelocity:0,marks:[]};
        });
        const streetCasualties=streetPeople.filter(p=>p.district===district&&!p.exitAtShelter&&p.originX>=origin+160&&p.originX<=origin+280);
        const fallen=([194,226] as const).map((offset,i)=>{
            const existing=streetCasualties[i];
            const from=existing?existing.x:origin+offset,exit=origin+(district===3?338:354);
            const person:Bystander=existing??{x:from,originX:from,shelter:exit,escaped:false,fleeing:false,
                hitAt:-400,color:(district+2+i)%4,distance:18,velocity:0,alertAt:-420,
                speed:1,district,clothes:i===0||(district%2===1)?'star-shirt':'workcoat',
                stoppedAt:-400,threatenedAt:null,startledAt:null,
                reactionTimes:[],appearance:28+district*2+i,depth:i===0?-3:-4,exitAtShelter:false};
            return {kind:'fallen' as const,from,exit,stance:from-78,person,begunAt:0,completed:true,removedAt:-1,hitVelocity:0,marks:[]};
        });
        const extraFrom=origin+206,extraExit=origin+(district===3?338:354);
        const extra:EscapeEntry={
            kind:'rubble',from:extraFrom,exit:extraExit,stance:extraFrom-78,
            person:{x:extraFrom,originX:extraFrom,shelter:extraExit,escaped:false,fleeing:true,
                hitAt:null,color:(district+1)%4,distance:0,velocity:0,alertAt:Number.MAX_SAFE_INTEGER,
                speed:1,district,clothes:'star-shirt',stoppedAt:null,threatenedAt:null,startledAt:null,
                reactionTimes:[],appearance:36+district,depth:-4,exitAtShelter:true},
            begunAt:-1,completed:false,removedAt:-1,hitVelocity:0,marks:[],
        };
        this.entries=[...live,...fallen,extra];
    }
    get entry(){return this.entries[this.selected];}
    get timing(){return ESCAPE_TIMINGS[this.entry?.kind??'rubble'];}
    get duration(){return this.endingAt||this.timing.duration;}
    get done(){return !this.active&&this.selected>=0&&this.entry.completed;}
    get aimTarget(){return this.aim;}
    candidate(tick:number,performed:number,visible:(x:number,margin:number)=>boolean){
        if(this.active||tick<this.nextAt||performed<this.nextPerformance)return -1;
        const order=this.district%2?[1,0,4]:[0,1,4];
        return order.find(i=>{
            const e=this.entries[i];
            return e.kind!=='fallen'&&e.begunAt<0&&visible(e.from,34)&&visible(e.exit,28)&&visible(e.stance,32);
        })??-1;
    }
    prepare(index:number){this.selected=index;}
    begin(tick:number,actorX:number,performed:number){
        const e=this.entry;if(!e||e.begunAt>=0)return;
        e.begunAt=tick;this.tick=tick;this.age=0;this.active=true;this.endingAt=this.timing.duration;
        this.actorX=actorX;this.velocity=0;this.aim={x:e.from,y:-15};
        e.person.stoppedAt=tick-12;e.person.alertAt=tick+this.timing.run-8;
        e.person.threatenedAt=tick+this.timing.peek+4;
        this.nextAt=tick+960;this.nextPerformance=performed+4;
    }
    opening(e:EscapeEntry){
        if(e.begunAt<0||e.kind==='fallen')return 0;
        const age=this.tick-e.begunAt,t=ESCAPE_TIMINGS[e.kind];
        return smoothMotion((age-t.peek)/34);
    }
    canFire(){return this.active&&this.entry.person.hitAt===null&&!this.entry.person.escaped
        &&this.age>=this.timing.run+24&&this.age<=this.timing.shots[this.timing.shots.length-1];}
    update(tick:number){
        this.tick=tick;this.events=[];
        this.dust=this.dust.filter(p=>tick-p.born<80);
        for(const [index,e] of this.entries.entries()){
            if(e.begunAt<0||e.removedAt>=0)continue;
            const age=tick-e.begunAt,t=ESCAPE_TIMINGS[e.kind],p=e.person;
            if(e.kind==='fallen'){e.from=p.x;e.stance=p.x-78;continue;}
            const previous=p.x;p.velocity=0;
            if(p.hitAt!==null){
                // A little of the run survives the hit, then the shared fall
                // rig takes the weight. The root never snaps back to the doorway.
                e.hitVelocity*=.74;p.x+=e.hitVelocity;
                p.depth=(p.depth??-4)+(-4-(p.depth??-4))*.2;
            }else if(!p.escaped){
                if(age>=t.run){
                    p.stoppedAt=null;
                    const progress=smoothMotion((age-t.run)/t.runTime);
                    p.x=e.from+(e.exit-e.from)*progress;
                    const crossing=Math.max(0,Math.min(1,(p.x-this.origin-251)/42));
                    p.depth=-4-Math.sin(Math.PI*crossing)*(e.kind==='hatch'?10:8);
                    if(progress===1){p.escaped=true;p.depth=-4;}
                }
                p.velocity=p.x-previous;p.distance+=Math.abs(p.velocity);
                if(age===t.run+8)p.threatenedAt=tick;
            }
            if(index!==this.selected||!this.active)continue;
            this.age=age;
            if(age===12||age===t.peek){
                this.events.push(e.kind==='rubble'?'distant-grit':'distant-creak');
                for(let j=0;j<4;j++)this.dust.push({x:e.from+(j-1.5)*4,y:-10-j%2*4,born:tick,seed:j+index*5});
            }
            if(age===t.run-10)this.events.push(e.kind==='rubble'?'distant-thud':'distant-chain');
            const pursuing=age>=t.chase&&p.hitAt===null&&!p.escaped;
            const desired=pursuing?Math.max(0,Math.min(1.55,(p.x-76-this.actorX)*.065)):0;
            this.velocity+=(desired-this.velocity)*(pursuing?.12:.17);
            if(this.velocity<.008)this.velocity=0;
            this.actorX+=this.velocity;
            const speed=p.hitAt===null?p.velocity:0;
            const lead=Math.min(18,Math.hypot(p.x-this.actorX,38)/6.8);
            const target={x:Math.min(e.exit-7,p.x+speed*lead),y:(p.depth??-4)-12};
            this.aim.x+=(target.x-this.aim.x)*.28;this.aim.y+=(target.y-this.aim.y)*.22;
            if(age>=this.duration){this.active=false;this.velocity=0;e.completed=true;}
        }
    }
    intersectShot(x0:number,y0:number,x1:number,y1:number,index:number){
        const e=this.entries[index];if(!e||e.begunAt<0)return null;
        const p=e.person,hit=bystanderIntersection(p,this.tick,{px:x0,py:y0,x:x1,y:y1});
        if(hit===null)return null;
        p.hitAt=this.tick;e.hitVelocity=p.velocity*.8;p.velocity=0;
        this.endingAt=Math.min(this.timing.duration,Math.max(this.age+78,this.timing.run+100));
        return {x:x0+(x1-x0)*hit,y:y0+(y1-y0)*hit};
    }
    get body(){
        const a=this.age,t=this.timing,p=this.entry.person;
        const attention=pulse(a,14,18,58,90),sniff=this.entry.kind==='rubble'?pulse(a,26,10,46,70):0;
        const seen=pulse(a,t.run+4,12,t.run+24,t.run+42);
        const aim=pulse(a,t.run+18,22,this.duration-34,this.duration);
        const brake=p.hitAt===null?0:pulse(this.tick-p.hitAt,0,7,12,34);
        return {attention,aim,brake,
            bow:sniff*.22-seen*.06,neckDrop:sniff*9-seen*5,
            riderLean:-seen*2-this.velocity*.65+brake*2.2,
            riderDrop:brake*1.2,rein:Math.max(attention*.5,seen*.45)*(1-aim),
            jaw:.08+seen*.15,compression:brake*1.4,tail:-this.velocity*.055,
            focus:Math.max(attention,aim),eyeClose:sniff*.15,
            reload:p.hitAt===null?0:pulse(this.tick-p.hitAt,34,12,53,72)*.55};
    }
}
