import type {Bystander} from './HypotheticalBackdrop';
import type {CarriedBystander} from './HypotheticalBystanders';
import {AFTERMATH_SCALE,DEBRIS_GRIP_X} from './HypotheticalAftermathHandling';
import {smoothMotion} from './HypotheticalMotion';
import type {HypotheticalTowerPhysics} from './HypotheticalTowerPhysics';

export const TOWER_SEARCH={
    grip:58,yield:86,release:138,reveal:166,notice:194,
    clamp:242,thrash:258,bite:278,rip:296,drop:312,crunch:324,spit:336,end:392,
} as const;
export type TowerGoreKind='arm-left'|'pelvis'|'leg-left'|'arm-right'|'torso-stump'|'head'|'cloth-star'|'cloth-left'|'cloth-right';
export interface TowerGorePiece {
    kind:TowerGoreKind;x:number;y:number;vx:number;vy:number;
    angle:number;spin:number;radius:number;born:number;bounces:number;rest:boolean;kick:number;
}
export interface TowerGoreSplinter {
    x:number;y:number;vx:number;vy:number;born:number;radius:number;bone:boolean;rest:boolean;
}
export interface TowerBloodStain {x:number;y:number;radius:number;born:number;seed:number}
export interface TowerBloodSpray {x:number;y:number;dx:number;dy:number;born:number;strength:number;seed:number}

const pulse=(a:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((a-start)/rise)*(1-smoothMotion((a-hold)/(end-hold)));
const reach=DEBRIS_GRIP_X*AFTERMATH_SCALE;

/** A single continuation of the tower's collapse. The roof wing is the actual
 * simulated part; the sheltered actor and the dismembered remains persist on the rubble. */
export class HypotheticalTowerSearch {
    age=-1;tick=0;
    events:Array<'distant-debris'|'distant-stone'|'distant-thud'|'distant-roar'>=[];
    dust:Array<{x:number;y:number;born:number;strength:number}>=[];
    pieces:TowerGorePiece[]=[];
    splinters:TowerGoreSplinter[]=[];
    stains:TowerBloodStain[]=[];
    sprays:TowerBloodSpray[]=[];
    readonly person:Bystander;
    private source={x:0,y:0,angle:0};
    private fromX=0;
    private releaseX=0;private releaseY=0;private releaseAngle=0;
    private seed=911;
    constructor(private physics:HypotheticalTowerPhysics,readonly origin:number){
        this.person={x:origin,originX:origin,shelter:origin-32,escaped:false,fleeing:true,hitAt:null,
            color:1,distance:0,velocity:0,alertAt:TOWER_SEARCH.reveal,speed:1,district:3,
            clothes:'star-shirt',stoppedAt:null,threatenedAt:TOWER_SEARCH.notice,startledAt:TOWER_SEARCH.notice,
            reactionTimes:[TOWER_SEARCH.notice],appearance:18,depth:-3};
    }
    private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    get part(){return this.physics.bodies['roof-left'];}
    get ready(){return this.age<0&&this.physics.age>150&&this.part.sleeping;}
    get done(){return this.age>=TOWER_SEARCH.end;}
    get active(){return this.age>=0&&!this.done;}
    get stance(){return this.age<0?this.origin+this.part.x+reach:this.fromX;}
    get actorX(){
        if(this.age<0)return this.stance;
        const a=this.age,t=TOWER_SEARCH;
        const heave=pulse(a,t.yield,34,t.release,t.release+34);
        const lunge=pulse(a,218,22,t.spit,t.end-12);
        const thrash=Math.sin((a-t.clamp)*.62)*3.4*pulse(a,t.clamp+2,6,t.bite-6,t.bite+2);
        const wrench=pulse(a,t.rip-4,6,t.rip+8,t.drop+4)*6.5;
        const crunch=pulse(a,t.crunch-4,4,t.crunch+4,t.spit+6)*-3.5;
        return this.fromX+heave*6-12*lunge+thrash+wrench+crunch;
    }
    get jawX(){return this.actorX-reach;}
    get body(){
        const a=Math.max(0,this.age),t=TOWER_SEARCH;
        const seek=pulse(a,0,40,142,174),heave=pulse(a,t.yield,34,t.release,t.release+34);
        const effort=pulse(a,t.grip-8,18,t.yield+4,t.yield+25);
        const lunge=pulse(a,218,22,252,282),lift=pulse(a,t.clamp,22,t.spit,t.spit+34);
        const thrashEnv=pulse(a,t.clamp+2,5,t.bite-6,t.bite);
        const thrashWave=Math.sin((a-t.clamp)*.62)*thrashEnv;
        const bite=pulse(a,t.bite-7,6,t.bite+4,t.bite+18);
        const rip=pulse(a,t.rip-5,6,t.rip+7,t.drop+2);
        const toss=pulse(a,t.drop-2,5,t.crunch-4,t.crunch+2);
        const crunch=pulse(a,t.crunch-4,4,t.crunch+5,t.spit+4);
        const spit=pulse(a,t.spit-2,3,t.spit+5,t.spit+18);
        const swallow=pulse(a,t.spit+6,8,t.spit+20,t.end-12);
        const attention=pulse(a,174,24,354,t.end);
        const open=pulse(a,219,14,t.clamp-4,t.clamp+2);
        let jawY=-33+(this.source.y+33)*seek-heave*22;
        jawY+=Math.sin((a-22)/3)*.7*pulse(a,18,12,42,54);
        if(a>=t.reveal)jawY+=(-14-jawY)*smoothMotion((a-t.reveal)/46);
        if(a>=t.clamp)jawY=-14-lift*23+thrashWave*5.5+bite*4.5-rip*9-toss*4+crunch*5-swallow*3;
        if(a>=t.spit)jawY+=(-33-jawY)*smoothMotion((a-t.spit)/(t.end-t.spit));
        const jaw=.12+pulse(a,29,16,t.grip-6,t.grip+3)*.45
            +pulse(a,t.grip,4,t.release-3,t.release+13)*.43
            +pulse(a,t.release-4,4,t.release+8,t.release+24)*.38+open*.78
            +pulse(a,t.clamp,3,t.bite-10,t.bite-2)*.22
            +Math.abs(thrashWave)*.18
            +pulse(a,t.bite-9,5,t.bite-3,t.bite+2)*.44
            +pulse(a,t.rip-6,4,t.rip-1,t.rip+4)*.42
            +toss*.64
            +spit*.52;
        const savage=Math.max(bite,rip,crunch,thrashEnv*.75);
        return {jawY,jaw,
            bow:seek*.36-heave*.12+lunge*.32-lift*.18+thrashWave*.14+bite*.18-rip*.24+crunch*.2-swallow*.08,
            compression:effort*2+lunge*3+Math.abs(thrashWave)*2.2+bite*3.2+rip*2.5+crunch*3.6,
            tail:-heave*.18+lunge*.18+thrashWave*.28-bite*.14+rip*.26-crunch*.18,
            riderLean:-effort*2+heave*3-lunge*4+thrashWave*2.5-bite*3.5+rip*4-crunch*4,
            riderDrop:effort*2+lunge*3+Math.abs(thrashWave)*2+bite*2.8+rip*2.2+crunch*3.2,
            brace:Math.max(effort*.8,heave*.55,lunge*.75,lift*.55,savage*.85),
            rein:Math.max(seek,heave,lift,savage),
            focus:Math.max(seek,attention,savage),
            eyeClose:Math.max(effort*.28,bite*.65,rip*.5,crunch*.85,swallow*.4),
            voice:Math.max(bite*.35,rip*.75,crunch*.45,spit*.3),
            lookBack:attention*.18,
            cloth:savage*3+lunge*2+Math.abs(thrashWave)*2.5};
    }
    get carried():CarriedBystander|undefined {
        const a=this.age,t=TOWER_SEARCH;
        if(a<t.clamp||a>=t.spit)return;
        const elapsed=a-t.clamp;
        const stage=a<t.bite?'whole':a<t.rip?'maimed-arm':a<t.crunch?'upper-half':'head-bite';
        const thrash=Math.sin(elapsed*.62)*(a<t.rip?1:.55);
        const kick=Math.sin(elapsed*.78)*(a<t.rip?1:.45);
        const hit=pulse(a,t.bite-3,3,t.bite+4,t.bite+14)+pulse(a,t.rip-3,3,t.rip+5,t.rip+14);
        const toss=pulse(a,t.drop,4,t.crunch-3,t.crunch+2);
        const wound=smoothMotion((a-t.clamp)/18);
        return {
            person:this.person,
            angle:-.14+thrash*.28+hit*.26-toss*.35,
            kick,stage,wound,thrash,
        };
    }
    get fallen(){
        if(this.age<TOWER_SEARCH.drop)return;
        const primary=this.pieces.find(p=>p.kind==='torso-stump')??this.pieces.find(p=>p.kind==='pelvis');
        if(primary)return {x:primary.x,y:primary.y,angle:primary.angle,kick:primary.kick};
        const a=Math.min(38,this.age-TOWER_SEARCH.drop),u=smoothMotion(a/38);
        return {x:this.releaseX-14*u,y:this.releaseY+(-7-this.releaseY)*u-Math.sin(Math.PI*u)*5,
            angle:this.releaseAngle+(Math.PI/2-this.releaseAngle)*u,kick:(1-u)*.2};
    }
    begin(){
        if(!this.ready)return;
        this.source={x:this.part.x,y:this.part.y,angle:this.part.angle};this.fromX=this.stance;this.age=0;
        this.pieces=[];this.splinters=[];this.stains=[];this.sprays=[];this.seed=911;
        const x=this.origin+this.source.x-8;this.person.x=x;this.person.originX=x;this.person.shelter=x-32;
    }
    advance(){
        this.tick++;this.events=[];
        this.dust=this.dust.filter(p=>this.tick-p.born<64);
        this.sprays=this.sprays.filter(p=>this.tick-p.born<44);
    }
    private disturb(strength:number,x=this.jawX,y=this.body.jawY){
        this.dust.push({x,y,born:this.tick,strength});
    }
    private addSpray(dx:number,dy:number,strength:number,x=this.jawX,y=this.body.jawY){
        this.sprays.push({x,y,dx,dy,born:this.tick,strength,seed:this.sprays.length+this.age});
    }
    private addStain(x:number,y:number,radius:number){
        if(this.stains.length<28)this.stains.push({x,y,radius,born:this.tick,seed:this.stains.length*7+this.age});
    }
    private addPiece(kind:TowerGoreKind,ox:number,oy:number,vx:number,vy:number,angle:number,spin:number,radius:number){
        this.pieces.push({kind,x:this.jawX+ox,y:this.body.jawY+oy,vx,vy,angle,spin,radius,born:this.age,bounces:0,rest:false,kick:1});
    }
    private addSplinters(count:number,vx:number,vy:number,spread:number){
        for(let i=0;i<count&&this.splinters.length<36;i++){
            this.splinters.push({
                x:this.jawX+(this.random()-.5)*6,
                y:this.body.jawY+(this.random()-.5)*5,
                vx:vx+(this.random()-.5)*spread,
                vy:vy-this.random()*spread*.85,
                born:this.age,radius:1+this.random()*1.2,
                bone:i%3===0,rest:false,
            });
        }
    }
    rubbleFloor(worldX:number){
        const lx=worldX-this.origin;
        if(lx>-46&&lx<-22)return -10-Math.round(Math.sin(lx*.35)*1.5);
        if(lx>=-22&&lx<=12)return -8-Math.round(Math.cos(lx*.28)*1.5);
        return -5;
    }
    private stepGore(){
        for(const p of this.pieces){
            if(p.rest)continue;
            const cloth=p.kind.startsWith('cloth');
            if(cloth){
                p.vy=Math.min(.95,p.vy+.045);
                p.vx*=.955;
                p.x+=p.vx+Math.sin((this.age-p.born)*.34+p.radius)*.18;
                p.y+=p.vy;p.angle+=p.spin;
            }else{
                p.vy+=.11;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;
                p.kick*=.92;
            }
            const floor=this.rubbleFloor(p.x);
            if(p.y+p.radius>=floor&&p.vy>0){
                p.y=floor-p.radius;
                if(!cloth&&p.bounces===0){
                    const r=p.kind==='pelvis'||p.kind==='torso-stump'?7:p.kind==='head'?5.5:4.5;
                    this.addStain(p.x,floor,r);
                }
                if(cloth){
                    p.vy*=-.1;p.vx*=.3;p.spin*=.25;p.bounces++;
                    if(p.bounces>=2||Math.abs(p.vy)<.14){p.rest=true;p.vx=p.vy=p.spin=0;}
                }else{
                    const bounce=p.kind==='head'?.34:.25;
                    p.vy*=-bounce;p.vx*=.52;p.spin*=.48;p.bounces++;
                    if(Math.abs(p.vy)<.16||p.bounces>=3){
                        p.rest=true;p.vx=p.vy=p.spin=0;p.kick=0;
                        if(p.kind==='head'||p.kind==='pelvis')this.angleToSurface(p);
                    }
                }
            }
        }
        for(const s of this.splinters){
            if(s.rest)continue;
            s.vy+=.12;s.x+=s.vx;s.y+=s.vy;
            const floor=this.rubbleFloor(s.x);
            if(s.y>=floor&&s.vy>0){
                s.y=floor;s.vy*=-.18;s.vx*=.42;
                if(Math.abs(s.vy)<.18){s.rest=true;s.vx=s.vy=0;}
            }
        }
    }
    private angleToSurface(p:TowerGorePiece){
        const y0=this.rubbleFloor(p.x-3);
        const y1=this.rubbleFloor(p.x+3);
        const slope=Math.atan2(y1-y0,6);
        p.angle=p.kind==='head'?slope-.2:Math.PI/2+slope*.5;
    }
    update(framed:boolean){
        this.events=[];
        // Discovery and bite wait with the same actors and props. Once released,
        // the dismembered pieces finish settling even if the camera moves away.
        if(!this.active||!framed&&this.age<TOWER_SEARCH.rip)return;
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
        if(this.age===t.clamp){
            this.events.push('distant-thud');this.disturb(.35);
            this.addSpray(-.8,-.55,.75);
            this.addStain(this.jawX-2,this.rubbleFloor(this.jawX-2),5.5);
        }
        if(this.age===t.thrash){
            this.events.push('distant-thud');
            this.addSpray(-1.05,-.4,.85);
            this.addSplinters(4,-.65,-.9,1.1);
        }
        if(this.age===t.bite){
            this.events.push('distant-thud');this.disturb(.35);
            this.addSpray(-1.15,-.65,1.05);
            this.addPiece('arm-left',-4,-1,-.45,-1.15,-.4,-.14,2.5);
            this.addPiece('cloth-left',-3,0,-.52,-.85,.2,.16,1.5);
            this.addSplinters(5,-.75,-1.1,1.3);
        }
        if(this.age===t.rip){
            this.events.push('distant-thud','distant-roar');this.disturb(.45);
            this.addSpray(-1.25,-.8,1.3);
            this.addSpray(.55,-.85,.85);
            this.addPiece('pelvis',-4,2,-.68,-1.18,-.25,-.09,3.5);
            this.addPiece('leg-left',-6,4,-1.12,-1.38,.35,.15,3);
            this.addPiece('cloth-star',-2,1,-.22,-.75,-.3,-.12,2);
            this.addSplinters(7,-.9,-1.3,1.6);
        }
        if(this.age===t.drop){
            this.releaseX=this.jawX;this.releaseY=this.body.jawY;this.releaseAngle=-.1;
            this.addSpray(.5,-.7,.75);
            this.addPiece('arm-right',3,0,.56,-1.05,.45,.13,2.5);
            this.addPiece('cloth-right',2,1,.38,-.75,-.2,-.14,1.5);
            this.addSplinters(4,.35,-.95,1.1);
        }
        if(this.age===t.crunch){
            this.events.push('distant-thud');this.disturb(.35);
            this.addSpray(-.85,-.75,1.15);
            this.addPiece('torso-stump',0,2,.14,-.72,-.18,-.07,3.5);
            this.addSplinters(6,-.45,-1.15,1.4);
        }
        if(this.age===t.spit){
            this.events.push('distant-thud');
            this.addSpray(-1.05,-.45,.9);
            this.addPiece('head',-3,0,-.28,-1.02,-.3,-.16,3);
            this.addSplinters(5,-.65,-.95,1.2);
            this.disturb(.3,this.jawX-6,-7);
        }
        this.stepGore();
    }
}
