import type {Bystander} from './HypotheticalBackdrop';
import type {CarriedBystander} from './HypotheticalBystanders';
import {smoothMotion,dinosaurHeadPoint,dinosaurMouthPoint} from './HypotheticalMotion';
import {AFTERMATH_SCALE,DEBRIS_GRIP_X} from './HypotheticalAftermathHandling';
import type {AftermathEscape} from './HypotheticalAftermathEscape';

const pulse=(age:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((age-start)/rise)*(1-smoothMotion((age-hold)/(end-hold)));

export type ForageGoreKind='arm-left'|'pelvis'|'leg-left'|'arm-right'|'torso-stump'|'head'|'cloth-star'|'cloth-left'|'cloth-right';
export interface ForageGorePiece {
    kind:ForageGoreKind;person:Bystander;x:number;y:number;vx:number;vy:number;
    angle:number;spin:number;radius:number;born:number;bornTick:number;bounces:number;rest:boolean;kick:number;
}
export interface ForageGoreSplinter {
    x:number;y:number;vx:number;vy:number;born:number;radius:number;bone:boolean;rest:boolean;
}
export interface ForageBloodStain {x:number;y:number;radius:number;born:number;seed:number}
export interface ForageBloodSpray {x:number;y:number;dx:number;dy:number;born:number;strength:number;seed:number}
export type ForageSound='distant-debris'|'distant-grit'|'distant-chain'|'distant-snort'|'distant-thud'|'distant-roar';

/**
 * Corpse-feeding and scavenging director for the aftermath yards.
 * - Variants 0 & 1: Preserved dust-occluded scavenging passages.
 * - Variant 2: Explicit Piece-by-Piece Dismemberment Feast (arm -> pelvis/legs -> right arm -> ribcage -> spit head).
 * - Variant 3: Explicit High-Lift, Skyward Toss & Whole-Body Gulp (hoist -> airborne flip -> head-first catch with kicking legs -> 3 gulps -> severed boot/leg).
 * - Variant 4: Explicit Savage Ground-Pin, Drag & Spine-Rip (ground thrash & blood smear -> both arms -> high spine rip -> crunch & skull fling).
 */
export class AftermathForage {
    selected=-1;variant=0;age=0;begunAt=-1;active=false;completed=false;
    nextAt=0;nextPerformance=0;targetX=0;stance=0;feedCount=0;
    cancelledAt=-1;contactTick=-1;contactX=0;landingTick=-1;
    jawX=0;jawY=-8;lastGoreTick=-1;
    marks:Array<{entry:number;x:number}>=[];
    pieces:ForageGorePiece[]=[];
    splinters:ForageGoreSplinter[]=[];
    stains:ForageBloodStain[]=[];
    sprays:ForageBloodSpray[]=[];
    events:ForageSound[]=[];
    private seed=733;
    constructor(readonly escape:AftermathEscape,readonly district:number){
        this.seed=733+district*197;
    }
    private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    get entry(){return this.escape.entries[this.selected];}
    get explicit(){return this.variant>=2;}
    get offset(){return this.variant===1?44:0;}
    get duration(){
        if(this.variant===2)return 340;
        if(this.variant===3)return 316;
        if(this.variant===4)return 326;
        return 284+this.offset;
    }
    get contactAt(){
        if(this.variant===2)return 68;
        if(this.variant===3)return 64;
        if(this.variant===4)return 62;
        return 96+this.offset;
    }
    get concealAt(){
        if(this.explicit)return this.contactAt;
        return 126+this.offset;
    }
    get rootShift(){
        if(!this.explicit){
            const m=this.motion();return m.support*2.8-m.release*.7;
        }
        const a=this.age;
        if(this.variant===2){
            const lunge=pulse(a,42,20,264,300)*2.8;
            const shake=Math.sin((a-68)*.65)*2.2*pulse(a,70,6,106,114);
            const wrench=pulse(a,170,6,184,200)*-4.2;
            const crunch=pulse(a,232,4,242,256)*1.8;
            return lunge+shake+wrench+crunch;
        }
        if(this.variant===3){
            const brace=pulse(a,38,20,248,288)*2.4;
            const shake=Math.sin((a-66)*.68)*2.5*pulse(a,68,6,120,128);
            const toss=pulse(a,130,5,142,154)*-3.2+pulse(a,150,4,160,174)*2.8;
            return brace+shake+toss;
        }
        const pin=pulse(a,38,18,252,292)*3.2;
        const drag=Math.sin((a-64)*.42)*4.2*pulse(a,64,6,130,140);
        const rip=pulse(a,144,6,158,176)*-4.8;
        return pin+drag+rip;
    }
    get goreLevel(){
        if(this.explicit&&this.active&&this.age>=this.contactAt)return 1;
        if(this.lastGoreTick>=0)return .85;
        return 0;
    }
    available(index:number,tick:number,visible:(x:number,margin:number)=>boolean){
        const e=this.escape.entries[index];
        if(!e||e.person.hitAt===null||e.person.escaped||e.person.foraged||e.person.capturedAt!==undefined
            ||!e.completed||e.removedAt>=0||e.settledAt<0||tick-e.settledAt<180
            ||Math.abs(e.hitVelocity)>.05||Math.abs(e.person.velocity)>.05)return false;
        const target=e.person.x+12,stance=target-DEBRIS_GRIP_X*AFTERMATH_SCALE;
        return visible(target,32)&&visible(stance,56);
    }
    candidate(tick:number,performed:number,visible:(x:number,margin:number)=>boolean,actorX=this.escape.origin+222){
        if(this.active||this.escape.active||tick<this.nextAt||performed<this.nextPerformance)return -1;
        return this.escape.entries.map((entry,index)=>({entry,index}))
            .filter(({index})=>this.available(index,tick,visible))
            .sort((a,b)=>Number(a.entry.kind==='fallen')-Number(b.entry.kind==='fallen')
                ||Math.abs(a.entry.person.x-actorX)-Math.abs(b.entry.person.x-actorX)||a.index-b.index)[0]?.index??-1;
    }
    prepare(index:number){
        this.selected=index;
        if(this.feedCount===0){
            this.variant=([2,3,4,3] as const)[this.district%4];
        }else if(this.feedCount===1){
            this.variant=([3,2,3,2] as const)[this.district%4];
        }else{
            this.variant=([4,0,1,2,3] as const)[(this.feedCount-2+this.district)%5];
        }
        this.targetX=this.entry.person.x+12;this.stance=this.targetX-DEBRIS_GRIP_X*AFTERMATH_SCALE;
    }
    begin(tick:number,performed:number,visible:(x:number,margin:number)=>boolean=()=>true){
        if(this.active||this.escape.active||!this.available(this.selected,tick,visible)
            ||Math.abs(this.entry.person.x+12-this.targetX)>3)return false;
        this.begunAt=tick;this.age=0;this.active=true;this.completed=false;
        this.cancelledAt=-1;this.contactTick=-1;this.contactX=this.targetX;this.landingTick=-1;
        this.jawX=this.targetX;this.jawY=-8;this.events=[];
        this.feedCount++;
        this.nextAt=tick+540;this.nextPerformance=performed+2;
        return true;
    }
    private addSpray(tick:number,dx:number,dy:number,strength:number,x=this.jawX,y=this.jawY){
        this.sprays.push({x,y,dx,dy,born:tick,strength,seed:this.sprays.length+this.age});
    }
    private addStain(tick:number,x:number,y:number,radius:number){
        if(this.stains.length<36)this.stains.push({x,y,radius,born:tick,seed:this.stains.length*7+this.age});
    }
    private addPiece(tick:number,kind:ForageGoreKind,ox:number,oy:number,vx:number,vy:number,angle:number,spin:number,radius:number){
        const person=this.entry?.person;if(!person)return;
        this.pieces.push({kind,person,x:this.jawX+ox,y:this.jawY+oy,vx,vy,angle,spin,radius,born:this.age,bornTick:tick,bounces:0,rest:false,kick:1});
    }
    private addSplinters(tick:number,count:number,vx:number,vy:number,spread:number){
        for(let i=0;i<count&&this.splinters.length<44;i++){
            this.splinters.push({
                x:this.jawX+(this.random()-.5)*6,
                y:this.jawY+(this.random()-.5)*5,
                vx:vx+(this.random()-.5)*spread,
                vy:vy-this.random()*spread*.85,
                born:tick,radius:1+this.random()*1.2,
                bone:i%3===0,rest:false,
            });
        }
    }
    stepGore(tick:number){
        this.sprays=this.sprays.filter(p=>tick-p.born<44);
        const floor=-3.5;
        for(const p of this.pieces){
            if(p.rest)continue;
            const cloth=p.kind.startsWith('cloth');
            if(cloth){
                p.vy=Math.min(.95,p.vy+.045);p.vx*=.955;
                p.x+=p.vx+Math.sin((tick-p.bornTick)*.34+p.radius)*.18;
                p.y+=p.vy;p.angle+=p.spin;
            }else{
                p.vy+=.11;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;p.kick*=.92;
            }
            if(p.y+p.radius>=floor&&p.vy>0){
                p.y=floor-p.radius;
                if(!cloth&&p.bounces===0){
                    const r=p.kind==='pelvis'||p.kind==='torso-stump'?6.8:p.kind==='head'?5.2:4.2;
                    this.addStain(tick,p.x,floor,r);
                }
                if(cloth){
                    p.vy*=-.1;p.vx*=.3;p.spin*=.25;p.bounces++;
                    if(p.bounces>=2||Math.abs(p.vy)<.14){p.rest=true;p.vx=p.vy=p.spin=0;}
                }else{
                    const bounce=p.kind==='head'?.34:.25;
                    p.vy*=-bounce;p.vx*=.52;p.spin*=.48;p.bounces++;
                    if(Math.abs(p.vy)<.16||p.bounces>=3){
                        p.rest=true;p.vx=p.vy=p.spin=0;p.kick=0;
                        p.angle=p.kind==='head'?-.18:Math.PI/2;
                    }
                }
            }
        }
        for(const s of this.splinters){
            if(s.rest)continue;
            s.vy+=.12;s.x+=s.vx;s.y+=s.vy;
            if(s.y>=floor&&s.vy>0){
                s.y=floor;s.vy*=-.18;s.vx*=.42;
                if(Math.abs(s.vy)<.18){s.rest=true;s.vx=s.vy=0;}
            }
        }
    }
    update(tick:number,jawX=this.targetX,jawY=-8){
        this.events=[];
        this.stepGore(tick);
        if(!this.active)return;
        this.age=tick-this.begunAt;
        this.jawX=jawX;this.jawY=jawY;
        if(this.age>=this.concealAt&&this.entry&&this.entry.removedAt<0){
            this.entry.removedAt=tick;
            this.entry.person.foraged=true;
        }
        if(this.explicit){
            this.lastGoreTick=tick;
            const a=this.age;
            if(this.variant===2){
                if(a===68){
                    this.events.push('distant-thud');
                    this.addStain(tick,jawX,-3.5,6);
                    this.addSpray(tick,.75,-.5,.8);
                }
                if(a===86){
                    this.events.push('distant-thud');
                    this.addSpray(tick,.95,-.45,.85);
                    this.addSplinters(tick,4,.55,-.85,1.1);
                }
                if(a===112){
                    this.events.push('distant-thud');
                    this.addSpray(tick,-.95,-.65,1.05);
                    this.addPiece(tick,'arm-left',-3,-1,-.58,-1.12,-.35,-.14,2.5);
                    this.addPiece(tick,'cloth-left',-2,0,-.45,-.82,.2,.16,1.5);
                    this.addSplinters(tick,5,-.65,-1.05,1.3);
                }
                if(a===176){
                    this.events.push('distant-thud','distant-roar');
                    this.addSpray(tick,1.25,-.8,1.35);
                    this.addSpray(tick,-.65,-.85,.9);
                    this.addPiece(tick,'pelvis',4,2,.72,-1.18,.25,.09,3.5);
                    this.addPiece(tick,'leg-left',6,4,1.15,-1.36,-.35,-.15,3);
                    this.addPiece(tick,'cloth-star',2,1,.28,-.76,.3,.12,2);
                    this.addSplinters(tick,7,.85,-1.28,1.6);
                }
                if(a===212){
                    this.addSpray(tick,-.55,-.7,.75);
                    this.addPiece(tick,'arm-right',-3,0,-.52,-1.02,-.42,-.13,2.5);
                    this.addPiece(tick,'cloth-right',-2,1,-.36,-.74,.2,.14,1.5);
                    this.addSplinters(tick,4,-.35,-.92,1.1);
                }
                if(a===236){
                    this.events.push('distant-thud');
                    this.addSpray(tick,.9,-.75,1.15);
                    this.addPiece(tick,'torso-stump',1,2,.18,-.74,.18,.07,3.5);
                    this.addSplinters(tick,6,.45,-1.15,1.4);
                }
                if(a===264){
                    this.events.push('distant-thud');
                    this.addSpray(tick,1.1,-.5,.95);
                    this.addPiece(tick,'head',4,0,.86,-1.05,.3,.16,3);
                    this.addSplinters(tick,5,.7,-.95,1.2);
                }
            }else if(this.variant===3){
                if(a===64){
                    this.events.push('distant-thud');
                    this.addStain(tick,jawX,-3.5,6);
                    this.addSpray(tick,.75,-.5,.75);
                }
                if(a===88||a===110){
                    this.events.push('distant-thud');
                    this.addSpray(tick,a===88?1.0:-.85,-.5,.85);
                    this.addSplinters(tick,3,a===88?.6:-.5,-.8,1.0);
                }
                if(a===134){
                    this.events.push('distant-roar');
                    this.addSpray(tick,.6,-.85,.8);
                }
                if(a===152){
                    this.events.push('distant-thud');
                    this.addSpray(tick,1.05,-.7,1.15);
                    this.addSplinters(tick,5,.65,-1.05,1.25);
                }
                if(a===176){
                    this.events.push('distant-thud');
                    this.addSpray(tick,.8,-.55,.85);
                    this.addPiece(tick,'cloth-star',3,0,.38,-.72,.25,.14,2);
                }
                if(a===202){
                    this.events.push('distant-thud');
                    this.addSpray(tick,.9,-.5,.85);
                    this.addSplinters(tick,4,.55,-.9,1.1);
                }
                if(a===228){
                    this.events.push('distant-thud');
                    this.addSpray(tick,1.15,-.65,1.15);
                    this.addPiece(tick,'leg-left',5,2,.88,-1.08,-.3,-.15,3);
                    this.addPiece(tick,'arm-left',3,1,.46,-.92,.35,.13,2.5);
                    this.addSplinters(tick,6,.75,-1.1,1.35);
                }
            }else if(this.variant===4){
                if(a===62){
                    this.events.push('distant-thud');
                    this.addStain(tick,jawX,-3.5,6.2);
                    this.addSpray(tick,.8,-.45,.8);
                }
                if(a===84){
                    this.events.push('distant-thud');
                    this.addStain(tick,jawX-4,-3.5,5.5);
                    this.addSpray(tick,-.95,-.55,.95);
                    this.addPiece(tick,'arm-left',-3,-1,-.64,-1.05,-.38,-.15,2.5);
                    this.addPiece(tick,'cloth-left',-2,0,-.48,-.78,.2,.15,1.5);
                    this.addSplinters(tick,5,-.6,-.95,1.2);
                }
                if(a===112){
                    this.events.push('distant-thud');
                    this.addStain(tick,jawX+4,-3.5,5.5);
                    this.addSpray(tick,.95,-.6,1.0);
                    this.addPiece(tick,'arm-right',3,-1,.62,-1.05,.4,.14,2.5);
                    this.addPiece(tick,'cloth-right',2,0,.44,-.76,-.2,-.14,1.5);
                    this.addSplinters(tick,5,.6,-.95,1.2);
                }
                if(a===148){
                    this.events.push('distant-thud','distant-roar');
                    this.addSpray(tick,1.2,-.85,1.35);
                    this.addSpray(tick,-.75,-.8,.95);
                    this.addPiece(tick,'pelvis',3,2,.66,-1.16,.24,.09,3.5);
                    this.addPiece(tick,'leg-left',5,4,1.08,-1.32,-.32,-.14,3);
                    this.addPiece(tick,'cloth-star',1,1,.22,-.74,.28,.12,2);
                    this.addSplinters(tick,8,.8,-1.25,1.6);
                }
                if(a===214){
                    this.events.push('distant-thud');
                    this.addSpray(tick,-.85,-.75,1.1);
                    this.addPiece(tick,'torso-stump',-1,2,-.28,-.78,-.2,-.08,3.5);
                    this.addSplinters(tick,6,-.4,-1.1,1.35);
                }
                if(a===246){
                    this.events.push('distant-thud');
                    this.addSpray(tick,1.15,-.55,1.0);
                    this.addPiece(tick,'head',4,0,1.02,-1.12,.34,.17,3);
                    this.addSplinters(tick,5,.8,-1.0,1.25);
                }
            }
        }
        if(this.age>=this.duration){this.active=false;this.completed=true;}
    }
    get carried():CarriedBystander|undefined {
        if(!this.explicit||!this.active||!this.entry)return;
        const a=this.age,p=this.entry.person;
        if(this.variant===2){
            if(a<68||a>=264)return;
            const elapsed=a-68;
            const stage=a<112?'whole':a<176?'maimed-arm':a<236?'upper-half':'head-bite';
            const thrash=Math.sin(elapsed*.62)*(a<176?1:.55);
            const kick=Math.sin(elapsed*.78)*(a<176?1:.45);
            const hit=pulse(a,109,3,116,126)+pulse(a,173,3,181,192);
            const toss=pulse(a,212,4,232,238);
            const wound=smoothMotion(elapsed/18);
            return {person:p,angle:.16+thrash*.26-hit*.24+toss*.32,kick,stage,wound,thrash};
        }
        if(this.variant===3){
            if(a<64||a>=228)return;
            const elapsed=a-64;
            const stage=a<152?'whole':a<202?'legs-only':'shins-only';
            const thrash=Math.sin(elapsed*.68)*(a<152?1:.65);
            const kick=Math.sin(elapsed*.86)*(a<152?1:1.35);
            const u=Math.max(0,Math.min(1,(a-134)/18));
            const tossProgress=smoothMotion(u);
            const inAir=a>=134&&a<152;
            const offsetY=inAir?-8.5*Math.sin(Math.PI*u):stage==='legs-only'?-1:0;
            const offsetX=a<134?2:inAir?2+4*u:stage==='legs-only'?7:8;
            const angle=a<134?.18+thrash*.28
                :a<152?.18+(-1.42-.18)*tossProgress
                :-1.42+Math.sin((a-152)*.65)*.16;
            const wound=smoothMotion(elapsed/16);
            return {person:p,angle,kick,stage,wound,thrash,offsetX,offsetY};
        }
        if(a<62||a>=246)return;
        const elapsed=a-62;
        const stage=a<84?'whole':a<148?'maimed-arm':a<214?'upper-half':'head-bite';
        const thrash=Math.sin(elapsed*.64)*(a<148?1.1:.55);
        const kick=Math.sin(elapsed*.82)*(a<148?1.1:.45);
        const rip=pulse(a,145,4,154,166);
        const wound=smoothMotion(elapsed/14);
        return {person:p,angle:.22+thrash*.3-rip*.35,kick,stage,wound,thrash};
    }
    cancel(tick:number){if(this.active)this.cancelledAt=tick;this.active=false;}
    contact(tick:number,x:number){
        this.contactTick=tick;this.contactX=x;
        if(!this.explicit){
            this.landingTick=tick+Math.ceil(Math.min(...Array.from({length:9},(_,j)=>j+forageGrain(j,0,this.district).landing)));
        }
        if(!this.marks.some(m=>m.entry===this.selected))this.marks.push({entry:this.selected,x});
    }
    coverAt(tick:number){
        if(this.explicit||this.begunAt<0||this.contactTick<0)return 0;
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
    private explicitBody(breath:number,reduced:boolean){
        const a=this.age;
        if(this.variant===2){
            const sniff=pulse(a,16,8,28,40)+pulse(a,36,6,43,50)*.6;
            const descend=pulse(a,42,24,66,76);
            const hoist=pulse(a,68,20,148,162);
            const shake=Math.sin((a-68)*.62)*pulse(a,70,5,104,112);
            const biteArm=pulse(a,108,5,116,128);
            const pinLow=pulse(a,150,14,170,176);
            const ripTorso=pulse(a,172,6,186,210);
            const toss=pulse(a,210,5,222,234);
            const crunch=pulse(a,232,4,242,256);
            const spit=pulse(a,260,4,268,282);
            const swallow=Math.max(
                smoothMotion((a-120)/26)*(1-smoothMotion((a-144)/6)),
                smoothMotion((a-240)/22)*(1-smoothMotion((a-260)/5)),
            );
            const active=pulse(a,40,22,272,312);
            const bow=descend*.48+pinLow*.42-hoist*.12-ripTorso*.24+crunch*.18+sniff*.12;
            const compression=descend*2.2+Math.abs(shake)*2+biteArm*2.6+pinLow*2.4+ripTorso*2.8+crunch*3.4;
            const jaw=.1+pulse(a,50,12,64,70)*.72
                +Math.abs(shake)*.18
                +pulse(a,104,5,110,115)*.46
                +pulse(a,166,5,174,180)*.48
                +toss*.62+spit*.65;
            const headPitch=descend*.16-hoist*.06+shake*.08-biteArm*.14+pinLow*.15-ripTorso*.2-toss*.12+crunch*.1+spit*.14;
            const desiredY=-28+descend*20-hoist*14+shake*4.5-biteArm*6+pinLow*17-ripTorso*22-toss*5+crunch*6;
            const mouth=dinosaurHeadPoint([DEBRIS_GRIP_X,10+jaw*6],0,headPitch);
            const aligned=desiredY/AFTERMATH_SCALE+59-bow*25-breath-compression-mouth[1];
            const savage=Math.max(biteArm,ripTorso,crunch,Math.abs(shake)*.75);
            return {
                bow,compression,jaw,headPitch,swallow,
                neckDrop:aligned*active+sniff*5,
                tail:-descend*.14+shake*.24+ripTorso*.26-crunch*.16,
                riderDrop:descend*1.8+Math.abs(shake)*1.8+biteArm*2.2+ripTorso*2.4+crunch*2.8,
                riderLean:-descend*2.4+shake*2.2-biteArm*3+ripTorso*3.8-crunch*3.5,
                rein:Math.max(active*.85,savage),
                lookBack:pulse(a,280,14,310,336)*.25,
                aim:.14+active*.16,
                focus:Math.max(active,savage),
                eyeClose:Math.max(sniff*.5,biteArm*.6,ripTorso*.5,crunch*.85),
                voice:Math.max(biteArm*.35,ripTorso*.8,crunch*.45,spit*.35),
                cloth:reduced?0:savage*2.8+Math.abs(shake)*2.2,
                brace:Math.max(active*.55,savage*.85),tuck:0,stride:0,breath,recoil:0,heat:0,reload:0,lift:0,pivot:0,
            };
        }
        if(this.variant===3){
            const sniff=pulse(a,16,8,28,40);
            const descend=pulse(a,38,22,62,72);
            const hoist=pulse(a,66,24,234,268);
            const shake=Math.sin((a-68)*.68)*pulse(a,70,5,120,128);
            const toss=pulse(a,130,5,146,154);
            const catchSnap=pulse(a,150,3,158,170);
            const gulp1=pulse(a,172,5,180,192);
            const gulp2=pulse(a,198,5,206,218);
            const gulp3=pulse(a,224,4,234,248);
            const swallow=Math.max(
                smoothMotion((a-176)/22)*(1-smoothMotion((a-196)/5)),
                smoothMotion((a-202)/22)*(1-smoothMotion((a-222)/5)),
                smoothMotion((a-228)/28)*(1-smoothMotion((a-254)/6)),
            );
            const active=pulse(a,36,20,256,296);
            const gulps=gulp1+gulp2+gulp3;
            const bow=descend*.48-hoist*.12-toss*.08+catchSnap*.15-gulps*.06+sniff*.12;
            const compression=descend*2.2+Math.abs(shake)*2.2+catchSnap*3.6+gulps*2.6;
            const jaw=.1+pulse(a,46,12,60,66)*.76
                +Math.abs(shake)*.16
                +toss*.86
                +pulse(a,152,4,224,230)*.34
                +gulp1*.32+gulp2*.34+gulp3*.18;
            const headPitch=descend*.16-hoist*.11+shake*.08-toss*.09+catchSnap*.08-gulps*.06;
            const desiredY=-28+descend*20-hoist*14+shake*4-toss*6+catchSnap*5-gulps*3;
            const mouth=dinosaurHeadPoint([DEBRIS_GRIP_X,10+jaw*6],0,headPitch);
            const aligned=desiredY/AFTERMATH_SCALE+59-bow*25-breath-compression-mouth[1];
            const savage=Math.max(toss,catchSnap,gulps,Math.abs(shake)*.8);
            return {
                bow,compression,jaw,headPitch,swallow,
                neckDrop:aligned*active+sniff*5,
                tail:-descend*.14+shake*.25-hoist*.14+toss*.22-catchSnap*.16,
                riderDrop:descend*1.8+Math.abs(shake)*2+catchSnap*3+gulps*2.2,
                riderLean:-descend*2.4+hoist*2+shake*2.4+toss*3.5-catchSnap*3.8+gulps*2.4,
                rein:Math.max(active*.85,savage),
                lookBack:pulse(a,268,14,292,312)*.24,
                aim:.12+active*.14-hoist*.18,
                focus:Math.max(active,savage),
                eyeClose:Math.max(sniff*.5,catchSnap*.75,gulps*.65),
                voice:Math.max(toss*.8,catchSnap*.45,gulps*.4),
                cloth:reduced?0:savage*2.8+Math.abs(shake)*2.4,
                brace:Math.max(active*.55,savage*.85),tuck:0,stride:0,breath,recoil:0,heat:0,reload:0,lift:0,pivot:0,
            };
        }
        const sniff=pulse(a,14,8,26,38);
        const pin=pulse(a,36,20,136,148);
        const dragWave=Math.sin((a-64)*.58)*pulse(a,64,5,132,142);
        const rip=pulse(a,144,6,196,214);
        const crunch=pulse(a,210,4,222,238);
        const spit=pulse(a,242,4,252,266);
        const swallow=smoothMotion((a-216)/26)*(1-smoothMotion((a-240)/6));
        const active=pulse(a,34,20,262,302);
        const bow=pin*.54-rip*.24+crunch*.2+sniff*.12;
        const compression=pin*2.8+Math.abs(dragWave)*2.4+rip*3+crunch*3.5;
        const jaw=.1+pulse(a,44,12,58,64)*.74
            +Math.abs(dragWave)*.24
            +pulse(a,80,4,86,92)*.42
            +pulse(a,108,4,114,120)*.44
            +pulse(a,142,5,150,158)*.52
            +crunch*.28+spit*.68;
        const headPitch=pin*.17+dragWave*.09-rip*.2+crunch*.1+spit*.15;
        const desiredY=-28+pin*19+dragWave*3.5-rip*24+crunch*6;
        const mouth=dinosaurHeadPoint([DEBRIS_GRIP_X,10+jaw*6],0,headPitch);
        const aligned=desiredY/AFTERMATH_SCALE+59-bow*25-breath-compression-mouth[1];
        const savage=Math.max(rip,crunch,spit,Math.abs(dragWave)*.85);
        return {
            bow,compression,jaw,headPitch,swallow,
            neckDrop:aligned*active+sniff*5,
            tail:-pin*.16+dragWave*.28+rip*.28-crunch*.18,
            riderDrop:pin*2+Math.abs(dragWave)*2.2+rip*2.6+crunch*3,
            riderLean:-pin*2.8+dragWave*2.6+rip*4-crunch*3.6,
            rein:Math.max(active*.85,savage),
            lookBack:pulse(a,272,14,298,322)*.24,
            aim:.15+active*.18,
            focus:Math.max(active,savage),
            eyeClose:Math.max(sniff*.5,rip*.55,crunch*.85),
            voice:Math.max(rip*.85,crunch*.45,spit*.4),
            cloth:reduced?0:savage*3+Math.abs(dragWave)*2.5,
            brace:Math.max(active*.6,savage*.88),tuck:0,stride:0,breath,recoil:0,heat:0,reload:0,lift:0,pivot:0,
        };
    }
    body(breath:number,reduced:boolean){
        if(this.explicit)return this.explicitBody(breath,reduced);
        const m=this.motion(),head=this.motion(this.age-3),r=this.motion(this.age-6),tailMotion=this.motion(this.age-9);
        const bow=m.support*.52+m.sniff*.12-m.listen*.07;
        const compression=m.support*2.4+m.settle*.65-m.release*.35;
        const jaw=.12-m.attention*.04+pulse(this.age,62+this.offset,19,92+this.offset,116+this.offset)*.22+head.shift*.06;
        const jawHinge=jaw*.38;
        const desiredY=-8+m.settle*.8+m.shift*.55;
        const headPitch=m.lower*.15+head.sniff*.07-head.listen*.08-head.release*.09+head.clear*.035;
        const mouth=dinosaurMouthPoint(0,jaw,headPitch,jawHinge);
        const aligned=desiredY/AFTERMATH_SCALE+59-bow*25-breath-compression-mouth[1];
        return {bow,compression,jaw,headPitch,jawHinge,swallow:0,
            // The skull meets a fixed ground point; the trunk, knees and neck
            // share the descent rather than stretching only the neck.
            neckDrop:aligned*m.lower+m.sniff*5-m.listen*5+m.clear*3,
            tail:-tailMotion.support*.14-m.listen*.035+tailMotion.release*.025+m.clear*.055,
            riderDrop:r.support*1.8+r.settle*.5-r.release*.4,riderLean:-r.support*2-r.listen*2.4-r.clear*1.4+r.release*1.2,
            rein:Math.max(r.lower*.8,r.attention*.45,r.listen*.65),
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
