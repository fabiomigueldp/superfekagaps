import test from 'node:test';
import {DESTRUCTION_SITES,SCENIC_STARTS,scenicDistrict} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {ARRIVAL} from '../src/adventure/hipotetico/HypotheticalArrival';
import assert from 'node:assert/strict';
import { HYPOTHETICAL, HypotheticalModel, ARENA_COVER, type HypotheticalAttack } from '../src/adventure/hipotetico/HypotheticalModel';
import { hypotheticalStage } from '../src/adventure/hipotetico/HypotheticalStage';
import { SIEGE_SECTORS } from '../src/adventure/hipotetico/HypotheticalSiege';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import replay from './helpers/hypotheticalReplay.json';
import { hypotheticalChaseInputs } from './helpers/hypotheticalRoutes';
import { CHASE_TERRACES } from '../src/adventure/hipotetico/HypotheticalLayout';
import { dinosaurPose } from '../src/adventure/hipotetico/HypotheticalArt';
import { dinosaurFoot, dinosaurLeg, hypotheticalMotion, riderBend, riderTorsoPoint } from '../src/adventure/hipotetico/HypotheticalMotion';

const dt=HYPOTHETICAL.step,p={x:100,y:200,width:14,height:24};
function advance(b:HypotheticalModel,n:number,guards=0){for(let i=0;i<n;i++)b.update(dt,b.act==='siege'?{...p,x:SIEGE_SECTORS[0].trigger+4}:p,guards);}
function viewStreet(b:HypotheticalModel,tick:number){
    const district=scenicDistrict(tick);b.route.cleared=district;
    b.update(dt,{...p,x:district?SIEGE_SECTORS[district].origin+200:360},1);
}
function opening(b:HypotheticalModel){b.state='recover';b.age=14;const w=b.weakpoint;return [{x:w.x+5,y:w.y-23,width:14,height:24},{x:w.x+5,y:w.y-29,width:14,height:24}] as const;}

test('fixed steps produce the same target, animation and shot trajectories across frame partitions',()=>{
    for(const health of [9,3]){
        const a=new HypotheticalModel('duel',health),b=new HypotheticalModel('duel',health);
        advance(a,2400);for(let i=0;i<400;i++)b.update(100,p);
        assert.equal(a.tick,b.tick);assert.equal(a.state,b.state);assert.equal(a.age,b.age);assert.deepEqual(a.shots,b.shots);
        assert.equal(a.heat,b.heat);assert.equal(a.chainStep,b.chainStep);assert.equal(a.followup,b.followup);assert.equal(a.x,b.x);
        assert.deepEqual(a.impacts,b.impacts);
    }
});
test('a running Feka keeps the pursuer on camera, and every pursuit shot leaves the forward-facing barrel',()=>{
    const b=new HypotheticalModel('chase');let shot=false;
    for(let i=0;i<370;i++){
        b.update(dt,{...p,x:96+i*3.5});
        for(const s of b.shots)if(s.kind==='bullet'){shot=true;assert.ok(s.vx>0);}
    }
    const gap=96+369*3.5-b.x;
    assert.ok(gap>80&&gap<135,`camera pursuit gap ${gap}`);assert.equal(shot,true);
});
test('rifle aim commits for at least 24 ticks before firing and cannot follow a late dodge',()=>{
    const b=new HypotheticalModel('duel');advance(b,137);
    assert.equal(b.state,'tell');advance(b,b.warningTicks-24);
    const locked=[b.targetX,b.targetY];
    for(let i=0;i<24;i++)b.update(dt,{...p,x:260,y:130});
    assert.deepEqual([b.targetX,b.targetY],locked);assert.equal(b.shots.length,0);
    b.update(dt,p);assert.equal(b.shots.length,1);
    assert.equal(b.shots[0].x,b.aim.x);assert.equal(b.shots[0].y,b.aim.y);
});
test('cover consumes a swept bullet before it can hurt a player behind the column',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='rifle';b.age=5;
    const cover=ARENA_COVER[0];
    b.shots.push({x:cover.x+18,y:202,px:80,py:202,width:5,height:5,vx:-20,vy:0,age:0,life:100,kind:'bullet'});
    b.update(dt,p);assert.equal(b.shots.length,0);assert.equal(b.contact({...p,x:45},p,false),'none');
    assert.equal(b.impacts[0].x,cover.x+cover.width);assert.equal(b.impacts[0].nx,1);assert.equal(b.impacts[0].ny,0);
    assert.equal(b.contact({...p,x:78},p,false),'hurt','the short flight before the column is still dangerous');
});

test('a floor impact lands on its actual surface and cover does not stop a diagonal near miss',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='rifle';b.age=2;
    b.shots.push({x:120,y:210,px:120,py:210,width:5,height:5,vx:3,vy:12,age:0,life:100,kind:'bullet'});
    b.update(dt,p);assert.equal(b.shots.length,0);assert.equal(b.impacts[0].y,224);assert.equal(b.impacts[0].ny,-1);
    b.shots.push({x:80,y:175,px:80,py:175,width:5,height:5,vx:-30,vy:5,age:0,life:100,kind:'bullet'});
    b.update(dt,p);assert.equal(b.shots.length,1);assert.equal(b.impacts.length,1);
});
test('each recovery permits one top hit; body contact and an early jump cannot damage the saddle',()=>{
    const b=new HypotheticalModel('duel');const [hit,previous]=opening(b);
    assert.equal(b.contact(hit,previous,false),'none');assert.equal(b.health,9);
    assert.equal(b.contact(hit,previous,true),'hit');assert.equal(b.health,8);
    assert.equal(b.contact(hit,previous,true),'none');assert.equal(b.health,8);
});
test('all three duel phases have a committed attack, a fair opening and distinct schedules',()=>{
    const seen=new Set<HypotheticalAttack>();
    for(const health of [9,6,3]){
        const b=new HypotheticalModel('duel',health);let tells=0,openings=0,last=b.state;
        for(let i=0;i<2400;i++){
            b.update(dt,p);
            if(b.state==='tell'&&last!=='tell'){tells++;seen.add(b.attack);assert.ok(b.warningTicks>=44);}
            if(b.state==='recover'&&last!=='recover'){openings++;assert.equal(b.shots.length,0);}
            last=b.state;
        }
        assert.ok(tells>=5);assert.ok(openings>=4);
    }
    assert.deepEqual([...seen].sort(),['bite','charge','leap','rifle','tail']);
});
test('a late-phase charge announces its return and a cable interrupts it with an extended opening',()=>{
    const b=new HypotheticalModel('duel',3);b.state='attack';b.attack='charge';b.originX=b.x=244;b.facing=-1;
    advance(b,50);assert.equal(b.state,'turn');advance(b,37);assert.equal(b.state,'turn');
    b.update(dt,p);assert.equal(b.state,'attack');assert.equal(b.facing,1);
    b.arm(1);advance(b,43);assert.equal(b.state,'recover');assert.equal(b.snared,true);assert.equal(b.armed[1],0);
    assert.ok(b.openingTicks>HYPOTHETICAL.recovery);
});
test('takeoff and tick-zero animation changes do not invent contact damage',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='leap';b.targetX=120;
    const atFeet={x:240,y:200,width:14,height:24};
    assert.equal(b.contact(atFeet,atFeet,false),'none');b.update(dt,atFeet);assert.equal(b.contact(atFeet,atFeet,false),'none');
});
test('the tail is aimed toward Feka during its tell and danger never extends past its painted tip',()=>{
    const b=new HypotheticalModel('duel',6);b.cycle=3;b.state='rest';b.age=31;
    b.update(dt,p);assert.equal(b.attack,'tail');assert.equal(b.facing,1);
    assert.equal(b.tailBox.x,b.x-85);assert.equal(b.tailBox.x+b.tailBox.width,b.x-41);
    advance(b,b.warningTicks+14);
    assert.equal(b.contact({x:b.x-70,y:204,width:14,height:20},p,false),'hurt');
    assert.equal(b.contact({x:b.x-110,y:204,width:14,height:20},p,false),'none');
    // A player above the painted whip or next to the harmless pelvis is safe.
    assert.equal(b.contact({x:b.x-70,y:174,width:14,height:24},p,false),'none');
    assert.equal(b.contact({x:b.x-30,y:200,width:14,height:24},p,false),'none');
});

test('late rifle phases reload, reacquire, then lock for 24 frames before the second salvo',()=>{
    for(const health of [6,3]){
        const b=new HypotheticalModel('duel',health);b.state='rest';b.age=31;b.cycle=health===6?2:1;
        b.update(dt,p);assert.equal(b.attack,'rifle');
        let shots=0;
        for(let i=0;i<b.warningTicks+b.rifleLastShot+24;i++){b.update(dt,p);if(b.events.includes('shot'))shots++;}
        assert.equal(b.state,'reload');assert.equal(shots,health===3?9:6);assert.equal(b.vulnerable,false);
        const reloadStart=b.x;
        const across={...p,x:268,y:140};advance(b,8);b.update(dt,across);
        assert.equal(b.facing,1);assert.equal(b.targetX,275);assert.equal(b.targetY,152);
        while(b.age<24)b.update(dt,across);
        assert.ok(b.x<reloadStart,'he advances in the committed direction while reloading');
        const locked=[b.targetX,b.targetY,b.facing,b.x];
        for(let i=0;i<24;i++)b.update(dt,p);
        assert.deepEqual([b.targetX,b.targetY,b.facing,b.x],locked);assert.equal(b.state,'attack');
        for(let i=0;i<180&&b.state!=='recover'&&b.attack==='rifle';i++){b.update(dt,p);if(b.events.includes('shot'))shots++;}
        assert.equal(shots,health===3?18:12);assert.equal(b.state,health===3?'tell':'recover');assert.equal(b.shots.length,0);
        if(health===3)assert.equal(b.attack,'leap');
    }
});

test('the first rifle phase teaches two three-shot bursts and later bursts keep visible breathing gaps',()=>{
    const b=new HypotheticalModel('duel');advance(b,137+b.warningTicks);
    const fired:number[]=[];
    for(let i=0;i<150&&b.state!=='recover';i++){b.update(dt,p);if(b.events.includes('shot'))fired.push(b.age);}
    assert.deepEqual(fired,[1,7,13,37,43,49]);assert.equal(b.state,'recover');
    assert.ok(b.openingTicks>=156);assert.equal(b.shots.length,0);
});

test('a bite-tail combination has a full second tell and only exposes the rider after its finisher',()=>{
    const b=new HypotheticalModel('duel',6);b.state='rest';b.age=31;b.cycle=1;
    b.update(dt,p);assert.equal(b.attack,'bite');assert.equal(b.followup,'tail');assert.equal(b.chainLength,2);
    advance(b,b.warningTicks+51);
    assert.equal(b.state,'tell');assert.equal(b.attack,'tail');assert.equal(b.chainStep,1);assert.equal(b.vulnerable,false);
    const weak=b.weakpoint,hit={x:weak.x+5,y:weak.y-20,width:14,height:24},above={...hit,y:weak.y-30};
    assert.equal(b.contact(hit,above,true),'none');assert.equal(b.health,6);
    advance(b,b.warningTicks-1);assert.equal(b.state,'tell');assert.equal(b.contact(hit,above,true),'none');
    b.update(dt,p);assert.equal(b.state,'attack');advance(b,87);assert.equal(b.state,'recover');
    advance(b,14);assert.equal(b.vulnerable,true);assert.ok(b.openingTicks>=156);
});

test('the last-phase tail-bite finisher reacquires early but cannot chase a late side change',()=>{
    const b=new HypotheticalModel('duel',3);b.state='rest';b.age=31;b.cycle=2;b.update(dt,p);
    assert.equal(b.followup,'bite');advance(b,b.warningTicks+87);assert.equal(b.attack,'bite');assert.equal(b.state,'tell');
    const across={...p,x:280};b.update(dt,across);assert.equal(b.facing,1);
    while(b.age<b.warningTicks-24)b.update(dt,across);
    const locked=[b.targetX,b.targetY,b.facing];
    for(let i=0;i<24;i++)b.update(dt,p);
    assert.deepEqual([b.targetX,b.targetY,b.facing],locked);
    advance(b,51);assert.equal(b.state,'recover');assert.equal(b.followup,null);
});

test('retreating far from a bite triggers a telegraphed leap instead of a harmless distant tail swing',()=>{
    const b=new HypotheticalModel('duel',6);b.state='rest';b.age=31;b.cycle=1;b.update(dt,p);
    advance(b,b.warningTicks+50);const before=b.x;
    b.update(dt,{...p,x:290});assert.equal(b.attack,'leap');assert.equal(b.state,'tell');assert.equal(b.age,0);
    assert.equal(b.x,before);assert.equal(b.targetX,284);assert.equal(b.vulnerable,false);
    advance(b,b.warningTicks-1);assert.equal(b.y,HYPOTHETICAL.floor);assert.equal(b.state,'tell');
});

test('phase transitions restart their teaching attack instead of carrying an unrelated pattern index',()=>{
    for(const [health,attack]of [[7,'leap'],[4,'charge']]as const){
        const b=new HypotheticalModel('duel',health);b.cycle=99;const [hit,previous]=opening(b);
        b.contact(hit,previous,true);assert.equal(b.cycle,0);advance(b,50+105+32);
        assert.equal(b.state,'tell');assert.equal(b.attack,attack);
    }
});

test('a rifle-to-leap handoff clears residual bullets and gives a complete readable landing warning',()=>{
    const b=new HypotheticalModel('duel',3);b.state='rest';b.age=31;b.cycle=1;b.update(dt,p);
    const end=b.rifleLastShot+70;
    for(let i=0;i<600&&!((b.state as string)==='attack'&&b.volley===1&&b.age===end-1);i++)b.update(dt,p);
    assert.equal(b.state,'attack');assert.equal(b.volley,1);assert.equal(b.age,end-1);
    b.shots.push({x:100,y:200,px:100,py:200,width:5,height:5,vx:0,vy:0,age:0,life:100,kind:'bullet'});
    b.update(dt,p);assert.equal(b.state,'tell');assert.equal(b.attack,'leap');assert.equal(b.shots.length,0);
    assert.equal(b.contact(p,p,false),'none');assert.equal(b.age,0);assert.ok(b.warningTicks>=44);
    advance(b,b.warningTicks+114);assert.equal(b.state,'tell');assert.equal(b.attack,'bite');assert.equal(b.chainStep,2);assert.equal(b.chainLength,3);
    assert.equal(b.shots.length,0);assert.equal(b.contact(p,p,false),'none');assert.equal(b.vulnerable,false);
    advance(b,b.warningTicks+51);assert.equal(b.state,'recover');assert.equal(b.health,3);
});

test('the second phase teaches landing waves then a fully announced rifle attack before exposing the rider',()=>{
    const b=new HypotheticalModel('duel',6);advance(b,137);assert.equal(b.attack,'leap');assert.equal(b.chainLength,2);
    advance(b,b.warningTicks+114);assert.equal(b.attack,'rifle');assert.equal(b.state,'tell');assert.equal(b.chainStep,1);
    assert.equal(b.shots.length,0);assert.equal(b.vulnerable,false);assert.match(b.hint,/^2\/2:/);
    const tell=b.warningTicks;advance(b,tell-1);assert.equal(b.state,'tell');assert.equal(b.shots.length,0);
    advance(b,1);let shots=0;
    for(let i=0;i<400&&(b.state as string)!=='recover';i++){b.update(dt,p);if(b.events.includes('shot'))shots++;}
    assert.equal(shots,12);assert.equal(b.state,'recover');advance(b,14);assert.equal(b.vulnerable,true);
});

test('the three-part finisher changes with distance, commits its target, and a cable can stop the final charge',()=>{
    for(const near of [true,false]){
        const b=new HypotheticalModel('duel',3);b.state='rest';b.age=31;b.cycle=1;b.update(dt,p);
        for(let i=0;i<700&&!(b.attack==='leap'&&(b.state as HypotheticalModel['state'])==='attack'&&b.age===113);i++)b.update(dt,p);
        assert.equal(b.attack,'leap');assert.equal(b.age,113);
        const player={...p,x:near?b.x+30:290};b.update(dt,player);
        assert.equal(b.attack,near?'bite':'charge');assert.equal(b.state,'tell');assert.equal(b.chainStep,2);
        assert.equal(b.chainLength,3);assert.match(b.hint,/^3\/3:/);assert.equal(b.shots.length,0);assert.equal(b.followup,null);
        advance(b,b.warningTicks-1);assert.equal(b.state,'tell');assert.equal(b.vulnerable,false);
        const target=[b.targetX,b.targetY,b.facing];b.update(dt,{...p,x:5,y:80});assert.deepEqual([b.targetX,b.targetY,b.facing],target);
        if(!near){b.arm(1);for(let i=0;i<100&&(b.state as string)!=='recover';i++)b.update(dt,p);assert.equal(b.snared,true);assert.equal(b.state,'recover');assert.equal(b.followup,null);}
    }
});

test('crossing behind the rifle during its tracking tell turns the visible gun; bullets leave its exact muzzle',()=>{
    const b=new HypotheticalModel('duel');b.state='rest';b.age=31;b.update(dt,p);
    b.update(dt,{...p,x:274});assert.equal(b.facing,1);
    while((b.state as string)!=='attack')b.update(dt,{...p,x:274});b.update(dt,p);
    const pose=dinosaurPose(b,0,0),shoulderY=b.y-64+pose.bow*39+pose.compression+(pose.riderDrop??0)-14;
    const gunX=b.x+b.facing*(7-pose.recoil+riderBend(14,pose.riderLean??0)+31*Math.cos(pose.aim)),gunY=shoulderY+31*Math.sin(pose.aim);
    const s=b.shots[0];assert.ok(s.vx>0);assert.ok(Math.abs(s.x-gunX)<1e-8);assert.ok(Math.abs(s.y-gunY)<1e-8);
});

test('running rider inertia does not detach a shot from the visible barrel',()=>{
    const b=new HypotheticalModel('chase');let checks=0;
    for(let i=0;i<1250;i++){
        b.update(dt,{...p,x:96+i*3.5});if(!b.events.includes('shot'))continue;
        const pose=dinosaurPose(b,0,0),s=b.shots[b.shots.length-1];
        const x=b.x+b.facing*(7-pose.recoil+pose.tuck*10+riderBend(14,pose.riderLean??0)+31*Math.cos(pose.aim));
        const y=b.y-64+pose.bow*39+pose.compression+(pose.riderDrop??0)-14+31*Math.sin(pose.aim);
        assert.ok(Math.abs(x-s.x)<1e-8&&Math.abs(y-s.y)<1e-8);assert.ok((pose.riderLean??0)>1);checks++;
    }
    assert.ok(checks>=18);
});

test('anticipation survives the exact takeoff frame and the rider absorbs braking without changing collision',()=>{
    for(const attack of ['leap','charge'] as const){
        const b=new HypotheticalModel('duel');b.attack=attack;b.state='tell';b.age=b.warningTicks-1;
        const before=hypotheticalMotion(b);b.update(dt,p);const after=hypotheticalMotion(b);
        assert.equal(b.state,'attack');assert.ok(Math.abs(before.compression-after.compression)<.04);
        assert.ok(Math.abs(before.riderDrop-after.riderDrop)<.05);
        if(attack==='leap'){assert.equal(b.y,224);b.update(dt,p);assert.ok(hypotheticalMotion(b).compression>5);}
    }
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='charge';b.x=b.originX=244;b.facing=-1;
    let greatest=0;
    for(let i=0;i<48;i++){b.update(dt,p);greatest=Math.max(greatest,hypotheticalMotion(b).riderLean);}
    assert.ok(greatest>3);assert.equal(b.body.height,46);
});

test('a planted turn passes through its front pose, keeps its ground position and finishes before charging back',()=>{
    const b=new HypotheticalModel('duel',3);b.state='attack';b.attack='charge';b.originX=b.x=244;b.facing=-1;
    advance(b,50);const x=b.x;let front=false;
    for(let i=0;i<38;i++){
        b.update(dt,p);assert.equal(b.x,x);front||=b.pivot>.95;
        if((b.state as HypotheticalModel['state'])==='turn')assert.equal(b.contact({...p,x:b.x-7},p,false),'none');
    }
    assert.equal(front,true);assert.equal(b.pivotAge,12);assert.equal(b.visualFacing,1);assert.equal(b.state,'attack');assert.equal(b.age,0);
});

test('a successful stomp preserves the bowed rider height and recovery stands up without teleporting',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='bite';b.age=50;
    b.update(dt,p);assert.equal(b.state,'recover');assert.equal(b.bow,0);
    advance(b,14);const before=dinosaurPose(b,0,0),[hit,previous]=opening(b);
    b.contact(hit,previous,true);assert.equal(dinosaurPose(b,0,0).bow,before.bow);
    let last=b.bow;
    for(let i=0;i<90;i++){b.update(dt,p);assert.ok(Math.abs(last-b.bow)<=.11);last=b.bow;}
    assert.equal(b.bow,0);
});

test('the running foot has a planted stance and a leaping dinosaur tucks both legs instead of running in air',()=>{
    for(let i=0;i<=6;i++)assert.ok(Math.abs(dinosaurFoot(i/10*Math.PI*2,0,1,0)[1])<1e-8);
    assert.ok(dinosaurFoot(.8*Math.PI*2,0,1,0)[1]<-8);
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='leap';b.age=29;
    const m=hypotheticalMotion(b);assert.equal(m.stride,0);assert.ok(m.tuck>.99);
    for(const side of [0,.5])assert.ok(dinosaurFoot(4,side,m.stride,m.tuck)[1]<-17);
    b.age=58;assert.ok(hypotheticalMotion(b).compression>=7);
});

test('a foot in its planted stance counteracts the exact ground distance in both facing directions',()=>{
    for(const facing of [-1,1]){
        const start=100+facing*dinosaurFoot(.4,0,1,0)[0];
        for(let travel=1;travel<27;travel++){
            const foot=100+facing*travel+facing*dinosaurFoot(.4+travel/11,0,1,0)[0];
            assert.ok(Math.abs(foot-start)<1e-8,`sliding planted foot: ${foot-start}`);
        }
    }
});

test('crouching and recoil keep the waist seated while preserving both arm roots',()=>{
    let crouches=0,recoils=0;
    for(const attack of ['charge','leap','rifle'] as const){
        const b=new HypotheticalModel('duel',3);b.attack=attack;b.state='tell';
        for(let i=0;i<250;i++){
            b.update(dt,p);const m=hypotheticalMotion(b),rider=m.saddle+m.riderDrop,shift=m.recoil-m.tuck*10;
            const waist=riderTorsoPoint([-5-shift,rider],rider,m.riderDrop,shift,m.riderLean);
            assert.ok(Math.abs(waist[0]+5)<1e-8&&Math.abs(waist[1]-m.saddle)<1e-8,'waist slipped through the saddle');
            for(const shoulderX of [-8,6]){
                const shoulder=riderTorsoPoint([shoulderX-shift,rider-20],rider,m.riderDrop,shift,m.riderLean);
                assert.ok(Math.abs(shoulder[0]-(shoulderX-shift+riderBend(20,m.riderLean)))<1e-8);
                assert.equal(shoulder[1],rider-20,'upper arm detached from its coat shoulder');
            }
            const chest=riderTorsoPoint([-shift,rider-10],rider,m.riderDrop,shift,m.riderLean);
            assert.ok(chest[1]<waist[1]&&chest[1]>rider-20,'crouching inverted the torso');
            crouches+=m.riderDrop>10?1:0;recoils+=m.recoil>2?1:0;
        }
    }
    assert.ok(crouches>20&&recoils>10,'exercise actual leap and rifle animations');
});

test('running footfall dust lands under the contacting sole in both charge directions',()=>{
    for(const facing of [-1,1] as const){
        const b=new HypotheticalModel('duel',3);b.state='attack';b.attack='charge';
        b.facing=facing;b.x=b.originX=facing<0?244:74;
        let contacts=0;
        for(let i=0;i<49;i++){
            b.update(dt,p);if(!b.events.includes('step'))continue;
            const pose=dinosaurPose(b,0,0),body=-43+pose.bow*13+pose.breath+pose.compression;
            const footfalls=b.dust.filter(d=>d.kind==='step'&&d.born===b.tick);
            assert.equal(footfalls.length,1);const dust=footfalls[0];
            const soles=[false,true].map(rear=>dinosaurLeg(body,pose.gait,rear,(1-pose.bow)*pose.stride,pose.tuck,pose.brace).foot);
            assert.ok(soles.some(foot=>Math.abs(b.x+facing*(foot[0]+3)-dust.x)<.001&&Math.abs(b.y+foot[1]-dust.y)<.001),'dust detached from both feet');
            assert.equal(dust.y,HYPOTHETICAL.floor,'ground dust emitted in mid-air');contacts++;
        }
        assert.ok(contacts>=4,'exercise alternating footsteps across acceleration and braking');
    }
});

test('thigh and shin keep their lengths through running, jumping, landing and recovery poses',()=>{
    for(const attack of ['charge','leap','bite','rifle','tail'] as const){
        const b=new HypotheticalModel('duel');b.state='tell';b.attack=attack;
        for(let i=0;i<250;i++){
            b.update(dt,p);const pose=dinosaurPose(b,0,0);
            const body=-43+pose.bow*13+pose.breath+pose.compression;
            for(const rear of [true,false]){
                const leg=dinosaurLeg(body,pose.gait,rear,(1-pose.bow)*pose.stride,pose.tuck,pose.brace);
                const distance=(a:readonly number[],z:readonly number[])=>Math.hypot(z[0]-a[0],z[1]-a[1]);
                assert.ok(Math.abs(distance(leg.hip,leg.knee)-20)<.00001,`${attack}: thigh stretched`);
                assert.ok(Math.abs(distance(leg.knee,leg.hock)-22)<.00001,`${attack}: shin stretched`);
                assert.ok(leg.foot[1]<=.00001,'foot sinks through the floor');
            }
        }
    }
});

test('secondary sprite motion preserves tail strike geometry and respects reduced motion',()=>{
    const b=new HypotheticalModel('duel');b.state='tell';b.attack='tail';b.tick=137;
    for(let i=0;i<160;i++){
        const before=JSON.stringify(b),pose=dinosaurPose(b,0,0),reduced=dinosaurPose(b,0,0,true);
        assert.equal(JSON.stringify(b),before);
        assert.equal(reduced.cloth,0);assert.equal(reduced.breath,0);assert.equal(reduced.eyeClose,0);
        assert.equal(reduced.tail,hypotheticalMotion(b).tail);
        if(['tell','attack'].includes(b.state))assert.equal(pose.tail,hypotheticalMotion(b).tail);
        b.update(dt,p);
    }
});

test('a bite reaches Feka at ground height while the open jaws never damage the empty space underneath',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='bite';b.facing=1;b.x=b.originX=120;b.targetX=157;
    advance(b,20);
    assert.equal(b.contact({x:171,y:200,width:14,height:24},p,false),'hurt');
    assert.equal(b.contact({x:171,y:b.biteBox.y+b.biteBox.height+1,width:4,height:5},p,false),'none');
    b.age=37;b.update(dt,p);assert.ok(b.biteBox.y+b.biteBox.height<200);
    assert.equal(b.contact({x:171,y:200,width:14,height:24},p,false),'none');
});

test('the entire leaping rider remains below the 31px HUD while the ground landing mark stays visible',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='leap';b.targetX=160;
    for(let i=0;i<58;i++){
        b.update(dt,p);const pose=dinosaurPose(b,0,64);
        const headTop=pose.y-64+pose.bow*39+pose.compression+(pose.riderDrop??0)-42;
        assert.ok(headTop>=32,`head hidden by HUD at ${b.age}: ${headTop}`);
        assert.ok(HYPOTHETICAL.floor-64<180);
    }
});
test('landing waves have real danger and are removed when the rider exposes the weak point',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='leap';b.targetX=160;b.originX=244;
    advance(b,58);assert.equal(b.shots.length,2);assert.ok(b.events.includes('slam'));
    const s=b.shots[0];b.update(dt,p);assert.equal(b.contact({x:s.x,y:s.y,width:14,height:24},p,false),'hurt');
    advance(b,56);assert.equal(b.state,'recover');assert.equal(b.shots.length,0);
});
test('the garrison must be defeated before its gate opens, and rubble has a full second of warning',()=>{
    const b=new HypotheticalModel('siege');advance(b,ARRIVAL.release+210,2);assert.equal(b.wave,1);assert.equal(b.nextAct,false);
    assert.equal(b.route.cleared,0);assert.equal(b.route.gateHeight(0),224);
    while((b.tick-ARRIVAL.release)%210!==0)advance(b,1,2);
    assert.equal(b.marks[0].born,b.tick);
    advance(b,59,2);assert.equal(b.shots.filter(s=>s.kind==='rubble').length,0);
    advance(b,1,2);assert.equal(b.shots.filter(s=>s.kind==='rubble').length,1);
    advance(b,110);assert.equal(b.route.cleared,1);assert.equal(b.route.gateHeight(0),0);
    assert.equal(b.route.active,false);assert.equal(b.nextAct,false);
});

test('every tall launcher has a platform, and background destruction travels through the district',()=>{
    const stage=hypotheticalStage('siege');
    for(const loader of stage.foes.filter(f=>f.kind==='loader'))
        assert.ok(stage.mechanisms.some(s=>s.kind==='support'&&loader.x>=s.x&&loader.x+22<=s.x+s.width&&loader.y===s.y));
    const b=new HypotheticalModel('siege');let breaks=0;
    for(let i=1;i<=2000;i++){viewStreet(b,i);if(b.events.includes('break')){breaks++;assert.ok(b.backgroundX+70>=DESTRUCTION_SITES[b.destroyed-1].x);}}
    assert.equal(breaks,DESTRUCTION_SITES.length);
    assert.ok(SCENIC_STARTS.every((start,i)=>b.backdrop.breaches[i?i+1:0]>=start));
});

test('street reactions follow visible bullets and distant shots never enter the foreground collision layer',()=>{
    const b=new HypotheticalModel('siege');let shots=0,deaths=0;
    for(let i=1;i<=2000;i++){
        const previous=b.casualties;viewStreet(b,i);
        if(b.events.includes('distant-shot')){
            shots++;const s=b.backdrop.shots[b.backdrop.shots.length-1],m=b.backdrop.barrel;
            assert.ok(Math.abs(s.x-m.x)<1e-8&&Math.abs(s.y-m.y)<1e-8);assert.ok(s.vx>0);
        }
        if(b.casualties>previous){assert.ok(b.events.includes('distant-hit'));assert.ok(shots>0);deaths++;}
        // Rubble can hurt Feka, but distant bullets are never registered as foreground shots.
        assert.ok(b.shots.every(s=>s.kind==='rubble'));
    }
    assert.equal(deaths,b.casualties);assert.ok(deaths>=10);assert.equal(shots,32);
    // The survivors now flee when the rider approaches their district, rather than
    // disappearing at the far end before that part of the street comes into view.
    assert.ok(b.backdrop.people.filter(p=>p.escaped).length>=10);
    const deathTimes=b.backdrop.people.filter(p=>p.hitAt!==null).map(p=>p.hitAt!);
    assert.equal(new Set(deathTimes).size,b.casualties,'individual falls rather than an instantaneous casualty counter');
    b.cancelAttacks();assert.equal(b.backdrop.shots.length,0);assert.equal(b.backdrop.muzzle,0);
});

test('background animation and impact cleanup are deterministic across frame partitions',()=>{
    const a=new HypotheticalModel('siege'),b=new HypotheticalModel('siege');
    for(let i=0;i<1800;i++)a.update(dt,{...p,x:360},1);
    for(let i=0;i<900;i++)b.update(dt*2,{...p,x:360},1);
    assert.deepEqual(a.backdrop,b.backdrop);
    const c=new HypotheticalModel('duel');c.impacts.push({x:60,y:200,nx:1,ny:0,born:0});
    c.state='won';advance(c,181);assert.equal(c.impacts.length,0);
});
test('invalid time, cancellation and victory cannot leak active hazards',()=>{
    const b=new HypotheticalModel('duel');for(const time of [NaN,Infinity,-1,0])b.update(time,p);assert.equal(b.tick,0);
    advance(b,200);b.cancelAttacks();assert.equal(b.shots.length,0);assert.equal(b.contact(p,p,false),'none');
    b.health=1;const [hit,old]=opening(b);b.contact(hit,old,true);assert.equal(b.won,true);
    advance(b,100);assert.equal(b.shots.length,0);assert.equal(b.contact(p,p,false),'none');
});
test('native pause freezes the whole encounter and repeated painting never changes simulation',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    advance(g.fight,150);
    const snapshot=()=>JSON.stringify({model:g.fight,objects:g.objects.time,p:g.player.data});
    const before=snapshot();g.render();g.render();assert.equal(snapshot(),before);
    h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');assert.equal(g.state,'paused');
    const frozen=snapshot();for(let i=0;i<120;i++){g.update(dt);g.render();}assert.equal(snapshot(),frozen);
    g.dispose();const listeners=h.listenerCount();h.key('keydown','r');assert.equal(h.listenerCount(),listeners);
});
test('native sentada activates an encounter cable, with no global player changes',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    g.act='duel';g.load('hipotetico-duel',true);
    // Native WorldObjects records the same event that an actual ground pound emits.
    assert.equal(g.objects.pound(38,224),true);
    g.boss!.update(dt,g.player.getRect(),g.objects,g.level);assert.ok(g.fight.armed[0]>0);
    assert.equal(g.fight.armed[1],0);
});
test('standing still in the chase loses the helmet and then dies; destroyed bridge tiles have no phantom collision',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    let helmetLost=false,collapsed=false;
    for(let i=0;i<370;i++){
        g.update(dt);helmetLost||=!g.player.data.hasHelmet;
        collapsed||=g.level.data.tiles[14][0]===0;
    }
    assert.equal(helmetLost,true);assert.ok(g.receipt.deaths>=1);assert.equal(collapsed,true);
});
for(const route of ['upper','lower'] as const)test(`the ${route} chase route reaches the courtyard and leaves no floating terrace collision`,t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    let held=new Set<string>(),landedOnTerrace=false,reward=false,coins=0,collapsed=false,highest=180;
    routeRun:for(const [frames,keys] of hypotheticalChaseInputs(route)){
        const next=new Set(keys);
        for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
        for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
        held=next;
        for(let i=0;i<frames;i++){
            g.update(dt);if(g.act!=='chase')break routeRun;
            assert.equal(g.player.data.isDead,false,'the chosen route must be survivable without a retry');
            const p=g.player.getRect();highest=Math.min(highest,p.y-g.camera.y-4);
            landedOnTerrace ||= g.player.data.isGrounded&&CHASE_TERRACES.slice(0,3).some(t=>Math.abs(p.y+p.height-t.y)<.1&&p.x<t.x+t.width&&p.x+p.width>t.x);
            // Read the native pickup receipt; the route never moves or equips the player directly.
            const collected=Reflect.get(g,'collected') as Set<string>;
            reward ||= collected.has('hipotetico:run:helmet');
            coins=Math.max(coins,[...collected].filter(id=>/^hipotetico:terrace:[0-3]$/.test(id)).length);
            if(g.fight.x>1100){
                const collapsedEdge=Math.floor((g.fight.x-32)/16)*16;
                assert.equal(g.objects.bodies.some(p=>p.id.startsWith('chase-terrace-')&&p.x<collapsedEdge),false);
                assert.equal(g.level.bodies.some(p=>p.id.startsWith('chase-terrace-')&&p.x<collapsedEdge),false);
                collapsed=true;
            }
        }
    }
    assert.equal(g.act,'siege');assert.equal(g.receipt.deaths,0);assert.ok(collapsed);
    assert.equal(landedOnTerrace,route==='upper');assert.equal(reward,route==='upper');
    // The first breadcrumb may be reached from below; the helmet and most coins reward the upper road.
    assert.ok(route==='upper'?coins>=3:coins<=1,`optional route coins: ${coins}`);
    assert.ok(highest>=31,`helmet clipped into HUD at ${highest}`);g.dispose();
});

test('a full jump from the upper balcony keeps the helmet below the encounter HUD',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    g.act='duel';g.load('hipotetico-duel',true);
    // A grounded setup on the authored upper balcony, followed by actual Player physics.
    g.player.data.position={x:242,y:144};g.player.data.isGrounded=true;h.key('keydown',' ');
    let highest=180;
    for(let i=0;i<40;i++){g.update(dt);highest=Math.min(highest,g.player.data.position.y-g.camera.y-4);}
    assert.ok(highest>=31,`visible helmet top ${highest}`);
});
test('recorded native inputs complete all acts, survive a checkpoint retry and earn victory without campaign writes',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    const acts=new Set([g.act]),phases=new Set<number>(),attacks=new Set<string>(),finishers=new Set<string>(),thirdAttacks=new Set<string>();
    let held=new Set<string>(),lastPlayer=g.player;
    for(const [frames,keys] of replay.runs as [number,string[]][]){
        // The tape includes releases after scene transitions, just as the real keyboard does.
        const next=new Set(keys);
        for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
        for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
        held=next;
        for(let i=0;i<frames;i++){
            g.update(dt);acts.add(g.act);if(g.act==='duel'){
                phases.add(g.fight.phaseNumber);attacks.add(g.fight.attack);
                if(g.fight.chaining&&g.fight.chainStep===1)finishers.add(g.fight.attack);
                if(g.fight.chaining&&g.fight.chainStep===2)thirdAttacks.add(g.fight.attack);
            }
            if(g.player!==lastPlayer){held=new Set();lastPlayer=g.player;}
        }
    }
    assert.deepEqual([...acts],['chase','siege','duel']);assert.deepEqual([...phases],[1,2,3]);assert.equal(attacks.size,5);
    assert.equal(g.fight.won,true);assert.equal(g.receipt.deaths,replay.receipt.deaths);assert.equal(g.fight.health,0);
    assert.deepEqual([...finishers].sort(),['bite','leap','rifle','tail']);assert.ok(thirdAttacks.has('charge'));
    assert.equal(g.resultReady,false);const receipt=g.receipt;
    // The final bounce can still be in progress. A fresh jump must not hide the defeat reaction.
    h.key('keydown',' ');g.update(dt);h.key('keyup',' ');assert.equal(g.fight.won,true);
    for(let i=0;i<150;i++)g.update(dt);
    assert.equal(g.resultReady,true);assert.deepEqual(g.receipt,receipt);assert.equal(g.fight.dust.length,0);
    assert.deepEqual(g.store.save.completed,[]);
    h.key('keydown','Enter');assert.equal(g.act,'chase');assert.equal(g.fight.health,9);assert.equal(g.fight.won,false);
});
