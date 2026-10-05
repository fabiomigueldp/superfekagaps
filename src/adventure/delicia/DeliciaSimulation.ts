import { DELICIA_STAGES, type Box, type DeliciaStage, type Floor, type FoeType, type StagePickup } from './DeliciaContent';
import { DeliciaBoss, intersects, type BossMissile } from './DeliciaBoss';
export interface DeliciaInput { left:boolean;right:boolean;jump:boolean;jumpPressed:boolean;jumpReleased:boolean;dash:boolean;pound:boolean;seed:boolean;parry:boolean;interact:boolean }
export const noDeliciaInput = (): DeliciaInput => ({left:false,right:false,jump:false,jumpPressed:false,jumpReleased:false,dash:false,pound:false,seed:false,parry:false,interact:false});
export interface DeliciaPlayer extends Box { vx:number;vy:number;grounded:boolean;facing:number;health:number;invincible:number;coyote:number;buffer:number;dashTime:number;dashCooldown:number;seedCooldown:number;parryTime:number;parryCooldown:number;pounding:boolean;walk:number;land:number }
export interface DeliciaEnemy extends Box { kind:FoeType;home:number;patrol:number;vx:number;hp:number;timer:number;state:'walk'|'tell'|'attack'|'stun'|'dead';phase:number;flash?:number }
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
    readonly player:DeliciaPlayer;readonly boss:DeliciaBoss|null;enemies:DeliciaEnemy[];projectiles:BossMissile[]=[];particles:DeliciaParticle[]=[];
    time=0;elapsed=0;coins=0;checkpoint=-1;finished=false;dead=false;cameraX=0;cameraY=0;
    readonly recordEligible:boolean;
    events:SimulationEvent[]=[];valves=new Set<string>();collected=new Set<string>();crumble=new Map<number,number>();
    damageTaken=0;parries=0;enemiesDefeated=0;readonly heard=new Set<string>();zoneIndex=-1;
    private jetCooldown=0;private machineStates=new Map<string,string>();
    private support=-1;private safeX=90;private safeY=396;private lastValveTimes=new Map<string,number>();
    constructor(readonly stage:DeliciaStage=DELICIA_STAGES[0],readonly assists=false,checkpoint=-1){
        this.recordEligible=!assists&&checkpoint<0;
        this.player={...stage.spawn,w:34,h:54,vx:0,vy:0,grounded:false,facing:1,health:assists?6:4,invincible:0,coyote:0,buffer:0,dashTime:0,dashCooldown:0,seedCooldown:0,parryTime:0,parryCooldown:0,pounding:false,walk:0,land:0};
        this.boss=stage.boss?new DeliciaBoss(stage.boss,assists):null;
        this.enemies=stage.enemies.map((e,i)=>({...e,w:e.kind==='roller'?46:38,h:e.kind==='wasp'?30:44,home:e.x,vx:i%2?-55:55,hp:e.kind==='sentinel'?3:e.kind==='mimic'?2:1,timer:0,state:'walk',phase:i*.73}));
        if(checkpoint>=0&&checkpoint<stage.checkpoints.length){this.checkpoint=checkpoint;this.safeX=stage.checkpoints[checkpoint].x;this.safeY=stage.checkpoints[checkpoint].y;this.player.x=this.safeX;this.player.y=this.safeY;}
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
        for(const key of ['invincible','dashTime','dashCooldown','seedCooldown','parryTime','parryCooldown','coyote','buffer','land'] as const)p[key]=Math.max(0,p[key]-dt);
        if(input.jumpPressed)p.buffer=.14;if(p.grounded)p.coyote=.13;
        const axis=Number(input.right)-Number(input.left);if(axis)p.facing=axis;
        if(input.dash&&p.dashCooldown===0&&!p.pounding){p.dashTime=.18;p.dashCooldown=.75;p.vy=0;p.invincible=Math.max(p.invincible,.18);this.emit('dash');}
        if(input.parry&&p.parryCooldown===0){p.parryTime=this.assists?.32:.21;p.parryCooldown=.55;this.emit('guard');}
        if(p.buffer>0&&p.coyote>0){p.vy=-610;p.grounded=false;p.coyote=0;p.buffer=0;p.pounding=false;this.emit('jump');}
        if(input.jumpReleased&&p.vy<-200)p.vy*=.5;
        if(input.pound&&!p.grounded&&p.dashTime===0){p.pounding=true;p.vy=920;}
        if(input.seed&&p.seedCooldown===0){p.seedCooldown=.42;this.projectiles.push({x:p.x+p.w*.5,y:p.y+19,w:12,h:10,vx:p.facing*640,vy:-35,gravity:85,kind:'seed',life:1.4,friendly:true});this.emit('seed');}
        if(input.interact)this.useValve();
        if(p.dashTime>0){p.vx=p.facing*720;p.vy=0;this.burst(p.x+p.w/2,p.y+30,'#f9ba4c',1);}
        else{const target=axis*290,rate=p.grounded?16:10;p.vx+=(target-p.vx)*Math.min(1,rate*dt);p.vy=Math.min(1020,p.vy+1750*dt);}
        if(this.support>=0&&p.grounded){const f=this.stage.floors[this.support];if(f.kind==='moving'||f.kind==='lift'){const now=movingFloor(f,this.time),before=movingFloor(f,this.time-dt);p.x+=now.x-before.x;p.y+=now.y-before.y;}if(f.kind==='belt')p.x+=(f.beltSpeed??85)*dt;}
        p.x=Math.max(0,Math.min(this.stage.width-p.w,p.x+p.vx*dt));p.y+=p.vy*dt;p.grounded=false;
        this.resolveFloors(previous,dt);
        if(p.grounded&&p.pounding){p.pounding=false;this.emit('pound',p.x+p.w/2,p.y+p.h);this.burst(p.x,p.y+p.h,'#f1c879',18);
            for(const e of this.enemies)if(e.state!=='dead'&&Math.abs(e.x-p.x)<125&&Math.abs(e.y-p.y)<90){e.state='stun';e.timer=1.5;}}
        if(p.grounded&&!previous.grounded){p.land=.13;this.burst(p.x+p.w/2,p.y+p.h,'#e5bf85',5);}
        p.walk+=Math.abs(p.vx)*dt*.07;
        this.updateEnemies(dt,previous);this.boss?.update(dt,p);this.updateProjectiles(dt);
        if(this.boss){
            for(const m of this.boss.missiles)this.missileContact(m);
            for(const danger of this.boss.danger)if(intersects(p,danger))this.hurt(danger.x+danger.w/2);
            if(p.y+p.h>447&&this.boss.gaps.some(g=>p.x+p.w>g.x+7&&p.x<g.x+g.w-7))this.fallIntoGap();
            if(intersects(p,this.boss.rect)&&this.boss.beat!=='defeated'){
                if(previous.y+previous.h<=this.boss.y+30&&p.vy>0){if(this.boss.hit(p.pounding?2:1)){this.emit('boss-hit',this.boss.x,this.boss.y);this.burst(this.boss.x+48,this.boss.y,'#ffe7a9',26);}p.vy=-510;p.pounding=false;p.y=this.boss.y-p.h;}
                // The crouched charge uses its telegraphed lower hitbox. Applying
                // the upright body here would make the advertised jump impossible.
                else if(this.boss.beat==='attack'&&this.boss.attack!=='charge'||this.boss.beat==='idle'&&this.boss.beatTime>.22)this.hurt(this.boss.x+this.boss.w/2);
            }
            for(const event of this.boss.events){if(event.kind==='tell')this.emit('tell',event.x,event.y,{attack:event.attack});if(event.kind==='impact'){this.emit('pound',event.x,event.y);this.burst(event.x,450,'#ffc270',20);}if(event.kind==='phase')this.emit('phase',event.x,event.y);if(event.kind==='defeat')this.emit('defeat',event.x,event.y);}
        }
        for(const h of this.stage.hazards){if((h.kind==='thorns'||h.kind==='steam'&&steamPhase(this.time,h.period,h.phase)==='active')&&intersects(p,h))this.hurt(h.x);if(h.kind==='juice'&&intersects(p,h))this.fallIntoGap();}
        this.updateMachines(dt);
        if(p.y>this.stage.height-60)this.fallIntoGap();
        for(const pickup of this.stage.pickups)if(!this.collected.has(pickup.id)&&Math.hypot(p.x+p.w*.5-pickup.x,p.y+p.h*.5-pickup.y)<35){
            this.collected.add(pickup.id);if(pickup.kind==='orange')this.coins++;if(pickup.kind==='heart')p.health=Math.min(this.assists?6:4,p.health+1);
            this.emit('collect',pickup.x,pickup.y,{pickup});this.burst(pickup.x,pickup.y,pickup.kind==='memory'?'#a5e6d2':'#ffc552',12);
        }
        this.stage.checkpoints.forEach((cp,index)=>{if(index>this.checkpoint&&Math.abs(p.x-cp.x)<55&&Math.abs(p.y-cp.y)<60){this.checkpoint=index;this.safeX=cp.x;this.safeY=cp.y;this.emit('checkpoint',cp.x,cp.y);}});
        for(const echo of this.stage.echoes??[])if(!this.heard.has(echo.id)&&Math.abs(p.x-echo.x)<65&&(!echo.after||this.valves.has(echo.after))){this.heard.add(echo.id);this.emit('echo',echo.x,echo.y,{text:`${echo.speaker}: ${echo.text}`});}
        const zone=this.stage.zones?.reduce((found,z,index)=>p.x>=z.x?index:found,-1)??-1;if(zone>this.zoneIndex){this.zoneIndex=zone;this.emit('zone',p.x,p.y,{text:this.zone?.name});}
        if(this.gateOpen&&intersects(p,this.stage.gate)){this.finished=true;this.emit('clear',this.stage.gate.x,this.stage.gate.y);}
        for(const part of this.particles){part.life-=dt;part.x+=part.vx*dt;part.y+=part.vy*dt;part.vy+=300*dt;}this.particles=this.particles.filter(part=>part.life>0);
        const focus=this.boss&&this.boss.hp>0?(p.x+this.boss.x)*.5-480:p.x-350+p.vx*.22;
        const viewX=Math.max(0,Math.min(this.stage.width-960,focus)),viewY=this.boss?0:Math.max(0,Math.min(this.stage.height-540,p.y-390));
        this.cameraX+=(viewX-this.cameraX)*(1-Math.exp(-dt*5.5));this.cameraY+=(viewY-this.cameraY)*(1-Math.exp(-dt*6));
    }
    private resolveFloors(previous:DeliciaPlayer,dt:number):void {
        const p=this.player;this.support=-1;
        for(let index=0;index<this.stage.floors.length;index++){
            const f=this.stage.floors[index],box=movingFloor(f,this.time),fallen=this.crumble.get(index);
            if(!this.floorAvailable(f))continue;
            if(fallen!==undefined&&fallen>1)continue;
            if(this.boss&&this.boss.gaps.some(g=>p.x+p.w>g.x+7&&p.x<g.x+g.w-7)&&f.y===450)continue;
            if(p.x+p.w<=box.x||p.x>=box.x+box.w)continue;
            if(p.vy>=0&&previous.y+previous.h<=box.y+8&&p.y+p.h>=box.y){
                p.y=box.y-p.h;p.vy=0;p.grounded=true;this.support=index;
                if(f.kind==='spring'){p.vy=-830;p.grounded=false;this.emit('jump',p.x,box.y);}
                if(f.kind==='crumble')this.crumble.set(index,(fallen??0)+dt);
                break;
            }
            if(f.h>50&&intersects(p,box)&&previous.y+previous.h>box.y+10){
                if(previous.x+previous.w<=box.x+10){p.x=box.x-p.w;p.vx=0;}else if(previous.x>=box.x+box.w-10){p.x=box.x+box.w;p.vx=0;}
            }
        }
        for(const [index,timer] of this.crumble){if(timer>4.5)this.crumble.delete(index);else if(index!==this.support)this.crumble.set(index,timer+dt);}
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
            if(e.state==='stun'){if(e.timer<=0)e.state='walk';}
            else if(e.kind==='wasp'){e.x=e.home+Math.sin(this.time*1.6+e.phase)*e.patrol*.5;e.y=this.stage.enemies[this.enemies.indexOf(e)].y-60+Math.sin(this.time*2.8+e.phase)*36;}
            else if(e.kind==='bottler'||e.kind==='bloom'){
                e.vx=Math.sign(p.x-e.x)||-1;
                if(e.timer<=0&&Math.abs(e.x-p.x)<650){if(e.state==='tell'){
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
            if(previous.y+previous.h<=e.y+20&&p.vy>0){if(e.kind==='sentinel'&&!p.pounding&&e.state!=='stun'){e.state='stun';e.timer=1.6;}else this.hitEnemy(e,p.pounding?2:1);p.y=e.y-p.h;p.vy=-455;p.pounding=false;}
            else if(e.state!=='stun')this.hurt(e.x);
        }
    }
    private hitEnemy(e:DeliciaEnemy,power:number):void {e.hp-=power;e.flash=.16;this.burst(e.x,e.y,'#ffa84a',15);this.emit('enemy',e.x,e.y);e.state=e.hp<=0?'dead':'stun';if(e.state==='dead')this.enemiesDefeated++;e.timer=1.2;}
    private updateProjectiles(dt:number):void {
        for(const m of this.projectiles){m.life-=dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=m.gravity*dt;
            if(m.friendly){
                for(const e of this.enemies)if(e.state!=='dead'&&intersects(m,e)){if(e.kind!=='sentinel'||e.state==='stun')this.hitEnemy(e,1);else{e.state='stun';e.timer=1;}m.life=0;break;}
                if(this.boss&&intersects(m,this.boss.rect)){if(this.boss.hit()){this.emit('boss-hit',m.x,m.y);this.burst(m.x,m.y,'#ffdc87',20);}m.life=0;}
            }else this.missileContact(m);
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
        p.health--;this.damageTaken++;p.invincible=1.5;p.vx=(p.x<sourceX?-1:1)*300;p.vy=-290;p.pounding=false;this.emit('hurt');this.burst(p.x,p.y,'#ec795f',18);
        if(p.health<=0)this.dead=true;
    }
    private fallIntoGap():void{
        const p=this.player;if(p.invincible>0&&p.y<600&&(!this.boss||p.dashTime>0))return;
        this.emit('gap',p.x,p.y);if(p.invincible<=0||p.y>600){p.health--;this.damageTaken++;p.invincible=1.7;}
        if(p.health<=0){this.dead=true;return;}p.x=this.safeX;p.y=this.safeY;p.vx=0;p.vy=0;p.pounding=false;p.dashTime=0;
        this.cameraX=Math.max(0,Math.min(this.stage.width-960,p.x-250));
    }
}
