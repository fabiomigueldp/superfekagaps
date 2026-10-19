import type { Rect } from '../../types';
import { clamp, overlaps, type FoeSpec } from '../types';
import type { WorldFoe, FoePhase } from '../WorldEnemies';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import { HypotheticalGuard, type GuardCoverSignal } from './HypotheticalGuards';
import {VANGUARD,planVanguardVault,vanguardLandingSpan,type VanguardLanding} from './HypotheticalVanguardTactics';
import {vanguardTargetPose,blendVanguardPose,type VanguardPose} from './HypotheticalVanguardMotion';
export {VANGUARD} from './HypotheticalVanguardTactics';

export type VanguardMove = 'rush' | 'cross' | 'vault' | 'sweep';
const STEP=1000/60;

/** The final defender contests space with native physics and committed attacks.
 * Every combination has at most two strikes, then a guaranteed punish window. */
export class HypotheticalVanguard extends HypotheticalGuard {
    move:VanguardMove='rush';
    actionTicks=0; attacks=0; strike=0; hitCooldown=0;
    landing:VanguardLanding|null=null;
    landed=false; landingAge=0; retreatTicks=0;
    pivotAt=-Infinity; pivotFrom=-1;
    swungAt=-Infinity; parryAt=-Infinity;
    swingKind:'guard-swipe'|'guard-sweep'='guard-swipe';
    parryPoint={x:0,y:0};
    lastPrimary:VanguardMove|null=null;
    private fraction=0;
    private flightX=0;
    private dashOrigin=0;
    private dashLength:number=VANGUARD.rushDistance;
    private retreatDirection=1;
    private grounded=true;
    private poseFrom:VanguardPose|null=null;
    private poseChangedAt=-Infinity;
    constructor(spec:FoeSpec,wave:number,private readonly squad:()=>readonly WorldFoe[],bounds:{left:number;right:number}){
        super(spec,wave,squad,bounds);
        this.width=20;this.height=28;this.y=spec.y-this.height;this.hp=VANGUARD.health;
        this.armor=false;this.phase='rest';this.vx=0;this.actionTicks=24;
    }
    override get warningDuration(){return this.tellTicks*STEP;}
    get attackDuration(){return this.move==='sweep'?26:this.enraged?20:VANGUARD.rushTicks;}
    get activeFrom(){return this.move==='sweep'?7:4;}
    get activeUntil(){return this.move==='sweep'?20:this.attackDuration-5;}
    get exposed(){return this.phase==='rest'||this.phase==='stunned'
        ||this.phase==='attack'&&(this.move==='vault'?this.landed&&this.landingAge>=8:this.actionTicks>=this.activeUntil);}
    override get blocksStomp(){return !this.exposed;}
    get tellTicks(){return (this.strike?VANGUARD.secondWarning:VANGUARD.warning)
        +(this.move==='vault'?4:this.move==='sweep'?2:0)-(this.enraged?4:0);}
    get recoveryTicks(){return this.move==='vault'?44:this.move==='sweep'?42:this.enraged?34:VANGUARD.recovery;}
    get enraged(){return this.hp<=2;}
    get pivotProgress(){return clamp((this.age-this.pivotAt)/(8*STEP),0,1);}
    get rushTarget(){return clamp(this.dashOrigin+this.facing*this.dashLength,this.bounds!.left,this.bounds!.right-this.width);}
    get duelPose(){
        const target=vanguardTargetPose(this);
        return this.poseFrom?blendVanguardPose(this.poseFrom,target,(this.age-this.poseChangedAt)/(6*STEP)):target;
    }
    override get coverSignal():GuardCoverSignal|null {
        if(this.dead||!this.awake||this.strike!==0||this.phase!=='warning')return null;
        return this.move==='rush'?{serial:this.attacks,arc:'high'}:this.move==='vault'?{serial:this.attacks,arc:'low'}:null;
    }
    private state(phase:FoePhase,from=this.duelPose){
        this.poseFrom=from;this.poseChangedAt=this.age;this.phase=phase;this.actionTicks=0;this.timer=0;
    }
    private face(direction:number){
        if(direction===this.facing)return;
        this.pivotFrom=this.facing;this.pivotAt=this.age;this.facing=direction;
    }
    private prepare(player:Rect,level:WorldLevel,followup?:VanguardMove){
        const pose=this.duelPose;
        const gap=player.x+player.width/2-this.x-this.width/2;
        this.face(gap<0?-1:1);
        const foot=player.y+player.height;
        const elevated=foot<this.y+this.height-20&&level.bodies.some(p=>p.kind==='support'
            &&Math.abs(p.y-foot)<3&&player.x+player.width>p.x&&player.x<p.x+p.width);
        let vault:VanguardLanding|null=null;
        if((elevated||Math.abs(gap)>132||this.lastPrimary==='sweep'||followup==='vault')&&this.grounded)
            vault=planVanguardVault(this,player,level,this.bounds!,this.squad());
        if(followup){this.move=followup==='vault'&&!vault?'cross':followup;}
        else{
            this.strike=0;
            this.move=vault&&this.lastPrimary!=='vault'&&(elevated||this.attacks%3===0||this.lastPrimary==='sweep')?'vault'
                :this.lastPrimary==='vault'?'rush'
                :Math.abs(gap)<92&&this.lastPrimary==='cross'?'sweep'
                :this.lastPrimary==='rush'||this.lastPrimary==='sweep'?'cross':'rush';
            this.lastPrimary=this.move;this.attacks++;
        }
        this.landing=this.move==='vault'?vault:null;this.landed=false;this.landingAge=0;
        this.flightX=this.landing?.velocityX??0;
        this.dashLength=this.move==='sweep'?32:this.move==='cross'?(this.strike?88:62)
            :clamp(Math.abs(gap)+22,80,this.enraged?120:VANGUARD.rushDistance);
        this.dashOrigin=this.x;this.state('warning',pose);
    }
    private finishStrike(player:Rect,level:WorldLevel){
        const gap=Math.abs(player.x+player.width/2-this.x-this.width/2);
        if(this.strike===0&&this.move==='cross'){
            this.strike=1;
            const elevated=player.y+player.height<this.y+this.height-20;
            this.prepare(player,level,this.enraged&&elevated?'vault':'cross');
        }else if(this.strike===0&&this.move==='rush'&&this.enraged&&gap<104
            &&Math.abs(player.y+player.height-this.y-this.height)<26){
            this.strike=1;this.prepare(player,level,'sweep');
        }else this.state('rest');
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
        if(this.phase==='stunned'&&this.actionTicks>=VANGUARD.stun){
            // Choose a side with room before stepping, rather than retreating into a gate.
            const left=this.x-this.bounds!.left,right=this.bounds!.right-this.x-this.width;
            this.retreatDirection=this.facing>0?(left>44?-1:1):(right>44?1:-1);
            this.retreatTicks=16;this.state('walk');
        }else if(this.phase==='rest'&&this.actionTicks>=this.recoveryTicks)this.state('walk');
        else if(this.phase==='walk'&&!this.retreatTicks&&this.grounded){
            const gap=player.x+player.width/2-this.x-this.width/2;
            this.face(gap<0?-1:1);
            if(Math.abs(gap)<210)this.prepare(player,level);
        }else if(this.phase==='warning'&&this.actionTicks>=this.tellTicks){
            this.dashOrigin=this.x;this.state('attack');if(this.move==='vault')this.vy=VANGUARD.jump;
        }
        let dx=this.phase==='walk'?this.facing*(this.enraged?2.35:VANGUARD.chaseSpeed):0;
        if(this.retreatTicks){dx=this.retreatDirection*VANGUARD.retreatSpeed;this.retreatTicks--;}
        if(this.phase==='warning'&&this.move==='cross'&&this.strike===0&&this.actionTicks<9)dx=-this.facing*.8;
        if(this.phase==='attack'){
            if(this.move!=='vault'&&this.actionTicks===this.activeFrom){
                this.swungAt=this.age;this.swingKind=this.move==='sweep'?'guard-sweep':'guard-swipe';
            }
            if(this.move==='vault'){
                if(!this.landed)dx=this.flightX;
                else if(++this.landingAge>=12)this.state('rest');
                if(this.actionTicks>90)this.state('rest');
            }else{
                const t=Math.min(1,this.actionTicks/this.attackDuration);
                const travel=t*t*(3-2*t),target=this.dashOrigin+this.facing*this.dashLength*travel;
                dx=target-this.x;
                if(this.actionTicks>=this.attackDuration){this.finishStrike(player,level);dx=0;}
            }
        }
        const old=this.x;
        this.vy=Math.min(8,this.vy+VANGUARD.gravity);
        const result=level.resolveCollision(this,{x:dx,y:this.vy},this);
        this.x=clamp(result.position.x,this.bounds!.left,this.bounds!.right-this.width);
        this.y=result.position.y;this.vy=result.velocity.y;this.grounded=result.grounded;
        this.motionX=this.x-old;this.distance+=Math.abs(this.motionX);
        if(this.phase==='attack'&&this.move==='vault'&&!this.landed&&result.grounded&&this.actionTicks>2){
            this.landed=true;this.landingAge=0;this.impactAt=this.age;
        }
    }
    override get danger():Rect|null{
        if(this.dead||!this.awake||this.phase!=='attack')return null;
        if(this.move==='vault'){
            if(!this.landed||this.landingAge>=8||!this.landing)return null;
            const span=vanguardLandingSpan({...this.landing,x:this.x});
            return {x:span.left,y:this.y+this.height-7,width:span.right-span.left,height:7};
        }
        if(this.actionTicks<this.activeFrom||this.actionTicks>=this.activeUntil)return null;
        const sweep=this.move==='sweep',reach=sweep?29:20;
        return {x:this.facing<0?this.x-reach:this.x+this.width-1,
            y:this.y+(sweep?this.height-9:10),width:reach+1,height:sweep?8:11};
    }
    override contact(p:Rect,previous:Rect,falling:boolean,pound:boolean):'none'|'hurt'|'bounce'|'kill'{
        if(this.dead||!this.awake)return 'none';
        if(this.danger&&overlaps(p,this.danger))return 'hurt';
        if(!overlaps(p,this))return 'none';
        if(falling&&previous.y+previous.height<=this.y+8){
            if(this.hitCooldown||!this.exposed){
                if(!this.exposed&&this.age-this.parryAt>=120){
                    this.parryAt=this.age;this.parryPoint={x:clamp(p.x+p.width/2,this.x+3,this.x+this.width-3),y:this.y-3};
                }
                return 'bounce';
            }
            const pose=this.duelPose;
            this.hp=Math.max(0,this.hp-(pound?2:1));this.flash=200;this.hitCooldown=VANGUARD.immunity;
            this.landing=null;this.landed=false;this.vy=0;this.state('stunned',pose);
            if(this.hp===0){this.dead=true;this.deadTimer=0;return 'kill';}
            return 'bounce';
        }
        return this.phase==='stunned'?'none':'hurt';
    }
}
