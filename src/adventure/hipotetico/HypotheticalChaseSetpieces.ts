import type {Rect} from '../../types';
import {clamp} from '../types';
import {smoothMotion,dinosaurFootAnchor} from './HypotheticalMotion';
import type {Point} from '../WorldPainting';
import type {LauncherPose} from './HypotheticalTower';
import {advanceRocketMotor,rocketTail,type ScenicRocket} from './HypotheticalRocketMotion';
import {CHASE_PORTICO as P,CHASE_FALLEN_DECKS,CHASE_FLOOD as W,CHASE_LEAP as L} from './HypotheticalLayout';
import {chaseCargoMotion,chasePorticoBeam,chaseFloodTravel,chaseFloodCap,CHASE_FLOOD_END} from './HypotheticalChaseChoreography';

export type ChaseScenicCue='distant-metal'|'chase-launch'|'chase-rocket'|'chase-blast'|'chase-cable'|
    'distant-chain'|'distant-leak'|'chase-metal'|'collapse-water'|'slam'|'debris-land';
const envelope=(age:number,rise:number,end:number)=>smoothMotion(age/rise)*(1-smoothMotion((age-rise)/(end-rise)));

/** One simulation score for the rocket, changing road, flood and committed leap.
 * Camera and drawing only read it. Checkpoints reconstruct the consumed events. */
export class HypotheticalChaseSetpieces {
    tick=0;
    porticoAt=-1;launchAt=-1;impactAt=-1;
    floodWarningAt=-1;floodAt=-1;
    leapAt=-1;leapFrom=0;leapTo=0;leapSpent=false;
    takeoffFeet:readonly [Point,Point]=[[-8,0],[14,0]];
    rocket:ScenicRocket|null=null;
    launch:{x:number;y:number;backX:number;backY:number;dx:number;dy:number}|null=null;
    trail:Array<{x:number;y:number;born:number;seed:number}>=[];
    events:ChaseScenicCue[]=[];
    private trailGap=0;private trailSeed=0;
    constructor(start=0){
        if(start>P.end)this.porticoAt=this.launchAt=this.impactAt=-10000;
        if(start>W.endX)this.floodWarningAt=this.floodAt=-10000;
        if(start>L.until)this.leapSpent=true;
    }
    get porticoAge(){return this.porticoAt===-1?-1:this.tick-this.porticoAt;}
    get impactAge(){return this.impactAt===-1?-1:this.tick-this.impactAt;}
    get floodAge(){return this.floodAt===-1?-1:this.tick-this.floodAt;}
    get leapAge(){return this.leapAt===-1?-1:this.tick-this.leapAt;}
    get needsLaunch(){return this.porticoAge>=P.fire&&this.launchAt===-1;}
    get airborne(){return this.leapAge>=L.prepare&&this.leapAge<L.prepare+L.flight;}
    get leaping(){return this.leapAge>=0&&this.leapAge<L.prepare+L.flight+L.recover;}
    get landingAge(){return this.leapAge<0?-1:this.leapAge-L.prepare-L.flight;}
    get leapHeight(){
        if(!this.airborne)return 0;
        const u=(this.leapAge-L.prepare)/L.flight;return 4*L.height*u*(1-u);
    }
    get leapPosition(){
        if(!this.airborne)return null;
        return this.leapFrom+(this.leapTo-this.leapFrom)*(this.leapAge-L.prepare)/L.flight;
    }
    get leapLanded(){return this.leapAge===L.prepare+L.flight;}
    get gaitWeight(){
        if(this.leapAge<0)return 1;
        if(this.leapAge<L.prepare)return 1-.65*smoothMotion(this.leapAge/L.prepare);
        if(this.airborne)return .35*(1-smoothMotion((this.leapAge-L.prepare)/6));
        return smoothMotion(this.landingAge/L.footRelease);
    }
    get movementScale(){
        if(!this.leaping)return 1;
        if(this.leapAge<L.prepare)return 1-.34*smoothMotion(this.leapAge/L.prepare);
        return this.airborne?1:.70+.30*smoothMotion(this.landingAge/L.recover);
    }
    /** No incoming rifle or ram is scheduled on top of a new movement lesson. */
    reservesAttack(x:number){
        return x>=1264&&x<1576 || x>=P.trigger&&x<P.end ||
            x>=W.warningX&&x<W.endX+40 || x>=4900&&x<5304 ||
            x>=L.trigger&&x<5952 || x>=6608&&x<6900;
    }
    update(tick:number,player:Rect,pursuerX:number){
        this.tick=tick;this.events=[];
        if(this.porticoAt===-1&&player.x>=P.trigger)this.porticoAt=tick;
        if(this.porticoAge===20||this.porticoAge===40)this.events.push('distant-metal');
        if(this.rocket&&tick>this.launchAt){
            const r=this.rocket,speed=Math.min(r.remaining,3+11*smoothMotion(r.age/11));
            const motor=advanceRocketMotor(r,speed);
            if(motor.ignited)this.events.push('chase-rocket');
            for(let d=speed-motor.burnDistance+4-this.trailGap;d<=speed;d+=4){
                const tail=rocketTail(r.age+d/speed);
                this.trail.push({x:r.x+r.dx*(d-tail),y:r.y+r.dy*(d-tail),born:tick-(speed-d)/speed,seed:this.trailSeed++});
            }
            this.trailGap=(this.trailGap+motor.burnDistance)%4;
            r.x+=r.dx*speed;r.y+=r.dy*speed;r.speed=speed;r.age++;r.remaining-=speed;
            if(r.remaining<=0){this.rocket=null;this.impactAt=tick;this.events.push('chase-blast');}
        }
        this.trail=this.trail.filter(p=>tick-p.born<54).slice(-44);
        for(const [i,d]of CHASE_FALLEN_DECKS.entries()){
            if(this.impactAge===d.delay+P.release)this.events.push('chase-cable');
            if(this.impactAge===d.delay+P.settle)this.events.push('debris-land');
            const beam=chasePorticoBeam(i,this.impactAge);
            if(this.impactAge>=beam.contact&&this.impactAge-1<beam.contact)this.events.push('collapse-water');
        }
        if(this.floodWarningAt===-1&&player.x>=W.warningX){this.floodWarningAt=tick;this.events.push('distant-leak');}
        if(this.floodAt===-1&&this.floodWarningAt!==-1&&tick-this.floodWarningAt>=48&&pursuerX+56>=W.sourceX){
            this.floodAt=tick;this.events.push('chase-metal','collapse-water');
        }
        const cap=chaseFloodCap(this.floodAge);
        if(this.floodAge>=cap.contact&&this.floodAge-1<cap.contact)this.events.push('chase-metal');
        const end=Math.ceil(CHASE_FLOOD_END);
        if(this.floodAge===end)this.events.push('collapse-water');
        if(!this.leapSpent&&this.leapAt===-1&&player.x>=L.trigger&&player.x<L.until&&player.x-pursuerX<220){
            this.leapAt=tick;
        }
        if(this.leapAge===L.prepare){
            this.leapFrom=pursuerX;
            this.leapTo=clamp(L.landingX,pursuerX+80,pursuerX+290);
            this.events.push('debris-land');
        }
        if(this.leapLanded){this.leapSpent=true;this.events.push('slam');}
    }
    ignite(socket:{x:number;y:number;backX:number;backY:number}){
        if(!this.needsLaunch)return;
        const dx=P.targetX-socket.x,dy=P.targetY-socket.y,length=Math.hypot(dx,dy);
        this.launchAt=this.tick;this.launch={...socket,dx:dx/length,dy:dy/length};
        this.rocket={x:socket.x,y:socket.y,fromX:socket.x,fromY:socket.y,
            dx:dx/length,dy:dy/length,age:0,remaining:length,speed:0,motorAge:-1};
        this.events.push('chase-launch');
    }
    get launcher():LauncherPose|undefined {
        const a=this.porticoAge,impact=this.impactAge;
        if(a<0||impact>56)return undefined;
        const stow=impact<0?0:smoothMotion((impact-20)/30);
        return {draw:smoothMotion((a-10)/32)*(1-stow),
            rifleLower:smoothMotion(a/16)*(1-stow),reach:smoothMotion((a-4)/22)*(1-stow),
            supportReach:smoothMotion((a-15)/24)*(1-stow),triggerReach:smoothMotion((a-25)/18)*(1-stow),
            aim:-.12,recoil:this.launchAt<0?0:envelope(this.tick-this.launchAt,2,20),
            fired:this.launchAt!==-1};
    }
    get bodyMotion(){
        const launcher=this.launcher,brace=launcher?.draw??0,recoil=launcher?.recoil??0;
        const a=this.leapAge,wind=a>=0&&a<L.prepare?smoothMotion(a/L.prepare):0;
        const release=this.airborne?1-smoothMotion((a-L.prepare)/6):0;
        const fly=a-L.prepare;
        const tuck=this.airborne?smoothMotion(fly/9)*(1-smoothMotion((fly-L.flight+12)/12)):0;
        const land=a>=L.prepare+L.flight?envelope(a-L.prepare-L.flight,4,L.recover):0;
        const riderLand=this.landingAge>=0?envelope(this.landingAge,7,L.recover):0;
        const water=this.floodAge<0?0:envelope(this.floodAge,3,22);
        return {compression:(wind+release)*5+tuck*6+land*8+brace*.8+water*3,
            tuck,strideScale:1-tuck,neckDrop:(wind+release)*4-land*3-water*2,
            riderDrop:(wind+release)*4+tuck*9+riderLand*6+recoil*2,
            riderLean:-brace*2-recoil*4-(wind+release)*2+tuck*3-riderLand*3,
            tail:-(wind+release)*.08+tuck*.10+riderLand*.075,rein:1-brace,
            headPitch:(wind+release)*.045-tuck*.06+land*.04,
            headTilt:-recoil*.055-riderLand*.04,eyeClose:recoil>.65||land>.8};
    }
    feet(gait:number,stride:number,pursuerX:number):readonly [Point,Point]|undefined {
        const a=this.leapAge,land=this.landingAge;
        if(!this.airborne&&(land<0||land>=L.footRelease))return undefined;
        const blend=(p:Point,q:Point,t:number):Point=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
        const planted:readonly [Point,Point]=[[-9,0],[17,0]];
        return ([0,1] as const).map(i=>{
            if(this.airborne){
                const t=a-L.prepare;
                const tuck:Point=i?[11,-16]:[-15,-21];
                const landing:Point=[planted[i][0],i?0:-2];
                return blend(blend(this.takeoffFeet[i],tuck,smoothMotion(t/8)),landing,
                    smoothMotion((t-L.flight+12)/12));
            }
            const lock:Point=[planted[i][0]-(pursuerX-this.leapTo),i?0:-2*(1-smoothMotion(land/2))];
            const native=dinosaurFootAnchor(gait,i===0,stride,0,0),u=smoothMotion((land-6)/(L.footRelease-6));
            return blend(lock,native,u);
        }) as [Point,Point];
    }
    fallenDeck(index:number){
        const d=CHASE_FALLEN_DECKS[index],age=this.impactAge<0?-1:this.impactAge-d.delay;
        return {...d,age,...chaseCargoMotion(age,index)};
    }
    get floodFront(){
        const age=this.floodAge;if(age<0)return null;
        const x=W.sourceX+chaseFloodTravel(age);
        if(x>=W.endX)return null;
        const height=4+(W.height-4)*smoothMotion(age/W.grow);
        return {x,y:224-height,width:W.width,height,age};
    }
    get hazards():Rect[]{
        const front=this.floodFront;
        if(!front||front.age<W.grow)return [];
        const x=front.x+10,width=Math.min(14,W.endX-x);
        return width>0?[{x,y:front.y+6,width,height:front.height-6}]:[];
    }
    /** Functional look-ahead is retained with reduced motion enabled. */
    cameraLead(x:number){
        const zone=(from:number,to:number,amount:number)=>amount*smoothMotion((x-from)/96)*(1-smoothMotion((x-to)/112));
        const flightLook=this.porticoAge<0?0:smoothMotion((this.porticoAge-P.fire)/24);
        const settleLook=this.impactAge<0?0:smoothMotion((this.impactAge-16)/32);
        return Math.max(zone(P.trigger-80,P.end-80,62-34*settleLook)*flightLook,zone(W.warningX-96,W.endX-48,44),
            zone(4848,5296,48),zone(1264-80,1544,40),zone(6608-80,6872,40),
            zone(L.trigger-64,5952,24));
    }
}
