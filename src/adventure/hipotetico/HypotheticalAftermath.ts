import { smoothMotion, riderBend, dinosaurFootAnchor } from './HypotheticalMotion';
import { scenicDistrict, SCENIC_STARTS } from './HypotheticalDevastation';
import { SIEGE_SECTORS, SIEGE_WIDTH } from './HypotheticalSiege';
import type { Bystander } from './HypotheticalBackdrop';
import {gunRecoil,type GunImpact,type GunTrace} from './HypotheticalGunfire';
import {AFTERMATH_PROPS,AftermathRepertoire,aftermathFamily,aftermathShotPoint,aftermathReach,aftermathActionTiming,type AftermathAction} from './HypotheticalAftermathScore';
import {AFTERMATH_SCALE,DEBRIS_GRIP_X,createAftermathProp,handlingForMaterial,handlingMotion,handlingTiming,
    isHandling,handlesMaterial,SHAKE_BEATS,shutterHandle,stepAftermathProp,type AftermathProp,type HeldDebris} from './HypotheticalAftermathHandling';
import {AftermathEnvironment,type YardIncident} from './HypotheticalAftermathEnvironment';
import {aftermathReaction,reactionDuration,reactionReplies} from './HypotheticalAftermathReaction';
import {fragmentLanding} from './HypotheticalAftermathParticles';
import {aftermathFooting,type PlantedFeet} from './HypotheticalAftermathFooting';
import {HypotheticalTower,BASTION_TOWER,TOWER_SEQUENCE,launcherGeometry,towerLauncherPose,type TowerCue} from './HypotheticalTower';
import {TOWER_SEARCH} from './HypotheticalTowerSearch';
import {arrivalBeat} from './HypotheticalHelicopterTiming';
import {AftermathFlock,FLOCK_VOLLEYS,OPENING_FLOCK_SHOTS} from './HypotheticalAftermathFlock';
import {AftermathEscape} from './HypotheticalAftermathEscape';

/** These small service yards belong to the rear street, never to Feka's collision layer. */
export const AFTERMATH_YARDS = SIEGE_SECTORS.map((s, district) => ({
    origin: s.origin + (district === 0 ? 256 : 0),
    kind: (['timber', 'cargo', 'vent', 'masonry'] as const)[district],
    start: district === 0 ? arrivalBeat(634) : district===3?226:278,
}));
type Activity = 'approach' | 'search' | 'rummage' | 'listen' | 'flush' | 'turn-out' | 'patrol' | 'survey' | 'turn-back' | 'return' | 'watch'
    | 'roam' | 'orient' | 'perform' | 'recover' | 'notice' | 'tower' | 'tower-await' | 'tower-search' | 'pursuit';
type Destination='perform'|'search'|'tower'|'tower-search'|'notice'|'pursuit';
type Sound = 'distant-debris' | 'distant-thud' | 'distant-shot' | 'distant-hit' | 'distant-roar'
    | 'distant-wood' | 'distant-stone' | 'distant-metal' | 'distant-creak' | 'distant-chain' | 'distant-leak' | 'distant-snort' | 'distant-grit'
    | 'distant-flutter' | 'distant-soft-hit' | TowerCue;
export interface AftermathContact { x:number; y?:number; born:number; landingAt?:number; strength:number; kind:'scrape'|'break'|'step'; material?:'timber'|'stone'|'iron' }
interface AmbientShot extends GunTrace {targetX:number;targetY:number;remaining:number;prop:number;flock?:boolean;escape?:number}
export interface AftermathYard {
    damage: number; shiftedAt:number; brokenAt:number; birdsAt:number; runnerAt:number;
    people:Bystander[];
    props:AftermathProp[];
    birdsFlights:number;birdsReturn:number;roarAt:number;
    environment:AftermathEnvironment;
    flock:AftermathFlock;
    escape:AftermathEscape;
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
    reaction:YardIncident|null=null;motivation:YardIncident|null=null;
    exhales:Array<{x:number;y:number;facing:number;born:number}>=[];
    readonly tower=new HypotheticalTower();
    casings:Array<{x:number;y:number;born:number;direction:number}>=[];
    readonly yards:AftermathYard[] = AFTERMATH_YARDS.map((yard, district) => ({
        damage:0, shiftedAt:-1, brokenAt:-1, birdsAt:-1, runnerAt:-1,birdsFlights:0,birdsReturn:1250+district*73,roarAt:-1,
        environment:new AftermathEnvironment(district),
        flock:new AftermathFlock(yard.origin,district),
        escape:new AftermathEscape(yard.origin,district),
        props:AFTERMATH_PROPS.map(p=>createAftermathProp(p.material)),
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
    private orientThen:'roam'|Destination='perform';
    private roamThen:Destination='perform';
    private recent:AftermathAction[]=[];
    private viewX=0;
    private lookBehind=0;
    private planView=0;
    private gripX=0;
    private gripY=0;
    private gripAngle=0;
    private performances=0;
    private lastPerformed:Partial<Record<AftermathAction,number>>={};
    private readonly repertoire=new AftermathRepertoire();
    private lastNoticed=-1000;
    private noticeX=0;
    private noticeTicks=40;
    private recoverTicks=32;
    private reply:YardIncident|null=null;
    private feetFrom:PlantedFeet=[[0,0],[0,0]];
    private birdTarget=-1;
    private birdAim={x:0,y:-60};
    private birdTracking=false;
    private lastFlutter=-1000;
    private lastVariant:Partial<Record<AftermathAction,number>>={};

    get yard(){ return this.yards[this.district]; }
    get origin(){ return AFTERMATH_YARDS[this.district]?.origin ?? 0; }
    get stride(){ return Math.min(1, Math.abs(this.velocity)/1.05); }
    /** Keep the opening landmark in view while leaving at least 48 native
     * pixels ahead of Feka. Both the director and the game camera use this. */
    cameraFor(playerX:number){
        return Math.max(0,Math.min(SIEGE_WIDTH-320,Math.max(playerX-256,playerX-132-this.lookBehind)));
    }
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
            case 'recover': return this.recoverTicks;
            case 'notice': return this.noticeTicks;
            case 'tower': return TOWER_SEQUENCE.end;
            case 'tower-await': return 96;
            case 'tower-search': return TOWER_SEARCH.end;
            case 'pursuit': return this.yard.escape.duration;
        }
    }
    private enter(phase:Activity){
        if(phase==='perform'){
            const p=this.pose(false);
            this.feetFrom=p.feet??[
                dinosaurFootAnchor(p.gait,true,(1-p.bow)*p.stride,p.tuck,p.brace),
                dinosaurFootAnchor(p.gait,false,(1-p.bow)*p.stride,p.tuck,p.brace),
            ];
        }
        this.phase=phase; this.age=0; this.fromX=this.x; this.fromFacing=this.facing;
        if(phase==='recover')this.recoverTicks=(aftermathFamily(this.action)==='search'?20:32)+Math.floor(this.repertoire.random()*25);
        if(phase==='tower')this.tower.begin();
        if(phase==='tower-search')this.tower.search.begin();
        if(phase==='pursuit'){
            this.action='fire';this.targetProp=-1;this.reply=null;this.birdTracking=false;
            this.yard.escape.begin(this.tick,this.x,++this.performances);
            this.recent=[...this.recent,'fire' as AftermathAction].slice(-3);
            this.lastPerformed.fire=this.performances;
        }
        if(phase==='perform'){
            this.recent=[...this.recent,this.action].slice(-3);
            this.lastPerformed[this.action]=++this.performances;
            // Keep a second appearance of an action from repeating its exact
            // cadence/gesture, even when the weighted repertoire revisits it.
            const cadences=this.action==='fire'?4:this.action==='bellow'?2:3;
            if(this.lastVariant[this.action]===this.variant%cadences)this.variant=(this.variant+1)%24;
            this.lastVariant[this.action]=this.variant%cadences;
            this.birdTarget=-1;this.birdTracking=false;
            if(isHandling(this.action)&&this.targetProp>=0){
                const prop=this.yard.props[this.targetProp],p=prop.piece??shutterHandle(prop);
                this.gripX=this.origin+AFTERMATH_PROPS[this.targetProp].offset+p.x;
                this.gripY=p.y;this.gripAngle=prop.piece?.angle??0;
                prop.handledAt=this.tick;
            }
        }
    }
    private contact(kind:AftermathContact['kind'],x:number,strength:number,y?:number,material?:AftermathContact['material']){
        const contact:AftermathContact={kind,x,strength,born:this.tick,
            y:y??(kind==='step'?-2:this.district===3&&kind==='break'?-4:-17),
            material:material??(this.district===2?'iron':this.district===3?'stone':'timber')};
        if(kind!=='step')contact.landingAt=this.tick+fragmentLanding(contact);
        this.contacts.push(contact);
        if(this.yard&&(kind==='step'||strength>=.45))this.yard.environment.disturb(x-this.origin,this.tick,kind==='step'?strength*.5:strength);
        if(kind!=='step')this.events.push(material==='iron'?'distant-metal':material==='timber'?'distant-wood'
            :material==='stone'?'distant-stone':kind==='break'?'distant-thud':'distant-debris');
    }
    private inView(x:number,margin=20){return x>=this.viewX+margin&&x<=this.viewX+320-margin;}
    private orient(facing:number,next:'roam'|Destination){
        this.destinationFacing=facing;this.orientThen=next;
        this.enter(this.facing===facing?next:'orient');
    }
    /** The landmark remains the opening cue, before the continuing score. */
    private planTower(){
        if(this.district!==3||this.tower.search.done)return false;
        const searching=this.tower.destroyed;
        const stance=searching?this.tower.search.stance:Math.max(BASTION_TOWER.x+76,Math.min(this.origin+224,this.viewX+224));
        const ready=searching?this.tower.search.ready:this.tower.available;
        if(ready&&(searching?this.searchFramed(stance):this.towerFramed(stance))){
            const next=searching?'tower-search':'tower';
            this.targetProp=-1;this.roamThen=next;this.destination=stance;this.planView=this.viewX;
            const distance=Math.abs(this.destination-this.x);
            if(distance<6){
                this.x=stance;this.orient(-1,next);
            }else{
                this.roamTicks=Math.max(24,Math.min(108,Math.ceil(distance*1.2)));
                this.orient(Math.sign(this.destination-this.x)||this.facing,'roam');this.destinationFacing=-1;
            }
        }else if(this.phase!=='tower-await'){
            this.targetProp=-1;this.enter('tower-await');
        }
        return true;
    }
    private planEscape(){
        if(this.yard.damage<2)return false;
        const e=this.yard.escape,index=e.candidate(this.tick,this.performances,(x,margin)=>this.inView(x,margin));
        if(index<0)return false;
        e.prepare(index);this.targetProp=-1;this.roamThen='pursuit';this.destination=e.entry.stance;this.planView=this.viewX;
        const distance=Math.abs(this.destination-this.x);
        this.roamTicks=Math.max(24,Math.min(120,Math.ceil(distance*1.35)));
        if(distance<1)this.orient(1,'pursuit');
        else{this.orient(Math.sign(this.destination-this.x),'roam');this.destinationFacing=1;}
        return true;
    }
    private plan(){
        // The landmark and its discovery are the opening of this yard's
        // secondary score, never a lottery after other activities finish.
        if(this.planTower())return;
        if(this.planEscape())return;
        const invitation=this.yard.environment.invitationFor(prop=>this.inView(this.origin+AFTERMATH_PROPS[prop].offset,36));
        if(invitation&&this.tick-this.lastNoticed>480){
            invitation.noticed=true;this.lastNoticed=this.tick;
            this.reaction={...invitation};this.reply={...invitation};
            this.noticeX=this.origin+AFTERMATH_PROPS[invitation.prop].offset;
            this.noticeTicks=reactionDuration(invitation.kind)+invitation.variant%3*3;
            this.orient(Math.sign(this.noticeX-this.x)||this.facing,'notice');return;
        }
        this.roamThen='perform';
        // Investigate a recently disturbed material before wandering elsewhere.
        // The cooldown leaves room for the other performances on later laps.
        const prompted=this.yard.props.map((p,i)=>({p,i})).filter(({p,i})=>p.cueAt>=0&&this.tick-p.cueAt<360
            &&this.tick-p.handledAt>540&&this.inView(this.origin+AFTERMATH_PROPS[i].offset,40))
            .sort((a,b)=>b.p.cueAt-a.p.cueAt)[0];
        const scored=this.repertoire.order(this.district,this.recent,this.performances,this.lastPerformed,
            prompted?handlingForMaterial(AFTERMATH_PROPS[prompted.i].material):undefined);
        const reply=this.reply&&this.tick-this.reply.born<600&&this.inView(this.origin+AFTERMATH_PROPS[this.reply.prop].offset,32)?this.reply:null;
        const responses=reply?reactionReplies(reply.kind).filter(action=>!this.recent.slice(-2).includes(action)):[];
        const loud=this.recent.length>=2&&this.recent.slice(-2).every(action=>aftermathFamily(action)!=='search');
        const flockPrompt=this.yard.flock.flights>0&&this.tick-this.yard.flock.lastScatter>300&&!loud
            &&this.performances-(this.lastPerformed['flush-fire']??-4)>=4
            &&this.yard.flock.perched(x=>this.inView(x,30)).length>=2;
        // A settled new flock is an invitation, not a performance that must win
        // the lottery for minutes. Leave room for a quiet passage and at least
        // four other performances before inviting another volley.
        const candidates=[...responses.map(action=>({action,prop:reply!.prop})),
            ...(flockPrompt?[{action:'flush-fire' as AftermathAction,prop:-1}]:[]),...scored.map(action=>({action,prop:-1}))];
        this.variant=Math.floor(this.repertoire.random()*24);this.actionCount++;this.cycle=Math.floor(this.actionCount/3);
        const lo=Math.max(this.origin+66,this.viewX+64),hi=Math.min(this.origin+372,this.viewX+256);
        let target:{i:number;facing:number;x:number}|undefined;
        this.motivation=null;
        for(const candidate of candidates){
            const action=candidate.action;
            if(action==='flush-fire'){
                const birds=this.yard.flock.perched(x=>this.inView(x,30));
                if(birds.length<2||lo>hi)continue;
                const center=birds.reduce((sum,b)=>sum+b.x,0)/birds.length;
                const stances=[1,-1].map(facing=>({i:-1,facing,x:Math.max(lo,Math.min(hi,center-facing*94))}))
                    .filter(p=>(center-p.x)*p.facing>58);
                stances.sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x));
                if(stances.length){this.action=action;target=stances[0];break;}
                continue;
            }
            const options=AFTERMATH_PROPS.flatMap((p,i)=>[-1,1].map(facing=>{
                const s=this.yard.props[i],offset=isHandling(action)?s.piece?.x??0:0;
                const ideal=this.origin+p.offset+offset-facing*aftermathReach(action);
                return {i,facing,x:action==='fire'?Math.max(lo,Math.min(hi,ideal)):ideal};
            })).filter(p=>(candidate.prop<0||p.i===candidate.prop)&&p.x>=lo&&p.x<=hi&&this.inView(this.origin+AFTERMATH_PROPS[p.i].offset,26)
                &&(!isHandling(action)||handlesMaterial(action,AFTERMATH_PROPS[p.i].material)
                    &&!this.yard.props[p.i].piece?.moving&&this.yard.props[p.i].hinge<.03
                    &&this.inView(p.x+p.facing*aftermathReach(action),32))
                &&(action!=='fire'||(this.origin+AFTERMATH_PROPS[p.i].offset-p.x)*p.facing>40)
                &&(action!=='breach'||AFTERMATH_PROPS[p.i].material!=='stone'));
            options.sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x)
                +(prompted&&isHandling(action)?(a.i===prompted.i?-100:0)-(b.i===prompted.i?-100:0):0)
                // If already near an edge, turn the next toss back into the yard.
                +(isHandling(action)?Math.max(0,(this.yard.props[a.i].piece?.x??0)*a.facing)*2
                    -Math.max(0,(this.yard.props[b.i].piece?.x??0)*b.facing)*2:0)
                +(a.i===this.targetProp?55:0)-(b.i===this.targetProp?55:0));
            if(options.length){this.action=action;target=options[0];this.motivation=candidate.prop>=0?reply:null;break;}
        }
        this.reply=null;
        this.targetProp=target?.i??-1;
        if(!target)this.action='bellow';
        this.targetX=target&&target.i>=0?this.origin+AFTERMATH_PROPS[target.i].offset:this.x;
        this.targetY=target&&target.i>=0?AFTERMATH_PROPS[target.i].top:0;
        this.destination=target?.x??(lo<=hi?Math.max(lo,Math.min(hi,this.x)):this.origin+222);
        const distance=Math.abs(this.destination-this.x);
        this.roamTicks=Math.max(18,Math.min(144,Math.ceil(distance*1.45)));
        this.planView=this.viewX;
        this.destinationFacing=target?.facing??this.facing;
        const finalFacing=this.destinationFacing;
        if(distance<.01){this.orient(finalFacing,'perform');return;}
        // First turn toward the walking direction; then plant and turn toward
        // the selected target. No backwards gliding or instantaneous mirroring.
        this.orient(Math.abs(this.destination-this.x)>2?Math.sign(this.destination-this.x):this.facing,'roam');
        this.destinationFacing=finalFacing;
    }
    private hitProp(prop:number,x:number,y:number,strength:number,kind:AftermathContact['kind']){
        if(!this.inView(x)||prop<0)return;
        const s=this.yard.props[prop];s.wear=Math.min(3,s.wear+1);s.struckAt=this.tick;s.force=strength;s.cueAt=this.tick;
        this.yard.environment.stir(prop,this.tick,strength);
        if(this.action==='breach'&&s.material==='iron'&&!s.driven){s.hingeFacing=this.facing;s.hingeVelocity=.075;}
        if(strength>.8)this.scatterBirds(x,90);
        this.contact(kind,x,strength,y,AFTERMATH_PROPS[prop].material);
    }
    private scatterBirds(nearX=this.x,radius=Infinity){
        if(this.yard.flock.scatter(this.tick,this.x,this.viewX,nearX,radius)){
            this.yard.birdsAt=this.tick;this.yard.birdsFlights++;
            this.yard.birdsReturn=this.yard.flock.nextVisit-this.tick;
        }
    }
    private get flockVolley(){return this.phase==='flush'||this.phase==='perform'&&this.action==='flush-fire';}
    private trackBirds(){
        if(!this.flockVolley)return;
        const b=this.yard.flock.target(this.x,this.facing,x=>this.inView(x,12),this.birdTarget);
        this.birdTarget=b?.id??-1;
        if(!b)return;
        const point=this.yard.flock.lead(b,this.tick,this.x);
        if(!this.birdTracking){this.birdAim={...point};this.birdTracking=true;}
        else{this.birdAim.x+=(point.x-this.birdAim.x)*.24;this.birdAim.y+=(point.y-this.birdAim.y)*.24;}
    }
    get aimTarget(){
        if(this.phase==='pursuit')return this.yard.escape.aimTarget;
        if(this.flockVolley&&this.birdTracking)return this.birdAim;
        const offset=aftermathShotPoint(this.action,this.variant,this.age,this.targetProp);
        return {x:this.targetX+offset.x,y:offset.y};
    }
    get barrel(){
        const p=this.pose(false),scale=AFTERMATH_SCALE,r=p.recoil-p.tuck*10;
        const shoulder={x:this.x+this.facing*(7-r+riderBend(14,p.riderLean))*scale,
            y:p.lift+(-78+p.bow*39+p.compression+p.riderDrop)*scale};
        return {x:shoulder.x+this.facing*Math.cos(p.aim)*31*scale,y:shoulder.y+Math.sin(p.aim)*31*scale,
            dx:this.facing*Math.cos(p.aim),dy:Math.sin(p.aim)};
    }
    private towerFramed(x=this.x){
        const margin=this.phase==='tower'?-160:-120;
        return x>=BASTION_TOWER.x+68&&this.inView(x,margin)&&this.inView(BASTION_TOWER.x,margin);
    }
    private searchFramed(x=this.x){
        const s=this.tower.search,target=s.age<TOWER_SEARCH.release?BASTION_TOWER.x+s.part.x-12:s.person.x-8;
        const margin=this.phase==='tower-search'?-160:-120;
        return this.inView(x,margin)&&this.inView(target,margin);
    }
    get launcherPose(){const p=this.pose(false);return towerLauncherPose(this.tower,p,p.lift,this.x,this.facing);}
    get launcherBarrel(){
        const p=this.pose(false),g=launcherGeometry(p,this.launcherPose),s=AFTERMATH_SCALE;
        return {x:this.x+this.facing*g.mouth[0]*s,y:p.lift+g.mouth[1]*s,
            backX:this.x+this.facing*g.exhaust[0]*s,backY:p.lift+g.exhaust[1]*s};
    }
    private fire(){
        if(this.targetProp<0||!this.inView(this.targetX,16)||!this.inView(this.x,24))return;
        this.muzzle=5;this.heat=Math.min(1,this.heat+.22);
        const target=this.aimTarget,m=this.barrel,dx=target.x-m.x,dy=target.y-m.y,d=Math.max(1,Math.hypot(dx,dy)),speed=5.8;
        this.shots.push({x:m.x,y:m.y,vx:dx/d*speed,vy:dy/d*speed,age:0,
            targetX:target.x,targetY:target.y,remaining:d,prop:this.targetProp});
        this.casings.push({x:m.x-m.dx*15,y:m.y-m.dy*15,born:this.tick,direction:this.facing});
        this.events.push('distant-shot');
    }
    private fireAtBird(){
        if(this.birdTarget<0||!this.birdTracking||!this.inView(this.birdAim.x,12)||!this.inView(this.x,20))return;
        const bird=this.yard.flock.birds.find(b=>b.id===this.birdTarget);
        if(bird?.state!=='flight'||(bird.x-this.x)*this.facing<32)return;
        this.muzzle=5;this.heat=Math.min(1,this.heat+.18);
        const m=this.barrel;
        // A round follows the visible bore. It can miss a banking bird and can
        // hit only through segment/body contact, never by a scheduled death.
        this.shots.push({x:m.x,y:m.y,vx:m.dx*7.6,vy:m.dy*7.6,age:0,
            targetX:this.birdAim.x,targetY:this.birdAim.y,remaining:220,prop:-1,flock:true});
        this.casings.push({x:m.x-m.dx*15,y:m.y-m.dy*15,born:this.tick,direction:this.facing});
        this.events.push('distant-shot');this.yard.flock.lastNoise=this.tick;
    }
    private fireAtEscape(){
        const e=this.yard.escape;
        if(!e.canFire()||!this.inView(e.entry.person.x,12)||!this.inView(this.x,12))return;
        this.muzzle=5;this.heat=Math.min(1,this.heat+.2);
        const m=this.barrel;
        this.shots.push({x:m.x,y:m.y,vx:m.dx*6.8,vy:m.dy*6.8,age:0,
            targetX:e.aimTarget.x,targetY:e.aimTarget.y,remaining:230,prop:-1,escape:e.selected});
        this.casings.push({x:m.x-m.dx*15,y:m.y-m.dy*15,born:this.tick,direction:this.facing});
        this.events.push('distant-shot');this.yard.flock.lastNoise=this.tick;
        if(e.age===e.timing.shots[0]){
            e.entry.person.threatenedAt=this.tick;e.entry.person.reactionTimes.push(this.tick+4);
            this.scatterBirds(this.x,160);
        }
    }
    private handleDebris(){
        if(!isHandling(this.action)||this.targetProp<0)return;
        const action=this.action,a=this.age,t=handlingTiming(action),motion=handlingMotion(action,a,this.variant);
        const s=this.yard.props[this.targetProp],anchor=this.origin+AFTERMATH_PROPS[this.targetProp].offset;
        if(action==='wrench'){
            if(a===t.grip){s.driven=true;s.hingeFacing=this.facing;s.hingeVelocity=0;}
            if(a>=t.grip&&a<t.release)s.hinge=motion.hinge;
            if(a===t.release){s.driven=false;s.hingeVelocity=-.012;}
            const handle=shutterHandle(s);
            const returning=smoothMotion((a-t.release)/36);
            this.x=this.fromX+(a<t.release?handle.x:-this.facing*Math.sin(1.08)*22*(1-returning));
        }else{
            this.x=this.fromX-this.facing*motion.pull;
            const p=s.piece!;
            if(a===t.grip){p.held=true;p.moving=false;p.settling=false;p.vx=0;p.vy=0;p.spin=0;}
            if(p.held){
                const jaw=this.jawAnchor;
                p.x=jaw.x-anchor;p.y=jaw.y;
                p.angle=this.gripAngle+(motion.angle-(action==='haul'||action==='shake'?-.11:0))*this.facing;
            }
            if(a===t.release){
                p.held=false;p.moving=true;p.bounces=0;
                const timber=action==='haul'||action==='shake';
                const desired=p.x+this.facing*(timber?26:20),reach=DEBRIS_GRIP_X*AFTERMATH_SCALE;
                const lo=Math.max(this.origin+66,this.planView+64),hi=Math.min(this.origin+372,this.planView+256);
                // Leave room for the next jaw AND the body's stance. A visible
                // piece at the extreme edge used to become unreachable forever.
                // Extra inset absorbs the short horizontal drift on its bounce.
                const landings=[-1,1].map(f=>({
                    left:Math.max(-30,this.planView+40-anchor,lo+f*reach-anchor+6),
                    right:Math.min(30,this.planView+280-anchor,hi+f*reach-anchor-6),
                })).filter(r=>r.left<=r.right).map(r=>Math.max(r.left,Math.min(r.right,desired)));
                landings.sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
                const landing=landings[0]??Math.max(-30,Math.min(30,p.x));
                p.vy=timber?-.85:-.3;
                const flight=(-p.vy+Math.sqrt(p.vy*p.vy+2*.12*Math.max(0,-5-p.y)))/.12;
                p.vx=(landing-p.x)/Math.max(10,flight);p.spin=this.facing*(timber?.014:.037);
            }
        }
        if(a===t.grip||a===t.yield){
            const strength=a===t.grip?.22:.72;
            s.wear=Math.min(3,s.wear+(a===t.yield?1:0));s.struckAt=this.tick;s.force=strength;
            if(this.inView(this.gripX))this.contact('scrape',this.gripX,strength,this.gripY,AFTERMATH_PROPS[this.targetProp].material);
        }
        if(a===t.release+20&&action==='sift'&&this.inView(this.gripX))
            this.contact('scrape',this.gripX,.22,-8,'stone');
        if(action==='shake'&&SHAKE_BEATS.some(beat=>beat===a)){
            const jaw=this.jawAnchor;
            if(this.inView(jaw.x))this.contact('scrape',jaw.x,.38,jaw.y,'timber');
            s.wear=Math.min(3,s.wear+1);
        }
        if(a===t.release)this.yard.environment.stir(this.targetProp,this.tick,.65);
    }
    get jawAnchor(){
        const p=this.pose(false);
        return {x:this.x+this.facing*DEBRIS_GRIP_X*AFTERMATH_SCALE,
            y:p.lift+(-59+p.bow*25+p.breath+p.neckDrop+p.compression+10+p.jaw*6)*AFTERMATH_SCALE};
    }
    get heldDebris():HeldDebris|undefined {
        if(!this.active||this.targetProp<0)return;
        const s=this.yard.props[this.targetProp],material=AFTERMATH_PROPS[this.targetProp].material;
        if(s.piece?.held&&material!=='iron')return {material,angle:s.piece.angle,wear:s.wear};
    }
    private routine(){
        this.age++;
        if(this.phase==='orient'){
            if(this.age===18)this.facing=this.orientThen==='roam'?Math.sign(this.destination-this.x)||this.facing:this.destinationFacing;
            if(this.age>=this.duration)this.enter(this.orientThen);
        }else if(this.phase==='roam'){
            this.x=this.fromX+(this.destination-this.fromX)*smoothMotion(this.age/this.duration);
            if(this.age>=this.duration)this.orient(this.destinationFacing,this.roamThen);
        }else if(this.phase==='tower'){
            if(this.tower.done)this.plan();
        }else if(this.phase==='tower-await'){
            this.plan();
        }else if(this.phase==='tower-search'){
            const search=this.tower.search,framed=this.searchFramed();
            search.update(framed);this.x=search.actorX;
            if(framed)this.events.push(...search.events);
            if(search.done)this.enter('recover');
        }else if(this.phase==='pursuit'){
            const e=this.yard.escape;this.x=e.actorX;
            if((e.timing.shots as readonly number[]).includes(e.age))this.fireAtEscape();
            if(e.done)this.enter('recover');
        }else if(this.phase==='notice'){
            if(this.reaction?.kind==='leak'&&[34,39,44].includes(this.age)){
                const mouth=this.jawAnchor;
                if(this.inView(mouth.x,12)){
                    this.exhales.push({...mouth,facing:this.facing,born:this.tick});
                    if(this.age===34)this.events.push('distant-snort');
                }
            }
            if(this.age>=this.duration)this.plan();
        }else if(this.phase==='perform'){
            const timing=aftermathActionTiming(this.action,this.variant),a=this.age;
            this.trackBirds();
            if(isHandling(this.action))this.handleDebris();
            if(this.action==='ram')this.x=this.fromX+this.facing*8*pulse(a-20,28,34,84);
            if(this.action==='breach')this.x=this.fromX+this.facing*8*pulse(a-24,28,34,56);
            if(this.action==='rake')this.x=this.fromX+this.facing*3*pulse(a,26,timing.duration-28,timing.duration);
            if(this.action!=='stomp'&&!(this.action==='flush-fire'&&this.variant%3===0)&&(a===14||a===25)){
                const foot=this.pose(false).feet?.[a===14?0:1];
                if(foot){const x=this.x+this.facing*(foot[0]+3)*AFTERMATH_SCALE;if(this.inView(x))this.contact('step',x,.25);}
            }
            if(timing.beats.includes(a)){
                if(this.action==='flush-fire'){
                    if(this.inView(this.x)){
                        if(this.variant%3===1){this.events.push('distant-roar');this.yard.roarAt=this.tick;}
                        else{
                            const x=this.x+this.facing*(this.variant%3===0?8:-54);
                            if(this.inView(x))this.contact('break',x,.65,-3,'stone');
                            this.events.push('distant-thud');
                        }
                        this.scatterBirds();this.yard.environment.disturb(this.x-this.origin,this.tick,.62);
                    }
                }else if(this.action==='bellow'){
                    if(this.inView(this.x)){
                        this.events.push('distant-roar');this.yard.roarAt=this.tick;this.scatterBirds();
                        this.yard.environment.disturb(this.x-this.origin,this.tick,.5);
                        for(const p of this.yard.props){p.struckAt=this.tick;p.force=.18;}
                    }
                }else{
                    const y=this.action==='stomp'?0:this.action==='tail'?-9:this.targetY;
                    this.hitProp(this.targetProp,this.targetX,y,this.action==='rake'?.55:1,this.action==='rake'?'scrape':'break');
                }
            }
            if(timing.shots.includes(a)){if(this.action==='flush-fire')this.fireAtBird();else this.fire();}
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
        if(this.phase==='roam'&&this.roamThen!=='tower'&&this.roamThen!=='tower-search'&&Math.abs(this.viewX-this.planView)>72)this.plan();
    }

    update(storyTick:number, storyX:number, playerX:number){
        this.events=[];
        this.tick++;
        const normal=Math.max(0,Math.min(SIEGE_WIDTH-320,playerX-132));
        const focus=storyTick>=SCENIC_STARTS[3]&&!this.tower.search.done;
        const desired=focus?Math.max(playerX-256,Math.min(normal,BASTION_TOWER.x+BASTION_TOWER.left-14)):normal;
        const offset=Math.max(0,Math.min(124,normal-desired));
        this.lookBehind+=(offset-this.lookBehind)*.12;
        if(Math.abs(this.lookBehind)<.01)this.lookBehind=0;
        this.viewX=this.cameraFor(playerX);
        this.tower.update(this.phase==='tower'&&this.towerFramed(),()=>this.launcherBarrel);
        if(this.district===3&&(this.inView(BASTION_TOWER.x,0)||this.phase==='tower'))this.events.push(...this.tower.events);
        this.muzzle=Math.max(0,this.muzzle-1);this.heat=Math.max(0,this.heat-.006);
        this.casings=this.casings.filter(p=>this.tick-p.born<150).slice(-18);
        this.impacts=this.impacts.filter(p=>this.tick-p.born<100).slice(-24);
        this.contacts=this.contacts.filter(p=>this.tick-p.born<88);
        if(this.contacts.some(p=>p.strength>=.35&&p.landingAt===this.tick&&this.inView(p.x)))this.events.push('distant-grit');
        this.exhales=this.exhales.filter(p=>this.tick-p.born<28).slice(-6);
        const regular=this.active&&this.district===scenicDistrict(storyTick)
            &&(this.district!==3||this.tower.search.done)&&!['tower','tower-await','tower-search','pursuit'].includes(this.phase)
            &&!(this.roamThen==='pursuit'&&['roam','orient'].includes(this.phase));
        const timing=aftermathActionTiming(this.action,this.variant);
        const closeToImpact=this.phase==='perform'&&([...timing.beats,...timing.shots].some(t=>Math.abs(t-this.age)<20)
            ||this.action==='flush-fire'&&this.age>=24&&this.age<=timing.shots[timing.shots.length-1]+18);
        const noticing=this.phase==='notice'||this.phase==='orient'&&this.orientThen==='notice';
        const reserved=noticing?this.reaction?.prop??-1:this.phase==='perform'||isHandling(this.action)&&this.roamThen==='perform'&&['roam','orient'].includes(this.phase)
            ?this.targetProp:-1;
        for(const [district,yard] of this.yards.entries()){
            yard.escape.update(this.tick);
            if(district===scenicDistrict(storyTick)&&this.phase==='pursuit'&&this.inView(yard.escape.entry?.from??-1000,0))
                this.events.push(...yard.escape.events);
            yard.flock.update(this.tick,regular&&district===this.district&&!closeToImpact,this.viewX);
            if(district===this.district&&this.tick-this.lastFlutter>10&&yard.flock.takeoffs.some(x=>this.inView(x,8))){
                this.events.push('distant-flutter');this.lastFlutter=this.tick;
            }
            for(const p of yard.flock.landings)if(district===this.district&&this.inView(p.x)){
                this.contact('step',p.x,.16,p.y,'stone');
                yard.environment.disturb(p.x-AFTERMATH_YARDS[district].origin,this.tick,.18);
            }
            const event=yard.environment.update(this.tick,yard.props,regular&&district===this.district&&!closeToImpact,
                prop=>this.inView(AFTERMATH_YARDS[district].origin+AFTERMATH_PROPS[prop].offset,34),
                reserved);
            if(event){
                if(event.kind==='creak')this.events.push('distant-creak');
                else if(event.kind==='rattle')this.events.push('distant-chain');
                else if(event.kind==='settle')this.events.push('distant-stone');
                else if(event.kind==='leak')this.events.push('distant-leak');
            }
        }
        for(const [district,yard] of this.yards.entries())for(const [i,s] of yard.props.entries()){
            const hit=stepAftermathProp(s);
            if(hit){
                s.struckAt=this.tick;s.force=hit.strength;
                const x=AFTERMATH_YARDS[district].origin+AFTERMATH_PROPS[i].offset+hit.x;
                if(district===this.district&&this.active&&this.inView(x))
                    this.contact('break',x,hit.strength,hit.y,AFTERMATH_PROPS[i].material);
            }
        }
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
            // If the next authored scene takes over during a grip, the actual
            // loose piece drops at its current location instead of vanishing.
            for(const s of this.yard?.props??[]){
                s.driven=false;
                if(s.piece?.held){s.piece.held=false;s.piece.moving=true;s.piece.vy=0;}
            }
            this.active=false; this.district=district; this.cycle=0; this.contacts=[];
            this.shots=[];this.impacts=[];this.casings=[];this.muzzle=0;this.heat=0;
            this.actionCount=0;this.recent=[];this.performances=0;this.lastPerformed={};
            this.lastVariant={};this.birdTarget=-1;this.birdTracking=false;
            this.reaction=null;this.motivation=null;this.reply=null;this.exhales=[];
            this.lastNoticed=-1000;this.repertoire.reset(((district+1)*0x9e3779b9)^this.tick^(Math.round(playerX)*257));
        }
        const center=yard.origin+272;
        const visible=(x:number,margin=28)=>this.inView(x,margin);
        if(!this.active){
            const startX=district===3?Math.min(yard.origin+216,storyX):storyX;
            if(storyTick-SCENIC_STARTS[district]<yard.start || !visible(startX,-24)&&!(district===3&&visible(BASTION_TOWER.x,-64)))return;
            this.active=true; this.x=startX; this.velocity=0; this.facing=1; this.travel=0; this.lastStep=0;
            this.enter('approach');
            if(district===3){this.plan();return;}
        }
        for(const s of this.shots){
            s.age++;s.remaining-=Math.hypot(s.vx,s.vy);
            if(s.escape!==undefined){
                const e=this.yard.escape,hit=e.intersectShot(s.x,s.y,s.x+s.vx,s.y+s.vy,s.escape);
                if(hit){
                    s.remaining=0;
                    if(this.inView(hit.x)){
                        this.impacts.push({...hit,nx:-1,ny:0,born:this.tick,material:'cloth'});
                        this.events.push('distant-soft-hit');
                    }
                }else{
                    const entry=e.entries[s.escape];
                    const floor=s.vy>0?(-4-s.y)/s.vy:Infinity,wall=s.vx>0?(entry.exit-7-s.x)/s.vx:Infinity;
                    const contact=Math.min(floor,wall);
                    if(contact>=0&&contact<=1){
                        const x=s.x+s.vx*contact,y=s.y+s.vy*contact,ground=floor<=wall;
                        if(this.inView(x)){
                            this.impacts.push({x,y,nx:ground?0:-1,ny:ground?-1:0,born:this.tick,material:'stone'});
                            this.events.push('distant-hit');
                            if(!ground&&entry.marks.length<8)entry.marks.push({x,y});
                        }
                        s.remaining=0;
                    }else{s.x+=s.vx;s.y+=s.vy;}
                }
                continue;
            }
            if(s.flock){
                const hit=this.yard.flock.strike(s.x,s.y,s.x+s.vx,s.y+s.vy,this.tick);
                s.x+=s.vx;s.y+=s.vy;
                if(hit){s.remaining=0;if(this.inView(hit.x))this.events.push('distant-soft-hit');}
                continue;
            }
            if(s.remaining<=0){
                if(this.inView(s.targetX)){
                    const prop=this.yard.props[s.prop];prop.wear=Math.min(3,prop.wear+1);prop.struckAt=this.tick;prop.force=.25;prop.cueAt=this.tick;
                    if(prop.scars.length<12)prop.scars.push({x:s.targetX-this.origin-AFTERMATH_PROPS[s.prop].offset,y:s.targetY});
                    this.yard.environment.stir(s.prop,this.tick,.55);
                    this.impacts.push({x:s.targetX,y:s.targetY,nx:-Math.sign(s.vx),ny:0,born:this.tick,
                        fromX:s.x,fromY:s.y,material:AFTERMATH_PROPS[s.prop].material});this.events.push('distant-hit');
                }
            }else{s.x+=s.vx;s.y+=s.vy;}
        }
        this.shots=this.shots.filter(s=>s.remaining>0&&s.age<60).slice(-12);
        if(['roam','orient','perform','recover','notice','tower','tower-await','tower-search','pursuit'].includes(this.phase)){
            const old=this.x,walking=this.phase==='roam'||this.phase==='tower-search'||this.phase==='pursuit';
            this.routine();this.velocity=this.x-old;
            if(walking)this.travel+=Math.abs(this.velocity);
            const step=Math.floor(this.travel/(Math.PI*11*AFTERMATH_SCALE));
            if(step>this.lastStep&&(this.phase==='roam'||this.phase==='pursuit')&&this.stride>.15){
                const p=this.pose(false),foot=dinosaurFootAnchor(p.gait,step%2===1,(1-p.bow)*p.stride,p.tuck,p.brace);
                const x=this.x+this.facing*(foot[0]+3)*AFTERMATH_SCALE;
                if(foot[1]>-1&&this.inView(x))this.contact('step',x,.4);
            }
            this.lastStep=step;
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
        this.trackBirds();
        const step=Math.floor(this.travel/(Math.PI*11*AFTERMATH_SCALE));
        if(step>this.lastStep&&this.stride>.15){
            this.contact('step',this.x+this.facing*(step%2?9:-7),.4); this.lastStep=step;
        }
        if(!waiting){
            if(this.phase==='listen'&&(this.age===28||this.age===58)){
                const mouth=this.jawAnchor;
                if(this.inView(mouth.x,16)){
                    this.exhales.push({...mouth,facing:this.facing,born:this.tick});
                    if(this.age===28)this.events.push('distant-snort');
                }
            }
            if(this.phase==='rummage'&&this.age===58){
                this.yard.damage=1;this.yard.shiftedAt=this.tick;this.contact('scrape',center,.65);
                // Birds on the stack leave as its support moves. The eave's
                // flock remains available for the later flush and rifle reply.
                this.scatterBirds(center,40);
            }
            if(this.phase==='flush'&&this.age===18){
                this.scatterBirds();this.yard.runnerAt=this.tick;
                for(const [i,p] of this.yard.people.entries()){p.alertAt=this.tick+i*13;p.startledAt=this.tick+i*13;}
            }
            if(this.phase==='flush'&&this.age===58){
                this.yard.damage=2;this.yard.brokenAt=this.tick;this.contact('break',center,1);
            }
            if(this.phase==='flush'&&OPENING_FLOCK_SHOTS.includes(this.age))this.fireAtBird();
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
        const proximity=Math.max(0,1-Math.abs(this.noticeX-this.x)/110);
        const reaction=phase==='notice'&&this.reaction?aftermathReaction(this.reaction.kind,a,this.duration,proximity):null;
        const riderReaction=phase==='notice'&&this.reaction?aftermathReaction(this.reaction.kind,a-4,this.duration-4,proximity):null;
        const notice=reaction?.attention??0;
        const cooling=phase==='recover'?pulse(a,10,this.duration-12,this.duration):0;
        const look=phase==='tower-await'?.25+Math.sin(this.tick/48)*.12:survey?pulse(a,24,this.duration-30,this.duration):0;
        const breath=reduced?0:Math.sin(this.tick/19)*.5;
        const cargo=this.district===1&&rummaging?pulse(a-56,12,26,52):0;
        const steam=this.district===2&&phase==='flush'?pulse(a-60,8,25,54):0;
        const stamp=this.district===3&&phase==='flush';
        const lift=stamp&&a>=38&&a<58?Math.sin(Math.PI*(a-38)/20):0;
        const landing=stamp?pulse(a-58,3,8,30):0;
        const sniff=phase==='listen'?pulse(a-10,12,24,42)*.7+pulse(a-44,9,18,35)*.45:0;
        const tailCheck=phase==='survey'?pulse(a-34,20,32,62):0;
        const performing=phase==='perform',timing=aftermathActionTiming(this.action,this.variant);
        const flock=performing&&this.action==='flush-fire',flockStyle=this.variant%3;
        const flockBeat=FLOCK_VOLLEYS[flockStyle].beat;
        const breach=performing&&this.action==='breach';
        const ram=performing&&this.action==='ram'?pulse(a-16,32,38,88):breach?pulse(a-20,32,38,60):0;
        const rake=performing&&this.action==='rake'?pulse(a,25,timing.duration-26,timing.duration):0;
        const rakeBeat=rake?timing.beats.reduce((v,beat)=>v+pulse(a-beat+12,12,15,30),0):0;
        const stomping=performing&&(this.action==='stomp'||flock&&flockStyle===0);
        const rise=stomping?timing.beats.reduce((v,beat)=>v+(a>=beat-22&&a<beat?Math.sin(Math.PI*(a-beat+22)/22):0),0):0;
        const crush=stomping?timing.beats.reduce((v,beat)=>v+pulse(a-beat,3,7,23),0):0;
        const tailWind=flock&&flockStyle===2?pulse(a,24,28,flockBeat):performing&&this.action==='tail'?pulse(a,28,32,52):0;
        const tailStrike=flock&&flockStyle===2?pulse(a-28,16,22,58):performing&&this.action==='tail'?pulse(a-32,20,26,72):0;
        const roar=performing&&(this.action==='bellow'||flock&&flockStyle===1)?Math.max(...timing.beats.map(t=>pulse(a-t+30,30,38,58))):0;
        const skyAim=this.birdTracking?(flock?pulse(a-30,28,timing.duration-70,timing.duration-30)
            :phase==='flush'?pulse(a-42,24,76,84):0):0;
        const firing=performing&&this.action==='fire'?pulse(a,26,timing.duration-34,timing.duration)
            :breach?pulse(a-70,16,60,96):skyAim;
        const orienting=phase==='orient',turnProgress=orienting?a/36:a/44;
        const handling=performing&&isHandling(this.action)?this.action:null;
        const h=handling?handlingMotion(handling,a,this.variant):null;
        const riderHandling=handling?handlingMotion(handling,a-5,this.variant):null;
        const effort=h?.effort??0,heave=h?.raise??0,inspection=h?.inspect??0,shake=h?.shake??0;
        const compression=probe*2+(stamp?landing*7:strike*5)+ram*4+rakeBeat*2+crush*8+effort*3+(reaction?.flinch??0)*1.8
            +(turn||orienting?Math.sin(Math.PI*turnProgress)*2:0);
        const riderDrop=probe*3+strike*5+lift*5+ram*5+rise*5+crush*4+(riderHandling?.effort??0)*4-(riderHandling?.raise??0)*2
            +(riderHandling?.shake??0)*3+(riderReaction?.flinch??0)*1.8;
        const bodyLift=-lift*7-rise*9;
        const riderLean=probe*3-strike*4-steam*5-ram*4-rakeBeat*2-tailStrike*4+roar*2-skyAim*2.4
            -(riderHandling?.effort??0)*3+(riderHandling?.raise??0)*4-(riderHandling?.toss??0)*4
            -(riderHandling?.shake??0)*5+(riderReaction?.lean??0);
        const bow=search*.52+probe*.48-cargo*.22+(stamp?0:strike*.34)-steam*.1+sniff*.2+ram*.55+rake*.5+crush*.22-roar*.15-skyAim*.045
            +(h?h.reach*.48-heave*.27+effort*.08+inspection*.08:0)+(reaction?.bow??0);
        const jaw=h?h.jaw:.12+probe*.24+flush*.62*(1-smoothMotion((a-54)/8))+ram*.25+rake*.28+roar*.8+(reaction?.jaw??0);
        let neckDrop=search*(14+(reduced?0:Math.sin(a/9)*2))+probe*10-cargo*10+(stamp?landing*5:strike*10)-steam*8+sniff*5
            +ram*13+rake*14+rakeBeat*3+crush*6-roar*10-skyAim*3+(reaction?.neckDrop??0);
        const contact=ram?(breach?pulse(a-26,26,32,54):pulse(a-22,26,54,88)):rake?Math.min(1,rakeBeat):0;
        if(contact){
            const aligned=(this.targetY-bodyLift)/AFTERMATH_SCALE+59-bow*25-breath-compression-10-jaw*6;
            neckDrop+=(aligned-neckDrop)*contact;
        }
        if(h&&this.targetProp>=0){
            const s=this.yard.props[this.targetProp],t=handlingTiming(handling!);
            const panel=shutterHandle(s);
            const desiredY=handling==='wrench'?(a<t.release?panel.y:-38+Math.cos(1.08)*29
                +(this.gripY-(-38+Math.cos(1.08)*29))*smoothMotion((a-t.release)/32))
                :this.gripY-h.height+(reduced?0:h.sniff*Math.sin(a/4)*.8);
            // Cancel idle breathing inside this anchor, keeping teeth in contact
            // with the same physical component through effort, lift and release.
            neckDrop=((desiredY-bodyLift)/AFTERMATH_SCALE+59-bow*25-breath-compression-10-jaw*6)*h.reach;
        }
        const recoil=gunRecoil(this.muzzle),tuck=lift*.55+rise*.6;
        const shoulderY=bodyLift+(-78+bow*39+compression+riderDrop)*AFTERMATH_SCALE;
        const shoulderX=this.x+this.facing*(7-recoil+tuck*10+riderBend(14,riderLean))*AFTERMATH_SCALE;
        const aimTarget=this.aimTarget;
        const gunAngle=Math.atan2(aimTarget.y-shoulderY,Math.max(12,(aimTarget.x-shoulderX)*this.facing));
        const pose={
            facing:this.facing, gait:this.travel/(AFTERMATH_SCALE*11), stride:performing?0:this.stride,
            feet:performing&&!stomping?aftermathFooting(a,timing.duration,(this.fromX-this.x)*this.facing/AFTERMATH_SCALE,this.feetFrom,!!handling):undefined,
            pivot:turn||orienting?Math.sin(Math.PI*turnProgress)*.98:0,
            bow,
            lift:bodyLift, breath, compression,
            neckDrop,jaw,
            tail:search*-.09+strike*.12-tailWind*.35+tailStrike*.95-heave*.18+effort*.08-shake*.12+(reaction?.tail??0)+(reduced?0:Math.sin(this.tick/29)*.025+tailCheck*.12),
            tuck, brace:Math.max(probe*.35,(stamp?landing*.6:strike*.6),ram*.65,crush*.7,firing*.5,effort*.8,heave*.6,reaction?.brace??0,turn||orienting?.42:0),
            riderDrop, riderLean,
            rein:Math.max(probe,flush,this.stride*.6,ram,rake,crush,roar,effort,heave*.8,Math.abs(shake),riderReaction?.brace??0),
            lookBack:firing?0:look*(this.cycle%2?.8:.55)+inspection*.3+cooling*.16,
            aim:look*.3-.12+(gunAngle+.12)*firing+(h?.reach??0)*.35+(riderReaction?.inspect??0)*.22,
            recoil,heat:this.heat,
            reload:phase==='watch'||phase==='recover'&&aftermathFamily(this.action)==='gun'?Math.sin(Math.PI*a/this.duration)*.65:0,
            focus:Math.max(search,probe,flush,ram,rake,firing,roar,h?.reach??0,notice), eyeClose:Math.max(search*.35,steam*.8,crush*.65,effort*.35,reaction?.eyeClose??0),
            blink:this.tick%197<5, voice:Math.max(phase==='flush'?pulse(a-60,4,12,30)*.28:0,roar*.65,(reaction?.exhale??0)*.16),
            cloth:reduced?0:this.stride*2+strike*2+ram*3+tailStrike*2+roar+(h?.toss??0)*3+Math.abs(shake)*2,
        };
        if(this.phase==='tower')return {...pose,...this.tower.body,stride:0,rein:0,recoil:0,aim:-.12,
            lift:0,reload:0,cloth:reduced?0:this.tower.motion.recoil*3};
        if(this.phase==='tower-search'){
            const m=this.tower.search.body;
            const aligned=m.jawY/AFTERMATH_SCALE+59-m.bow*25-breath-m.compression-10-m.jaw*6;
            return {...pose,...m,neckDrop:aligned,aim:.16,lookBack:m.lookBack,stride:this.stride*.45,
                lift:0,recoil:0,reload:0,cloth:reduced?0:m.cloth};
        }
        if(this.phase==='pursuit'){
            const e=this.yard.escape,m=e.body;
            const shoulderX=this.x+(7-recoil+riderBend(14,m.riderLean))*AFTERMATH_SCALE;
            const shoulderY=(-78+m.bow*39+m.compression+m.riderDrop)*AFTERMATH_SCALE;
            const angle=Math.atan2(e.aimTarget.y-shoulderY,Math.max(12,e.aimTarget.x-shoulderX));
            return {...pose,...m,stride:this.stride,feet:undefined,lift:0,recoil,lookBack:0,
                aim:-.12+(angle+.12)*m.aim,cloth:reduced?0:this.stride*1.8+m.brake};
        }
        return pose;
    }
}
