import { DELICIA_STAGES, type Box, type DeliciaStage, type Floor, type FoeType, type StagePickup } from './DeliciaContent';
import { DeliciaBoss, intersects, type BossMissile } from './DeliciaBoss';
import { Player } from '../../entities/Player';
import { GroundPoundState } from '../../types';
import { TILE_SIZE, TileType } from '../../constants';
import { DeliciaCollision } from './DeliciaCollision';
import { DELICIA_UNIT, DELICIA_PLAYER_WIDTH, DELICIA_PLAYER_HEIGHT, DELICIA_CAMERA_TOP } from './DeliciaNative';
import { advanceCampaignCamera } from '../WorldCampaignCamera';
export interface DeliciaInput { left:boolean;right:boolean;jump:boolean;jumpPressed:boolean;jumpReleased:boolean;run?:boolean;dash:boolean;pound:boolean;seed:boolean;parry:boolean;interact:boolean }
export const noDeliciaInput = (): DeliciaInput => ({left:false,right:false,jump:false,jumpPressed:false,jumpReleased:false,dash:false,pound:false,seed:false,parry:false,interact:false});
export interface DeliciaPlayer extends Box { vx:number;vy:number;grounded:boolean;facing:number;health:number;invincible:number;coyote:number;buffer:number;dashTime:number;dashCooldown:number;seedCooldown:number;parryTime:number;parryCooldown:number;pounding:boolean;walk:number;land:number }
export interface DeliciaEnemy extends Box { kind:FoeType;home:number;patrol:number;vx:number;hp:number;timer:number;state:'walk'|'tell'|'attack'|'stun'|'dead';phase:number;flash?:number;shotAt?:number }
export interface DeliciaParticle {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number}
export interface SimulationEvent {kind:'jump'|'dash'|'seed'|'parry'|'guard'|'hurt'|'gap'|'pound'|'collect'|'valve'|'checkpoint'|'clear'|'enemy'|'boss-hit'|'tell'|'phase'|'defeat'|'jet'|'echo'|'zone';x:number;y:number;pickup?:StagePickup;attack?:string;valve?:string;text?:string}
export const steamPhase=(time:number,period=4,phase=0):'safe'|'tell'|'active' => {
    const t=((time+phase)%period+period)%period/period;return t<.58?'safe':t<.78?'tell':'active';
};
export function movingFloor(floor:Floor,time:number):Box {
    const travel=(Math.sin(time*(floor.speed??1.6)+(floor.phase??0))*.5+.5)*(floor.travel??60);
    return {...floor,x:floor.x+(floor.kind==='moving'?travel:0),y:floor.y-(floor.kind==='lift'?travel:0)};
}
export class DeliciaSimulation {
    readonly nativePlayer = new Player(0, 0);
    readonly player:DeliciaPlayer;readonly boss:DeliciaBoss|null;enemies:DeliciaEnemy[];projectiles:BossMissile[]=[];particles:DeliciaParticle[]=[];
    time=0;elapsed=0;coins=0;checkpoint=-1;finished=false;dead=false;cameraX=0;cameraY=0;
    readonly recordEligible:boolean;
    events:SimulationEvent[]=[];valves=new Set<string>();collected=new Set<string>();crumble=new Map<number,number>();
    damageTaken=0;parries=0;enemiesDefeated=0;readonly heard=new Set<string>();zoneIndex=-1;
    private jetCooldown=0;private machineStates=new Map<string,string>();
    private support=-1;private safeX=90;private safeY=396;private lastValveTimes=new Map<string,number>();
    constructor(readonly stage:DeliciaStage=DELICIA_STAGES[0],readonly assists=false,checkpoint=-1){
        this.recordEligible=!assists&&checkpoint<0;
        this.player={...stage.spawn,w:DELICIA_PLAYER_WIDTH,h:DELICIA_PLAYER_HEIGHT,vx:0,vy:0,grounded:false,facing:1,health:assists?6:4,invincible:0,coyote:0,buffer:0,dashTime:0,dashCooldown:0,seedCooldown:0,parryTime:0,parryCooldown:0,pounding:false,walk:0,land:0};
        this.safeX=stage.spawn.x;this.safeY=stage.spawn.y;
        this.boss=stage.boss?new DeliciaBoss(stage.boss,assists,impact=>{
            this.emit('boss-hit',impact.x,impact.y);
            this.burst(impact.x+(impact.stomp?48:0),impact.y,impact.stomp?'#ffe7a9':'#ffdc87',impact.stomp?26:20);
        }):null;
        this.enemies=stage.enemies.map((e,i)=>{const h=e.kind==='wasp'?42:60;return {...e,y:e.y+44-h,w:e.kind==='roller'?60:54,h,home:e.x,vx:i%2?-55:55,hp:e.kind==='sentinel'?3:e.kind==='mimic'?2:1,timer:0,state:'walk',phase:i*.73};});

        if(checkpoint>=0&&checkpoint<stage.checkpoints.length){this.checkpoint=checkpoint;this.safeX=stage.checkpoints[checkpoint].x;this.safeY=stage.checkpoints[checkpoint].y;this.player.x=this.safeX;this.player.y=this.safeY;}
        // Resume at the normal resting frame before the first paint. Starting at
        // the stage origin hides distant checkpoints while the live game runs.
        this.cameraX=Math.max(0,Math.min(Math.max(0,stage.width-960),this.player.x-350));
        this.cameraY=this.boss?0:Math.max(0,Math.min(Math.max(0,stage.height-540),this.player.y-390));
    }
    startBoss():void{this.boss?.start();}
    get gateOpen():boolean{return this.boss?this.boss.hp<=0:this.stage.valves.every(v=>this.valves.has(v.id));}
    get nearbyValve(){return this.stage.valves.find(v=>Math.hypot(v.x-this.player.x,v.y-(this.player.y+this.player.h))<85);}
    floorAvailable(floor:Floor):boolean{return !floor.requiresValve||this.valves.has(floor.requiresValve);}
    valveReady(id:string):boolean{return !this.boss? !this.valves.has(id):this.time-(this.lastValveTimes.get(id)??-10)>=4;}
    get zone(){return this.stage.zones?.[Math.max(0,this.zoneIndex)];}
    private emit(kind:SimulationEvent['kind'],x=this.player.x,y=this.player.y,extra:Partial<SimulationEvent>={}):void{this.events.push({kind,x,y,...extra});}
    burst(x:number,y:number,color:string,count=12):void {
        for(let i=0;i<count;i++){const angle=(i*2.399+this.time),speed=45+((i*67)%160);this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-50,life:.45+(i%5)*.06,max:.75,color,size:2+(i%3)});}
        if(this.particles.length>240)this.particles.splice(0,this.particles.length-240);
    }
    update(dt:number,input:DeliciaInput):void {
        this.events=[];dt=Math.min(.03,Math.max(0,dt));if(this.dead||this.finished)return;
        this.time+=dt;this.elapsed+=dt;const p=this.player,previous={...p};
        for(const key of ['seedCooldown','parryTime','parryCooldown'] as const)p[key]=Math.max(0,p[key]-dt);
        if(input.parry&&p.parryCooldown===0){p.parryTime=this.assists?.32:.21;p.parryCooldown=.55;this.emit('guard');}
        if(input.seed&&p.seedCooldown===0){p.seedCooldown=.42;this.projectiles.push({x:p.x+p.w*.5,y:p.y+p.h*.45,w:12,h:10,vx:p.facing*640,vy:-35,gravity:85,kind:'seed',life:1.4,friendly:true});this.emit('seed');}
        if(input.interact)this.useValve();
        if(this.support>=0&&p.grounded){const f=this.stage.floors[this.support];if(f.kind==='moving'||f.kind==='lift'){const now=movingFloor(f,this.time),before=movingFloor(f,this.time-dt);p.x+=now.x-before.x;p.y+=now.y-before.y;}if(f.kind==='belt')p.x+=(f.beltSpeed??85)*dt;}
        const impact=this.movePlayer(dt,input);
        if(impact){this.emit('pound',p.x+p.w/2,p.y+p.h);this.burst(p.x,p.y+p.h,'#f1c879',18);
            for(const e of this.enemies)if(e.state!=='dead'&&Math.abs(e.x-p.x)<125&&Math.abs(e.y-p.y)<90){e.state='stun';e.timer=1.5;}}
        if(p.grounded&&!previous.grounded){p.land=.13;this.burst(p.x+p.w/2,p.y+p.h,'#e5bf85',5);}
        p.walk+=Math.abs(p.vx)*dt*.07;
        // Contacts resolve in order. Keep consequences already earned, but a
        // lethal contact ends this step before later combat or progression.
        this.updateEnemies(dt,previous);if(this.dead)return;
        this.boss?.update(dt,p);this.updateProjectiles(dt);if(this.dead)return;
        if(this.boss){
            for(const m of this.boss.missiles){this.missileContact(m);if(this.dead)return;}
            for(const danger of this.boss.danger)if(intersects(p,danger)){this.hurt(danger.x+danger.w/2);if(this.dead)return;}
            if(p.y+p.h>447&&this.boss.gaps.some(g=>p.x+p.w>g.x+7&&p.x<g.x+g.w-7))this.fallIntoGap();
            if(this.dead)return;
            if(intersects(p,this.boss.rect)&&this.boss.beat!=='defeated'){
                if(previous.y+previous.h<=this.boss.y+30&&p.vy>0){this.boss.hit(p.pounding?2:1,{x:this.boss.x,y:this.boss.y,stomp:true});this.bounce(this.boss.y);}

                // The crouched charge uses its telegraphed lower hitbox. Applying
                // the upright body here would make the advertised jump impossible.
                else if(this.boss.beat==='attack'&&this.boss.attack!=='charge'||this.boss.beat==='idle'&&this.boss.beatTime>.22)this.hurt(this.boss.x+this.boss.w/2);
            }
            if(this.dead)return;
            for(const event of this.boss.events){if(event.kind==='tell')this.emit('tell',event.x,event.y,{attack:event.attack});if(event.kind==='impact'){this.emit('pound',event.x,event.y);this.burst(event.x,450,'#ffc270',20);}if(event.kind==='phase')this.emit('phase',event.x,event.y);if(event.kind==='defeat')this.emit('defeat',event.x,event.y);}
        }
        for(const h of this.stage.hazards){if((h.kind==='thorns'||h.kind==='steam'&&steamPhase(this.time,h.period,h.phase)==='active')&&intersects(p,h))this.hurt(h.x);if(this.dead)return;if(h.kind==='juice'&&intersects(p,h))this.fallIntoGap();if(this.dead)return;}
        this.updateMachines(dt);if(this.dead)return;
        if(p.y>this.stage.height-60)this.fallIntoGap();
        if(this.dead)return;
        for(const pickup of this.stage.pickups)if(!this.collected.has(pickup.id)&&Math.hypot(p.x+p.w*.5-pickup.x,p.y+p.h*.5-pickup.y)<35){
            this.collected.add(pickup.id);if(pickup.kind==='orange')this.coins++;if(pickup.kind==='heart')p.health=Math.min(this.assists?6:4,p.health+1);
            this.emit('collect',pickup.x,pickup.y,{pickup});this.burst(pickup.x,pickup.y,pickup.kind==='memory'?'#a5e6d2':'#ffc552',12);
        }
        this.stage.checkpoints.forEach((cp,index)=>{if(index>this.checkpoint&&Math.abs(p.x-cp.x)<55&&Math.abs(p.y-cp.y)<60){this.checkpoint=index;this.safeX=cp.x;this.safeY=cp.y;this.emit('checkpoint',cp.x,cp.y);}});
        for(const echo of this.stage.echoes??[])if(!this.heard.has(echo.id)&&Math.abs(p.x-echo.x)<65&&(!echo.after||this.valves.has(echo.after))){this.heard.add(echo.id);this.emit('echo',echo.x,echo.y,{text:`${echo.speaker}: ${echo.text}`});}
        const zone=this.stage.zones?.reduce((found,z,index)=>p.x>=z.x?index:found,-1)??-1;if(zone>this.zoneIndex){this.zoneIndex=zone;this.emit('zone',p.x,p.y,{text:this.zone?.name});}
        if(this.gateOpen&&intersects(p,this.stage.gate)){this.finished=true;this.emit('clear',this.stage.gate.x,this.stage.gate.y);}
        for(const part of this.particles){part.life-=dt;part.x+=part.vx*dt;part.y+=part.vy*dt;part.vy+=300*dt;}this.particles=this.particles.filter(part=>part.life>0);
        const u=DELICIA_UNIT,top=DELICIA_CAMERA_TOP/u;
        const camera={x:this.cameraX/u,y:this.cameraY/u-top};
        advanceCampaignCamera(camera,{position:{x:p.x/u,y:p.y/u-top},velocity:{x:p.vx/(u*60),y:p.vy/(u*60)},isGrounded:p.grounded},
            {width:this.stage.width/(u*16),height:(this.stage.height/u-top)/16});
        const blend=Math.min(1,dt*60);
        this.cameraX+=(camera.x*u-this.cameraX)*blend;this.cameraY+=((camera.y+top)*u-this.cameraY)*blend;
        if(this.boss&&this.boss.hp>0){
            const focus=Math.max(0,Math.min(this.stage.width-960,(p.x+this.boss.x)*.5-480));
            // Arena framing includes the tell but never abandons the player.
            this.cameraX+=(focus-this.cameraX)*(1-Math.exp(-dt*3));
            this.cameraX=Math.max(0,Math.min(this.stage.width-960,Math.max(p.x+p.w-900,Math.min(p.x-45,this.cameraX))));
            // The native boss sprite and shield extend beyond its collision box.
            // Keep both actors whole whenever their span fits in World's viewport.
            const center=this.boss.x+this.boss.w/2,left=Math.min(p.x,center-96),right=Math.max(p.x+p.w,center+96);
            if(right-left<=960){
                const padding=Math.min(24,(960-(right-left))/2),min=Math.max(0,right+padding-960),max=Math.min(this.stage.width-960,left-padding);
                if(min<=max)this.cameraX=Math.max(min,Math.min(max,this.cameraX));
            }
        }
    }
    private movePlayer(dt:number,input:DeliciaInput):boolean {
        if(dt<=0)return false;
        const p=this.player,n=this.nativePlayer.data,u=DELICIA_UNIT,speed=u*60;
        n.position={x:p.x/u,y:p.y/u};n.velocity={x:p.vx/speed,y:p.vy/speed};
        n.isGrounded=p.grounded;n.facingRight=p.facing>0;n.coyoteTimer=p.coyote*1000;n.jumpBufferTimer=p.buffer*1000;
        n.invincibleTimer=p.invincible*1000;n.landingTimer=p.land*1000;
        // Stomps, springs, jets and damage can end an attack between engine steps.
        if(!p.pounding&&n.groundPoundState===GroundPoundState.FALL)n.groundPoundState=GroundPoundState.NONE;
        if(!p.grounded&&p.vy<0&&n.velocity.y<0&&n.groundPoundState===GroundPoundState.RECOVERY)n.groundPoundState=GroundPoundState.NONE;
        const surfaces=this.stage.floors.flatMap((f,index)=>{
            if(!this.floorAvailable(f)||(this.crumble.get(index)??0)>1)return [];
            if(this.boss&&f.y===450&&this.boss.gaps.some(g=>p.x+p.w>g.x+7&&p.x<g.x+g.w-7))return [];
            const b=movingFloor(f,this.time),old=movingFloor(f,this.time-dt);
            return [{index,x:b.x/u,y:b.y/u,width:b.w/u,height:b.h/u,previousY:old.y/u,solid:f.h>50,spring:f.kind==='spring'}];
        });
        const world=new DeliciaCollision(this.stage.width/u,surfaces);
        const result=this.nativePlayer.update(dt*1000,{left:input.left,right:input.right,jump:input.jump,
            jumpPressed:input.jumpPressed,jumpReleased:input.jumpReleased,run:input.run??input.dash,
            down:input.pound,downPressed:input.pound,start:false,pause:false,mute:false},world,dt*60);
        p.x=n.position.x*u;p.y=n.position.y*u;p.vx=n.velocity.x*speed;p.vy=n.velocity.y*speed;
        p.grounded=n.isGrounded;p.facing=n.facingRight?1:-1;p.coyote=n.coyoteTimer/1000;p.buffer=n.jumpBufferTimer/1000;
        p.invincible=n.invincibleTimer/1000;p.land=(n.landingTimer??0)/1000;p.pounding=n.groundPoundState===GroundPoundState.FALL;
        this.support=world.support;
        if(result.jumpStarted||result.tileHit?.type===TileType.SPRING)this.emit('jump');
        if(this.support>=0&&this.stage.floors[this.support].kind==='crumble')this.crumble.set(this.support,(this.crumble.get(this.support)??0)+dt);
        for(const [index,timer] of this.crumble){if(timer>4.5)this.crumble.delete(index);else if(index!==this.support)this.crumble.set(index,timer+dt);}
        return !!result.groundPoundImpact;
    }
    private updateMachines(dt:number):void {
        this.jetCooldown=Math.max(0,this.jetCooldown-dt);const p=this.player;
        for(const machine of this.stage.machines??[]){
            const disabled=!!machine.disabledBy&&this.valves.has(machine.disabledBy);
            const phase=disabled?'safe':steamPhase(this.time,machine.period,machine.phase);
            if(this.machineStates.get(machine.id)!==phase&&phase==='tell'&&machine.kind==='press'&&Math.abs(machine.x-p.x)<600)this.emit('tell',machine.x,machine.y,{attack:'machine'});
            this.machineStates.set(machine.id,phase);
            if(disabled||!intersects(p,machine))continue;
            if(machine.kind==='press'&&phase==='active')this.hurt(machine.x+machine.w/2);
            if(this.dead)return;
            if(machine.kind==='jet'&&phase==='active'&&this.jetCooldown===0){p.vy=-(machine.power??800);p.grounded=false;p.pounding=false;this.jetCooldown=.55;this.emit('jet',machine.x,machine.y);this.burst(p.x,p.y+45,'#ffdc85',20);}
            if(machine.kind==='wind'){p.vx+=(machine.power??0)*dt;if(!p.pounding&&p.vy> -180)p.vy=Math.max(-180,p.vy-2300*dt);}
        }
    }
    private useValve():void {
        const valve=this.nearbyValve;if(!valve)return;
        if(this.boss){if(this.time-(this.lastValveTimes.get(valve.id)??-10)<4)return;this.lastValveTimes.set(valve.id,this.time);if(this.boss.openValve()){this.emit('valve',valve.x,valve.y,{valve:valve.id});this.burst(valve.x,valve.y-28,'#95e0ba',24);}return;}
        if(this.valves.has(valve.id))return;if(valve.order&&valve.order>this.valves.size+1){this.emit('tell',valve.x,valve.y,{attack:'order'});return;}
        this.valves.add(valve.id);this.emit('valve',valve.x,valve.y,{valve:valve.id});this.burst(valve.x,valve.y-28,'#95e0ba',24);
    }
    private updateEnemies(dt:number,previous:DeliciaPlayer):void {
        const p=this.player;
        for(const e of this.enemies){
            if(e.state==='dead'||Math.abs(e.x-p.x)>1250)continue;e.timer-=dt;e.flash=Math.max(0,(e.flash??0)-dt);
            if(e.state==='stun'){if(e.timer<=0){
                e.state='walk';
                // A completed or parried charge must not leave its attack speed in patrol.
                if(e.kind==='roller')e.vx=(e.vx<0?-1:1)*55;
            }}
            else if(e.kind==='wasp'){e.x=e.home+Math.sin(this.time*1.6+e.phase)*e.patrol*.5;e.y=this.stage.enemies[this.enemies.indexOf(e)].y-60+Math.sin(this.time*2.8+e.phase)*36;}
            else if(e.kind==='bottler'||e.kind==='bloom'){
                e.vx=Math.sign(p.x-e.x)||-1;
                if(e.timer<=0&&Math.abs(e.x-p.x)<650){if(e.state==='tell'){
                    e.shotAt=this.time;
                    const count=e.kind==='bloom'?3:1;for(let i=0;i<count;i++)this.projectiles.push({x:e.x,y:e.y+10,w:16,h:16,vx:Math.sign(p.x-e.x)*(185+i*38),vy:-180-i*45,gravity:350,kind:e.kind==='bloom'?'seed':'juice',life:4,friendly:false});e.state='walk';e.timer=e.kind==='bloom'?3.6:2.8;
                }else{e.state='tell';e.timer=e.kind==='bloom'?1.15:.8;this.emit('tell',e.x,e.y);}}
            }else{
                if(e.kind==='mimic'&&Math.abs(e.x-p.x)>160)continue;
                if(e.kind==='roller'&&e.state==='walk'&&Math.abs(e.x-p.x)<250){e.state='tell';e.timer=.65;this.emit('tell',e.x,e.y);}
                else if(e.kind==='roller'&&e.state==='tell'&&e.timer<=0){e.state='attack';e.timer=.8;e.vx=Math.sign(p.x-e.x)*260;}
                else if(e.state==='attack'&&e.timer<=0){e.state='stun';e.timer=1.1;}
                if(e.state==='walk'||e.state==='attack'){e.x+=e.vx*dt;if(Math.abs(e.x-e.home)>e.patrol*.5){e.vx*=-1;e.x=Math.max(e.home-e.patrol*.5,Math.min(e.home+e.patrol*.5,e.x));}}
            }
            if(!intersects(p,e))continue;
            if(p.parryTime>0&&e.state==='attack'){e.state='stun';e.timer=1.8;this.parries++;this.emit('parry',e.x,e.y);continue;}
            if(previous.y+previous.h<=e.y+20&&p.vy>0){if(e.kind==='sentinel'&&!p.pounding&&e.state!=='stun'){e.state='stun';e.timer=1.6;}else this.hitEnemy(e,p.pounding?2:1);this.bounce(e.y);}
            else if(e.state!=='stun')this.hurt(e.x);
            if(this.dead)return;
        }
    }
    private bounce(surfaceY:number):void {
        const p=this.player,n=this.nativePlayer.data,u=DELICIA_UNIT;
        n.invincibleTimer=p.invincible*1000;
        this.nativePlayer.bounceFromSurface(surfaceY/u);
        p.y=n.position.y*u;p.vy=n.velocity.y*u*60;p.grounded=false;p.pounding=false;p.invincible=n.invincibleTimer/1000;
    }
    private hitEnemy(e:DeliciaEnemy,power:number):void {e.hp-=power;e.flash=.16;this.burst(e.x,e.y,'#ffa84a',15);this.emit('enemy',e.x,e.y);e.state=e.hp<=0?'dead':'stun';if(e.state==='dead')this.enemiesDefeated++;e.timer=1.2;}
    private updateProjectiles(dt:number):void {
        for(const m of this.projectiles){m.life-=dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=m.gravity*dt;
            if(m.friendly){
                for(const e of this.enemies)if(e.state!=='dead'&&intersects(m,e)){if(e.kind!=='sentinel'||e.state==='stun')this.hitEnemy(e,1);else{e.state='stun';e.timer=1;}m.life=0;break;}
                if(this.boss&&intersects(m,this.boss.rect)){this.boss.hit(1,m);m.life=0;}
            }else this.missileContact(m);
            if(this.dead)return;
        }
        this.projectiles=this.projectiles.filter(m=>m.life>0&&m.y<850);
    }
    private missileContact(m:BossMissile):void{
        if(m.life<=0||m.friendly||!intersects(this.player,m))return;
        if(this.player.parryTime>0){if(this.boss)this.boss.reflect(m);else{m.friendly=true;m.vx*=-2;m.vy=-70;m.gravity=0;}this.parries++;this.emit('parry',m.x,m.y);this.burst(m.x,m.y,'#a5fff1',20);this.player.parryTime=0;}
        else{this.hurt(m.x);m.life=0;}
    }
    hurt(sourceX:number):void {
        const p=this.player;if(p.invincible>0||this.dead)return;
        this.nativePlayer.data.groundPoundState=GroundPoundState.NONE;this.nativePlayer.data.groundPoundTimer=0;this.nativePlayer.data.isJumping=false;
        p.health--;this.damageTaken++;p.invincible=1.5;p.vx=(p.x<sourceX?-1:1)*300;p.vy=-290;p.pounding=false;this.emit('hurt');this.burst(p.x,p.y,'#ec795f',18);
        if(p.health<=0)this.dead=true;
    }
    private fallIntoGap():void{
        const p=this.player;if(p.invincible>0&&p.y<600&&(!this.boss||p.dashTime>0))return;
        this.emit('gap',p.x,p.y);if(p.invincible<=0||p.y>600){p.health--;this.damageTaken++;p.invincible=1.7;}
        if(p.health<=0){this.dead=true;return;}p.x=this.safeX;p.y=this.safeY;p.vx=0;p.vy=0;p.pounding=false;p.dashTime=0;p.grounded=false;p.coyote=0;p.buffer=0;
        this.nativePlayer.reset(p.x/(DELICIA_UNIT*TILE_SIZE),(p.y+p.h)/(DELICIA_UNIT*TILE_SIZE));this.support=-1;
        this.cameraX=Math.max(0,Math.min(this.stage.width-960,p.x-250));
    }
}
