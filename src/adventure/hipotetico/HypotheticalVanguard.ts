import type { Rect } from '../../types';
import { clamp, overlaps, type FoeSpec } from '../types';
import type { WorldFoe, FoePhase } from '../WorldEnemies';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import { HypotheticalGuard } from './HypotheticalGuards';

export type VanguardMove = 'rush' | 'cross' | 'vault';
export const VANGUARD = { health:4, warning:34, secondWarning:26, rushTicks:24,
    rushDistance:92, recovery:50, stun:22, immunity:34, gravity:.34, jump:-7.6 } as const;
const STEP=1000/60;

/** A local elite, using native floor, one-way decks, stomps and equipment.
 * Targets are committed at the tell. No mid-flight homing or instant turn. */
export class HypotheticalVanguard extends HypotheticalGuard {
    move:VanguardMove='rush';
    actionTicks=0; attacks=0; strike=0; hitCooldown=0;
    landing:{x:number;y:number}|null=null;
    landed=false; landingAge=0;
    retreatTicks=0;
    private fraction=0;
    private flightX=0;
    private dashOrigin=0;
    constructor(spec:FoeSpec,wave:number,company:()=>readonly WorldFoe[],bounds:{left:number;right:number}){
        super(spec,wave,company,bounds);
        this.width=20;this.height=28;this.y=spec.y-this.height;this.hp=VANGUARD.health;
        this.armor=false;this.phase='rest';this.vx=0;this.actionTicks=36;
    }
    override get warningDuration(){return (this.strike?VANGUARD.secondWarning:VANGUARD.warning)*STEP;}
    get exposed(){return this.phase==='rest'||this.phase==='stunned'
        ||this.phase==='attack'&&(this.move==='vault'?this.landed&&this.landingAge>=8:this.actionTicks>=19);}
    override get blocksStomp(){return !this.exposed;}
    get tellTicks(){return (this.strike?VANGUARD.secondWarning:VANGUARD.warning)-(this.hp===1?4:0);}
    get enraged(){return this.hp===1;}
    private state(phase:FoePhase){this.phase=phase;this.actionTicks=0;this.timer=0;}
    private prepare(player:Rect,level:WorldLevel,followup=false){
        const gap=player.x+player.width/2-this.x-this.width/2;
        this.facing=gap<0?-1:1;
        if(!followup){
            this.strike=0;
            const elevated=player.y+player.height<this.y+this.height-24;
            this.move=(elevated||Math.abs(gap)>124)&&this.attacks%3!==2?'vault':this.attacks%2?'cross':'rush';
            this.attacks++;this.landing=null;this.landed=false;
        }
        if(this.move==='vault'){
            const foot=player.y+player.height;
            const perch=level.bodies.find(p=>p.kind==='support'&&Math.abs(p.y-foot)<12
                &&player.x+player.width>p.x&&player.x<p.x+p.width);
            const x=clamp(player.x-3,this.bounds!.left+8,this.bounds!.right-this.width-8);
            const y=perch?perch.y:224;
            const steps=(7.6+Math.sqrt(Math.max(1,7.6**2+2*VANGUARD.gravity*(y-this.y-this.height))))/VANGUARD.gravity;
            this.flightX=clamp((x-this.x)/steps,-3.8,3.8);
            this.landing={x:this.x+this.flightX*steps,y};
        }
        this.dashOrigin=this.x;this.state('warning');
    }
    override update(dt:number,level:WorldLevel,_objects:WorldObjects,player:Rect){
        if(!Number.isFinite(dt)||dt<=0)return;
        this.fraction+=dt;
        while(this.fraction+1e-7>=STEP){this.fraction-=STEP;this.advance(level,player);}
    }
    private advance(level:WorldLevel,player:Rect){
        this.age+=STEP;this.flash=Math.max(0,this.flash-STEP);
        if(this.dead){this.deadTimer+=STEP;return;}
        if(!this.awake){this.motionX=0;return;}
        this.actionTicks++;this.timer=this.actionTicks*STEP;this.hitCooldown=Math.max(0,this.hitCooldown-1);
        if(this.phase==='stunned'&&this.actionTicks>=VANGUARD.stun){this.retreatTicks=18;this.state('walk');}
        else if(this.phase==='rest'&&this.actionTicks>=(this.enraged?38:VANGUARD.recovery))this.state('walk');
        else if(this.phase==='walk'&&!this.retreatTicks&&Math.abs(player.x-this.x)<230)this.prepare(player,level);
        else if(this.phase==='warning'&&this.actionTicks>=this.tellTicks){
            this.dashOrigin=this.x;this.state('attack');if(this.move==='vault')this.vy=VANGUARD.jump;
        }
        let dx=0;
        if(this.phase==='walk')dx=this.facing*1.25;
        if(this.retreatTicks){dx=-this.facing*1.8;this.retreatTicks--;}
        if(this.phase==='warning'&&this.move==='cross'&&this.strike===0&&this.actionTicks<12)dx=-this.facing*.65;
        if(this.phase==='attack'){
            if(this.move==='vault'){
                if(!this.landed)dx=this.flightX;
                else if(++this.landingAge>=12)this.state('rest');
                if(this.actionTicks>90)this.state('rest');
            }else{
                const t=Math.min(1,this.actionTicks/VANGUARD.rushTicks);
                const distance=this.move==='cross'?(this.strike?80:58):VANGUARD.rushDistance;
                const target=this.dashOrigin+this.facing*distance*(t*t*(3-2*t));
                dx=target-this.x;
                if(this.actionTicks>=VANGUARD.rushTicks){
                    if(this.move==='cross'&&this.strike===0){this.strike=1;this.prepare(player,level,true);}
                    else this.state('rest');
                    dx=0;
                }
            }
        }
        const old=this.x;
        this.vy=Math.min(8,this.vy+VANGUARD.gravity);
        const result=level.resolveCollision(this,{x:dx,y:this.vy},this);
        this.x=clamp(result.position.x,this.bounds!.left,this.bounds!.right-this.width);
        this.y=result.position.y;this.vy=result.velocity.y;
        this.motionX=this.x-old;this.distance+=Math.abs(this.motionX);
        if(this.phase==='attack'&&this.move==='vault'&&!this.landed&&result.grounded&&this.actionTicks>2){
            this.landed=true;this.landingAge=0;this.impactAt=this.age;
        }
    }
    override get danger():Rect|null{
        if(this.dead||!this.awake||this.phase!=='attack')return null;
        if(this.move==='vault')return this.landed&&this.landingAge<8
            ?{x:this.x-18,y:this.y+this.height-7,width:this.width+36,height:7}:null;
        return this.actionTicks>=5&&this.actionTicks<19
            ?{x:this.facing<0?this.x-17:this.x+this.width-1,y:this.y+11,width:18,height:10}:null;
    }
    override contact(p:Rect,previous:Rect,falling:boolean,pound:boolean):'none'|'hurt'|'bounce'|'kill'{
        if(this.dead||!this.awake)return 'none';
        if(this.danger&&overlaps(p,this.danger))return 'hurt';
        if(!overlaps(p,this))return 'none';
        if(falling&&previous.y+previous.height<=this.y+8){
            if(this.hitCooldown||!this.exposed)return 'bounce';
            this.hp=Math.max(0,this.hp-(pound?2:1));this.flash=200;this.hitCooldown=VANGUARD.immunity;
            this.landing=null;this.landed=false;this.vy=0;this.state('stunned');
            if(this.hp===0){this.dead=true;this.deadTimer=0;return 'kill';}
            return 'bounce';
        }
        return this.phase==='stunned'?'none':'hurt';
    }
}
