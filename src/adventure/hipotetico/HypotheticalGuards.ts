import { WorldFoe } from '../WorldEnemies';
import type { FoePhase } from '../WorldEnemies';
import type { FoeSpec } from '../types';
import type { Rect } from '../../types';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import { isSolidTile } from '../../world/tileRules';
import { guardActionPose, blendGuardAction, type GuardActionPose } from './HypotheticalGuardMotion';

const frame = 1000 / 60;
export const GUARD_SHOVE = { warning: 650, attack: 300, recovery: 950, reach: 9 } as const;
// A complete Feka body fits between allies, including a little room after a successful stomp bounce.
export const GUARD_FOOTWORK = { gap: 18, attackSpace: 32, pivot: 180, reload: 1000, reloadStep: 6 } as const;

/** Encounter-local variations. Contacts, armor, stomps and terrain still belong to WorldFoe. */
export class HypotheticalGuard extends WorldFoe {
    lastRelease = -Infinity;
    releaseHigh = false;
    armorLostAt = -Infinity;
    comboStep = 0;
    transitionAt = -Infinity;
    transitionFrom: GuardActionPose | null = null;
    yielding = false;
    turnAt = -Infinity;
    private turnTarget = 1;
    reloadAt = -Infinity;
    private reloadOrigin = 0;
    private reloadFacing = 1;
    private lastArmor = true;

    constructor(spec: FoeSpec, readonly wave = 1, private readonly company: () => readonly WorldFoe[] = () => []) {
        super(spec);
        // Both entrances face into the courtyard; the left entrance used to patrol away from Feka.
        this.facing = spec.x < 160 ? 1 : -1;
        this.vx = this.facing * .55;
        if(spec.kind==='loader')this.startReload();
    }
    override get warningDuration() { return this.spec.kind === 'helmet' ? GUARD_SHOVE.warning : super.warningDuration; }
    get comboLength() { return this.wave === 3 && ['minion','loader'].includes(this.spec.kind) ? 2 : 1; }
    get turnProgress() { return Math.max(0, Math.min(1, (this.age-this.turnAt)/GUARD_FOOTWORK.pivot)); }
    get reloadProgress() { return Math.max(0, Math.min(1, (this.age-this.reloadAt)/GUARD_FOOTWORK.reload)); }
    get actionPose(): GuardActionPose {
        const target=guardActionPose(this);
        if(this.phase==='walk') {
            target.turn=Math.sin(Math.PI*this.turnProgress);
            if(this.yielding)target.brace=.25;
        }
        if(this.spec.kind==='loader'&&this.phase==='rest'){
            const t=this.reloadProgress,smooth=(v:number)=>{const u=Math.max(0,Math.min(1,v));return u*u*(3-2*u);};
            target.supply=t<.42?smooth(t/.3):1-smooth((t-.42)/.38);
            target.crouch+=target.supply*1.2;
        }
        return this.transitionFrom?blendGuardAction(this.transitionFrom,target,(this.age-this.transitionAt)/(this.phase==='attack'?50:120)):target;
    }
    private change(phase: FoePhase) { this.phase = phase; this.timer = 0; }
    /** Live neighbors are read in simulation order, so two approaching bodies cannot use stale gaps. */
    private clearance(direction:number,from=this.x) {
        let space=Infinity;
        for(const ally of this.company()){
            if(ally===this||ally.dead||Math.abs(ally.y+ally.height-this.y-this.height)>4)continue;
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
    private reloadStep(level:WorldLevel){
        // The six-pixel step is confined to the actual balcony, and finishes well before the next tell.
        const support=level.bodies.find(b=>b.kind==='support'&&Math.abs(b.y-this.y-this.height)<1&&this.x>=b.x&&this.x+this.width<=b.x+b.width);
        if(!support)return;
        const offset=Math.sin(Math.PI*this.reloadProgress)**2*GUARD_FOOTWORK.reloadStep;
        const target=this.reloadOrigin-this.reloadFacing*offset;
        this.x=Math.max(support.x+2,Math.min(support.x+support.width-this.width-2,target));
    }
    private travel(dx: number, dt: number, level: WorldLevel) {
        dx=this.separate(dx);
        const direction = Math.sign(dx), foot = this.y + this.height;
        const support = level.getTile(level.worldToCol(this.x + (direction > 0 ? this.width + 3 : -3)), level.worldToRow(foot + 3));
        this.vy = Math.min(8, this.vy + .4 * dt / frame);
        const move = level.resolveCollision(this, { x: direction && !isSolidTile(support) ? 0 : dx, y: this.vy * dt / frame }, this);
        this.x = move.position.x; this.y = move.position.y; this.vy = move.velocity.y;
    }
    override update(dt: number, level: WorldLevel, objects: WorldObjects, player: Rect) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        const before = this.phase, oldX = this.x, oldDistance=this.distance, wasHigh = this.highThrow, priorPose=this.actionPose;
        if (this.lastArmor && !this.armor) this.armorLostAt = this.age;
        this.lastArmor = this.armor;
        this.yielding=false;
        const infantry=['minion','helmet'].includes(this.spec.kind);
        if(!this.dead&&infantry&&this.phase==='walk'){
            const gap=player.x+player.width/2-this.x-this.width/2;
            // Acquire the other side only between actions. A jump behind a committed attack stays safe.
            if(this.turnProgress===1&&Math.abs(gap)>28&&gap*this.facing<0&&Math.abs(player.y+player.height-this.y-this.height)<60){
                this.turnAt=this.age;this.turnTarget=Math.sign(gap);
            }
        }
        const pivot=!this.dead&&infantry&&this.phase==='walk'&&this.turnProgress<1;
        const screened=!this.dead&&infantry&&this.phase==='walk'&&this.clearance(this.facing)<GUARD_FOOTWORK.attackSpace;
        const shove = this.spec.kind === 'helmet' && !this.dead && ['warning', 'attack', 'rest'].includes(this.phase);
        if(pivot){
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
        } else {
            super.update(dt, level, objects, player);
            if (this.dead) return;
            if (this.comboLength===2) {
                const gap=player.x+player.width/2-this.x-this.width/2;
                const sameBank=Math.abs(player.y+player.height-this.y-this.height)<2;
                // Crossing behind or jumping out of reach cancels the batedor's follow-up.
                // A second committed tell always precedes the next damaging window.
                if(this.spec.kind==='minion'&&before==='attack'&&this.phase==='rest'&&this.comboStep===0&&sameBank&&gap*this.facing>0&&Math.abs(gap)<78&&this.clearance(this.facing)>=GUARD_FOOTWORK.attackSpace){
                    this.comboStep=1;this.change('warning');
                }else if(this.spec.kind==='loader'&&before==='recoil'&&this.phase==='rest'){
                    if(this.comboStep===0&&Math.abs(gap)<170&&Math.abs(player.y-this.y)<60){
                        this.comboStep=1;this.facing=gap<0?-1:1;this.change('warning');
                    }else if(this.comboStep===1)this.timer=-400; // A longer resupply after the pair.
                }else if(this.phase==='warning'&&before!==this.phase&&['walk','rest'].includes(before))this.comboStep=0;
            }
            if (this.spec.kind === 'helmet' && this.armor && this.phase === 'walk') {
                const gap = player.x + player.width / 2 - this.x - this.width / 2;
                if (gap*this.facing>0 && Math.abs(gap) < 57 && Math.abs(gap) > 22 && Math.abs(player.y + player.height - this.y - this.height) < 2) {
                    this.facing = Math.sign(gap); this.vx = this.facing * .55; this.change('warning');
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
                this.vx=this.facing*.55;
            }
        }
        if(this.spec.kind==='loader'&&!this.dead&&this.phase==='rest'){
            if(before!=='rest')this.startReload();
            this.reloadStep(level);
        }else if(infantry&&!this.dead)this.x=oldX+this.separate(this.x-oldX,oldX);
        this.motionX=this.x-oldX;this.distance=oldDistance+Math.abs(this.motionX);
        if (this.spec.kind === 'loader' && before === 'warning' && this.phase === 'recoil') {
            this.lastRelease = this.age; this.releaseHigh = wasHigh;
        }
        if(before!==this.phase){this.transitionFrom=priorPose;this.transitionAt=this.age;}
    }
    override contact(player:Rect,previous:Rect,falling:boolean,pound:boolean){
        const phase=this.phase,pose=this.actionPose;
        const result=super.contact(player,previous,falling,pound);
        if(this.phase!==phase){this.transitionFrom=pose;this.transitionAt=this.age;}
        return result;
    }
    override get danger(): Rect | null {
        if (this.dead) return null;
        if (this.spec.kind === 'helmet' && this.armor && this.phase === 'attack' && this.timer >= 65 && this.timer < 225)
            return { x: this.facing < 0 ? this.x - GUARD_SHOVE.reach : this.x + this.width - 1, y: this.y + 9, width: GUARD_SHOVE.reach + 1, height: 9 };
        return super.danger;
    }
}
