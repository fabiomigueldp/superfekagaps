import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalModel } from '../src/adventure/hipotetico/HypotheticalModel';
import { HypotheticalBackdrop, BACKDROP_RIG, backdropBaseline } from '../src/adventure/hipotetico/HypotheticalBackdrop';
import { distantRiderPose, drawHypotheticalBackground } from '../src/adventure/hipotetico/HypotheticalArt';
import { devastationAt, ARRIVAL_RAM, ARRIVAL_BITE, SCENIC_STARTS, DESTRUCTION_SITES, ruinAge, rubbleApproach } from '../src/adventure/hipotetico/HypotheticalDevastation';
import {ARRIVAL} from '../src/adventure/hipotetico/HypotheticalArrival';
import { bystanderPose } from '../src/adventure/hipotetico/HypotheticalBystanders';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { riderBend } from '../src/adventure/hipotetico/HypotheticalMotion';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
const dt=1000/60,p={x:360,y:200,width:14,height:24};

test('each destruction site has a prepared contact, exactly one collapse, and persistent ruins',()=>{
    const b=new HypotheticalModel('siege'),hits:number[]=[];
    for(let n=1;n<=1800;n++){
        b.update(dt,p,2);
        if(b.events.includes('break')){
            hits.push(n);const index=hits.length-1,site=DESTRUCTION_SITES[index];
            assert.equal(b.backdrop.motion.phase,'contact');assert.equal(ruinAge(b.backdrop.breaches,index,n),0);
            assert.ok(b.backgroundX+70*BACKDROP_RIG.scale>=site.x);
            assert.equal(b.destroyed,hits.length);
        }
        if(n===ARRIVAL_RAM.impact-1)assert.equal(b.destroyed,0);
    }
    assert.deepEqual(hits,[ARRIVAL_RAM.impact,ARRIVAL_BITE.impact,980,1380]);assert.equal(b.destroyed,4);assert.equal(b.backdrop.shots.length,0);
    assert.equal(ruinAge(b.backdrop.breaches,3,1800),420);
    for(const cleared of [1,2]){
        const resumed=new HypotheticalModel('siege',9,cleared);
        assert.equal(resumed.destroyed,cleared+1);assert.equal(resumed.backdrop.tick,SCENIC_STARTS[cleared]);
        assert.deepEqual(resumed.events,[]);assert.ok(resumed.backdrop.casualties>=cleared*2);
    }
});

test('movement stays continuous across the contact hold and district seams; actions have distinct poses',()=>{
    let prior=devastationAt(0);
    for(let tick=1;tick<=1800;tick++){
        const pose=devastationAt(tick);assert.ok(Math.abs(pose.x-prior.x)<4.4);assert.ok(Math.abs(pose.lift-prior.lift)<2);
        assert.ok(Math.abs(pose.neckDrop-prior.neckDrop)<4);assert.ok(Math.abs(pose.riderLean-prior.riderLean)<2);
        if(tick>=ARRIVAL_RAM.impact&&tick<=ARRIVAL_RAM.hold)assert.equal(pose.x,178);
        prior=pose;
    }
    assert.equal(devastationAt(214).phase,'prepare');assert.equal(devastationAt(238).phase,'strike');
    assert.ok(devastationAt(518).jaw>devastationAt(238).jaw);
    assert.ok(devastationAt(1370).lift<-8);assert.equal(devastationAt(1380).lift,0);
});

test('every visible distant shot originates at the articulated rifle, including body compression and rider lean',()=>{
    const b=new HypotheticalBackdrop(true);let shots=0;
    for(let tick=1;tick<=1800;tick++){
        b.update(tick);if(!b.events.includes('distant-shot'))continue;shots++;
        const pose=distantRiderPose(b),s=BACKDROP_RIG.scale,rx=7-pose.recoil+pose.tuck*10+riderBend(14,pose.riderLean??0);
        const ry=-64+pose.compression+(pose.riderDrop??0)-14;
        const muzzle={x:b.x+(rx+31*Math.cos(pose.aim))*s,y:(pose.y-BACKDROP_RIG.y+ry+31*Math.sin(pose.aim))*s};
        const shot=b.shots[b.shots.length-1];assert.ok(Math.hypot(shot.x-muzzle.x,shot.y-muzzle.y)<1e-7);
    }
    assert.equal(shots,26);assert.equal(b.casualties,10);assert.equal(b.people.filter(p=>p.escaped).length,12);
});

test('arrival lets the final bullet land before the ram and leaves a readable aftermath before guards emerge',()=>{
    const b=new HypotheticalBackdrop(true);let lastShot=0,lastImpact=0,contact=0;
    const debris:number[]=[],contacts:number[]=[];
    for(let tick=1;tick<ARRIVAL.deployment;tick++){
        b.update(tick);
        if(b.events.includes('distant-shot'))lastShot=tick;
        if(b.events.includes('distant-hit'))lastImpact=tick;
        if(b.events.includes('break')){contact=tick;contacts.push(tick);assert.ok(contact-lastShot>=50);assert.ok(contact-lastImpact>=30);}
        if(b.events.includes('distant-debris'))debris.push(tick);
        if(b.motion.phase==='strike'||b.motion.phase==='contact'){
            assert.equal(b.shots.length,0,'the ram is not obscured by the previous volley');
            assert.equal(b.muzzle,0);
        }
        if(b.motion.lookBack>.8){assert.ok(contact>0);assert.equal(b.muzzle,0);}
    }
    assert.ok(contact-lastShot>=50);assert.ok(contact-lastImpact>=30);
    assert.ok(ARRIVAL.deployment-contact>=90,'let settling debris and the look back finish before opening the guard posts');
    assert.equal(debris.length,4);assert.deepEqual(debris,contacts.flatMap(t=>[t+18,t+34]));
});

test('distant rider remains below the HUD through every attack and courtyard falls clear the near scaffold',()=>{
    const b=new HypotheticalBackdrop(true);
    for(let tick=1;tick<=1800;tick++){
        b.update(tick);const pose=distantRiderPose(b),s=BACKDROP_RIG.scale;
        for(const cy of [0,32,64]){
            const head=backdropBaseline(cy)+(pose.y-BACKDROP_RIG.y-106+pose.compression+(pose.riderDrop??0))*s;
            assert.ok(head>=32,`background head behind HUD at tick ${tick}`);
        }
    }
    // The nearest scaffold is at world y=188; even a three-pixel fallen silhouette
    // must fit above its top at the ordinary camera, where the opening is viewed.
    assert.ok(backdropBaseline(64)+3<188-64);
});

test('civilians wait for their local alert, walk by real distance, and keep stopped poses stable',()=>{
    const b=new HypotheticalBackdrop(true),initial=b.people[4].x;
    for(let tick=1;tick<=400;tick++)b.update(tick);
    assert.equal(b.people[4].x,initial);assert.equal(b.people[4].distance,0);
    const person=b.people[0],pose=bystanderPose(person,400);assert.ok(person.hitAt!==null);
    assert.equal(pose.running,false);
    const waiting=b.people[4];assert.deepEqual(bystanderPose(waiting,400),bystanderPose(waiting,450));
});

test('scenic rubble reaches the native projectile after the full ground warning, without an extra collision',()=>{
    const b=new HypotheticalModel('siege');for(let n=0;n<ARRIVAL.release+210;n++)b.update(dt,p,2);
    assert.equal(b.marks.length,1);const mark={...b.marks[0]},site=DESTRUCTION_SITES[0];
    for(let n=0;n<59;n++)b.update(dt,p,2);assert.equal(b.shots.length,0);
    b.update(dt,p,2);const stone=b.shots[0],point=rubbleApproach(site.x+site.width/2,mark.x,60);
    assert.equal(stone.kind,'rubble');assert.equal(stone.age,0);assert.equal(point.x,stone.x+stone.width/2);assert.equal(point.y,stone.y+stone.height/2);
    assert.ok(b.shots.every(s=>s.kind==='rubble'));
    for(const cy of [0,24,64]){
        const floor=backdropBaseline(cy),end=rubbleApproach(site.x+site.width/2,mark.x,60,floor+cy);
        assert.equal(end.y-cy,stone.y+stone.height/2-cy);
        assert.ok(floor<131&&floor>=116,'the rear street stays above the foreground garrison doorways');
    }
});

test('destruction, people and scenic effects are read-only in both motion modes and freeze on native pause',t=>{
    const h=sceneLifecycleBrowser(t),b=new HypotheticalModel('siege');
    for(let tick=1;tick<=1460;tick++){
        b.update(dt,p,2);if(![214,244,260,286,308,494,526,540,596,980,1380,1460].includes(tick))continue;
        const before=JSON.stringify(b);
        for(const reduced of [false,true])drawHypotheticalBackground(h.canvas.getContext(),b,Math.max(0,b.backgroundX-110),64,reduced);
        assert.equal(JSON.stringify(b),before);
    }
    const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);g.act='siege';g.load('hipotetico-siege',true);
    for(let n=0;n<190;n++)g.fight.update(dt,p,2);
    h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');assert.equal(g.state,'paused');
    const before=JSON.stringify(g.fight);for(let n=0;n<60;n++){g.update(dt);g.render();}assert.equal(JSON.stringify(g.fight),before);g.dispose();
});
