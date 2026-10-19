import { WorldFoe } from '../WorldEnemies';
import type { FoePhase } from '../WorldEnemies';
import type { FoeSpec } from '../types';
import type { Rect } from '../../types';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import { isSolidTile } from '../../world/tileRules';
import { overlaps } from '../types';
import { guardActionPose, blendGuardAction, GUARD_LUNGE, type GuardActionPose } from './HypotheticalGuardMotion';
import { GUARD_VAULT, planGuardVault, type GuardVaultTarget } from './HypotheticalGuardVault';
export { GUARD_LUNGE } from './HypotheticalGuardMotion';

const frame = 1000 / 60;
export const GUARD_SHOVE = { warning: 650, attack: 300, recovery: 950, reach: 9 } as const;
// A complete Feka body fits between allies, including a little room after a successful stomp bounce.
export const GUARD_FOOTWORK = { gap: 18, attackSpace: 32, pivot: 180, reload: 1000, reloadStep: 6 } as const;
export const GUARD_COVER = { resupply:1100, chargeUntil:500 } as const;

/** Encounter-local variations. Contacts, armor, stomps and terrain still belong to WorldFoe. */
export class HypotheticalGuard extends WorldFoe {
    awake = true;
    lastRelease = -Infinity;
    releaseHigh = false;
    armorLostAt = -Infinity;
    comboStep = 0;
    coveringCharge = false;
    transitionAt = -Infinity;
    transitionFrom: GuardActionPose | null = null;
    yielding = false;
    turnAt = -Infinity;
    private turnTarget = 1;
    reloadAt = -Infinity;
    private reloadOrigin = 0;
    private reloadFacing = 1;
    private lastArmor = true;
    private launches = 0;
    vaultTarget: GuardVaultTarget | null = null;
    vaultLandedAt = -Infinity;
    impactAt = -Infinity;
    private lastVaultAt = -Infinity;
    private perchTime = 0;
    private perchId = '';
    private vaultVelocity = 0;

    constructor(spec: FoeSpec, readonly wave = 1, private readonly company: () => readonly WorldFoe[] = () => [],
        readonly bounds?: {left:number;right:number}) {
        super(spec);
        // Both entrances face into the courtyard; the left entrance used to patrol away from Feka.
        this.facing = spec.x < (bounds ? (bounds.left+bounds.right)/2 : 160) ? 1 : -1;
        this.vx = this.facing * this.patrolSpeed;
        if(spec.kind==='loader'){this.startReload();if(bounds)this.timer=spec.x>bounds.left+230?350:800;}
    }
    get patrolSpeed() { return this.spec.kind==='minion' ? .8+(this.wave-1)*.08 : .65; }
    override get highThrow() { return this.spec.kind==='loader'?this.launches%2===1:super.highThrow; }
    override get blocksStomp() {
        if(this.spec.kind==='helmet')return this.armor&&!['rest','stunned'].includes(this.phase);
        if(this.spec.kind==='charger'&&!this.armor)return false;
        return super.blocksStomp;
    }
    override get warningDuration() { return this.vaultTarget ? GUARD_VAULT.warning : this.spec.kind === 'helmet' ? GUARD_SHOVE.warning : this.longLunge ? GUARD_LUNGE.warning : super.warningDuration; }
    get longLunge() { return this.spec.kind==='minion'&&this.comboLength===2&&this.comboStep===1; }
    get comboLength() { return (this.wave >= 2 && this.spec.kind==='minion'||this.wave===3&&this.spec.kind==='loader') ? 2 : 1; }
    get turnProgress() { return Math.max(0, Math.min(1, (this.age-this.turnAt)/GUARD_FOOTWORK.pivot)); }
    get reloadProgress() { return Math.max(0, Math.min(1, (this.age-this.reloadAt)/GUARD_FOOTWORK.reload)); }
    get actionPose(): GuardActionPose {
        const target=guardActionPose(this);
        if(this.vaultTarget){
            if(this.phase==='warning'){target.crouch=target.brace*3;target.lean=-target.brace*3;target.cut=-target.brace*.8;}
            else if(this.phase==='attack'){
                const flight=Math.max(0,Math.min(1,this.timer/(this.vaultTarget.steps*frame)));
                target.thrust=0;target.tuck=Math.sin(flight*Math.PI);target.lean=2;target.cut=-.8+flight*.6;target.crouch=0;
            }else if(this.phase==='rest'){
                const t=Math.min(1,this.timer/240);target.crouch=Math.sin(t*Math.PI)*2.4;target.lean=(1-t)*2;
            }
        }
        if(this.phase==='walk') {
            target.turn=Math.sin(Math.PI*this.turnProgress);
            if(this.yielding)target.brace=.25;
        }
        if(this.spec.kind==='loader'&&this.phase==='rest'){
            const t=this.reloadProgress,smooth=(v:number)=>{const u=Math.max(0,Math.min(1,v));return u*u*(3-2*u);};
            target.supply=t<.42?smooth(t/.3):1-smooth((t-.42)/.38);
            target.crouch+=target.supply*1.2;
        }
        if(this.spec.kind==='loader'&&this.comboLength===2){
            // The hand returns to the satchel between the two throws. The next barrel is
            // collected there, then raised during its own complete warning.
            if(this.phase==='recoil'&&this.comboStep===0)target.supply=Math.max(0,Math.min(1,(this.timer-100)/220));
            if(this.phase==='warning'&&this.comboStep===1)target.supply=1-Math.max(0,Math.min(1,this.timer/280));
        }
        return this.transitionFrom?blendGuardAction(this.transitionFrom,target,(this.age-this.transitionAt)/(this.phase==='attack'?50:120)):target;
    }
    private change(phase: FoePhase) { this.phase = phase; this.timer = 0; }
    /** Live neighbors are read in simulation order, so two approaching bodies cannot use stale gaps. */
    private clearance(direction:number,from=this.x) {
        let space=Infinity;
        for(const ally of this.company()){
            if(ally===this||ally.dead||ally instanceof HypotheticalGuard&&!ally.awake||Math.abs(ally.y+ally.height-this.y-this.height)>4)continue;
            if((ally.x+ally.width/2-from-this.width/2)*direction<=0)continue;
            space=Math.min(space,direction>0?ally.x-from-this.width:from-ally.x-ally.width);
        }
        return space;
    }
    private separate(dx:number,from=this.x) {
        return Math.sign(dx)*Math.min(Math.abs(dx),Math.max(0,this.clearance(Math.sign(dx),from)-GUARD_FOOTWORK.gap));
    }
    private idleStep(dt:number,level:WorldLevel,dx=0) {
        this.age+=dt;this.timer+=dt;this.flash=Math.max(0,this.flash-dt);this.travel(dx,dt,level);
    }
    private startReload(){this.reloadAt=this.age;this.reloadOrigin=this.x;this.reloadFacing=this.facing;}
    private acquireVault(dt:number,level:WorldLevel,player:Rect){
        if(this.dead||this.spec.kind!=='minion'||this.wave<2||this.phase!=='walk'||this.vaultTarget||this.age-this.lastVaultAt<GUARD_VAULT.cooldown){this.perchTime=0;return;}
        const target=planGuardVault(this,player,level,this.company());
        if(!target){this.perchTime=0;this.perchId='';return;}
        if(this.perchId!==target.supportId){this.perchTime=0;this.perchId=target.supportId;}
        this.perchTime+=dt;
        if(this.perchTime<GUARD_VAULT.acquire)return;
        this.vaultTarget=target;this.lastVaultAt=this.age;this.perchTime=0;this.comboStep=0;
        this.facing=target.x>=this.x?1:-1;this.vx=this.facing*this.patrolSpeed;
        this.vaultVelocity=(target.x-this.x)/target.steps;this.change('warning');
    }
    private updateVault(dt:number,level:WorldLevel,fresh:boolean){
        const target=this.vaultTarget!;
        this.age+=dt;this.timer+=fresh?0:dt;this.flash=Math.max(0,this.flash-dt);
        if(this.phase==='warning'){
            if(this.timer>=GUARD_VAULT.warning){this.change('attack');this.vy=GUARD_VAULT.velocityY;}
        }else if(this.phase==='attack'){
            const step=dt/frame;this.vy=Math.min(8,this.vy+GUARD_VAULT.gravity*step);
            const remaining=target.x-this.x,dx=Math.sign(this.vaultVelocity)*Math.min(Math.abs(remaining),Math.abs(this.vaultVelocity*step));
            const result=level.resolveCollision(this,{x:dx,y:this.vy*step},this);
            this.x=result.position.x;this.y=result.position.y;this.vy=result.velocity.y;
            if(result.grounded){this.vaultLandedAt=this.age;this.change('rest');}
        }else if(this.phase==='rest'&&this.timer>=GUARD_VAULT.recovery){
            this.vaultTarget=null;this.change('walk');this.vx=this.facing*this.patrolSpeed;
        }
    }
    private updateBatedor(dt:number,level:WorldLevel,player:Rect){
        // Use the native phases and contacts, but recognize actual one-way decks
        // as footing. The campaign patrol's tile-only edge check cannot do that.
        this.age+=dt;this.timer+=dt;this.flash=Math.max(0,this.flash-dt);
        if(this.dead){this.deadTimer+=dt;return;}
        const gap=player.x+player.width/2-this.x-this.width/2,foot=this.y+this.height;
        if(this.phase==='walk'&&gap*this.facing>0&&Math.abs(player.x-this.x)<52&&Math.abs(player.y+player.height-foot)<1)this.change('warning');
        else if(this.phase==='warning'&&this.timer>=this.warningDuration)this.change('attack');
        else if(this.phase==='attack'&&this.timer>=240)this.change('rest');
        else if(this.phase==='rest'&&this.timer>=900)this.change('walk');
        const dx=(this.phase==='walk'?this.vx:this.phase==='attack'?this.facing*1.2:0)*dt/frame,oldX=this.x;
        // Leave a conquered perch when Feka drops to the road; do not get stuck
        // turning in place above him. The native floor still catches the fall.
        const drop=this.phase==='walk'&&player.y+player.height>foot+16;
        this.travel(dx,dt,level,drop);
        if(this.phase==='walk'&&dx&&Math.abs(this.x-oldX)<.001){this.vx=-this.vx;this.facing=Math.sign(this.vx);}
    }
    private updateLauncher(dt:number,objects:WorldObjects,player:Rect){
        this.age+=dt;this.timer+=dt;this.flash=Math.max(0,this.flash-dt);
        if(this.dead){this.deadTimer+=dt;return;}
        // Elevated defenders must see the actual floor below their balcony. The campaign's
        // 60px same-bank detector left the tall arsenal balconies unable to attack grounded Feka.
        const gap=player.x+player.width/2-this.x-this.width/2;
        const visible=Math.abs(gap)<170&&Math.abs(player.y-this.y)<110;
        if(this.phase==='rest'&&this.timer>1500&&visible){this.facing=gap<0?-1:1;this.change('warning');}
        else if(this.phase==='warning'&&this.timer>this.warningDuration){
            const barrel=objects.spawnBarrel(this.x+(this.facing<0?-14:this.width),this.y-4,this.facing);
            barrel.vy=this.highThrow?-4.8:-2.5;if(this.highThrow)barrel.vx=this.facing*2.1;
            this.launches++;this.change('recoil');
        }else if(this.phase==='recoil'&&this.timer>400)this.change('rest');
    }
    private reloadStep(level:WorldLevel){
        // The six-pixel step is confined to the actual balcony, and finishes well before the next tell.
        const support=level.bodies.find(b=>b.kind==='support'&&Math.abs(b.y-this.y-this.height)<1&&this.x>=b.x&&this.x+this.width<=b.x+b.width);
        if(!support)return;
        const offset=Math.sin(Math.PI*this.reloadProgress)**2*GUARD_FOOTWORK.reloadStep;
        const target=this.reloadOrigin-this.reloadFacing*offset;
        this.x=Math.max(support.x+2,Math.min(support.x+support.width-this.width-2,target));
    }
    private travel(dx: number, dt: number, level: WorldLevel, allowDrop=false) {
        dx=this.separate(dx);
        const direction = Math.sign(dx), foot = this.y + this.height;
        const support = level.getTile(level.worldToCol(this.x + (direction > 0 ? this.width + 3 : -3)), level.worldToRow(foot + 3));
        const nextFoot=this.x+(direction>0?this.width+3:-3);
        const deck=level.bodies.some(b=>b.kind==='support'&&Math.abs(foot-b.y)<4&&nextFoot>=b.x&&nextFoot<=b.x+b.width);
        this.vy = Math.min(8, this.vy + .4 * dt / frame);
        const move = level.resolveCollision(this, { x: direction && !isSolidTile(support)&&!deck&&!allowDrop ? 0 : dx, y: this.vy * dt / frame }, this);
        this.x = move.position.x; this.y = move.position.y; this.vy = move.velocity.y;
    }
    override update(dt: number, level: WorldLevel, objects: WorldObjects, player: Rect) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        if(!this.awake&&!this.dead){this.age+=dt;this.motionX=0;return;}
        const before = this.phase, oldX = this.x, oldDistance=this.distance, wasHigh = this.highThrow, priorPose=this.actionPose;
        if (this.lastArmor && !this.armor) this.armorLostAt = this.age;
        this.lastArmor = this.armor;
        this.yielding=false;
        this.acquireVault(dt,level,player);
        const vault=Boolean(this.vaultTarget);
        const infantry=['minion','helmet'].includes(this.spec.kind);
        if(!this.dead&&infantry&&this.phase==='walk'){
            const gap=player.x+player.width/2-this.x-this.width/2;
            // Acquire the other side only between actions. A jump behind a committed attack stays safe.
            if(this.turnProgress===1&&Math.abs(gap)>28&&gap*this.facing<0&&Math.abs(player.y+player.height-this.y-this.height)<(this.spec.kind==='minion'?96:60)){
                this.turnAt=this.age;this.turnTarget=Math.sign(gap);
            }
        }
        const pivot=!this.dead&&infantry&&this.phase==='walk'&&this.turnProgress<1;
        const screened=!this.dead&&infantry&&this.phase==='walk'&&this.clearance(this.facing)<GUARD_FOOTWORK.attackSpace;
        const shove = this.spec.kind === 'helmet' && !this.dead && ['warning', 'attack', 'rest'].includes(this.phase);
        const lunge = !this.dead && this.longLunge && ['warning','attack','rest'].includes(this.phase);
        if(vault&&!this.dead){
            this.updateVault(dt,level,before==='walk'&&this.phase==='warning');
        }else if(pivot){
            this.idleStep(dt,level);
            if(this.turnProgress>=.5){this.facing=this.turnTarget;this.vx=this.facing*Math.abs(this.vx);}
        }else if(screened){
            // Follow the front guard without hiding a telegraph or swinging through its silhouette.
            this.yielding=true;this.idleStep(dt,level,this.vx*dt/frame);
        }else if (shove) {
            this.age += dt; this.timer += dt; this.flash = Math.max(0, this.flash - dt);
            let dx = 0;
            if (this.phase === 'warning' && this.timer >= GUARD_SHOVE.warning) this.change('attack');
            else if (this.phase === 'attack') {
                // A short committed step, with active shield contact only in the middle of its motion.
                const travel = (t: number) => 14 * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t) / GUARD_SHOVE.attack))) / 2;
                dx = this.facing * (travel(this.timer) - travel(this.timer - dt));
                if (this.timer >= GUARD_SHOVE.attack) this.change('rest');
            } else if (this.phase === 'rest' && this.timer >= GUARD_SHOVE.recovery) this.change('walk');
            this.travel(dx, dt, level);
        } else if(lunge) {
            this.age+=dt;this.timer+=dt;this.flash=Math.max(0,this.flash-dt);
            let dx=0;
            if(this.phase==='warning'&&this.timer>=GUARD_LUNGE.warning)this.change('attack');
            else if(this.phase==='attack'){
                const travel=(t:number)=>{const u=Math.max(0,Math.min(1,t/GUARD_LUNGE.attack));return GUARD_LUNGE.distance*u*u*(3-2*u);};
                dx=this.facing*(travel(this.timer)-travel(this.timer-dt));
                if(this.timer>=GUARD_LUNGE.attack)this.change('rest');
            }else if(this.phase==='rest'){
                if(this.timer<200)dx=-this.facing*Math.min(dt,this.timer)*.5/frame;
                if(this.timer>=GUARD_LUNGE.recovery){this.change('walk');this.vx=this.facing*this.patrolSpeed;this.comboStep=0;}
            }
            this.travel(dx,dt,level);
        } else {
            let coverCharge=false;
            if(!this.dead&&this.spec.kind==='loader'&&this.phase==='rest'&&this.timer>=GUARD_COVER.resupply){
                const ally=this.company().find(e=>!e.dead&&e.spec.kind==='charger'&&e.phase==='attack'&&e.timer<GUARD_COVER.chargeUntil);
                const gap=player.x+player.width/2-this.x-this.width/2;
                // The ariete drives Feka across the floor; its partner then covers the recovery
                // with a fully announced barrel. Never interrupt resupply or an existing throw.
                if(ally&&Math.abs(gap)<170&&Math.abs(player.y-this.y)<110){
                    coverCharge=true;
                }
            }
            if(this.spec.kind==='loader')this.updateLauncher(dt,objects,player);
            else if(this.spec.kind==='minion')this.updateBatedor(dt,level,player);
            else super.update(dt, level, objects, player);
            if (this.dead) return;
            if(coverCharge&&this.phase==='rest'){
                this.coveringCharge=true;this.facing=player.x+player.width/2<this.x+this.width/2?-1:1;this.comboStep=0;this.change('warning');
            }
            if (this.comboLength===2) {
                const gap=player.x+player.width/2-this.x-this.width/2;
                const sameBank=Math.abs(player.y+player.height-this.y-this.height)<2;
                // Crossing behind or jumping out of reach cancels the batedor's follow-up.
                // A second committed tell always precedes the next damaging window.
                if(this.spec.kind==='minion'&&before==='attack'&&this.phase==='rest'&&this.comboStep===0&&sameBank&&gap*this.facing>0&&Math.abs(gap)<78&&this.clearance(this.facing)>=GUARD_FOOTWORK.attackSpace){
                    this.comboStep=1;this.change('warning');
                }else if(this.spec.kind==='loader'&&before==='recoil'&&this.phase==='rest'){
                    if(this.comboStep===0&&Math.abs(gap)<170&&Math.abs(player.y-this.y)<110){
                        this.comboStep=1;this.facing=gap<0?-1:1;this.change('warning');
                    }else if(this.comboStep===1)this.timer=-400; // A longer resupply after the pair.
                }else if(this.phase==='warning'&&before!==this.phase&&['walk','rest'].includes(before))this.comboStep=0;
            }
            if (this.spec.kind === 'helmet' && this.armor && this.phase === 'walk') {
                const gap = player.x + player.width / 2 - this.x - this.width / 2;
                if (gap*this.facing>0 && Math.abs(gap) < 57 && Math.abs(gap) > 22 && Math.abs(player.y + player.height - this.y - this.height) < 2) {
                    this.facing = Math.sign(gap); this.vx = this.facing * this.patrolSpeed; this.change('warning');
                }
            }
            // The light guard withdraws after a missed thrust, opening a readable chase/punish decision.
            if (this.spec.kind === 'minion' && this.phase === 'rest' && this.timer < 200) {
                const retreat = Math.min(dt, this.timer) * .5 / frame;
                // WorldFoe already resolved vertical motion for this step.
                this.travel(-this.facing * retreat, 0, level);
            }
            if(this.spec.kind==='minion'&&before==='rest'&&this.phase==='walk'){
                // The next update performs a planted pivot instead of instantly mirroring the sprite.
                this.vx=this.facing*this.patrolSpeed;
            }
        }
        if(this.spec.kind==='loader'&&!this.dead&&this.phase==='rest'){
            if(before!=='rest'){this.startReload();this.coveringCharge=false;}
            this.reloadStep(level);
        }else if(infantry&&!this.dead&&!vault)this.x=oldX+this.separate(this.x-oldX,oldX);
        if(this.bounds&&!this.dead){
            const bounded=Math.max(this.bounds.left,Math.min(this.bounds.right-this.width,this.x));
            if(bounded!==this.x){
                this.x=bounded;
                if(this.spec.kind==='charger'&&this.phase==='attack'){this.change('rest');this.flash=100;}
                else if(this.phase==='walk'){this.facing=this.x===this.bounds.left?1:-1;this.vx=this.facing*this.patrolSpeed;}
            }
        }
        this.motionX=this.x-oldX;this.distance=oldDistance+Math.abs(this.motionX);
        // A fresh collision sets exactly 100ms. A previous stomp flash has already
        // decayed and must not turn an ordinary brake into a false impact.
        if(this.spec.kind==='charger'&&before==='attack'&&this.phase==='rest'&&this.flash===100)this.impactAt=this.age;
        if (this.spec.kind === 'loader' && before === 'warning' && this.phase === 'recoil') {
            this.lastRelease = this.age; this.releaseHigh = wasHigh;
        }
        if(before!==this.phase){this.transitionFrom=priorPose;this.transitionAt=this.age;}
    }
    override contact(player:Rect,previous:Rect,falling:boolean,pound:boolean){
        if(!this.awake&&!this.dead)return 'none';
        const phase=this.phase,pose=this.actionPose;
        const top=!this.dead&&falling&&overlaps(player,this)&&previous.y+previous.height<=this.y+9;
        if(top&&this.armor&&(this.spec.kind==='helmet'||this.spec.kind==='charger')){
            if(pound){
                this.armor=false;this.hp=1;this.armorLostAt=this.age;this.flash=250;this.change('stunned');
                this.transitionFrom=pose;this.transitionAt=this.age;return 'bounce';
            }
            if(this.blocksStomp){this.flash=100;return 'bounce';}
        }
        const result=super.contact(player,previous,falling,pound);
        if(this.phase!==phase){this.transitionFrom=pose;this.transitionAt=this.age;}
        return result;
    }
    override get danger(): Rect | null {
        if (this.dead||!this.awake) return null;
        if(this.vaultTarget)return null; // The moving body is the whole airborne threat.
        if(this.longLunge&&this.phase==='attack'){
            if(this.timer<GUARD_LUNGE.activeFrom||this.timer>=GUARD_LUNGE.activeUntil)return null;
            return {x:this.facing<0?this.x-GUARD_LUNGE.reach:this.x+this.width-2,y:this.y+8,width:GUARD_LUNGE.reach+2,height:10};
        }
        if (this.spec.kind === 'helmet' && this.armor && this.phase === 'attack' && this.timer >= 65 && this.timer < 225)
            return { x: this.facing < 0 ? this.x - GUARD_SHOVE.reach : this.x + this.width - 1, y: this.y + 9, width: GUARD_SHOVE.reach + 1, height: 9 };
        return super.danger;
    }
}
