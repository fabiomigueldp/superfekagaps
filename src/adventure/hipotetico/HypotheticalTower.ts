import {smoothMotion,riderBend} from './HypotheticalMotion';
import {SIEGE_SECTORS} from './HypotheticalSiege';
import {AFTERMATH_SCALE} from './HypotheticalAftermathHandling';
import {HypotheticalTowerPhysics,TOWER_RELEASE} from './HypotheticalTowerPhysics';
import {HypotheticalTowerSearch} from './HypotheticalTowerSearch';
import {advanceRocketMotor,rocketTail,type ScenicRocket} from './HypotheticalRocketMotion';

export const BASTION_TOWER={x:SIEGE_SECTORS[3].origin+125,left:-31,right:33,hitY:-64} as const;
export const TOWER_SEQUENCE={draw:30,shoulder:98,fire:142,lower:286,stow:324,end:354} as const;
export type TowerCue='distant-metal'|'distant-launch'|'distant-rocket'|'distant-blast'|'distant-stone'|'distant-bell'|'distant-debris'|'distant-wood';
export interface LauncherPose {draw:number;rifleLower:number;reach:number;supportReach?:number;triggerReach?:number;aim:number;recoil:number;fired:boolean}
interface RiderBody {bow:number;compression:number;riderDrop?:number;riderLean?:number}
export function launcherShoulder(body:RiderBody){
    return {x:7+riderBend(14,body.riderLean??0),y:-85+body.bow*39+body.compression+(body.riderDrop??0)};
}
/** Socket, hands, tube mouth and exhaust all share this authored trajectory. */
export function launcherGeometry(body:RiderBody,p:LauncherPose){
    const shoulder=launcherShoulder(body),saddle=-64+body.bow*39+body.compression,t=p.draw;
    const x=-21+(shoulder.x+21)*t-Math.sin(Math.PI*t)*5-p.recoil*2.5;
    const y=saddle-10+(shoulder.y-saddle+10)*t-Math.sin(Math.PI*t)*14;
    const angle=-1.25+(p.aim+1.25)*t,co=Math.cos(angle),si=Math.sin(angle);
    const point=(a:number,b:number):[number,number]=>[x+a*co-b*si,y+a*si+b*co];
    return {x,y,angle,point,mouth:point(39,0),exhaust:point(-20,0),trigger:point(5,6),support:point(21,4)};
}
const pulse=(a:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((a-start)/rise)*(1-smoothMotion((a-hold)/(end-hold)));

/** A unique landmark event, independent from the repeatable debris score.
 * Before ignition an unseen scene retracts the weapon; after ignition its
 * projectile and masonry finish moving, even if Feka chooses to look away. */
export class HypotheticalTower {
    tick=0;age=-1;impactAt=-1;launchAt=-1;abortedAt=-1;retryAt=0;
    events:TowerCue[]=[];
    readonly destruction=new HypotheticalTowerPhysics();
    readonly search=new HypotheticalTowerSearch(this.destruction,BASTION_TOWER.x);
    rocket:ScenicRocket|null=null;
    trail:Array<{x:number;y:number;born:number;seed:number}>=[];
    launch:{x:number;y:number;dx:number;dy:number;backX:number;backY:number}|null=null;
    private retract:LauncherPose|null=null;
    private rubbleCueAt=-100;
    private trailGap=0;
    private trailSeed=0;
    private unframed=0;
    get destroyed(){return this.impactAt>=0;}
    get impactAge(){return this.destroyed?this.tick-this.impactAt:-1;}
    get done(){return this.age>=0&&(this.abortedAt>=0?this.age-this.abortedAt>=60:this.age>=TOWER_SEQUENCE.end);}
    get active(){return this.age>=0&&!this.done;}
    get available(){return !this.destroyed&&this.launchAt<0&&!this.active&&this.tick>=this.retryAt;}
    begin(){if(!this.available)return;this.age=0;this.abortedAt=-1;this.retract=null;this.unframed=0;}
    private abort(){
        if(this.abortedAt>=0||this.launchAt>=0)return;
        this.retract=this.motion;this.abortedAt=this.age;this.retryAt=this.tick+48;
    }
    get motion():LauncherPose {
        const a=this.age;
        if(a<0||this.done)return {draw:0,rifleLower:0,reach:0,aim:-.12,recoil:0,fired:this.launchAt>=0};
        if(this.retract){
            const t=smoothMotion((a-this.abortedAt)/48),hands=1-smoothMotion((a-this.abortedAt-30)/30);
            return {...this.retract,draw:this.retract.draw*(1-t),reach:this.retract.reach*hands,
                rifleLower:this.retract.rifleLower*hands,recoil:0};
        }
        return {draw:smoothMotion((a-TOWER_SEQUENCE.draw)/(TOWER_SEQUENCE.shoulder-TOWER_SEQUENCE.draw))
                *(1-smoothMotion((a-TOWER_SEQUENCE.lower)/(TOWER_SEQUENCE.stow-TOWER_SEQUENCE.lower))),
            rifleLower:smoothMotion(a/28)*(1-smoothMotion((a-TOWER_SEQUENCE.stow)/30)),
            reach:smoothMotion((a-18)/30)*(1-smoothMotion((a-TOWER_SEQUENCE.stow)/30)),
            aim:-.12,recoil:pulse(a,TOWER_SEQUENCE.fire,2,TOWER_SEQUENCE.fire+3,TOWER_SEQUENCE.fire+22),fired:this.launchAt>=0};
    }
    get body(){
        const a=this.age,m=this.motion,brace=m.draw;
        const shock=this.abortedAt>=0?0:pulse(a,TOWER_SEQUENCE.fire,3,TOWER_SEQUENCE.fire+4,TOWER_SEQUENCE.fire+26);
        const watch=smoothMotion((this.impactAge-25)/85)*brace;
        const echo=pulse(this.impactAge,4,3,8,22)*brace;
        return {bow:brace*.035+watch*.08,compression:brace+shock*2+echo*.5,riderDrop:brace*1.5+shock*2,
            riderLean:-m.reach*1.8-shock*5+watch*2-echo*.7,neckDrop:-brace*3+watch*3+echo*1.4,jaw:.12+shock*.16,
            tail:brace*-.12,brace:brace*.7,focus:brace,lookBack:0,eyeClose:Math.max(shock*.75,echo*.25)};
    }
    update(framed:boolean,barrel:()=>{x:number;y:number;backX:number;backY:number}){
        this.events=[];this.tick++;this.search.advance();
        if(this.active){
            this.age++;
            this.unframed=framed?0:this.unframed+1;
            if(this.unframed>=36&&this.age<=TOWER_SEQUENCE.fire)this.abort();
            if(this.abortedAt<0){
                if(this.age===38||this.age===104)this.events.push('distant-metal');
                if(this.age===TOWER_SEQUENCE.fire){
                    const p=barrel(),dx=BASTION_TOWER.x-p.x,dy=BASTION_TOWER.hitY-p.y,length=Math.hypot(dx,dy);
                    this.launchAt=this.tick;this.launch={...p,dx:dx/length,dy:dy/length};
                    this.rocket={x:p.x,y:p.y,fromX:p.x,fromY:p.y,dx:dx/length,dy:dy/length,age:0,remaining:length,speed:0,motorAge:-1};
                    this.events.push('distant-launch');
                }
            }
        }
        if(this.rocket&&this.tick>this.launchAt){
            const r=this.rocket,speed=Math.min(r.remaining,1.1+5.6*smoothMotion((r.age-3)/15));
            const motor=advanceRocketMotor(r,speed);
            if(motor.ignited)this.events.push('distant-rocket');
            for(let d=speed-motor.burnDistance+3-this.trailGap;d<=speed;d+=3){
                const tail=rocketTail(r.age+d/speed);
                this.trail.push({x:r.x+r.dx*(d-tail),y:r.y+r.dy*(d-tail),born:this.tick-(speed-d)/speed,seed:this.trailSeed++});
            }
            this.trailGap=(this.trailGap+motor.burnDistance)%3;
            r.age++;r.speed=speed;r.remaining-=speed;r.x+=r.dx*speed;r.y+=r.dy*speed;
            if(r.remaining<=0){
                this.rocket=null;this.impactAt=this.tick;this.destruction.start(r.dx);this.events.push('distant-blast');
            }
        }
        this.trail=this.trail.filter(p=>this.tick-p.born<88).slice(-36);
        if(this.impactAge>0){
            this.destruction.step(this.impactAge);
            if(this.impactAge===TOWER_RELEASE.shaft)this.events.push('distant-debris');
            const contacts=this.destruction.events;
            if(contacts.some(c=>c.part==='bell'&&c.first))this.events.push('distant-bell');
            const strongest=contacts.filter(c=>c.part!=='bell').sort((a,b)=>b.strength-a.strength)[0];
            if(strongest&&this.tick-this.rubbleCueAt>=10){
                this.events.push(strongest.material==='tile'||strongest.material==='wood'?'distant-wood':'distant-stone');this.rubbleCueAt=this.tick;
            }
        }
    }
}

export function towerLauncherPose(tower:HypotheticalTower,body:RiderBody,lift:number,x:number,facing:number):LauncherPose {
    const watch=smoothMotion((tower.impactAge-25)/85),s=launcherShoulder(body);
    const aim=Math.atan2(BASTION_TOWER.hitY+38*watch-lift-s.y*AFTERMATH_SCALE,
        Math.max(12,(BASTION_TOWER.x+28*watch-x)*facing-s.x*AFTERMATH_SCALE));
    return {...tower.motion,aim};
}
