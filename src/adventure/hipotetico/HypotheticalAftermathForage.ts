import {smoothMotion} from './HypotheticalMotion';
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
    constructor(readonly escape:AftermathEscape,readonly district:number){}
    get entry(){return this.escape.entries[this.selected];}
    get offset(){return this.variant===1?44:0;}
    get duration(){return 284+this.offset;}
    get contactAt(){return 96+this.offset;}
    get concealAt(){return 126+this.offset;}
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
    cancel(){this.active=false;}
    get cover(){
        return this.active?pulse(this.age,86+this.offset,30,160+this.offset,214+this.offset):0;
    }
    motion(age=this.age){
        const o=this.offset;
        const attention=pulse(age,4,20,55+o,88+o);
        const sniff=pulse(age,18,8,29,42)+(this.variant===0?pulse(age,39,7,46,56)*.6:0);
        const listen=this.variant===1?pulse(age,60,10,81,94):0;
        const lower=pulse(age,50+o,46,164+o,226+o);
        const settle=pulse(age,91+o,8,104+o,119+o);
        const obscured=pulse(age,117+o,12,153+o,172+o);
        const shift=obscured*(Math.sin((age-116-o)*Math.PI/18)*.5+.5);
        const clear=pulse(age,226+o,8,235+o,246+o)-pulse(age,239+o,6,245+o,260+o)*.55;
        const finish=pulse(age,244+o,10,263+o,284+o);
        return {attention,sniff,listen,lower,settle,shift,clear,finish};
    }
    body(breath:number,reduced:boolean){
        const m=this.motion(),r=this.motion(this.age-5);
        const bow=m.lower*.55+m.sniff*.12-m.listen*.07;
        const compression=m.lower*2.4+m.settle*.65;
        const jaw=.08+pulse(this.age,66+this.offset,15,92+this.offset,112+this.offset)*.24+m.shift*.06;
        const desiredY=-8+m.settle*.8+m.shift*.55;
        const aligned=desiredY/AFTERMATH_SCALE+49-bow*25-breath-compression-jaw*6;
        return {bow,compression,jaw,
            // The skull meets a fixed ground point; the trunk, knees and neck
            // share the descent rather than stretching only the neck.
            neckDrop:aligned*m.lower+m.sniff*5-m.listen*5+m.clear*3,
            tail:-m.lower*.13-m.listen*.035+m.clear*.055,
            riderDrop:r.lower*1.8+r.settle*.5,riderLean:-r.lower*2-r.listen*2.4-r.clear*1.4,
            rein:Math.max(m.lower*.8,m.attention*.45,r.listen*.65),
            lookBack:r.listen*.7+r.finish*.28,aim:-.12+m.lower*.3+m.finish*.12,
            focus:Math.max(m.lower,m.attention,m.listen),eyeClose:Math.max(m.sniff*.65,m.settle*.2),
            cloth:reduced?0:Math.abs(r.clear)*1.4+m.settle*.5,
            brace:0,tuck:0,stride:0,breath,recoil:0,heat:0,reload:0,voice:0,lift:0,pivot:0};
    }
}

