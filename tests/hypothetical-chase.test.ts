import test from 'node:test';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalModel,HYPOTHETICAL} from '../src/adventure/hipotetico/HypotheticalModel';
import {CHASE_ATTACKS,CHASE_BREAKS,CHASE_CHECKPOINT,CHASE_GAPS,CHASE_WIDTH} from '../src/adventure/hipotetico/HypotheticalLayout';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {hypotheticalChaseInputs} from './helpers/hypotheticalRoutes';

import {chaseDeckSpans,chaseRuinAt,chaseDebrisAt,CHASE_WATER_Y} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {hypotheticalMotion} from '../src/adventure/hipotetico/HypotheticalMotion';

const dt=HYPOTHETICAL.step;
function keys(h:ReturnType<typeof sceneLifecycleBrowser>,held:Set<string>,input:string[]){
    const next=new Set(input);
    for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{key:k==='Space'?' ':k,code:k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{key:k==='Space'?' ':k,code:k,target:h.canvas});
    return next;
}

test('the entire pursuit teaches high fire, low fire and lunges, with seven complete warnings and six visible destructions',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    let held=new Set<string>(),frames=0,last='arrival',warning=0,visibleDebris=0;
    const kinds:string[]=[],tells:number[]=[],breaks=new Set<number>(),landings=new Set<string>(),districts=new Set<number>();
    try{for(const [count,input] of hypotheticalChaseInputs('upper')){
        held=keys(h,held,input);
        for(let i=0;i<count;i++){
            g.update(dt);frames++;if(g.act!=='chase')break;
            const b=g.fight,p=g.player.getRect();
            assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true,'a correct route keeps its protection');
            districts.add(Math.min(3,Math.floor(p.x/1120)));
            if(b.state==='tell'&&last!=='tell'){warning=b.tick;kinds.push(b.pursuitKind);}
            if(b.state==='attack'&&last==='tell')tells.push(b.tick-warning);
            last=b.state;
            b.chaseBreaks.forEach((at,j)=>{if(at>=0)breaks.add(j);});
            visibleDebris+=b.bridgeDebris.filter(d=>d.x-g.camera.x>=0&&d.x-g.camera.x<320).length;
            if(g.player.data.isGrounded)for(const body of g.objects.bodies)if(body.id.startsWith('chase-')&&Math.abs(p.y+p.height-body.y)<.1&&p.x+p.width>body.x&&p.x<body.x+body.width)landings.add(body.id);
            assert.ok(b.bridgeDebris.length<=18);assert.ok(b.terraceDebris.length<=4);
            for(const d of b.terraceDebris)assert.ok(!g.objects.bodies.some(p=>p.x===d.x&&p.id.startsWith('chase-')));
        }
    }
    assert.equal(g.act,'siege');assert.equal(g.receipt.deaths,0);assert.equal(frames,1281);
    assert.deepEqual([...districts],[0,1,2,3]);assert.deepEqual(kinds,CHASE_ATTACKS.map(a=>a.kind));
    assert.deepEqual(tells,CHASE_ATTACKS.map(a=>a.tell));assert.equal(breaks.size,CHASE_BREAKS.length);assert.ok(visibleDebris>100);
    assert.ok([...landings].some(s=>s.includes('cargo')));assert.ok([...landings].some(s=>s.includes('final')));
    }finally{g.dispose();}
});

test('midpoint retry restores the reached section, with ruined earlier landmarks and a fresh announced attack',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);let held=new Set<string>();
    try{
    outer:for(const [count,input] of hypotheticalChaseInputs('lower')){
        held=keys(h,held,input);for(let i=0;i<count;i++){g.update(dt);if(g.player.data.position.x>CHASE_CHECKPOINT+80)break outer;}
    }
    h.key('keydown','r');h.key('keyup','r');held=new Set();
    assert.equal(g.player.data.position.x,CHASE_CHECKPOINT);assert.equal(g.fight.chaseStart,CHASE_CHECKPOINT);
    assert.equal(g.player.data.hasHelmet,true);assert.ok(g.fight.chaseBreaks.slice(0,3).every(t=>t<-1));
    held=keys(h,held,['ArrowRight','ShiftLeft']);let warning=-1,fired=-1;
    for(let i=0;i<140;i++){
        g.update(dt);assert.equal(g.player.data.isDead,false);
        if(g.fight.events.includes('warning')&&warning<0)warning=i;
        if(g.fight.events.includes('shot')&&fired<0)fired=i;
    }
    assert.ok(warning>=24);assert.ok(fired-warning>=46);assert.equal(g.player.data.hasHelmet,true);
    h.key('keydown','Enter');h.key('keyup','Enter'); // Enter cannot reset a live encounter.
    assert.equal(g.fight.chaseStart,CHASE_CHECKPOINT);
    g.replay();assert.equal(g.player.data.position.x,96);assert.equal(g.fight.chaseStart,0);
    }finally{g.dispose();}
});

test('moving rifle directions, muzzle anchors and environment events are deterministic under frame partitioning',()=>{
    const a=new HypotheticalModel('chase'),b=new HypotheticalModel('chase');
    const p={x:3000,y:200,width:14,height:24};
    for(let i=0;i<360;i++)a.update(dt,p);for(let i=0;i<60;i++)b.update(dt*6,p);
    assert.equal(a.tick,b.tick);assert.equal(a.pursuitIndex,b.pursuitIndex);assert.equal(a.state,b.state);
    assert.deepEqual(a.shots,b.shots);assert.deepEqual(a.chaseBreaks,b.chaseBreaks);
});

test('a real death after the midpoint returns to that bank with no lingering projectiles or replayed collapses',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);let held=new Set<string>();
    try{
    outer:for(const [count,input]of hypotheticalChaseInputs('lower')){
        held=keys(h,held,input);for(let i=0;i<count;i++){g.update(dt);if(g.player.data.position.x>CHASE_CHECKPOINT+80)break outer;}
    }
    keys(h,held,[]);const original=g.player;let dead=false;
    for(let i=0;i<400&&g.player===original;i++){g.update(dt);dead||=g.player.data.isDead;}
    assert.ok(dead);assert.notEqual(g.player,original);assert.equal(g.receipt.deaths,1);
    assert.equal(g.player.data.position.x,CHASE_CHECKPOINT);assert.equal(g.camera.x,CHASE_CHECKPOINT-150);
    assert.equal(g.fight.shots.length,0);assert.equal(g.fight.muzzle,0);assert.equal(g.fight.bridgeDebris.length,0);
    assert.ok(g.fight.chaseBreaks.slice(0,3).every(at=>at<-1));
    }finally{g.dispose();}
});

test('running ground waves fall into a missing deck and bullets still strike the last quarter of the bridge',()=>{
    const b=new HypotheticalModel('chase');b.tick=100;b.state='rest';b.age=0;
    const gap=CHASE_GAPS.at(-1)![0]*16;
    b.shots.push({x:gap-9,y:212,px:gap-9,py:212,width:15,height:12,vx:7,vy:0,age:1,life:100,kind:'wave'});
    b.update(dt,{x:100,y:200,width:14,height:24});assert.equal(b.shots.length,0);
    b.shots.push({x:CHASE_WIDTH-80,y:215,px:CHASE_WIDTH-80,py:215,width:5,height:5,vx:4,vy:8,age:0,life:100,kind:'bullet'});
    b.update(dt,{x:100,y:200,width:14,height:24});assert.equal(b.shots.length,0);assert.equal(b.impacts.at(-1)?.y,224);
});

test('pause freezes rifle pressure, moving destruction and the collapsing tile mask together',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);let held=new Set<string>();
    try{
    outer:for(const [count,input]of hypotheticalChaseInputs('upper')){
        held=keys(h,held,input);for(let i=0;i<count;i++){g.update(dt);if(g.fight.bridgeDebris.length>4&&g.fight.state==='attack')break outer;}
    }
    h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');assert.equal(g.state,'paused');
    const before=JSON.stringify({b:g.fight,p:g.player.data,tiles:g.level.data.tiles});
    for(let i=0;i<20;i++){g.update(dt);g.render();}
    assert.equal(JSON.stringify({b:g.fight,p:g.player.data,tiles:g.level.data.tiles}),before);
    }finally{g.dispose();}
});


test('shots hit only surviving banks, with wood, iron or water at the actual surface',()=>{
    for(const [x,material,y] of [[900,'stone',224],[1450,'timber',224],[3900,'iron',224],[600,'water',CHASE_WATER_Y]] as const){
        const b=new HypotheticalModel('chase');b.state='rest';b.tick=100;
        b.shots.push({x,y:214,px:x,py:214,width:5,height:5,vx:0,vy:8,age:0,life:20,kind:'bullet'});
        for(let tick=0;tick<4;tick++)b.update(dt,{x:100,y:200,width:14,height:24});
        assert.equal(b.shots.length,0);assert.equal(b.impacts.length,1);
        assert.equal(b.impacts[0].y,y);assert.equal(b.impacts[0].material,material);
    }
    const b=new HypotheticalModel('chase',9,0,2304);
    b.shots.push({x:1800,y:214,px:1800,py:214,width:5,height:5,vx:0,vy:8,age:0,life:20,kind:'bullet'});
    for(let tick=0;tick<4;tick++)b.update(dt,{x:2304,y:200,width:14,height:24});
    assert.equal(b.impacts[0].material,'water');assert.equal(b.impacts[0].y,CHASE_WATER_Y);
    for(const edge of [0,500,2100,4300])for(const span of chaseDeckSpans(edge)){
        assert.ok(span.width>0);assert.ok(span.x>=Math.max(0,Math.floor((edge-32)/16)*16));
        assert.ok(CHASE_GAPS.every(([a,z])=>span.x+span.width<=a*16||span.x>=z*16));
    }
});

test('a running lunge releases its neck and rider before the next preparation, without a posture snap',()=>{
    const b=new HypotheticalModel('chase');let before=hypotheticalMotion(b),slams=0,settled=false,peak=0;
    for(let tick=0;tick<680;tick++){
        b.update(dt,{x:Math.min(2400,96+tick*3.5),y:200,width:14,height:24});
        const pose=hypotheticalMotion(b);
        assert.ok(Math.abs(pose.neckDrop-before.neckDrop)<2);assert.ok(Math.abs(pose.riderDrop-before.riderDrop)<2);
        if(b.pursuitKind==='ram'&&b.state==='attack'){
            if(b.events.includes('slam')){slams++;assert.ok(pose.neckDrop>10);}
            peak=Math.max(peak,pose.neckDrop);
            if(b.age===60){assert.equal(pose.neckDrop,0);assert.equal(pose.riderDrop,0);settled=true;}
        }
        before=pose;
    }
    assert.equal(slams,1);assert.ok(peak>11&&settled);
});

test('destruction keeps its pieces through contact and settles the crane load before the dust clears',()=>{
    const first=chaseRuinAt(0);assert.equal(first.beamDrop,0);assert.equal(first.leftTurn,0);
    let prior=first;
    for(let age=1;age<100;age++){
        const p=chaseRuinAt(age);
        assert.ok(Math.abs(p.loadDrop-prior.loadDrop)<3.4);assert.ok(Math.abs(p.leftTurn-prior.leftTurn)<.08);
        assert.ok(p.loadDrop>=0&&p.loadDrop<=31);assert.ok(p.dust>=0&&p.dust<=1);
        if(age>=43)assert.equal(p.loadDrop,31);
        prior=p;
    }
    assert.equal(chaseRuinAt(90).dust,0);
    let contact=-1;
    for(let age=0;age<25;age++){
        const p=chaseDebrisAt(age);
        if(p.splashAge>=0&&contact<0){contact=age;assert.ok(224+p.drop+5+p.tilt>=CHASE_WATER_Y);}
        if(p.splashAge<0)assert.ok(224+p.drop+5+p.tilt<CHASE_WATER_Y);
    }
    assert.ok(contact>=12&&contact<=14);
});
