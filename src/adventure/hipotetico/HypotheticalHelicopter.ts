import {smoothMotion} from './HypotheticalMotion';
import {launcherGeometry,launcherShoulder,type LauncherPose} from './HypotheticalTower';
import {advanceRocketMotor,rocketTail,type ScenicRocket} from './HypotheticalRocketMotion';
import {AFTERMATH_SCALE} from './HypotheticalAftermathHandling';
import {HELICOPTER_SEQUENCE as SEQUENCE} from './HypotheticalHelicopterTiming';
import type {Point} from '../WorldPainting';
import {aircraftPoint,aircraftOutline,stepAircraftBody,AIRCRAFT_SHAPES,HELICOPTER_GROUND,type AircraftBody,type AircraftPart,type AircraftContact} from './HypotheticalAircraftPhysics';
export {aircraftPoint,AIRCRAFT_SHAPES,HELICOPTER_GROUND,type AircraftBody,type AircraftPart} from './HypotheticalAircraftPhysics';

export type HelicopterCue='distant-rotor'|'distant-engine-fail'|'distant-metal'|'distant-launch'|'distant-rocket'|'distant-blast'|'distant-crash'|'distant-debris';
export const HELICOPTER_BREAKUP={engine:9,tail:16,rotor:28} as const;
export const HELICOPTER_RAIL={left:267,right:306,y:HELICOPTER_GROUND-7} as const;
export interface AircraftChip {x:number;y:number;vx:number;vy:number;angle:number;spin:number;size:number;glass:boolean;rest:boolean;born:number;hot:number}
export interface AircraftPuff {x:number;y:number;vx:number;vy:number;born:number;seed:number;radius:number;kind:'smoke'|'dust'}
export interface AircraftSpark {x:number;y:number;vx:number;vy:number;born:number;life:number}
export function helicopterFlightAt(age:number){
    const settle=smoothMotion((age-54)/28),evade=smoothMotion((age-138)/52);
    return {x:424-166*smoothMotion(age/80)+Math.sin(age/33)*.7*settle+evade*3,
        y:-66-6*smoothMotion(age/80)+Math.sin(age/21)*.6*settle-evade*3,
        angle:-.065*(1-smoothMotion((age-38)/45))+Math.sin(age/27)*.012*settle+evade*.045};
}
const pulse=(a:number,start:number,rise:number,hold:number,end:number)=>smoothMotion((a-start)/rise)*(1-smoothMotion((a-hold)/(end-hold)));
const cross=(ax:number,ay:number,bx:number,by:number)=>ax*by-ay*bx;
/** Earliest swept contact with the painted, rotating fuselage. No timed mid-air blast. */
function hullContact(from:Point,to:Point,hull:AircraftBody){
    const points=AIRCRAFT_SHAPES.hull.map(p=>aircraftPoint(hull,...p)),dx=to[0]-from[0],dy=to[1]-from[1];
    let first=Infinity,nx=0,ny=0;
    for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],ex=b[0]-a[0],ey=b[1]-a[1],den=cross(dx,dy,ex,ey);
        if(Math.abs(den)<1e-8)continue;
        const ox=a[0]-from[0],oy=a[1]-from[1],t=cross(ox,oy,ex,ey)/den,u=cross(ox,oy,dx,dy)/den;
        if(t>=0&&t<=1&&u>=0&&u<=1&&t<first){
            first=t;const length=Math.hypot(ex,ey);nx=ey/length;ny=-ex/length;
        }
    }
    if(!Number.isFinite(first))return null;
    const x=from[0]+dx*first,y=from[1]+dy*first,co=Math.cos(hull.angle),si=Math.sin(hull.angle);
    return {x,y,nx,ny,localX:(x-hull.x)*co+(y-hull.y)*si,localY:-(x-hull.x)*si+(y-hull.y)*co};
}

/** Background-only physical scene. Its clock is owned by the game update, so
 * pause/retry cannot strand a timer, repeat a launch or create foreground damage. */
export class HypotheticalHelicopter {
    tick=0;age=-1;launchAt=-1;impactAt=-1;crashAt=-1;actorX=168;
    events:HelicopterCue[]=[];
    hull:AircraftBody={part:'hull',x:424,y:-66,angle:0,vx:0,vy:0,spin:0,sleeping:false,contacts:0,quiet:0,born:0,flatten:0};
    pieces:AircraftBody[]=[];chips:AircraftChip[]=[];plumes:AircraftPuff[]=[];
    sparks:AircraftSpark[]=[];
    scars:Array<{x:number;y:number;end:number;strength:number;born:number}>=[];
    railBrokenAt=-1;
    contacts:Array<{x:number;y:number;born:number;strength:number}>=[];
    impact:{x:number;y:number;dx:number;dy:number;nx:number;ny:number;localX:number;localY:number}|null=null;
    groundContact:{x:number;y:number;strength:number}|null=null;
    launch:{x:number;y:number;dx:number;dy:number;backX:number;backY:number}|null=null;
    rocket:ScenicRocket|null=null;
    trail:Array<{x:number;y:number;born:number;seed:number}>=[];
    rotor=0;rotorRate=2.18;private trailGap=0;private seed=0;private lastRattle=-100;private firedAim:number|null=null;
    get active(){return this.age>=0&&this.age<SEQUENCE.duration;}
    get impactAge(){return this.impactAt<0?-1:this.tick-this.impactAt;}
    get crashAge(){return this.crashAt<0?-1:this.tick-this.crashAt;}
    get tailAttached(){return this.impactAge<HELICOPTER_BREAKUP.tail;}
    get rotorAttached(){return this.impactAge<HELICOPTER_BREAKUP.rotor;}
    get skidsAttached(){return this.crashAt<0;}
    get body(){
        const a=this.age,notice=smoothMotion((a-SEQUENCE.notice)/24)*(1-smoothMotion((a-330)/42));
        const brace=smoothMotion((a-90)/36)*(1-smoothMotion((a-308)/64));
        const recoil=pulse(a,SEQUENCE.fire,2,SEQUENCE.fire+4,SEQUENCE.fire+24);
        const lift=pulse(a,78,18,101,130),seat=pulse(a,120,7,128,148);
        const flinch=pulse(this.impactAge,0,3,6,28),ground=pulse(this.crashAge,0,3,5,30);
        const watch=smoothMotion((this.impactAge-12)/78)*brace;
        return {bow:brace*.02+watch*.025,compression:brace*.9+recoil*1.9+ground*1.3+lift*.45,
            riderDrop:brace*.8+recoil*1.4+ground*.9-lift*.8+seat*.65,riderLean:-notice*2.2-recoil*4.8+watch*2-lift*1.2+seat*.5,
            neckDrop:-notice*4+watch*5+ground*2.2,jaw:.18+flinch*.12,tail:-notice*.08,
            brace:brace*.55,focus:notice,eyeClose:Math.max(recoil*.55,flinch*.55,ground*.35),lookBack:1-smoothMotion(a/24)};
    }
    get launcher():LauncherPose {
        const a=this.age,body=this.body,shoulder=launcherShoulder(body),scale=AFTERMATH_SCALE;
        // Aim ahead of the slow hover. Once fired the rider follows the falling wreck.
        const target=this.impactAt<0?helicopterFlightAt(SEQUENCE.fire+30):this.hull;
        const tracking=Math.atan2(target.y-5-shoulder.y*scale,Math.max(12,target.x-this.actorX-shoulder.x*scale));
        const follow=smoothMotion((this.impactAge-18)/70),aim=this.firedAim===null?tracking:this.firedAim+(tracking-this.firedAim)*follow;
        const handsBack=1-smoothMotion((a-SEQUENCE.stow)/30);
        return {draw:smoothMotion((a-SEQUENCE.draw)/(SEQUENCE.shoulder-SEQUENCE.draw))*(1-smoothMotion((a-SEQUENCE.lower)/(SEQUENCE.stow-SEQUENCE.lower))),
            rifleLower:smoothMotion((a-40)/26)*(1-smoothMotion((a-SEQUENCE.stow)/30)),
            reach:smoothMotion((a-48)/30)*handsBack,
            triggerReach:smoothMotion((a-48)/24)*handsBack,
            supportReach:smoothMotion((a-65)/30)*handsBack,aim,
            recoil:pulse(a,SEQUENCE.fire,2,SEQUENCE.fire+4,SEQUENCE.fire+24),fired:this.launchAt>=0};
    }
    private release(part:AircraftPart,x:number,y:number,vx:number,vy:number,spin:number){
        const p=aircraftPoint(this.hull,x,y);
        this.pieces.push({part,x:p[0],y:p[1],angle:this.hull.angle,
            vx:this.hull.vx-this.hull.spin*(p[1]-this.hull.y)+vx,vy:this.hull.vy+this.hull.spin*(p[0]-this.hull.x)+vy,
            spin:this.hull.spin+spin,sleeping:false,contacts:0,quiet:0,born:this.tick,flatten:0,
            ...(part==='rotor'?{projection:{phase:this.rotor,rate:this.rotorRate,tilt:.085}}:{}),
            ...(part==='tail'?{accessory:{phase:this.rotor,rate:this.rotorRate}}:{})});
    }
    private scatter(x:number,y:number,count:number,force:number,normal?:Point,glazing=true){
        for(let i=0;i<count;i++){
            const seed=this.seed++,angle=seed*2.39996,speed=(.35+(seed%7)*.15)*force;
            const glass=glazing&&seed%4===0;
            this.chips.push({x,y,vx:normal?normal[0]*speed+Math.cos(angle)*speed*.65:Math.cos(angle)*speed,
                vy:normal?normal[1]*speed+Math.sin(angle)*speed*.65-.25:-.7-Math.abs(Math.sin(angle))*speed,
                angle,spin:(seed%2?1:-1)*(.06+(seed%3)*.03),size:glass?1+seed%2:1+seed%3,glass,rest:false,
                born:this.tick,hot:normal&&!glass?10+seed%13:0});
        }
        this.chips=this.chips.slice(-40);
    }
    private puff(x:number,y:number,radius:number,kind:AircraftPuff['kind'],vx=.1,vy=-.13){
        this.plumes.push({x,y,radius,kind,vx,vy,born:this.tick,seed:this.seed++});
    }
    private detonate(contact:NonNullable<ReturnType<typeof hullContact>>){
        const r=this.rocket!;this.impactAt=this.tick;this.impact={...contact,dx:r.dx,dy:r.dy};
        this.rocket=null;this.events.push('distant-blast');
        const before=helicopterFlightAt(this.age-1);
        this.hull.vx=this.hull.x-before.x+r.dx*.22;this.hull.vy=this.hull.y-before.y+r.dy*.1-.08;this.hull.spin=-.002;
        this.release('panel',contact.localX+3,contact.localY,contact.nx*.6,contact.ny*.6-.25,-.04);
        this.scatter(contact.x,contact.y,16,1.15,[contact.nx,contact.ny]);
    }
    private contactSparks(hit:AircraftContact,count:number){
        const direction=Math.sign(hit.slide)||1;
        for(let i=0;i<count;i++){
            const seed=this.seed++;
            this.sparks.push({x:hit.x,y:hit.y-.5,vx:direction*(.22+seed%5*.13),
                vy:-.2-seed%4*.12,born:this.tick,life:13+seed%9});
        }
        this.sparks=this.sparks.slice(-28);
    }
    private recordScar(hit:AircraftContact,slideLength:number,strength:number){
        const end=hit.x+hit.slide*slideLength,near=this.scars.find(mark=>Math.abs(mark.x-hit.x)<2);
        if(near){
            near.end=Math.max(near.end,end,near.x,hit.x);near.x=Math.min(near.x,hit.x,end);
            near.strength=Math.max(near.strength,strength);return;
        }
        const mark={x:hit.x,y:hit.y,end,strength,born:this.tick};
        if(this.scars.length<32){this.scars.push(mark);return;}
        const weakest=this.scars.reduce((index,value,i)=>value.strength<this.scars[index].strength?i:index,0);
        if(strength>this.scars[weakest].strength)this.scars[weakest]=mark;
    }
    private hitRail(before:Point[],after:Point[]){
        if(this.railBrokenAt>=0)return;
        const rail=HELICOPTER_RAIL;
        for(let i=0;i<after.length;i++){
            const a=before[i],b=after[i];
            if(a[1]>=rail.y||b[1]<rail.y)continue;
            const x=a[0]+(b[0]-a[0])*(rail.y-a[1])/(b[1]-a[1]);
            if(x<rail.left||x>rail.right)continue;
            this.railBrokenAt=this.tick;this.events.push('distant-metal');
            this.pieces.push({part:'rail',x:(rail.left+rail.right)/2,y:rail.y,angle:0,vx:-.65,vy:-.7,
                spin:-.025,sleeping:false,contacts:0,quiet:0,born:this.tick,flatten:0});
            this.contactSparks({x,y:rail.y,strength:this.hull.vy,slide:this.hull.vx,first:true},5);
            for(let j=0;j<3;j++)this.puff(x+(j-1)*3,HELICOPTER_GROUND,2,'dust',(j-1)*.15,-.08);
            this.hull.vy*=.93;this.hull.spin*=.88;
            return;
        }
    }
    private stepBody(p:AircraftBody,gravity:number){
        if(p.sleeping)return;
        const skids=p.part==='hull'&&this.skidsAttached,before=p.part==='hull'&&this.railBrokenAt<0?aircraftOutline(p,skids):null;
        const hit=stepAircraftBody(p,gravity,skids);
        if(before)this.hitRail(before,aircraftOutline(p,skids));
        if(!hit)return;
        const {strength,first,x,y:floor}=hit;
        if(p.part==='hull'&&this.crashAt<0){
            this.crashAt=this.tick;this.groundContact={x,y:floor,strength};
            this.events.push('distant-crash');this.release('skid',0,17,-.65,-.6,-.025);
            this.release('door',3,-1,-.9,-.8,-.045);this.scatter(x,floor,16,1.3);
            for(let j=0;j<7;j++)this.puff(x+(j-3)*2,floor-1,3+j%3,'dust',(j-3)*.24+p.vx*.2,-.065);
        }
        if(first||strength>.7){
            this.contacts.push({x,y:floor,born:this.tick,strength});
            if(strength>.45)this.contactSparks(hit,p.part==='hull'?7:3);
            if(strength>.6)this.recordScar(hit,3,strength);
            if(p.part!=='hull'&&this.tick-this.lastRattle>12){this.events.push('distant-debris');this.lastRattle=this.tick;}
        }
        if(Math.abs(hit.slide)>.12&&this.tick%5===0){
            this.recordScar(hit,5,Math.abs(hit.slide));
            this.contactSparks(hit,2);
        }
    }
    update(storyTick:number,actorX:number){
        this.events=[];this.tick++;
        if(this.age<0){if(storyTick!==SEQUENCE.start)return;this.age=0;}else this.age++;
        this.actorX=actorX;
        const a=this.age;
        if(this.impactAt<0){
            Object.assign(this.hull,helicopterFlightAt(a));this.rotorRate=2.18;
            if(a>=30&&a%12===6)this.events.push('distant-rotor');
        }else this.rotorRate=Math.max(.04,2.18*(1-smoothMotion(this.impactAge/88)));
        this.rotor+=this.rotorRate;
        if(a===72||a===130)this.events.push('distant-metal');
        if(a===SEQUENCE.fire){
            const geometry=launcherGeometry(this.body,this.launcher),scale=AFTERMATH_SCALE;
            const x=actorX+geometry.mouth[0]*scale,y=geometry.mouth[1]*scale,dx=Math.cos(geometry.angle),dy=Math.sin(geometry.angle);
            this.firedAim=geometry.angle;
            this.launchAt=this.tick;this.launch={x,y,dx,dy,backX:actorX+geometry.exhaust[0]*scale,backY:geometry.exhaust[1]*scale};
            this.rocket={x,y,fromX:x,fromY:y,dx,dy,age:0,remaining:180,speed:0,motorAge:-1};this.events.push('distant-launch');
        }
        if(this.rocket&&this.tick>this.launchAt){
            const r=this.rocket,speed=r.motorAge<0?.95:1.05+2.75*smoothMotion(r.motorAge/10),next:Point=[r.x+r.dx*speed,r.y+r.dy*speed];
            const contact=hullContact([r.x,r.y],next,this.hull);
            const motor=advanceRocketMotor(r,speed);
            if(motor.ignited)this.events.push('distant-rocket');
            for(let d=speed-motor.burnDistance+2.5-this.trailGap;d<=speed;d+=2.5){
                const tail=rocketTail(r.age+d/speed);
                this.trail.push({x:r.x+r.dx*(d-tail),y:r.y+r.dy*(d-tail),born:this.tick-1+d/speed,seed:this.seed++});
            }
            this.trailGap=(this.trailGap+motor.burnDistance)%2.5;r.x=next[0];r.y=next[1];r.age++;r.speed=speed;r.remaining-=speed;
            if(contact)this.detonate(contact);else if(r.remaining<=0)this.rocket=null;
        }
        const hit=this.impactAge;
        if(hit>=0){
            if(hit===HELICOPTER_BREAKUP.engine){
                this.events.push('distant-engine-fail');this.release('panel',9,-14,.38,-.7,.06);
                const p=aircraftPoint(this.hull,9,-14);this.scatter(...p,7,.7,[.25,-1],false);
                this.hull.spin-=.001;this.hull.vy-=.05;
            }
            if(hit===HELICOPTER_BREAKUP.tail)this.release('tail',36,-9,-.28,-.6,.035);
            if(hit===HELICOPTER_BREAKUP.rotor){this.release('rotor',1,-23,-.44,-.45,-.033);this.scatter(this.hull.x,this.hull.y-14,5,.7);}
            if(hit>=HELICOPTER_BREAKUP.engine&&this.crashAt<0&&hit%(this.hull.vy>.65?3:5)===0){
                const p=aircraftPoint(this.hull,9,-12);this.puff(...p,3.5+(hit%10)/5,'smoke',.13+this.hull.vx*.25,-.18+this.hull.vy*.07);
            }
            if(hit>14&&this.crashAt<0)this.hull.spin=Math.max(-.016,this.hull.spin-.0002);
            this.stepBody(this.hull,hit<18?.005:.033);
            if(this.crashAt>=0&&this.crashAge<240&&this.crashAge%12===0){const p=aircraftPoint(this.hull,9,-8);this.puff(...p,5,'smoke',.11,-.12);}
            for(const piece of this.pieces)if(piece.born<this.tick)this.stepBody(piece,piece.part==='rotor'?.032:.045);
            for(const p of this.chips)if(!p.rest){
                p.vy+=.045;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;
                const support=Math.abs(Math.sin(p.angle))*p.size+.5;
                if(p.y+support>=HELICOPTER_GROUND){p.y=HELICOPTER_GROUND-support;p.vy*=-.2;p.vx*=.66;p.spin*=.5;if(Math.abs(p.vx)+Math.abs(p.vy)<.2)p.rest=true;}
            }
            for(const p of this.sparks){
                p.vy+=.04;p.x+=p.vx;p.y+=p.vy;
                if(p.y>HELICOPTER_GROUND){p.y=HELICOPTER_GROUND;p.vy*=-.15;p.vx*=.7;}
            }
        }
        this.sparks=this.sparks.filter(p=>this.tick-p.born<p.life);
        this.trail=this.trail.filter(p=>this.tick-p.born<88).slice(-36);
        this.plumes=this.plumes.filter(p=>this.tick-p.born<132).slice(-48);
        this.contacts=this.contacts.filter(p=>this.tick-p.born<75).slice(-16);
    }
}
