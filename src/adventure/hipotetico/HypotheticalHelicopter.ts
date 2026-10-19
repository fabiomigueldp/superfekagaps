import {smoothMotion} from './HypotheticalMotion';
import {launcherGeometry,launcherShoulder,type LauncherPose} from './HypotheticalTower';
import {advanceRocketMotor,rocketTail,type ScenicRocket} from './HypotheticalRocketMotion';
import {AFTERMATH_SCALE} from './HypotheticalAftermathHandling';
import {HELICOPTER_SEQUENCE as SEQUENCE} from './HypotheticalHelicopterTiming';
import type {Point} from '../WorldPainting';

export type HelicopterCue='distant-rotor'|'distant-engine-fail'|'distant-metal'|'distant-launch'|'distant-rocket'|'distant-blast'|'distant-crash'|'distant-debris';
export type AircraftPart='hull'|'tail'|'rotor'|'door'|'panel'|'skid';
export const HELICOPTER_GROUND=-6;
export const HELICOPTER_BREAKUP={engine:9,tail:16,rotor:28} as const;
export interface AircraftBody {
    part:AircraftPart;x:number;y:number;angle:number;vx:number;vy:number;spin:number;
    sleeping:boolean;contacts:number;quiet:number;born:number;flatten:number;
}
export interface AircraftChip {x:number;y:number;vx:number;vy:number;angle:number;spin:number;size:number;glass:boolean;rest:boolean;born:number;hot:number}
export interface AircraftPuff {x:number;y:number;vx:number;vy:number;born:number;seed:number;radius:number;kind:'smoke'|'dust'}
export const AIRCRAFT_SHAPES:Record<AircraftPart,readonly Point[]>={
    hull:[[-26,1],[-24,-6],[-15,-14],[5,-14],[19,-8],[23,3],[14,11],[-14,10]],
    tail:[[-18,3],[8,-3],[12,-16],[18,-18],[17,3],[2,8]],
    rotor:[[-35,-1],[33,-1],[36,1],[-34,2]],
    door:[[-6,-8],[6,-8],[6,8],[-6,8]],
    panel:[[-6,-3],[5,-5],[7,2],[-4,5]],
    skid:[[-23,0],[-20,-2],[20,-2],[24,0],[22,2],[-22,2]],
};
export function aircraftPoint(p:Pick<AircraftBody,'x'|'y'|'angle'>&{flatten?:number},x:number,y:number):Point {
    const co=Math.cos(p.angle),si=Math.sin(p.angle),height=y*(1-(p.flatten??0));
    return [p.x+x*co-height*si,p.y+x*si+height*co];
}
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
    contacts:Array<{x:number;y:number;born:number;strength:number}>=[];
    impact:{x:number;y:number;dx:number;dy:number;nx:number;ny:number;localX:number;localY:number}|null=null;
    groundContact:{x:number;y:number;strength:number}|null=null;
    launch:{x:number;y:number;dx:number;dy:number;backX:number;backY:number}|null=null;
    rocket:ScenicRocket|null=null;
    trail:Array<{x:number;y:number;born:number;seed:number}>=[];
    rotor=0;private trailGap=0;private seed=0;private lastRattle=-100;private firedAim:number|null=null;
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
            spin:this.hull.spin+spin,sleeping:false,contacts:0,quiet:0,born:this.tick,flatten:0});
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
    private stepBody(p:AircraftBody,gravity:number){
        if(p.sleeping)return;
        // Sheet metal tips onto its broad face after first contact. Drawing and
        // support geometry share the same foreshortening, so doors cannot rest upright.
        if(p.contacts>0&&(p.part==='door'||p.part==='panel'))p.flatten=Math.min(.72,p.flatten+.035);
        if(p.contacts>0&&p.part==='hull')p.flatten=Math.min(.11,p.flatten+.012);
        p.vy+=gravity;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;
        const shape=p.part==='hull'&&this.skidsAttached?[...AIRCRAFT_SHAPES.hull,[-20,17],[21,17]] as Point[]:AIRCRAFT_SHAPES[p.part];
        const support=shape.map(v=>aircraftPoint(p,...v)).reduce((lowest,v)=>v[1]>lowest[1]?v:lowest),floor=HELICOPTER_GROUND;
        if(support[1]<floor){p.quiet=0;return;}
        p.y-=support[1]-floor;const strength=Math.max(0,p.vy),first=p.contacts++===0;
        if(p.part==='hull'&&this.crashAt<0){
            this.crashAt=this.tick;this.groundContact={x:support[0],y:floor,strength};
            this.events.push('distant-crash');this.release('skid',0,17,-.65,-.6,-.025);
            this.release('door',3,-1,.65,-1,.065);this.scatter(support[0],floor,16,1.3);
            for(let j=0;j<7;j++)this.puff(support[0]+(j-3)*2,floor-1,3+j%3,'dust',(j-3)*.24+p.vx*.2,-.065);
        }
        if(first||strength>.7){
            this.contacts.push({x:support[0],y:floor,born:this.tick,strength});
            if(p.part!=='hull'&&this.tick-this.lastRattle>12){this.events.push('distant-debris');this.lastRattle=this.tick;}
        }
        p.vy=strength>.45?-strength*(p.part==='hull'?.12:.24):0;
        p.vx*=p.part==='hull'?.84:.78;
        // Contact torque brings each broad surface onto the street; its lowest
        // painted vertex is projected back onto the ground on every frame.
        const target=p.part==='hull'?-.24:p.part==='tail'?.12:Math.round(p.angle/Math.PI)*Math.PI;
        p.spin=(p.spin+(target-p.angle)*.012)*.68;
        if(Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)*15<.09){
            if(++p.quiet>14){p.sleeping=true;p.vx=p.vy=p.spin=0;}
        }else p.quiet=0;
    }
    update(storyTick:number,actorX:number){
        this.events=[];this.tick++;
        if(this.age<0){if(storyTick!==SEQUENCE.start)return;this.age=0;}else this.age++;
        this.actorX=actorX;
        const a=this.age;
        if(this.impactAt<0){
            Object.assign(this.hull,helicopterFlightAt(a));this.rotor+=2.18;
            if(a>=30&&a%12===6)this.events.push('distant-rotor');
        }else this.rotor+=Math.max(.04,2.18*(1-smoothMotion(this.impactAge/88)));
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
            if(hit===HELICOPTER_BREAKUP.tail)this.release('tail',36,-9,.55,-.6,.035);
            if(hit===HELICOPTER_BREAKUP.rotor){this.release('rotor',1,-23,-.28,-1.05,-.052);this.scatter(this.hull.x,this.hull.y-14,5,.7);}
            if(hit>=HELICOPTER_BREAKUP.engine&&this.crashAt<0&&hit%(this.hull.vy>.65?3:5)===0){
                const p=aircraftPoint(this.hull,9,-12);this.puff(...p,3.5+(hit%10)/5,'smoke',.13+this.hull.vx*.25,-.18+this.hull.vy*.07);
            }
            if(hit>14&&this.crashAt<0)this.hull.spin=Math.max(-.016,this.hull.spin-.0002);
            this.stepBody(this.hull,hit<18?.005:.033);
            if(this.crashAt>=0&&this.crashAge<240&&this.crashAge%12===0){const p=aircraftPoint(this.hull,9,-8);this.puff(...p,5,'smoke',.11,-.12);}
            for(const piece of this.pieces)if(piece.born<this.tick)this.stepBody(piece,.045);
            for(const p of this.chips)if(!p.rest){
                p.vy+=.045;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;
                const support=Math.abs(Math.sin(p.angle))*p.size+.5;
                if(p.y+support>=HELICOPTER_GROUND){p.y=HELICOPTER_GROUND-support;p.vy*=-.2;p.vx*=.66;p.spin*=.5;if(Math.abs(p.vx)+Math.abs(p.vy)<.2)p.rest=true;}
            }
        }
        this.trail=this.trail.filter(p=>this.tick-p.born<88).slice(-36);
        this.plumes=this.plumes.filter(p=>this.tick-p.born<132).slice(-48);
        this.contacts=this.contacts.filter(p=>this.tick-p.born<75).slice(-16);
    }
}
