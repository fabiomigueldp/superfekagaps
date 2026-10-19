import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalVanguard, VANGUARD } from '../src/adventure/hipotetico/HypotheticalVanguard';
import { hypotheticalStage } from '../src/adventure/hipotetico/HypotheticalStage';
import { siegeGarrison, SIEGE_SECTORS } from '../src/adventure/hipotetico/HypotheticalSiege';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { HypotheticalModel } from '../src/adventure/hipotetico/HypotheticalModel';
import { SCENIC_STARTS, nextScenicTick } from '../src/adventure/hipotetico/HypotheticalDevastation';
import { forecourtPeople } from '../src/adventure/hipotetico/HypotheticalForecourt';
import type { Rect } from '../src/types';
const dt=1000/60;
function setup(){
    const s=hypotheticalStage('siege'),level=new WorldLevel(s.level),objects=new WorldObjects(s.mechanisms);
    level.bodies=objects.bodies;
    const sector=SIEGE_SECTORS[3];
    const e=new HypotheticalVanguard(siegeGarrison(3)[0],4,()=>[],{left:sector.origin+12,right:sector.gate});
    const p={x:e.x-75,y:200,width:14,height:24};
    return {e,level,objects,p,step:(player=p)=>e.update(dt,level,objects,player)};
}
test('the vanguard waits in its own fourth post and does not act or hurt through a locked approach',()=>{
    const {e,step,p}=setup();e.awake=false;const x=e.x;
    for(let i=0;i<900;i++)step();
    assert.equal(e.x,x);assert.equal(e.attacks,0);assert.equal(e.danger,null);
    assert.equal(e.contact({...p,x:e.x,y:e.y},p,false,false),'none');
});
test('rush has a complete tell, commits its direction and recovers after a bounded active interval',()=>{
    const {e,step,p}=setup();while(e.phase!=='warning')step();
    assert.equal(e.move,'rush');const direction=e.facing;
    while(e.phase==='warning'){
        assert.equal(e.danger,null);assert.equal(e.facing,direction);step({...p,x:e.x+100});
    }
    const start=e.x;let active=0;
    while(e.phase==='attack'){if(e.danger)active++;step({...p,x:e.x+100});assert.equal(e.facing,direction);}
    assert.ok(active>=12&&active<=15);assert.ok(Math.abs(e.x-start)>85&&Math.abs(e.x-start)<=92);
    assert.equal(e.phase,'rest');for(let i=0;i<35;i++){step();assert.equal(e.danger,null);assert.equal(e.phase,'rest');}
});
test('vault reaches the native upper deck, marks its destination and never tracks a dodge in flight',()=>{
    const {e,step}=setup();const p={x:1668,y:140,width:14,height:24};
    while(e.phase!=='warning')step(p);
    assert.equal(e.move,'vault');assert.equal(e.landing?.y,164);const mark={...e.landing!};
    for(let i=0;i<130&&!e.landed;i++){
        step({...p,x:1850,y:200});assert.deepEqual(e.landing,mark);
    }
    assert.equal(e.landed,true);assert.equal(e.y+e.height,164);
    assert.ok(Math.abs(e.x-mark.x)<5);assert.ok(e.danger);
    for(let i=0;i<14;i++)step();assert.equal(e.phase,'rest');assert.equal(e.danger,null);
});
test('crosscut re-aims only in its second tell and exposes an uninterrupted punish window afterwards',()=>{
    const {e,step,p}=setup();e.attacks=1;
    while(e.phase!=='warning')step();assert.equal(e.move,'cross');
    const direction=e.facing;
    while(e.strike===0)step({...p,x:e.x+80});
    assert.equal(e.phase,'warning');assert.equal(e.facing,-direction);assert.equal(e.danger,null);
    let tells=0;while(e.phase==='warning'){step(p);tells++;}
    assert.equal(tells,VANGUARD.secondWarning);
    while(e.phase==='attack')step(p);assert.equal(e.phase,'rest');
});
test('native stomps chip four pips; a ground pound deals two, cancels the attack and cannot hit twice in one contact',()=>{
    const {e,step}=setup();
    const stomp=(pound:boolean)=>{const p={x:e.x+3,y:e.y-23,width:14,height:24};return e.contact(p,{...p,y:p.y-5},true,pound);};
    assert.equal(stomp(false),'bounce');assert.equal(e.hp,3);assert.equal(e.phase,'stunned');
    assert.equal(stomp(false),'bounce');assert.equal(e.hp,3);
    for(let i=0;i<VANGUARD.immunity;i++)step();
    e.phase='rest';
    assert.equal(stomp(true),'bounce');assert.equal(e.hp,1);assert.equal(e.enraged,true);
    for(let i=0;i<VANGUARD.immunity;i++)step();
    e.phase='rest';
    assert.equal(stomp(false),'kill');assert.equal(e.dead,true);assert.equal(e.danger,null);
});
test('the elite remains in its arena and fixed-step movement is independent of update batching',()=>{
    const a=setup(),b=setup(),p:Rect={x:1600,y:200,width:14,height:24};
    for(let i=0;i<600;i++){a.step(p);a.step(p);b.e.update(dt*2,b.level,b.objects,p);
        assert.ok(a.e.x>=a.e.bounds!.left&&a.e.x+a.e.width<=a.e.bounds!.right);
    }
    for(const key of ['x','y','phase','actionTicks','attacks','distance'] as const)assert.equal(a.e[key],b.e[key]);
});
test('later destruction waits for both the cleared gate and a visible local stage, however long the player waits',()=>{
    const p={x:360,y:200,width:14,height:24},m=new HypotheticalModel('siege');
    for(let i=0;i<3600;i++)m.update(dt,p,2);
    assert.equal(m.backdrop.tick,799);assert.equal(m.destroyed,2);
    assert.ok(m.backdrop.people.filter(p=>p.district>0).every(p=>p.hitAt===null));
    for(let d=1;d<4;d++){
        const start=SCENIC_STARTS[d],watch=SIEGE_SECTORS[d].origin+96;
        assert.equal(nextScenicTick(start-1,watch,d-1),start-1);
        assert.equal(nextScenicTick(start-1,watch-1,d),start-1);
        assert.equal(nextScenicTick(start-1,watch,d),start);
        const resumed=new HypotheticalModel('siege',9,d);
        // Restoring a checkpoint must still wait for the nearby stage to be visible.
        for(let i=0;i<60;i++)resumed.update(dt,{...p,x:watch},2);
        assert.equal(resumed.backdrop.tick,start+60);
        assert.equal(resumed.backdrop.breaches[d+1],-1);
    }
});
test('a faster crossing starts the visible street without silently destroying any skipped scenery',()=>{
    const m=new HypotheticalModel('siege',9,1),p={x:768,y:200,width:14,height:24};
    for(let i=0;i<70;i++)m.update(dt,p,1);
    assert.equal(m.backdrop.breaches[2],-1);
    m.route.cleared=2;m.update(dt,{...p,x:1184},1);
    assert.equal(m.backdrop.tick,1200);assert.equal(m.backdrop.breaches[2],-1);
    assert.deepEqual(m.backdrop.events,[]);
    const resumed=new HypotheticalModel('siege',9,2,0,true,m.backdrop);
    assert.equal(resumed.backdrop.breaches[2],-1,'retry preserves what happened, not fabricated ruins');
    for(let i=0;i<190;i++)resumed.update(dt,{...p,x:1300},1);
    assert.equal(resumed.backdrop.breaches[2],-1);assert.equal(resumed.backdrop.breaches[3],1380);
});
test('an early stomp bounces off the visible brow guard without removing health',()=>{
    const {e,step}=setup();while(e.phase!=='warning')step();
    const p={x:e.x+3,y:e.y-23,width:14,height:24};
    assert.equal(e.blocksStomp,true);assert.equal(e.contact(p,{...p,y:p.y-5},true,true),'bounce');assert.equal(e.hp,4);
});
test('foreground gathering has distinct exits and staggered reactions, remaining entirely before combat',()=>{
    assert.equal(forecourtPeople(0).length,8);assert.equal(new Set(forecourtPeople(0).map(p=>p.alertAt)).size,8);
    for(let tick=0;tick<250;tick++)for(const p of forecourtPeople(tick)){
        assert.ok(p.x>=118&&p.x<=332);assert.equal(p.hitAt,null);
        if(tick<p.alertAt)assert.equal(p.x,p.originX);
    }
    assert.ok(forecourtPeople(250).every(p=>p.escaped));
});
