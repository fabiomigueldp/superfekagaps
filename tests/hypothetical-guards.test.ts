import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalGuard, GUARD_SHOVE, GUARD_FOOTWORK, GUARD_LUNGE, GUARD_COVER } from '../src/adventure/hipotetico/HypotheticalGuards';
import { guardFoot, guardPose, drawHypotheticalGuard } from '../src/adventure/hipotetico/HypotheticalGuardArt';
import { hypotheticalStage } from '../src/adventure/hipotetico/HypotheticalStage';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { SIEGE_SECTORS, siegeGarrison } from '../src/adventure/hipotetico/HypotheticalSiege';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import type { FoeSpec } from '../src/adventure/types';
import type { Rect } from '../src/types';
const dt=1000/60,player={x:145,y:200,width:14,height:24};
function setup(kind:FoeSpec['kind'],x=100,y=224,wave=1){
    const stage=hypotheticalStage('duel'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
    level.bodies=objects.bodies;
    const e=new HypotheticalGuard({id:'test',kind,x,y,range:120,behavior:'canal'},wave);
    return {e,level,objects,step:(p=player)=>e.update(dt,level,objects,p)};
}

test('authored garrisons have room bounds and every launcher stands on its own scaffold',()=>{
    const stage=hypotheticalStage('siege');
    assert.equal(stage.foes.length,9);
    for(const [i,sector] of SIEGE_SECTORS.entries())for(const spec of siegeGarrison(i)){
        const e=new HypotheticalGuard(spec,i+1,()=>[],{left:sector.origin+12,right:sector.gate});
        assert.ok(e.x>=sector.origin&&e.x+e.width<sector.gate);
        if(spec.kind==='loader')assert.ok(stage.mechanisms.some(p=>p.kind==='support'&&e.x>=p.x&&e.x+e.width<=p.x+p.width&&e.y+e.height===p.y));
    }
});
test('shield shove commits direction, has a complete tell and a bounded active interval before recovery',()=>{
    const {e,step}=setup('helmet');step();assert.equal(e.phase,'warning');
    const x=e.x,dir=e.facing;
    for(let i=0;i<38;i++){step({...player,x:60});assert.equal(e.danger,null);assert.equal(e.phase,'warning');assert.equal(e.facing,dir);}
    while(e.phase==='warning')step({...player,x:60});
    assert.ok(e.age>=GUARD_SHOVE.warning);assert.equal(e.danger,null);
    let active=0;
    while(e.phase==='attack'){
        step({...player,x:60});
        if(e.danger){active++;const r:Rect=e.danger;assert.equal(e.contact({...r,width:1,height:1},{...r,width:1,height:1},false,false),'hurt');}
    }
    assert.ok(active>=8&&active<=11);assert.ok(Math.abs(e.x-x-14)<.01);assert.equal(e.phase,'rest');assert.equal(e.danger,null);
    for(let i=0;i<50;i++){step();assert.equal(e.phase,'rest');assert.equal(e.danger,null);}
});
test('a real top contact cancels the shield shove, breaks its armor and preserves the native second stomp',()=>{
    const {e,step}=setup('helmet');step();while(e.phase!=='attack')step();for(let i=0;i<6;i++)step();assert.ok(e.danger);
    const hit={x:e.x+2,y:e.y-23,width:14,height:24},old={...hit,y:hit.y-4};
    assert.equal(e.contact(hit,old,true,true),'bounce');assert.equal(e.armor,false);assert.equal(e.phase,'stunned');assert.equal(e.danger,null);
    step();assert.ok(Number.isFinite(e.armorLostAt));
    for(let i=0;i<45;i++)step();assert.equal(e.phase,'walk');assert.equal(e.danger,null);
    assert.equal(e.contact({...hit,x:e.x+2,y:e.y-23},{...old,x:e.x+2,y:e.y-27},true,false),'kill');assert.equal(e.dead,true);
});
test('the light guard withdraws after a committed thrust, never extending its weapon during recovery',()=>{
    const {e,step}=setup('minion');step();assert.equal(e.phase,'warning');
    while(String(e.phase)!=='rest')step();const x=e.x;
    for(let i=0;i<12;i++){step();assert.equal(e.danger,null);assert.equal(e.y+e.height,224);}
    assert.ok(x-e.x>=5&&x-e.x<=7);assert.equal(e.phase,'rest');
});
test('the trolley accelerates, commits to its lane and exposes its rider only after braking',()=>{
    const {e,step}=setup('charger',90);step({...player,x:215});assert.equal(e.phase,'warning');
    while(e.phase==='warning')step({...player,x:20});const dir=e.facing;
    step({...player,x:20});const slow=e.motionX;
    for(let i=0;i<9;i++)step({...player,x:20});assert.equal(e.facing,dir);assert.ok(e.motionX>slow*2);assert.equal(e.blocksStomp,true);
    while(e.phase==='attack')step();assert.equal(e.phase,'rest');assert.equal(e.blocksStomp,false);
    const hit={x:e.x+5,y:e.y-23,width:14,height:24};assert.equal(e.contact(hit,{...hit,y:hit.y-4},true,false),'kill');
});
test('the launcher alternates low/high arcs, locks its facing and records the exact release tick',()=>{
    const {e,objects,step}=setup('loader',238,168),p={...player,x:185};
    while(e.phase!=='warning')step(p);const dir=e.facing;
    for(let i=0;i<49;i++){step({...p,x:280});assert.equal(e.facing,dir);assert.equal(objects.barrels.length,0);}
    while(objects.barrels.length===0)step(p);
    assert.equal(e.phase,'recoil');assert.equal(e.lastRelease,e.age);assert.equal(e.releaseHigh,false);
    assert.equal(objects.barrels[0].vy,-2.5);assert.equal(objects.barrels[0].x,e.x-14);assert.equal(objects.barrels[0].y,e.y-4);
    for(let i=0;i<190&&objects.barrels.length<2;i++)step(p);
    assert.equal(objects.barrels.length,2);assert.equal(objects.barrels[1].vy,-4.8);assert.equal(e.releaseHigh,true);
});
test('planted boots counter actual travel in both directions and lifted boots never stretch through the floor',()=>{
    for(const d of [-1,1])for(const side of [0,1] as const){
        const start=side===0?2:12;
        for(let t=0;t<7;t+=.5){
            const [x,y]=guardFoot(start+t,side),[origin]=guardFoot(start,side);
            assert.ok(Math.abs(d*t+d*x-d*origin)<1e-6);assert.equal(y,0);
        }
    }
    for(let d=0;d<60;d+=.1)for(const side of [0,1] as const)assert.ok(guardFoot(d,side)[1]<=0);
});
test('native pause freezes guards, projectiles and telegraphs; painting never advances a guard',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    g.act='siege';g.load('hipotetico-siege',true);for(let i=0;i<190;i++)g.update(dt);
    assert.ok(g.foes.length>=2);const e=g.foes[0],ctx=g.renderer.getContext();
    const snapshot=()=>JSON.stringify({foes:g.foes,objects:g.objects,player:g.player.data,model:g.fight});
    const before=snapshot();drawHypotheticalGuard(ctx,e,0,64);drawHypotheticalGuard(ctx,e,0,64,true);assert.equal(snapshot(),before);
    assert.equal(guardPose(e,true).warning,guardPose(e,false).warning);
    h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');assert.equal(g.state,'paused');
    const frozen=snapshot();for(let i=0;i<90;i++){g.update(dt);g.render();}assert.equal(snapshot(),frozen);g.dispose();
});

test('the last-wave batedor announces a second thrust fully, commits its direction and then really recovers',()=>{
    const {e,step}=setup('minion',100,224,3);step();let steps=0;
    while(e.comboStep!==1&&steps++<100)step();assert.equal(e.comboStep,1);assert.equal(e.phase,'warning');assert.equal(e.timer,0);
    const direction=e.facing;
    for(let i=0;i<26;i++){step({...player,x:60});assert.equal(e.phase,'warning');assert.equal(e.danger,null);assert.equal(e.facing,direction);}
    while(e.phase==='warning')step({...player,x:60});
    let active=0;while(e.phase==='attack'){step({...player,x:60});if(e.danger)active++;}
    assert.ok(active>=7);assert.equal(e.phase,'rest');assert.equal(e.comboStep,1);
    for(let i=0;i<50;i++){step();assert.equal(e.phase,'rest');assert.equal(e.danger,null);}
    const first=setup('minion',100,224,1);first.step();let attacked=false;
    for(let i=0;i<80;i++){first.step();attacked||=first.e.phase==='attack';assert.equal(first.e.comboStep,0);}
    assert.ok(attacked);assert.equal(first.e.phase,'rest');
});
test('crossing behind or clearing the first thrust vertically cancels the batedor follow-up',()=>{
    for(const escape of [{...player,x:60},{...player,y:160}]){
        const {e,step}=setup('minion',100,224,3);step();while(e.phase!=='attack')step();
        while(e.phase==='attack')step(escape);
        assert.equal(e.phase,'rest');assert.equal(e.comboStep,0);assert.equal(e.danger,null);
    }
});
test('last-wave barrel pairs have their own aim lock and full tell, followed by an extended resupply',()=>{
    const {e,objects,step}=setup('loader',238,168,3),p={...player,x:185};
    let n=0;while(objects.barrels.length===0&&n++<160)step(p);
    const first=e.age;assert.equal(objects.barrels.length,1);assert.equal(e.comboStep,0);
    while(e.phase==='recoil')step(p);assert.equal(e.phase,'warning');assert.equal(e.comboStep,1);const dir=e.facing;
    for(let i=0;i<50;i++){step({...p,x:280});assert.equal(e.phase,'warning');assert.equal(e.facing,dir);assert.equal(objects.barrels.length,1);}
    while(objects.barrels.length===1)step(p);
    assert.ok(e.age-first>=1250&&e.age-first<1300);assert.equal(e.releaseHigh,true);
    while(String(e.phase)==='recoil')step(p);assert.equal(e.phase,'rest');assert.equal(e.timer,-400);
    for(let i=0;i<111;i++){step(p);assert.equal(e.phase,'rest');assert.equal(objects.barrels.length,2);}
    while(e.phase==='rest')step(p);assert.equal(e.phase,'warning');assert.equal(e.comboStep,0);
});
test('defeating a last-wave launcher during its second tell cancels the prepared barrel',()=>{
    const {e,objects,step}=setup('loader',238,168,3),p={...player,x:185};
    let n=0;while(e.comboStep!==1&&n++<220)step(p);assert.equal(e.phase,'warning');
    const hit={x:e.x+3,y:e.y-23,width:14,height:24};
    assert.equal(e.contact(hit,{...hit,y:hit.y-4},true,false),'kill');
    for(let i=0;i<160;i++)step(p);assert.equal(objects.barrels.length,1);assert.equal(e.danger,null);
});
test('preparation, attack, braking and contact retain the previous pose at the transition boundary',()=>{
    for(const kind of ['minion','helmet','charger','loader'] as const){
        const {e,step}=setup(kind,100,kind==='loader'?184:224,3);let changes=0;
        for(let i=0;i<260;i++){
            const before=e.actionPose,phase=e.phase;step();
            if(phase!==e.phase){changes++;assert.deepEqual(e.actionPose,before,`${kind}: ${phase} to ${e.phase}`);}
        }
        assert.ok(changes>=2,`${kind} animation transitions exercised`);
    }
    const {e,step}=setup('helmet');step();while(e.phase!=='attack')step();for(let i=0;i<6;i++)step();
    const pose=e.actionPose,hit={x:e.x+3,y:e.y-23,width:14,height:24};
    e.contact(hit,{...hit,y:hit.y-4},true,true);assert.equal(e.phase,'stunned');assert.deepEqual(e.actionPose,pose);
});
test('retreating boots compensate backward displacement and reduced motion preserves attack poses',()=>{
    const {e}=setup('minion');Object.assign(e,{phase:'rest',motionX:-.5,distance:2,timer:100});
    const before=e.x+e.width/2+guardPose(e).left[0];e.x-=1;e.distance+=1;
    assert.equal(e.x+e.width/2+guardPose(e).left[0],before);
    e.phase='attack';e.timer=120;
    assert.equal(guardPose(e,true).thrust,guardPose(e,false).thrust);
    assert.equal(guardPose(e,true).lean,guardPose(e,false).lean);
});

test('infantry keeps separate silhouettes and the rear guard cannot announce an attack through its ally',()=>{
    for(const order of [false,true]){
        const {level,objects}=setup('minion'),team:HypotheticalGuard[]=[];
        const front=new HypotheticalGuard({id:'front',kind:'helmet',x:100,y:224,range:320,behavior:'canal'},3,()=>team);
        const rear=new HypotheticalGuard({id:'rear',kind:'minion',x:64,y:224,range:320,behavior:'canal'},3,()=>team);
        team.push(...order?[rear,front]:[front,rear]);
        let held=0;
        for(let n=0;n<100;n++){
            for(const e of team)e.update(dt,level,objects,player);
            assert.ok(front.x-rear.x-rear.width>=GUARD_FOOTWORK.gap-1e-6);
            if(rear.yielding){held++;assert.equal(rear.phase,'walk');assert.equal(rear.danger,null);}
        }
        assert.ok(held>30);
        front.dead=true;
        const start=rear.x;for(let n=0;n<40;n++)rear.update(dt,level,objects,{...player,x:240});
        assert.ok(rear.x>start+15);assert.equal(rear.yielding,false);
    }
});

test('crossing behind infantry produces a planted pivot and then a full new tell, never a turning strike',()=>{
    for(const kind of ['minion','helmet'] as const){
        const {e,step}=setup(kind,140),behind={...player,x:98};
        const x=e.x,direction=e.facing;
        step(behind);assert.equal(e.phase,'walk');assert.equal(e.facing,direction);
        for(let n=0;n<4;n++){step(behind);assert.equal(e.x,x);assert.equal(e.danger,null);}
        assert.ok(e.actionPose.turn>.9);
        while(e.turnProgress<1){step(behind);assert.equal(e.x,x);assert.equal(e.danger,null);}
        assert.equal(e.facing,-direction);step(behind);assert.equal(e.phase,'warning');assert.equal(e.timer,0);
        for(let n=0;n<Math.floor(e.warningDuration/dt)-1;n++){step(behind);assert.equal(e.danger,null);}
    }
    const close=setup('helmet',140),behind={...player,x:117};
    close.step(behind);assert.equal(close.e.phase,'walk');assert.equal(close.e.facing,1);
    for(let n=0;n<40&&String(close.e.phase)!=='warning';n++){close.step(behind);assert.equal(close.e.danger,null);}
    assert.equal(close.e.phase,'warning');assert.equal(close.e.facing,-1);assert.ok(close.e.age>=GUARD_FOOTWORK.pivot);
});

test('both entrances can pressure the opposite end of the courtyard instead of stopping at the spawn leash',()=>{
    for(const playerX of [20,280]){
        const {level,objects}=setup('minion');
        const e=new HypotheticalGuard({id:'patrol',kind:'minion',x:playerX<160?280:14,y:224,range:320,behavior:'canal'});
        let warned=false;
        for(let n=0;n<600;n++){
            e.update(dt,level,objects,{...player,x:playerX});
            assert.ok(e.x>=0&&e.x+e.width<=320);
            if(e.phase==='warning'){warned=true;break;}
        }
        assert.ok(warned,`courtyard approach to ${playerX}`);
    }
});

test('launcher resupply steps stay on both authored balconies and plant before any locked throw',()=>{
    for(const x of [56,238]){
        const {e,level,objects,step}=setup('loader',x,x===56?184:168,3);
        const origin=e.x,support=level.bodies.find(b=>e.x>=b.x&&e.x+e.width<=b.x+b.width)!;
        let travel=0,last=e.x;
        for(let n=0;n<65;n++){
            step();travel+=Math.abs(e.x-last);last=e.x;
            assert.ok(e.x>=support.x+2&&e.x+e.width<=support.x+support.width-2);
            assert.equal(e.y+e.height,support.y);assert.equal(objects.barrels.length,0);
        }
        assert.ok(travel>=11.9&&travel<=12.1);assert.equal(e.x,origin);
        while(e.phase!=='warning')step();
        const position=e.x;
        for(let n=0;n<50;n++){step({...player,x:300-player.x});assert.equal(e.x,position);assert.equal(objects.barrels.length,0);}
    }
});

test('spacing, pivots and reload steps remain unchanged on zero or invalid time',()=>{
    for(const kind of ['minion','loader'] as const){
        const {e,level,objects,step}=setup(kind,100,kind==='loader'?184:224);step({...player,x:45});
        const before=JSON.stringify(e);
        for(const bad of [0,-1,NaN,Infinity])e.update(bad,level,objects,player);
        assert.equal(JSON.stringify(e),before);
    }
});

test('the second batedor stroke has its own longer tell, committed step, reach and punish window',()=>{
    const {e,step}=setup('minion',100,224,3);
    while(e.comboStep!==1)step();
    assert.equal(e.warningDuration,GUARD_LUNGE.warning);
    const warningAt=e.age,dir=e.facing;
    while(e.phase==='warning'){
        step({...player,x:60});assert.equal(e.facing,dir);assert.equal(e.danger,null);
    }
    assert.ok(e.age-warningAt>=560&&e.age-warningAt<580);
    const start=e.x;
    while(e.phase==='attack'){
        if(e.timer<GUARD_LUNGE.activeFrom||e.timer>=GUARD_LUNGE.activeUntil)assert.equal(e.danger,null);
        else {assert.ok(e.danger);const r:Rect=e.danger;assert.equal(r.width,14);assert.equal(r.x+r.width,e.x+e.width+GUARD_LUNGE.reach);}
        step({...player,x:60});assert.equal(e.facing,dir);
    }
    assert.ok(Math.abs(e.x-start-GUARD_LUNGE.distance)<1e-6);
    for(let i=0;i<65;i++){step();assert.equal(e.phase,'rest');assert.equal(e.danger,null);}
    while(String(e.phase)==='rest')step();assert.equal(e.comboStep,0);
});

test('a long lunge still respects allied bodies, and its weapon cannot hit outside the advertised edge',()=>{
    const {level,objects}=setup('minion'),team:HypotheticalGuard[]=[];
    const e=new HypotheticalGuard({id:'lunge',kind:'minion',x:100,y:224,behavior:'canal'},3,()=>team);
    const ally=new HypotheticalGuard({id:'ally',kind:'helmet',x:143,y:224,behavior:'canal'},3,()=>team);
    team.push(e,ally);e.comboStep=1;e.phase='attack';
    for(let i=0;i<21;i++){
        e.update(dt,level,objects,player);
        assert.ok(ally.x-e.x-e.width>=GUARD_FOOTWORK.gap-1e-6);
        if(e.danger){
            const r:Rect=e.danger,outside={x:r.x+r.width,y:r.y,width:1,height:1},edge={...outside,x:outside.x-1};
            assert.equal(e.contact(outside,outside,false,false),'none');
            assert.equal(e.contact(edge,edge,false,false),'hurt');
        }
    }
    assert.ok(e.x<=109.0001);assert.equal(e.phase,'rest');
});

test('jumping onto a committed follow-up interrupts it using the ordinary stomp',()=>{
    const {e,step}=setup('minion',100,224,3);
    while(!e.longLunge||e.phase!=='attack')step();for(let i=0;i<7;i++)step();
    assert.ok(e.danger);
    const hit={x:e.x+1,y:e.y-23,width:14,height:24};
    assert.equal(e.contact(hit,{...hit,y:hit.y-4},true,false),'kill');assert.equal(e.danger,null);
    for(let i=0;i<60;i++)step();assert.equal(e.dead,true);
});

test('actual lunging travel drives planted soles instead of sliding motionless boots',()=>{
    for(const facing of [-1,1]){
        const {e,step}=setup('minion',100,224,3);e.comboStep=1;e.phase='attack';e.facing=facing;e.vx=facing*.55;
        let planted=0,lifted=0;
        for(let n=0;n<19;n++){
            const distance=e.distance,x=e.x,feet=guardPose(e);
            step({...player,x:facing>0?180:40});const next=guardPose(e);
            for(const side of ['left','right'] as const){
                assert.ok(next[side][1]<=0);
                if(next[side][1]<-1)lifted++;
                if(n>0&&feet[side][1]===0&&next[side][1]===0&&e.distance-distance<3){
                    assert.ok(Math.abs(x+facing*feet[side][0]-e.x-facing*next[side][0])<1e-6);planted++;
                }
            }
        }
        assert.ok(planted>8&&lifted>4);
    }
});

test('a loaded launcher covers an actual ariete charge, with a complete warning and locked aim',()=>{
    const {level,objects}=setup('minion'),team:HypotheticalGuard[]=[];
    const ram=new HypotheticalGuard({id:'ram',kind:'charger',x:90,y:224,behavior:'canal'},2,()=>team);
    const loader=new HypotheticalGuard({id:'loader',kind:'loader',x:238,y:168,behavior:'canal'},2,()=>team);
    team.push(ram,loader);
    const step=(p={...player,x:185})=>{for(const e of team)e.update(dt,level,objects,p);};
    while(loader.phase==='rest')step();
    assert.ok(loader.age>=GUARD_COVER.resupply&&loader.age<1500);
    assert.equal(ram.phase,'attack');assert.equal(loader.coveringCharge,true);assert.equal(loader.timer,0);assert.equal(loader.reloadProgress,1);
    const at=loader.age,dir=loader.facing;
    for(let i=0;i<50;i++){step({...player,x:280});assert.equal(objects.barrels.length,0);assert.equal(loader.facing,dir);}
    while(objects.barrels.length===0)step();
    assert.ok(loader.age-at>=850);assert.equal(objects.barrels.length,1);assert.equal(objects.barrels[0].vy,-2.5);
    assert.equal(ram.phase,'rest');assert.equal(ram.blocksStomp,false);
});

test('a defeated or recovering ariete cannot accelerate its partner, and a solo launcher keeps its cadence',()=>{
    for(const state of ['solo','dead','rest'] as const){
        const {level,objects}=setup('minion'),team:HypotheticalGuard[]=[];
        const ram=new HypotheticalGuard({id:'ram',kind:'charger',x:90,y:224,behavior:'canal'},2,()=>team);
        const loader=new HypotheticalGuard({id:'loader',kind:'loader',x:238,y:168,behavior:'canal'},2,()=>team);
        ram.phase=state==='rest'?'rest':'attack';ram.dead=state==='dead';
        team.push(loader,...state==='solo'?[]:[ram]);
        for(let n=0;n<89;n++){loader.update(dt,level,objects,{...player,x:185});assert.equal(loader.phase,'rest');assert.equal(loader.coveringCharge,false);}
        assert.equal(objects.barrels.length,0);
    }
});

test('the paired launcher visibly retrieves the next barrel before raising it, without spawning a projectile',()=>{
    const {e,objects,step}=setup('loader',238,168,3),p={...player,x:185};
    while(objects.barrels.length===0)step(p);
    while(e.timer<350)step(p);
    assert.equal(e.phase,'recoil');assert.ok(e.actionPose.supply>.95);assert.ok(e.actionPose.carry<.1);
    while(e.comboStep!==1)step(p);
    assert.equal(e.phase,'warning');assert.ok(e.actionPose.supply>.95);assert.equal(objects.barrels.length,1);
    for(let i=0;i<20;i++)step(p);
    assert.ok(e.actionPose.supply<.01);assert.ok(e.actionPose.carry>.25);assert.equal(objects.barrels.length,1);
});
