import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import { ALL_DELICIA_STAGES, DELICIA_STAGES, DELICIA_LORE } from '../src/adventure/delicia/DeliciaContent';
import { DELICIA_ATLAS, deliciaAsset } from '../src/adventure/delicia/DeliciaIsland';
import { completeDeliciaStage, deliciaUnlocked, DeliciaStore, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { DeliciaSimulation, noDeliciaInput, steamPhase, movingFloor } from '../src/adventure/delicia/DeliciaSimulation';
import { DeliciaBoss, gapTarget } from '../src/adventure/delicia/DeliciaBoss';

test('expansion art, map metadata and audio stay inside relative and immutable release bases',()=>{
    const release = 'https://game.example/world/releases/candidate/delicia.html';
    for(const base of ['./','/world/releases/candidate/','/world/releases/candidate']) {
        for(const file of ['island.webp?v=4','island-map.json?v=4','audio/orchard.ogg']) {
            assert.equal(new URL(deliciaAsset(file,base),release).href,
                `https://game.example/world/releases/candidate/assets/delicia/${file}`);
        }
    }
    assert.equal(new URL(deliciaAsset('island.webp','/'),'https://game.example/delicia.html').href,
        'https://game.example/assets/delicia/island.webp');
});

test('expansion has twelve distinct main stages, two optional shrines and a fixed large atlas footprint',()=>{
    assert.equal(DELICIA_STAGES.length,12);assert.equal(ALL_DELICIA_STAGES.length,14);
    assert.equal(new Set(ALL_DELICIA_STAGES.map(s=>s.id)).size,14);assert.deepEqual(DELICIA_STAGES.filter(s=>s.boss).map(s=>s.boss),['jaja','guina']);
    assert.ok(DELICIA_ATLAS.widthInMap>=2);assert.ok(DELICIA_ATLAS.heightInMap>=2);
    for(const stage of ALL_DELICIA_STAGES){assert.ok(stage.width>1000);assert.ok(stage.floors.length);assert.ok(stage.checkpoints.length);assert.equal(stage.pickups.filter(p=>p.kind==='seal').length,stage.boss?0:3);
        assert.equal(new Set(stage.pickups.map(p=>p.id)).size,stage.pickups.length);for(const p of stage.pickups){assert.ok(p.x>=0&&p.x<stage.width);assert.ok(p.y>=0&&p.y<stage.height);if(p.lore)assert.ok(DELICIA_LORE.some(l=>l.id===p.lore));}
        for(const floor of stage.floors){assert.ok(floor.x>=0&&floor.x+floor.w<=stage.width+.01);assert.ok(floor.y>=0&&floor.y+floor.h<=stage.height);}
    }
});
test('every main stage and optional shrine becomes reachable through earned progression',()=>{
    const save=freshDeliciaSave();assert.ok(deliciaUnlocked('delicia-1',save));assert.ok(!deliciaUnlocked('delicia-12',save));
    for(const stage of DELICIA_STAGES){assert.ok(deliciaUnlocked(stage.id,save));completeDeliciaStage(save,stage.id,45);}
    assert.ok(deliciaUnlocked('delicia-raizes',save));assert.ok(deliciaUnlocked('delicia-relogio',save));assert.ok(save.lore.includes('delicia'));
    const imported=parseDeliciaSave(JSON.stringify(save));assert.deepEqual(imported.completed,save.completed);assert.equal(imported.times['delicia-12'],45);
});
test('checkpoint valves survive serialization, invalid values are filtered, failed imports preserve current progress',()=>{
    const save=freshDeliciaSave();save.checkpoint={stage:'delicia-3',index:1,valves:['v5','not-a-valve']};
    const parsed=parseDeliciaSave(JSON.stringify(save));assert.deepEqual(parsed.checkpoint?.valves,['v5']);
    const store=new DeliciaStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});store.save.completed.push('delicia-1');assert.equal(store.import(JSON.stringify(parsed)),false);assert.deepEqual(store.save.completed,['delicia-1']);
    assert.throws(()=>parseDeliciaSave('{"version":2}'));assert.throws(()=>completeDeliciaStage(freshDeliciaSave(),'delicia-12',1));
});

test('checkpoint resumes and assisted runs unlock progression without replacing full-route records',()=>{
    const save=freshDeliciaSave();completeDeliciaStage(save,'delicia-1',80);completeDeliciaStage(save,'delicia-1',3,false);assert.equal(save.times['delicia-1'],80);
    save.assists=true;completeDeliciaStage(save,'delicia-2',12);assert.ok(save.completed.includes('delicia-2'));assert.equal(save.times['delicia-2'],undefined);
    assert.equal(new DeliciaSimulation(DELICIA_STAGES[0],false,0).recordEligible,false);
});
test('Guina locks a fair gap during a tell and protects both valve landing areas',()=>{
    for(const x of [-100,0,190,500,900,1100,1400]){const target=gapTarget(x);assert.ok(target.x>=340);assert.ok(target.x+target.w<=940);}
    const boss=new DeliciaBoss('guina');boss.start();const player={x:500,y:396,w:34,h:54};
    for(let i=0;i<100&&boss.beat!=='tell';i++)boss.update(1/60,player);
    assert.equal(boss.attack,'gap');const locked={...boss.target};
    for(let i=0;i<100&&boss.beat==='tell';i++)boss.update(1/60,{...player,x:1000});assert.deepEqual(boss.target,locked);
    for(let i=0;i<10;i++)boss.update(1/60,player);assert.equal(boss.gaps.length,1);assert.deepEqual(boss.gaps[0].x,locked.x);
    for(let i=0;i<400;i++)boss.update(1/60,{...player,x:150});assert.ok(!boss.gaps.some(g=>g.x===locked.x&&g.life>4.3));
});
test('boss armor opens through relief; all three phases and victory are achievable without damaging an invulnerable pose',()=>{
    for(const character of ['jaja','guina'] as const){const boss=new DeliciaBoss(character);boss.start();assert.equal(boss.hit(),false);
        const phases=new Set<number>([boss.phase]);let safety=0;
        while(boss.hp>0&&safety++<12000){boss.update(1/60,{x:150,y:396,w:34,h:54});if(boss.beat==='recover'||boss.beat==='stagger'){boss.openValve();boss.hit();phases.add(boss.phase);}}
        assert.equal(boss.hp,0);assert.equal(boss.beat,'defeated');assert.deepEqual([...phases],[1,2,3]);assert.equal(boss.hit(),false);
    }
});
test('a reflected heart changes allegiance and a ground pound hits harder during recovery',()=>{
    const boss=new DeliciaBoss('guina');const m={x:400,y:380,w:25,h:25,vx:-200,vy:20,gravity:250,kind:'heart' as const,life:3,friendly:false};boss.reflect(m);assert.ok(m.friendly);assert.equal(m.gravity,0);assert.ok(m.vx>0);
    boss.beat='recover';boss.openValve();const hp=boss.hp;assert.ok(boss.hit(2));assert.equal(boss.hp,hp-2);
});
test('native short jumps and held running do not grant attack immunity',()=>{
    const sim=new DeliciaSimulation();for(let i=0;i<30;i++)sim.update(1/120,noDeliciaInput());assert.ok(sim.player.grounded);
    sim.update(1/120,{...noDeliciaInput(),jumpPressed:true,jump:true});assert.ok(sim.player.vy<0);const before=sim.player.vy;sim.update(1/120,{...noDeliciaInput(),jumpReleased:true});assert.ok(sim.player.vy>before*.7);
    sim.update(1/120,{...noDeliciaInput(),run:true});assert.equal(sim.player.dashTime,0);const hp=sim.player.health;sim.hurt(sim.player.x+20);assert.equal(sim.player.health,hp-1);
});
test('steam has a readable warning before danger and moving collision surfaces match their animation',()=>{
    assert.equal(steamPhase(0),'safe');assert.equal(steamPhase(2.6),'tell');assert.equal(steamPhase(3.5),'active');
    const stage=DELICIA_STAGES[3],floor=stage.floors.find(f=>f.kind==='moving')!;assert.notEqual(movingFloor(floor,0).x,movingFloor(floor,1).x);
});
test('all traversal routes can be crossed using movement, jumps and valves without terrain warps',()=>{
    for(const hz of [60,120])for(const authored of ALL_DELICIA_STAGES.filter(s=>!s.boss)){
        // Geometry audit isolates terrain from enemy challenge. Collision, jumps,
        // moving platforms, belts, checkpoints and gates use the real simulation.
        const stage=structuredClone(authored);stage.enemies=[];stage.hazards=stage.hazards.filter(h=>h.kind==='juice');stage.machines=stage.machines?.filter(m=>m.kind!=='press');
        const sim=new DeliciaSimulation(stage,true);let stuck=0,lastX=0,gaps=0,jumpHold=0,wasHeld=false;
        for(let step=0;step<60000&&!sim.finished&&!sim.dead;step++){
            const p=sim.player,ground=stage.floors.filter(f=>sim.floorAvailable(f)).map(f=>movingFloor(f,sim.time)).find(f=>p.x+p.w>f.x&&p.x<f.x+f.w&&Math.abs(f.y-(p.y+p.h))<10);
            const next=ground?stage.floors.find(f=>f.x>ground.x):undefined;
            const edge=ground?ground.x+ground.w-(p.x+p.w):999;
            const shouldJump=p.grounded&&((ground&&next&&edge<55)||stuck>25);
            // Hold for a real 150 ms instead of making the route depend on a
            // one-frame tap whose duration changes with the simulation rate.
            if(shouldJump)jumpHold=.15;const held=jumpHold>0;jumpHold-=1/hz;
            sim.update(1/hz,{...noDeliciaInput(),right:true,jumpPressed:!!shouldJump,jump:held,jumpReleased:wasHeld&&!held,interact:true});wasHeld=held;
            gaps+=sim.events.filter(event=>event.kind==='gap').length;
            stuck=Math.abs(p.x-lastX)<.15?stuck+1:0;lastX=p.x;
        }
        assert.ok(sim.finished,`${authored.id} at ${hz} Hz blocked at x=${sim.player.x.toFixed(1)}, health=${sim.player.health}, valves=${[...sim.valves]}`);
        assert.equal(gaps,0,`${authored.id} at ${hz} Hz route requires a gap respawn`);
    }
});

test('both encounters are beatable from their authored spawn using real movement, projectiles, valves and collision',()=>{
    for(const hz of [60,120])for(const stage of DELICIA_STAGES.filter(s=>s.boss)){
        const sim=new DeliciaSimulation(stage);sim.startBoss();const phases=new Set([1]);let hits=0;
        for(let step=0;step<36000&&!sim.dead&&!sim.finished;step++){
            const p=sim.player,b=sim.boss!;
            const target=b.hp<=0?1280:b.attack==='press'&&(b.beat==='tell'||b.beat==='attack')?1270:1170;
            const approach=target-p.x;
            const gapAhead=[...b.gaps,...(b.attack==='gap'&&b.beat==='tell'?[b.target]:[])].some(g=>p.x+p.w>g.x-75&&p.x<g.x+g.w);
            const incoming=b.missiles.some(m=>!m.friendly&&Math.abs(m.x-p.x)<100&&m.y>365&&Math.sign(m.vx)===Math.sign(p.x-m.x));
            const raised=stage.floors.some(f=>f.h<50&&p.x+p.w>f.x-35&&p.x<f.x&&p.y+p.h>f.y);
            const charge=b.attack==='charge'&&b.beat==='attack'&&Math.abs(b.x-p.x)<180;
            const jump=p.grounded&&(gapAhead||incoming||raised||charge);
            const faceBoss=b.hp>0&&Math.abs(approach)<=8&&b.x<p.x&&p.facing>0;
            sim.update(1/hz,{...noDeliciaInput(),right:approach>8,left:approach<-8||faceBoss,jumpPressed:jump,jump:true,seed:p.x>900&&b.hp>0,parry:incoming,interact:true});
            phases.add(b.phase);hits+=sim.events.filter(e=>e.kind==='boss-hit').length;
        }
        assert.ok(sim.finished,`${stage.id} at ${hz} Hz: ${sim.player.health} player HP, ${sim.boss!.hp} boss HP`);
        assert.equal(sim.boss!.hp,0);assert.ok(sim.player.health>0);assert.ok(hits>0);assert.deepEqual([...phases],[1,2,3]);
    }
});

test('raised arena platforms make a two-damage ground pound physically reachable',()=>{
    const sim=new DeliciaSimulation(DELICIA_STAGES[11]);sim.startBoss();const b=sim.boss!;
    b.beat='recover';sim.player.x=1060;sim.player.y=380-sim.player.h;sim.player.grounded=true;
    let hit=false;
    for(let step=0;step<240&&!hit;step++){
        const p=sim.player,pound=p.x<b.x+b.w&&p.y+p.h<b.y+20;
        sim.update(1/60,{...noDeliciaInput(),left:true,jumpPressed:step===0,jump:true,pound,interact:step===0});
        hit=sim.events.some(e=>e.kind==='boss-hit');
    }
    assert.ok(hit);assert.equal(b.hp,b.maxHp-2);
});

test('all shipped expansion media match preserved source and runtime manifests',()=>{
    const manifest=JSON.parse(readFileSync('docs/world/delicia/runtime-manifest.json','utf8')) as Record<string,{source:string;file:string;bytes:number;sha256:string}[]>;
    assert.equal(manifest.images.length,13);assert.equal(manifest.audio.length,20);
    for(const a of [...manifest.images,...manifest.audio]){assert.ok(statSync(a.source).size>1000);const bytes=readFileSync(a.file);assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);}
    const original=JSON.parse(readFileSync('docs/world/delicia/audio-manifest.json','utf8')) as {assets:{file:string;sha256:string}[]};
    for(const a of original.assets)assert.equal(createHash('sha256').update(readFileSync(a.file)).digest('hex'),a.sha256);
    assert.ok(statSync('docs/world/delicia/imperio-delicia.blend').size>100000);assert.ok(statSync('docs/world/delicia/imperio-delicia.glb').size>100000);
});
