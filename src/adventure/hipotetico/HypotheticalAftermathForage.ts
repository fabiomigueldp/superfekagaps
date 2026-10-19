import {smoothMotion,dinosaurHeadPoint} from './HypotheticalMotion';
import {AFTERMATH_SCALE,DEBRIS_GRIP_X} from './HypotheticalAftermathHandling';
import type {AftermathEscape} from './HypotheticalAftermathEscape';

const pulse=(age:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((age-start)/rise)*(1-smoothMotion((age-hold)/(end-hold)));

/** A quiet, implied scavenging passage. Only settled residents already present
 * in this yard are eligible; concealment precedes removal, with no carried or
 * injured-body animation. Every resident can be used once. */
export class AftermathForage {
    selected=-1;variant=0;age=0;begunAt=-1;active=false;completed=false;
    nextAt=0;nextPerformance=0;targetX=0;stance=0;
    cancelledAt=-1;contactTick=-1;contactX=0;landingTick=-1;
    marks:Array<{entry:number;x:number}>=[];
    constructor(readonly escape:AftermathEscape,readonly district:number){}
    get entry(){return this.escape.entries[this.selected];}
    get offset(){return this.variant===1?44:0;}
    get duration(){return 284+this.offset;}
    get contactAt(){return 96+this.offset;}
    get concealAt(){return 126+this.offset;}
    get rootShift(){const m=this.motion();return m.support*2.8-m.release*.7;}
    candidate(tick:number,performed:number,visible:(x:number,margin:number)=>boolean){
        if(this.active||this.escape.active||tick<this.nextAt||performed<this.nextPerformance)return -1;
        return this.escape.entries.findIndex(e=>{
            if(e.person.hitAt===null||e.person.escaped||!e.completed||e.removedAt>=0||tick-e.person.hitAt<360)return false;
            const target=e.person.x+12,stance=target-DEBRIS_GRIP_X*AFTERMATH_SCALE;
            return visible(target,38)&&visible(stance,66);
        });
    }
    prepare(index:number){
        this.selected=index;this.variant=(Math.floor(this.district/2)+index)%2;
        this.targetX=this.entry.person.x+12;this.stance=this.targetX-DEBRIS_GRIP_X*AFTERMATH_SCALE;
    }
    begin(tick:number,performed:number){
        if(!this.entry||this.entry.removedAt>=0)return;
        this.begunAt=tick;this.age=0;this.active=true;this.completed=false;
        this.cancelledAt=-1;this.contactTick=-1;this.contactX=this.targetX;this.landingTick=-1;
        this.nextAt=tick+1680;this.nextPerformance=performed+5;
    }
    update(tick:number){
        if(!this.active)return;
        this.age=tick-this.begunAt;
        // The front dust mask is fully opaque before changing the resident's
        // visibility. Re-entering the street cannot restore the same body.
        if(this.age>=this.concealAt&&this.entry.removedAt<0)this.entry.removedAt=tick;
        if(this.age>=this.duration){this.active=false;this.completed=true;}
    }
    cancel(tick:number){if(this.active)this.cancelledAt=tick;this.active=false;}
    contact(tick:number,x:number){
        this.contactTick=tick;this.contactX=x;
        this.landingTick=tick+Math.ceil(Math.min(...Array.from({length:9},(_,j)=>j+forageGrain(j,0,this.district).landing)));
        if(!this.marks.some(m=>m.entry===this.selected))this.marks.push({entry:this.selected,x});
    }
    coverAt(tick:number){
        if(this.begunAt<0||this.contactTick<0)return 0;
        const age=(this.cancelledAt<0?tick:Math.min(tick,this.cancelledAt))-this.begunAt;
        const fade=this.cancelledAt<0?1:1-smoothMotion((tick-this.cancelledAt)/20);
        return pulse(age,this.contactAt,20,160+this.offset,220+this.offset)*fade;
    }
    get cover(){return this.coverAt(this.begunAt+this.age);}
    motion(age=this.age){
        const o=this.offset;
        const attention=pulse(age,4,20,55+o,88+o);
        const sniff=pulse(age,18,8,29,42)+(this.variant===0?pulse(age,39,7,46,56)*.6:0);
        const listen=this.variant===1?pulse(age,60,10,81,94):0;
        const support=pulse(age,36+o,42,174+o,224+o);
        const lower=pulse(age,50+o,46,164+o,214+o);
        const settle=pulse(age,91+o,8,104+o,119+o);
        const shift=pulse(age,121+o,7,132+o,149+o)*.65+pulse(age,148+o,5,155+o,171+o)*.4;
        const release=pulse(age,174+o,10,188+o,212+o);
        const clear=pulse(age,226+o,8,235+o,246+o)-pulse(age,239+o,6,245+o,260+o)*.55;
        const finish=pulse(age,244+o,10,263+o,284+o);
        return {attention,sniff,listen,support,lower,settle,shift,release,clear,finish};
    }
    body(breath:number,reduced:boolean){
        const m=this.motion(),r=this.motion(this.age-5),tailMotion=this.motion(this.age-8);
        const bow=m.support*.52+m.sniff*.12-m.listen*.07;
        const compression=m.support*2.4+m.settle*.65-m.release*.35;
        const jaw=.08+pulse(this.age,66+this.offset,15,92+this.offset,112+this.offset)*.24+m.shift*.06;
        const desiredY=-8+m.settle*.8+m.shift*.55;
        const headPitch=m.lower*.15+m.sniff*.07-m.listen*.08-m.release*.09+m.clear*.035;
        const mouth=dinosaurHeadPoint([DEBRIS_GRIP_X,10+jaw*6],0,headPitch);
        const aligned=desiredY/AFTERMATH_SCALE+59-bow*25-breath-compression-mouth[1];
        return {bow,compression,jaw,headPitch,
            // The skull meets a fixed ground point; the trunk, knees and neck
            // share the descent rather than stretching only the neck.
            neckDrop:aligned*m.lower+m.sniff*5-m.listen*5+m.clear*3,
            tail:-tailMotion.support*.14-m.listen*.035+tailMotion.release*.025+m.clear*.055,
            riderDrop:r.support*1.8+r.settle*.5-r.release*.4,riderLean:-r.support*2-r.listen*2.4-r.clear*1.4+r.release*1.2,
            rein:Math.max(m.lower*.8,m.attention*.45,r.listen*.65),
            lookBack:r.listen*.7+r.finish*.28,aim:-.12+m.lower*.3+m.finish*.12,
            focus:Math.max(m.lower,m.attention,m.listen),eyeClose:Math.max(m.sniff*.65,m.settle*.2),
            cloth:reduced?0:Math.abs(r.clear)*1.4+m.settle*.5,
            brace:0,tuck:0,stride:0,breath,recoil:0,heat:0,reload:0,voice:0,lift:0,pivot:0};
    }
}

/** Dry grains share their exact flight, first landing and rebound with the
 * effect and its sound cue. Flight starts at the ground contact, not a timer
 * before the head reaches the pavement. */
export function forageGrain(index:number,age:number,district:number){
    const seed=(index*37+district*19)%97/97,gravity=.09+seed*.025;
    const vx=(index-4)*(.11+seed*.06),vy=-.62-seed*.48,floor=-2,start=-3;
    const landing=(-vy+Math.sqrt(vy*vy+2*gravity*(floor-start)))/gravity;
    const after=Math.max(0,age-landing),impact=vy+gravity*landing,bounce=impact*(.16+seed*.08);
    const rebound=2*bounce/gravity,hop=Math.min(after,rebound),roll=Math.max(0,after-rebound);
    const x=(index-4)*2.3+vx*Math.min(age,landing)+vx*.45*hop+vx*5*(1-Math.exp(-roll/9));
    const y=age<landing?start+vy*age+gravity*age*age/2:floor-bounce*hop+gravity*hop*hop/2;
    return {x,y,landing,rebound,seed};
}

