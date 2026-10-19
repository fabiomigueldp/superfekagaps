import type {Bystander} from './HypotheticalBackdrop';
import {AFTERMATH_SCALE,DEBRIS_GRIP_X} from './HypotheticalAftermathHandling';
import {smoothMotion} from './HypotheticalMotion';
import type {HypotheticalTowerPhysics} from './HypotheticalTowerPhysics';

export const TOWER_SEARCH={grip:58,yield:86,release:138,reveal:166,notice:194,clamp:242,bite:278,drop:312,end:392} as const;
const pulse=(a:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((a-start)/rise)*(1-smoothMotion((a-hold)/(end-hold)));
const reach=DEBRIS_GRIP_X*AFTERMATH_SCALE;

/** A single continuation of the tower's collapse. The roof wing is the actual
 * simulated part; the sheltered actor and the disturbed rubble persist. */
export class HypotheticalTowerSearch {
    age=-1;tick=0;
    events:Array<'distant-debris'|'distant-stone'|'distant-thud'|'distant-roar'>=[];
    dust:Array<{x:number;y:number;born:number;strength:number}>=[];
    readonly person:Bystander;
    private source={x:0,y:0,angle:0};
    private fromX=0;
    private releaseX=0;private releaseY=0;private releaseAngle=0;
    constructor(private physics:HypotheticalTowerPhysics,readonly origin:number){
        this.person={x:origin,originX:origin,shelter:origin-32,escaped:false,fleeing:true,hitAt:null,
            color:1,distance:0,velocity:0,alertAt:TOWER_SEARCH.reveal,speed:1,district:3,
            clothes:'star-shirt',stoppedAt:null,threatenedAt:TOWER_SEARCH.notice,startledAt:TOWER_SEARCH.notice,
            reactionTimes:[TOWER_SEARCH.notice],appearance:18,depth:-3};
    }
    get part(){return this.physics.bodies['roof-left'];}
    get ready(){return this.age<0&&this.physics.age>150&&this.part.sleeping;}
    get done(){return this.age>=TOWER_SEARCH.end;}
    get active(){return this.age>=0&&!this.done;}
    get stance(){return this.age<0?this.origin+this.part.x+reach:this.fromX;}
    get actorX(){
        if(this.age<0)return this.stance;
        const a=this.age,heave=pulse(a,TOWER_SEARCH.yield,34,TOWER_SEARCH.release,TOWER_SEARCH.release+34);
        return this.fromX+heave*6-11*pulse(a,218,24,300,352);
    }
    get jawX(){return this.actorX-reach;}
    get body(){
        const a=Math.max(0,this.age),t=TOWER_SEARCH;
        const seek=pulse(a,0,40,142,174),heave=pulse(a,t.yield,34,t.release,t.release+34);
        const effort=pulse(a,t.grip-8,18,t.yield+4,t.yield+25);
        const lunge=pulse(a,218,24,249,278),lift=pulse(a,t.clamp,27,t.drop,t.drop+36);
        const bite=pulse(a,t.bite-9,9,t.bite+3,t.bite+24),attention=pulse(a,174,24,354,t.end);
        const open=pulse(a,219,14,t.clamp-5,t.clamp+3);
        let jawY=-33+(this.source.y+33)*seek-heave*22;
        jawY+=Math.sin((a-22)/3)*.7*pulse(a,18,12,42,54);
        if(a>=t.reveal)jawY+=( -15-jawY)*smoothMotion((a-t.reveal)/46);
        if(a>=t.clamp)jawY=-15-lift*22+bite*3;
        if(a>=t.drop)jawY+=(-33-jawY)*smoothMotion((a-t.drop)/(t.end-t.drop));
        const jaw=.12+pulse(a,29,16,t.grip-6,t.grip+3)*.45
            +pulse(a,t.grip,4,t.release-3,t.release+13)*.43
            +pulse(a,t.release-4,4,t.release+8,t.release+24)*.38+open*.75
            +pulse(a,t.clamp,3,t.bite-12,t.bite)*.18
            +pulse(a,t.bite-12,6,t.bite-5,t.bite+2)*.36
            +pulse(a,t.drop-4,4,t.drop+6,t.drop+20)*.45;
        return {jawY,jaw,bow:seek*.36-heave*.12+lunge*.3-lift*.16+bite*.14,
            compression:effort*2+lunge*3+bite*2,tail:-heave*.18+lunge*.16-bite*.1,
            riderLean:-effort*2+heave*3-lunge*4-bite*3,riderDrop:effort*2+lunge*3+bite*2,
            brace:Math.max(effort*.8,heave*.55,lunge*.7,lift*.45),rein:Math.max(seek,heave,lift,bite),
            focus:Math.max(seek,attention),eyeClose:effort*.28+bite*.55,voice:bite*.3,
            lookBack:attention*.18,cloth:bite*2+lunge*2};
    }
    get carried(){
        if(this.age<TOWER_SEARCH.clamp||this.age>=TOWER_SEARCH.drop)return;
        const a=this.age-TOWER_SEARCH.clamp,hit=pulse(this.age,TOWER_SEARCH.bite-4,4,TOWER_SEARCH.bite+3,TOWER_SEARCH.bite+17);
        return {person:this.person,angle:-.12+Math.sin(a*.19)*.13+hit*.22,kick:Math.sin(a*.52)*(1-hit*.65)};
    }
    get fallen(){
        if(this.age<TOWER_SEARCH.drop)return;
        const a=Math.min(38,this.age-TOWER_SEARCH.drop),u=smoothMotion(a/38);
        return {x:this.releaseX-14*u,y:this.releaseY+(-7-this.releaseY)*u-Math.sin(Math.PI*u)*5,
            angle:this.releaseAngle+(Math.PI/2-this.releaseAngle)*u,kick:(1-u)*.2};
    }
    begin(){
        if(!this.ready)return;
        this.source={x:this.part.x,y:this.part.y,angle:this.part.angle};this.fromX=this.stance;this.age=0;
        const x=this.origin+this.source.x-8;this.person.x=x;this.person.originX=x;this.person.shelter=x-32;
    }
    advance(){this.tick++;this.events=[];this.dust=this.dust.filter(p=>this.tick-p.born<64);}
    private disturb(strength:number,x=this.jawX,y=this.body.jawY){
        this.dust.push({x,y,born:this.tick,strength});
    }
    update(framed:boolean){
        this.events=[];
        // Discovery and bite wait with the same actors and props. Once released,
        // the falling actor finishes settling even if the camera moves away.
        if(!this.active||!framed&&this.age<TOWER_SEARCH.drop)return;
        const t=TOWER_SEARCH;this.age++;
        if(this.age===36){this.physics.disturbChips(this.source.x,this.source.y,.55);this.disturb(.2);}
        if(this.age===t.grip){this.physics.grab('roof-left');this.events.push('distant-stone');this.disturb(.45);}
        if(this.age===t.yield){this.physics.disturbChips(this.source.x,this.source.y,.85);this.events.push('distant-debris');this.disturb(.65);}
        if(this.part.held){
            const angle=this.source.angle+.28*smoothMotion((this.age-t.yield)/30)
                +Math.sin((this.age-t.grip)*.24)*.035*(1-smoothMotion((this.age-t.yield)/24));
            this.physics.carry('roof-left',this.jawX-this.origin,this.body.jawY,angle);
        }
        if(this.age===t.release)this.physics.drop('roof-left',-1.2,-.9,-.035);
        if(this.age>=t.reveal&&this.age<t.clamp){
            const old=this.person.x;
            this.person.x=this.person.originX-3*smoothMotion((this.age-212)/30);
            this.person.velocity=this.person.x-old;this.person.distance+=Math.abs(this.person.velocity);
            this.person.depth=9-12*smoothMotion((this.age-t.reveal)/28);
        }
        if(this.age===t.reveal)this.disturb(.3,this.person.x,-10);
        if(this.age===t.notice)this.events.push('distant-roar');
        if(this.age===t.clamp){this.events.push('distant-thud');this.disturb(.25);}
        if(this.age===t.bite){this.events.push('distant-thud');this.disturb(.3);}
        if(this.age===t.drop){
            this.releaseX=this.jawX;this.releaseY=this.body.jawY;this.releaseAngle=-.1;
        }
        if(this.age===t.drop+38)this.disturb(.3,this.fallen!.x,-5);
    }
}
