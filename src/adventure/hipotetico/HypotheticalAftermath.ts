import { smoothMotion, riderBend } from './HypotheticalMotion';
import { scenicDistrict, SCENIC_STARTS } from './HypotheticalDevastation';
import { SIEGE_SECTORS, SIEGE_WIDTH } from './HypotheticalSiege';
import type { Bystander } from './HypotheticalBackdrop';
import {gunRecoil,type GunImpact,type GunTrace} from './HypotheticalGunfire';
import {AFTERMATH_PROPS,AFTERMATH_SCORES,aftermathReach,aftermathActionTiming,type AftermathAction} from './HypotheticalAftermathScore';

/** These small service yards belong to the rear street, never to Feka's collision layer. */
export const AFTERMATH_YARDS = SIEGE_SECTORS.map((s, district) => ({
    origin: s.origin + (district === 0 ? 256 : 0),
    kind: (['timber', 'cargo', 'vent', 'masonry'] as const)[district],
    start: district === 0 ? 634 : 278,
}));
type Activity = 'approach' | 'search' | 'rummage' | 'listen' | 'flush' | 'turn-out' | 'patrol' | 'survey' | 'turn-back' | 'return' | 'watch'
    | 'roam' | 'orient' | 'perform' | 'recover';
type Sound = 'distant-debris' | 'distant-thud' | 'distant-shot' | 'distant-hit' | 'distant-roar';
export interface AftermathContact { x:number; y?:number; born:number; strength:number; kind:'scrape'|'break'|'step'; material?:'timber'|'stone'|'iron' }
interface AmbientShot extends GunTrace {targetX:number;targetY:number;remaining:number;prop:number}
export interface AftermathYard {
    damage: number; shiftedAt:number; brokenAt:number; birdsAt:number; runnerAt:number;
    people:Bystander[];
    props:Array<{wear:number;struckAt:number;force:number}>;
    birdsFlights:number;roarAt:number;
}
const pulse = (age:number, rise:number, hold:number, end:number) =>
    smoothMotion(age/rise) * (1-smoothMotion((age-hold)/(end-hold)));

/** A second clock keeps the current street alive without unlocking or consuming the next one.
 * Contacts wait BEFORE anticipation if their actual prop is outside Feka's viewport.
 * Damage and escaped actors persist, so an extended fight never repeats the same demolition. */
export class HypotheticalAftermath {
    district = -1; active = false; tick = 0; age = 0; cycle = 0;
    phase:Activity = 'approach'; x = 0; velocity = 0; travel = 0; facing = 1;
    events:Sound[] = []; contacts:AftermathContact[] = [];
    action:AftermathAction='ram'; actionCount=0; variant=0; targetProp=-1;
    targetX=0;targetY=0; muzzle=0;heat=0;
    shots:AmbientShot[]=[];impacts:GunImpact[]=[];
    casings:Array<{x:number;y:number;born:number;direction:number}>=[];
    readonly yards:AftermathYard[] = AFTERMATH_YARDS.map((yard, district) => ({
        damage:0, shiftedAt:-1, brokenAt:-1, birdsAt:-1, runnerAt:-1,birdsFlights:0,roarAt:-1,
        props:AFTERMATH_PROPS.map(()=>({wear:0,struckAt:-1,force:0})),
        people:[0,1].map(i => ({
            x:yard.origin+290-i*6, originX:yard.origin+290-i*6, shelter:yard.origin+(district===3?342:354),
            escaped:false, fleeing:true, hitAt:null, color:(district+i)%4,
            distance:0, velocity:0, alertAt:Number.MAX_SAFE_INTEGER, speed:1, district,
            clothes:i===0?'satchel':'workcoat', stoppedAt:null, threatenedAt:null, startledAt:null,
            reactionTimes:[], appearance:11+district+i, depth:-3-i*2, exitAtShelter:true, runTicks:60+i*8,
        })),
    }));
    private fromX = 0;
    private fromFacing = 1;
    private lastStep = 0;
    private destination=0;
    private destinationFacing=1;
    private roamTicks=72;
    private orientThen:'roam'|'perform'|'search'='perform';
    private roamThen:'perform'|'search'='perform';
    private recent:AftermathAction[]=[];
    private viewX=0;
    private planView=0;

    get yard(){ return this.yards[this.district]; }
    get origin(){ return AFTERMATH_YARDS[this.district]?.origin ?? 0; }
    get stride(){ return Math.min(1, Math.abs(this.velocity)/1.05); }
    get duration(){
        switch(this.phase){
            case 'approach': return 82;
            case 'search': return 126 + (this.district%2)*18;
            case 'rummage': return 108;
            case 'listen': return 84;
            case 'flush': return 126;
            case 'turn-out': case 'turn-back': return 44;
            case 'patrol': case 'return': return 124;
            case 'survey': return 104 + (this.cycle%3)*19;
            case 'watch': return 74;
            case 'roam': return this.roamTicks;
            case 'orient': return 36;
            case 'perform': return aftermathActionTiming(this.action,this.variant).duration;
            case 'recover': return 32+(this.variant%3)*8;
        }
    }
    private enter(phase:Activity){
        this.phase=phase; this.age=0; this.fromX=this.x; this.fromFacing=this.facing;
        if(phase==='perform')this.recent=[...this.recent,this.action].slice(-2);
    }
    private contact(kind:AftermathContact['kind'],x:number,strength:number){
        this.contacts.push({kind,x,strength,born:this.tick});
        if(kind!=='step')this.events.push(kind==='break'?'distant-thud':'distant-debris');
    }
    private inView(x:number,margin=20){return x>=this.viewX+margin&&x<=this.viewX+320-margin;}
    private orient(facing:number,next:'roam'|'perform'|'search'){
        this.destinationFacing=facing;this.orientThen=next;
        this.enter(this.facing===facing?next:'orient');
    }
    /** A rotating score changes order each lap and excludes the two last
     * performances. Placement is chosen before anticipation, not during impact. */
    private plan(){
        this.roamThen='perform';
        const order=AFTERMATH_SCORES[this.district],lap=Math.floor(this.actionCount/order.length);
        const candidates=Array.from({length:order.length},(_,j)=>order[(this.actionCount+lap*2+j)%order.length]);
        this.variant=this.actionCount+this.district;this.actionCount++;this.cycle=Math.floor(this.actionCount/3);
        const lo=Math.max(this.origin+66,this.viewX+64),hi=Math.min(this.origin+372,this.viewX+256);
        let target:{i:number;facing:number;x:number}|undefined;
        for(const action of candidates.filter(a=>!this.recent.includes(a))){
            const options=AFTERMATH_PROPS.flatMap((p,i)=>[-1,1].map(facing=>{
                const ideal=this.origin+p.offset-facing*aftermathReach(action);
                return {i,facing,x:action==='fire'?Math.max(lo,Math.min(hi,ideal)):ideal};
            })).filter(p=>p.x>=lo&&p.x<=hi&&this.inView(this.origin+AFTERMATH_PROPS[p.i].offset,26)
                &&(action!=='fire'||(this.origin+AFTERMATH_PROPS[p.i].offset-p.x)*p.facing>40));
            options.sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x)
                +(a.i===this.targetProp?55:0)-(b.i===this.targetProp?55:0));
            if(options.length){this.action=action;target=options[0];break;}
        }
        this.targetProp=target?.i??-1;
        if(!target)this.action='bellow';
        this.targetX=target?this.origin+AFTERMATH_PROPS[target.i].offset:this.x;
        this.targetY=target?AFTERMATH_PROPS[target.i].top:0;
        this.destination=target?.x??(lo<=hi?Math.max(lo,Math.min(hi,this.x)):this.origin+222);
        this.roamTicks=Math.max(48,Math.min(144,Math.ceil(Math.abs(this.destination-this.x)*1.45)));
        this.planView=this.viewX;
        this.destinationFacing=target?.facing??this.facing;
        const finalFacing=this.destinationFacing;
        // First turn toward the walking direction; then plant and turn toward
        // the selected target. No backwards gliding or instantaneous mirroring.
        this.orient(Math.abs(this.destination-this.x)>2?Math.sign(this.destination-this.x):this.facing,'roam');
        this.destinationFacing=finalFacing;
    }
    private hitProp(prop:number,x:number,y:number,strength:number,kind:AftermathContact['kind']){
        if(!this.inView(x)||prop<0)return;
        const s=this.yard.props[prop];s.wear=Math.min(3,s.wear+1);s.struckAt=this.tick;s.force=strength;
        this.contact(kind,x,strength);
        Object.assign(this.contacts[this.contacts.length-1],{y,material:AFTERMATH_PROPS[prop].material});
    }
    private scatterBirds(){
        if(this.yard.birdsAt<0||this.tick-this.yard.birdsAt>1630){
            this.yard.birdsAt=this.tick;this.yard.birdsFlights++;
        }
    }
    get barrel(){
        const p=this.pose(false),scale=.6875,r=p.recoil-p.tuck*10;
        const shoulder={x:this.x+this.facing*(7-r+riderBend(14,p.riderLean))*scale,
            y:p.lift+(-78+p.compression+p.riderDrop)*scale};
        return {x:shoulder.x+this.facing*Math.cos(p.aim)*31*scale,y:shoulder.y+Math.sin(p.aim)*31*scale,
            dx:this.facing*Math.cos(p.aim),dy:Math.sin(p.aim)};
    }
    private fire(){
        if(this.targetProp<0||!this.inView(this.targetX,16)||!this.inView(this.x,24))return;
        this.muzzle=5;this.heat=Math.min(1,this.heat+.22);
        const m=this.barrel,dx=this.targetX-m.x,dy=this.targetY-m.y,d=Math.hypot(dx,dy),speed=5.8;
        this.shots.push({x:m.x,y:m.y,vx:dx/d*speed,vy:dy/d*speed,age:0,
            targetX:this.targetX,targetY:this.targetY,remaining:d,prop:this.targetProp});
        this.casings.push({x:m.x-m.dx*15,y:m.y-m.dy*15,born:this.tick,direction:this.facing});
        this.events.push('distant-shot');
    }
    private routine(){
        this.age++;
        if(this.phase==='orient'){
            if(this.age===18)this.facing=this.orientThen==='roam'?Math.sign(this.destination-this.x)||this.facing:this.destinationFacing;
            if(this.age>=this.duration)this.enter(this.orientThen);
        }else if(this.phase==='roam'){
            this.x=this.fromX+(this.destination-this.fromX)*smoothMotion(this.age/this.duration);
            if(this.age>=this.duration)this.orient(this.destinationFacing,this.roamThen);
        }else if(this.phase==='perform'){
            const timing=aftermathActionTiming(this.action,this.variant),a=this.age;
            if(this.action==='ram')this.x=this.fromX+this.facing*8*pulse(a-20,28,34,84);
            if(this.action==='rake')this.x=this.fromX+this.facing*3*pulse(a,26,96,124);
            if(timing.beats.includes(a)){
                if(this.action==='bellow'){
                    if(this.inView(this.x)){
                        this.events.push('distant-roar');this.yard.roarAt=this.tick;this.scatterBirds();
                        for(const p of this.yard.props){p.struckAt=this.tick;p.force=.18;}
                    }
                }else{
                    const y=this.action==='stomp'?0:this.action==='tail'?-9:this.targetY;
                    this.hitProp(this.targetProp,this.targetX,y,this.action==='rake'?.55:1,this.action==='rake'?'scrape':'break');
                }
            }
            if(timing.shots.includes(a))this.fire();
            if(a>=this.duration)this.enter('recover');
        }else if(this.age>=this.duration){
            if(this.yard.damage<2&&this.inView(this.origin+272,48)){
                this.destination=this.origin+222;this.roamThen='search';this.planView=this.viewX;
                this.roamTicks=Math.max(48,Math.min(144,Math.ceil(Math.abs(this.destination-this.x)*1.45)));
                this.orient(Math.sign(this.destination-this.x)||this.facing,'roam');this.destinationFacing=1;
            }
            else this.plan();
        }
        // A large camera move redirects the next walk, never a committed strike.
        if(this.phase==='roam'&&Math.abs(this.viewX-this.planView)>72)this.plan();
    }

    update(storyTick:number, storyX:number, playerX:number){
        this.events=[];
        this.tick++;
        this.viewX=Math.max(0,Math.min(SIEGE_WIDTH-320,playerX-132));
        this.muzzle=Math.max(0,this.muzzle-1);this.heat=Math.max(0,this.heat-.006);
        this.casings=this.casings.filter(p=>this.tick-p.born<150).slice(-18);
        this.impacts=this.impacts.filter(p=>this.tick-p.born<100).slice(-24);
        this.contacts=this.contacts.filter(p=>this.tick-p.born<88);
        // Already-started escapes and settling finish even after the camera leaves a street.
        for(const yard of this.yards)for(const p of yard.people){
            p.velocity=0;
            if(p.escaped||this.tick<=p.alertAt+8)continue;
            const old=p.x;
            p.x=p.originX+(p.shelter-p.originX)*smoothMotion((this.tick-p.alertAt-8)/p.runTicks!);
            p.velocity=p.x-old;p.distance+=Math.abs(p.velocity);
            if(p.x===p.shelter)p.escaped=true;
        }
        const district=scenicDistrict(storyTick), yard=AFTERMATH_YARDS[district];
        // A new authored street has priority. No hidden activity continues in a later district.
        if(district!==this.district){
            this.active=false; this.district=district; this.cycle=0; this.contacts=[];
            this.shots=[];this.impacts=[];this.casings=[];this.muzzle=0;this.heat=0;
            this.actionCount=0;this.recent=[];
        }
        const center=yard.origin+272;
        const visible=(x:number,margin=28)=>this.inView(x,margin);
        if(!this.active){
            if(storyTick-SCENIC_STARTS[district]<yard.start || !visible(storyX,12))return;
            this.active=true; this.x=storyX; this.velocity=0; this.facing=1; this.travel=0; this.lastStep=0;
            this.enter('approach');
        }
        for(const s of this.shots){
            s.age++;s.remaining-=Math.hypot(s.vx,s.vy);
            if(s.remaining<=0){
                if(this.inView(s.targetX)){
                    const prop=this.yard.props[s.prop];prop.wear=Math.min(3,prop.wear+1);prop.struckAt=this.tick;prop.force=.25;
                    this.impacts.push({x:s.targetX,y:s.targetY,nx:-Math.sign(s.vx),ny:0,born:this.tick,
                        fromX:s.x,fromY:s.y,material:AFTERMATH_PROPS[s.prop].material});this.events.push('distant-hit');
                }
            }else{s.x+=s.vx;s.y+=s.vy;}
        }
        this.shots=this.shots.filter(s=>s.remaining>0&&s.age<60).slice(-12);
        if(['roam','orient','perform','recover'].includes(this.phase)){
            const old=this.x;this.routine();this.velocity=this.x-old;this.travel+=Math.abs(this.velocity);
            const step=Math.floor(this.travel/(Math.PI*11*.6875));
            if(step>this.lastStep&&this.stride>.15&&this.inView(this.x)){this.contact('step',this.x+this.facing*(step%2?9:-7),.4);this.lastStep=step;}
            return;
        }
        const areaVisible=playerX>yard.origin+62 && playerX<yard.origin+440;
        const needsContact=(this.phase==='search'&&this.yard.damage===0)
            || (this.phase==='listen'&&this.yard.damage===1);
        // Continue breathing and looking around while waiting, not a frozen attack silhouette.
        const staging=(this.phase==='rummage'||this.phase==='flush')&&this.age<58;
        const waiting=!areaVisible || needsContact&&this.age>=this.duration-1&&!visible(center,48)
            || staging&&!visible(center,20);
        if(waiting){this.velocity=0;this.plan();return;}
        this.age++;
        const oldX=this.x, t=smoothMotion(this.age/this.duration);
        const home=yard.origin+222;
        if(this.phase==='approach'||this.phase==='return')this.x=this.fromX+(home-this.fromX)*t;
        else if(this.phase==='patrol'){
            const stop=yard.origin+[152,180,136][this.cycle%3];
            this.x=this.fromX+(stop-this.fromX)*t;
        }
        else if(this.phase==='rummage')this.x=this.fromX+11*pulse(this.age,43,65,108);
        else if(this.phase==='flush')this.x=this.fromX-7*pulse(this.age,25,30,43)
            +(this.district===3?40:19)*pulse(this.age-32,26,37,94);
        this.velocity=this.x-oldX;
        this.travel+=Math.abs(this.velocity);
        const step=Math.floor(this.travel/(Math.PI*11*.6875));
        if(step>this.lastStep&&this.stride>.15){
            this.contact('step',this.x+this.facing*(step%2?9:-7),.4); this.lastStep=step;
        }
        if(!waiting){
            if(this.phase==='rummage'&&this.age===58){
                this.yard.damage=1;this.yard.shiftedAt=this.tick;this.contact('scrape',center,.65);
            }
            if(this.phase==='flush'&&this.age===18){
                this.scatterBirds();this.yard.runnerAt=this.tick;
                for(const [i,p] of this.yard.people.entries()){p.alertAt=this.tick+i*13;p.startledAt=this.tick+i*13;}
            }
            if(this.phase==='flush'&&this.age===58){
                this.yard.damage=2;this.yard.brokenAt=this.tick;this.contact('break',center,1);
            }
            if((this.phase==='turn-out'||this.phase==='turn-back')&&this.age===22)this.facing=-this.fromFacing;
            if(this.age>=this.duration){
                switch(this.phase){
                    case 'approach': case 'return': this.enter('search');break;
                    case 'search': if(this.yard.damage===2)this.plan();else this.enter(this.yard.damage===0?'rummage':'listen');break;
                    case 'rummage': this.enter('listen');break;
                    case 'listen': this.enter(this.yard.damage===1?'flush':this.cycle%2?'watch':'turn-out');break;
                    case 'flush': this.enter('watch');break;
                    case 'watch': this.plan();break;
                    case 'turn-out': this.enter('patrol');break;
                    case 'patrol': this.enter('survey');break;
                    case 'survey': this.enter('turn-back');break;
                    case 'turn-back': this.cycle++;this.enter('return');break;
                }
            }
        }
    }

    /** Anticipation, contact and follow-through use the same articulated rig as the boss. */
    pose(reduced:boolean){
        const a=this.age, phase=this.phase, searching=phase==='search', rummaging=phase==='rummage';
        const search=searching?smoothMotion(a/32)*(1-smoothMotion((a-this.duration+28)/28)):0;
        const probe=rummaging?pulse(a,30,70,108):0;
        const flush=phase==='flush'?pulse(a,32,66,126):0;
        const strike=phase==='flush'?pulse(a-32,26,30,62):0;
        const turn=phase==='turn-out'||phase==='turn-back';
        const survey=phase==='survey'||phase==='listen'||phase==='watch';
        const look=survey?pulse(a,24,this.duration-30,this.duration):0;
        const breath=reduced?0:Math.sin(this.tick/19)*.5;
        const cargo=this.district===1&&rummaging?pulse(a-56,12,26,52):0;
        const steam=this.district===2&&phase==='flush'?pulse(a-60,8,25,54):0;
        const stamp=this.district===3&&phase==='flush';
        const lift=stamp&&a>=38&&a<58?Math.sin(Math.PI*(a-38)/20):0;
        const landing=stamp?pulse(a-58,3,8,30):0;
        const sniff=phase==='listen'&&this.cycle>0?pulse(a-10,16,32,60):0;
        const tailCheck=phase==='survey'?pulse(a-34,20,32,62):0;
        const performing=phase==='perform',timing=aftermathActionTiming(this.action,this.variant);
        const ram=performing&&this.action==='ram'?pulse(a-16,32,38,88):0;
        const rake=performing&&this.action==='rake'?pulse(a,25,98,124):0;
        const rakeBeat=rake?timing.beats.reduce((v,beat)=>v+pulse(a-beat+12,12,15,30),0):0;
        const stomping=performing&&this.action==='stomp';
        const rise=stomping?timing.beats.reduce((v,beat)=>v+(a>=beat-22&&a<beat?Math.sin(Math.PI*(a-beat+22)/22):0),0):0;
        const crush=stomping?timing.beats.reduce((v,beat)=>v+pulse(a-beat,3,7,23),0):0;
        const tailWind=performing&&this.action==='tail'?pulse(a,28,32,52):0;
        const tailStrike=performing&&this.action==='tail'?pulse(a-32,20,26,72):0;
        const roar=performing&&this.action==='bellow'?pulse(a-10,34,54,102):0;
        const firing=performing&&this.action==='fire'?pulse(a,26,108,142):0;
        const orienting=phase==='orient',turnProgress=orienting?a/36:a/44;
        const compression=probe*2+(stamp?landing*7:strike*5)+ram*4+rakeBeat*2+crush*8+(turn||orienting?Math.sin(Math.PI*turnProgress)*2:0);
        const riderDrop=probe*3+strike*5+lift*5+ram*5+rise*5+crush*4;
        const bodyLift=-lift*7-rise*9;
        const riderLean=probe*3-strike*4-steam*5-ram*4-rakeBeat*2-tailStrike*4+roar*2;
        const recoil=gunRecoil(this.muzzle),tuck=lift*.55+rise*.6;
        const shoulderY=bodyLift+(-78+compression+riderDrop)*.6875;
        const shoulderX=this.x+this.facing*(7-recoil+tuck*10+riderBend(14,riderLean))*.6875;
        const gunAngle=Math.atan2(this.targetY-shoulderY,Math.max(12,(this.targetX-shoulderX)*this.facing));
        return {
            facing:this.facing, gait:this.travel/(.6875*11), stride:this.stride,
            pivot:turn||orienting?Math.sin(Math.PI*turnProgress)*.98:0,
            bow:search*.52+probe*.48-cargo*.22+(stamp?0:strike*.34)-steam*.1+sniff*.2+ram*.55+rake*.5+crush*.22-roar*.15,
            lift:bodyLift, breath, compression,
            neckDrop:search*(14+(reduced?0:Math.sin(a/9)*2))+probe*10-cargo*10+(stamp?landing*5:strike*10)-steam*8+sniff*5
                +ram*13+rake*14+rakeBeat*3+crush*6-roar*10,
            jaw:.12+probe*.24+flush*.62*(1-smoothMotion((a-54)/8))+ram*.25+rake*.28+roar*.8,
            tail:search*-.09+strike*.12-tailWind*.35+tailStrike*.95+(reduced?0:Math.sin(this.tick/29)*.025+tailCheck*.12),
            tuck, brace:Math.max(probe*.35,(stamp?landing*.6:strike*.6),ram*.65,crush*.7,firing*.5,turn||orienting?.42:0),
            riderDrop, riderLean,
            rein:Math.max(probe,flush,this.stride*.6,ram,rake,crush,roar), lookBack:firing?0:look*(this.cycle%2?.8:.55),
            aim:look*.3-.12+(gunAngle+.12)*firing,
            recoil,heat:this.heat,
            reload:phase==='watch'||phase==='recover'&&this.action==='fire'?Math.sin(Math.PI*a/this.duration)*.65:0,
            focus:Math.max(search,probe,flush,ram,rake,firing,roar), eyeClose:Math.max(search*.35,steam*.8,crush*.65),
            blink:this.tick%197<5, voice:Math.max(phase==='flush'?pulse(a-60,4,12,30)*.28:0,roar*.65),
            cloth:reduced?0:this.stride*2+strike*2+ram*3+tailStrike*2+roar,
        };
    }
}
