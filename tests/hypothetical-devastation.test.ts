import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalModel } from '../src/adventure/hipotetico/HypotheticalModel';
import { HypotheticalBackdrop, BACKDROP_RIG, backdropBaseline } from '../src/adventure/hipotetico/HypotheticalBackdrop';
import { distantRiderPose, drawHypotheticalBackground } from '../src/adventure/hipotetico/HypotheticalArt';
import { devastationAt, DESTRUCTION_SITES, ruinAge, rubbleApproach } from '../src/adventure/hipotetico/HypotheticalDevastation';
import { bystanderPose } from '../src/adventure/hipotetico/HypotheticalBystanders';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { riderBend } from '../src/adventure/hipotetico/HypotheticalMotion';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
const dt=1000/60,p={x:180,y:200,width:14,height:24};

test('each district has a prepared contact, exactly one collapse, and persistent ruins',()=>{
    const b=new HypotheticalModel('siege'),hits:number[]=[];
    for(let n=1;n<=1400;n++){
        b.update(dt,p,2);
        if(b.events.includes('break')){
            hits.push(n);const index=hits.length-1,site=DESTRUCTION_SITES[index];
            assert.equal(b.backdrop.motion.phase,'contact');assert.equal(ruinAge(b.backdrop.breaches,index,n),0);
            assert.ok(b.backgroundX+70*BACKDROP_RIG.scale>=site.x);
            assert.equal(b.destroyed,hits.length);
        }
        if(n===179)assert.equal(b.destroyed,0);
    }
    assert.deepEqual(hits,[180,580,980]);assert.equal(b.destroyed,3);assert.equal(b.backdrop.shots.length,0);
    assert.equal(ruinAge(b.backdrop.breaches,2,1400),420);
    for(const cleared of [1,2]){
        const resumed=new HypotheticalModel('siege',9,cleared);
        assert.equal(resumed.destroyed,cleared);assert.equal(resumed.backdrop.tick,cleared*400);
        assert.deepEqual(resumed.events,[]);assert.ok(resumed.backdrop.casualties>=cleared*2);
    }
});

test('movement stays continuous across the contact hold and district seams; actions have distinct poses',()=>{
    let prior=devastationAt(0);
    for(let tick=1;tick<=1300;tick++){
        const pose=devastationAt(tick);assert.ok(Math.abs(pose.x-prior.x)<4.4);assert.ok(Math.abs(pose.lift-prior.lift)<2);
        assert.ok(Math.abs(pose.neckDrop-prior.neckDrop)<4);assert.ok(Math.abs(pose.riderLean-prior.riderLean)<2);
        if(tick>=180&&tick<=185)assert.equal(pose.x,178);
        prior=pose;
    }
    assert.equal(devastationAt(150).phase,'prepare');assert.equal(devastationAt(172).phase,'strike');
    assert.ok(devastationAt(572).jaw>devastationAt(172).jaw);
    assert.ok(devastationAt(970).lift<-8);assert.equal(devastationAt(980).lift,0);
});

test('every visible distant shot originates at the articulated rifle, including body compression and rider lean',()=>{
    const b=new HypotheticalBackdrop(true);let shots=0;
    for(let tick=1;tick<=1200;tick++){
        b.update(tick);if(!b.events.includes('distant-shot'))continue;shots++;
        const pose=distantRiderPose(b),s=BACKDROP_RIG.scale,rx=7-pose.recoil+pose.tuck*10+riderBend(14,pose.riderLean??0);
        const ry=-64+pose.compression+(pose.riderDrop??0)-14;
        const muzzle={x:b.x+(rx+31*Math.cos(pose.aim))*s,y:(pose.y-BACKDROP_RIG.y+ry+31*Math.sin(pose.aim))*s};
        const shot=b.shots[b.shots.length-1];assert.ok(Math.hypot(shot.x-muzzle.x,shot.y-muzzle.y)<1e-7);
    }
    assert.equal(shots,20);assert.equal(b.casualties,7);assert.equal(b.people.filter(p=>p.escaped).length,7);
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
    const b=new HypotheticalModel('siege');for(let n=0;n<480;n++)b.update(dt,p,2);
    assert.equal(b.marks.length,1);const mark={...b.marks[0]},site=DESTRUCTION_SITES[0];
    for(let n=0;n<59;n++)b.update(dt,p,2);assert.equal(b.shots.length,0);
    b.update(dt,p,2);const stone=b.shots[0],point=rubbleApproach(site.x+site.width/2,mark.x,60);
    assert.equal(stone.kind,'rubble');assert.equal(stone.age,0);assert.equal(point.x,stone.x+stone.width/2);assert.equal(point.y,stone.y+stone.height/2);
    assert.ok(b.shots.every(s=>s.kind==='rubble'));
    for(const cy of [0,24,64]){
        const floor=backdropBaseline(cy),end=rubbleApproach(site.x+site.width/2,mark.x,60,floor+cy);
        assert.equal(end.y-cy,stone.y+stone.height/2-cy);
        assert.ok(floor<143&&floor>=128,'the rear street stays above the foreground garrison doorways');
    }
});

test('destruction, people and scenic effects are read-only in both motion modes and freeze on native pause',t=>{
    const h=sceneLifecycleBrowser(t),b=new HypotheticalModel('siege');
    for(let tick=1;tick<=1020;tick++){
        b.update(dt,p,2);if(![155,180,196,582,970,985,1020].includes(tick))continue;
        const before=JSON.stringify(b);
        for(const reduced of [false,true])drawHypotheticalBackground(h.canvas.getContext(),b,Math.max(0,b.backgroundX-110),64,reduced);
        assert.equal(JSON.stringify(b),before);
    }
    const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);g.act='siege';g.load('hipotetico-siege',true);
    for(let n=0;n<190;n++)g.fight.update(dt,p,2);
    h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');assert.equal(g.state,'paused');
    const before=JSON.stringify(g.fight);for(let n=0;n<60;n++){g.update(dt);g.render();}assert.equal(JSON.stringify(g.fight),before);g.dispose();
});
