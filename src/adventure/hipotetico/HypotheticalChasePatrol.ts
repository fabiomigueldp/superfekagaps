import {WorldFoe} from '../WorldEnemies';
import type {WorldLevel,WorldObjects} from '../WorldPhysics';
import type {Rect} from '../../types';
import {overlaps} from '../types';
import {CHASE_PATROLS} from './HypotheticalLayout';

export type ChasePatrolSpec=(typeof CHASE_PATROLS)[number];
export interface ChaseCart extends Rect {
    vx:number;vy:number;distance:number;released:boolean;broken:boolean;age:number;impactAge:number;
}
const frame=1000/60;

/** Pursuit opponents commit once, then recover or retreat. They never require
 * clearing a wave, stop the camera, or spawn into the runner's landing. */
export class HypotheticalChasePatrol extends WorldFoe {
    engaged=false;released=false;actionAt=-1;landedAt=-1;
    cart:ChaseCart|null=null;
    private cartContact=false;
    cues:Array<'chase-metal'|'chase-cable'|'collapse-water'>=[];
    constructor(readonly patrol:ChasePatrolSpec,private pursuer:()=>number){
        super({id:patrol.id,kind:patrol.role==='loader'?'loader':'minion',x:patrol.x,y:patrol.y});
        this.height=28;this.y=patrol.y-this.height;
        this.facing=-1;this.vx=0;this.armor=false;this.phase='rest';
        if(patrol.role==='loader')this.cart={x:patrol.x-72,y:206,width:28,height:18,
            vx:0,vy:0,distance:0,released:false,broken:false,age:0,impactAge:0};
    }
    override get warningDuration(){return this.patrol.role==='loader'?720:560;}
    override get blocksStomp(){return false;}
    override get danger(){return null;}
    private change(phase:WorldFoe['phase']){this.phase=phase;this.timer=0;}
    override update(dt:number,level:WorldLevel,_objects:WorldObjects,player:Rect){
        if(!Number.isFinite(dt)||dt<=0)return;
        this.cues=[];const oldX=this.x;
        for(let left=Math.min(dt,100);left>0;left-=frame)this.stepPatrol(Math.min(frame,left),level,player);
        this.motionX=this.x-oldX;this.distance+=Math.abs(this.motionX);
    }
    private stepPatrol(dt:number,level:WorldLevel,player:Rect){
        const step=dt/frame;this.age+=dt;this.flash=Math.max(0,this.flash-dt);this.timer+=dt;
        this.advanceCart(dt,level);
        if(this.dead){this.deadTimer+=dt;return;}
        if(this.x+this.width<this.pursuer()+36||this.y>264){
            this.dead=true;this.deadTimer=500;return;
        }
        if(!this.engaged&&player.x>=this.patrol.trigger&&player.x<this.x+64){
            this.engaged=true;this.change('warning');
        }
        if(!this.engaged)return;
        if(this.phase==='warning'){
            if(this.timer>=this.warningDuration){
                this.actionAt=this.age;this.change('attack');
                if(this.cart){
                    this.cart.released=true;this.cart.vx=-2.7;this.released=true;this.cues.push('chase-cable');
                }else{
                    this.vx=-2.35;
                    // The second scout adds a short committed hop to the learned dash.
                    this.vy=this.patrol.x>6000?-4.6:0;
                }
            }
        }else if(this.phase==='attack'){
            if(this.cart){this.vx=1.1;if(this.timer>=260)this.change('recoil');}
            else if(this.timer>=380){this.vx=0;this.change('recoil');}
        }else if(this.phase==='recoil'||this.phase==='stunned'){
            this.vx=0;
            if(this.timer>=300){this.facing=1;this.vx=1.7;this.change('walk');}
        }
        const previous={x:this.x,y:this.y,width:this.width,height:this.height};
        this.vy=Math.min(7,this.vy+.5*step);
        const hit=level.resolveCollision(previous,{x:this.vx*step,y:this.vy*step},previous);
        this.x=hit.position.x;this.y=hit.position.y;
        if(hit.grounded&&this.vy>1)this.landedAt=this.age;
        this.vy=hit.velocity.y/step;
        if(hit.velocity.x===0&&this.vx!==0){this.vx=0;if(this.phase==='attack')this.change('recoil');}
    }
    private advanceCart(dt:number,level:WorldLevel){
        const cart=this.cart;if(!cart||!cart.released)return;
        cart.age+=dt;
        if(cart.broken){cart.impactAge+=dt;return;}
        const step=dt/frame,old=cart.x;
        cart.vy=Math.min(8,cart.vy+.5*step);
        const hit=level.resolveCollision(cart,{x:cart.vx*step,y:cart.vy*step},cart);
        cart.x=hit.position.x;cart.y=hit.position.y;cart.distance+=Math.abs(cart.x-old);
        cart.vy=hit.velocity.y/step;
        if(cart.y>=238||hit.velocity.x===0||cart.x+cart.width<this.pursuer()+24||cart.age>1800){
            cart.broken=true;cart.impactAge=0;
            this.cues.push(cart.y>=238?'collapse-water':'chase-metal');
        }
    }
    override get contactPoint(){
        return this.cartContact&&this.cart?{x:this.cart.x+this.cart.width/2,y:this.cart.y}:super.contactPoint;
    }
    override contact(player:Rect,previous:Rect,falling:boolean,pound:boolean):'none'|'hurt'|'bounce'|'kill' {
        this.cartContact=false;
        const cart=this.cart;
        if(cart?.released&&!cart.broken&&overlaps(player,cart)){
            this.cartContact=true;
            if(falling&&previous.y+previous.height<=cart.y+6){
                cart.broken=true;cart.impactAge=0;this.cues.push('chase-metal');
                if(!this.dead)this.change('stunned');
                return 'bounce';
            }
            return 'hurt';
        }
        return super.contact(player,previous,falling,pound);
    }
}
