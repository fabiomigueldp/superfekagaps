import assert from 'node:assert/strict';
import test from 'node:test';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { GuairaAscent } from '../src/adventure/experimental/guaira/GuairaAscent';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GUAIRA_COURSES, type GuairaCourseId } from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import { WorldFoe } from '../src/adventure/WorldEnemies';
import type { WorldGame } from '../src/adventure/WorldGame';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { continueGuairaCourse } from './helpers/guairaCourseController';
import field from './helpers/guairaFieldRoutesReplays.json';
import patio from './helpers/guairaJunctionOptionalReplay.json';
import rooftop from './helpers/guairaRooftopReplay.json';
import readable from './helpers/guairaReadableRoutesReplays.json';
import relief from './helpers/guairaReliefRoutesReplays.json';

const factories:Record<GuairaCourseId,new(canvas:HTMLCanvasElement,status:HTMLElement)=>WorldGame&{finished:boolean}>={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
const tapes={travessia:field.travessia,patio,respiros:field.respiros,subida:rooftop,galeria:readable.galeria,alivio:relief.high};
const dt=1000/60;
for(const id of Object.keys(factories) as GuairaCourseId[]){
    test(`${id}: the developed course is played from spawn, with live danger, enemy tells and a real final arrival`,t=>{
        const h=sceneLifecycleBrowser(t),g=h.create(factories[id]);let held=new Set<string>(),frames=0;
        const checkpoints=new Set<number>(),enemyPhases=new Set<string>();let liveWater=0,entered=false;
        const input=(keys:string[])=>{const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
            for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;};
        for(const[n,keys]of tapes[id].runs as Array<[number,string[]]>){input(keys);for(let i=0;i<n;i++){
            g.update(dt);frames++;const p=g.player.data;
            assert.ok(!p.isDead&&p.hasHelmet,`${id} no mandatory damage at ${frames}`);
            if(p.position.x<GUAIRA_COURSES[id].finish)assert.equal(g.finished,false,'the original lesson cannot finish the expanded course');
            if(p.position.x>=GUAIRA_COURSES[id].start){
                entered=true;assert.ok(p.position.y-10-g.camera.y>=23,'full helmet below HUD');
                assert.ok(p.position.y+p.height-g.camera.y<=172.01,'feet remain in view');
                for(const e of g.foes)if(Math.abs(e.x-p.position.x)<220)enemyPhases.add(`${e.spec.kind}:${e.phase}`);
                if(g.objects.bodies.some(b=>b.id.includes(':course:')&&b.kind==='jet'&&g.objects.jetDanger(b)))liveWater++;
            }
            if(g.store.save.checkpoint)checkpoints.add(g.store.save.checkpoint.index);
        }}
        assert.ok(entered&&g.finished);assert.equal(frames,tapes[id].frames);assert.equal(g.coins,tapes[id].coins);
        assert.ok(checkpoints.size>=3);assert.ok(enemyPhases.has('loader:warning'),'arremessador has an observed warning');
        if(id!=='subida')assert.ok(liveWater>0,'pressure is physically live in the extended districts');
        assert.deepEqual(g.store.save.completed,[]);g.dispose();
    });
    test(`${id}: every new checkpoint has a quiet spawn and recovers a traversable course`,t=>{
        const h=sceneLifecycleBrowser(t),g=h.create(factories[id]),course=GUAIRA_COURSES[id];
        const indices=g.stage.checkpoints.flatMap((p,i)=>p.x*16>=course.start?[i]:[]);
        for(const index of indices){
            g.store.save.checkpoint={stage:g.stage.id,index,helmet:true};g.load(g.stage.id,true);
            const spawn={...g.player.data.position};
            assert.ok(spawn.y-10-g.camera.y>=23&&spawn.y+g.player.data.height-g.camera.y<=172.01,'the first respawn frame shows the full player');
            for(let i=0;i<600;i++)g.update(dt);
            assert.equal(g.player.data.hasHelmet,true,`checkpoint ${index} is not under attack before departure`);
            assert.equal(g.player.data.isDead,false);assert.deepEqual(g.player.data.position,spawn);
            for(const b of g.objects.bodies.filter(b=>b.kind==='lift'&&b.id.includes(':course:bridge:')&&b.x+b.width<spawn.x)){
                assert.ok(b.active);assert.equal(b.y,b.to!.y,'solved bridges remain open behind the checkpoint');
            }
            let held=new Set<string>();
            const result=continueGuairaCourse(g,keys=>{
                const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
                for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;g.update(dt);
            });
            assert.ok(result.finished&&!result.dead,`${id} checkpoint ${index} must remain completable`);
            assert.equal(result.damage,0,`${id} checkpoint ${index} must not require damage to escape`);
            for(const k of held)h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
        }
        g.dispose();
    });
    test(`${id}: holding right or repeating one jump cannot clear the developed challenge`,t=>{
        const h=sceneLifecycleBrowser(t),g=h.create(factories[id]);
        const index=g.stage.checkpoints.findIndex(p=>p.x*16>=GUAIRA_COURSES[id].start);
        for(const jumps of [false,true]){
            g.store.save.checkpoint={stage:g.stage.id,index,helmet:true};g.load(g.stage.id,true);
            h.window.dispatch('keydown',{code:'ArrowRight',key:'ArrowRight',target:h.canvas});
            h.window.dispatch('keydown',{code:'ShiftLeft',key:'ShiftLeft',target:h.canvas});
            for(let i=0;i<1200&&!g.player.data.isDead&&!g.finished;i++){
                if(jumps&&i%48===0)h.window.dispatch('keydown',{code:'Space',key:' ',target:h.canvas});
                if(jumps&&i%48===24)h.window.dispatch('keyup',{code:'Space',key:' ',target:h.canvas});
                g.update(dt);
            }
            assert.equal(g.finished,false,'a single repeated input is insufficient');
            for(const k of ['ArrowRight','ShiftLeft','Space'])h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
        }g.dispose();
    });
}

for(const kind of ['loader','charger'] as const)test(`${kind}: a Guaíra sentry cannot acquire an offscreen player behind it`,t=>{
    const e=new WorldFoe({id:'guard',kind,x:160,y:192,guardFacing:-1});
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal);
    const level=new WorldLevel(g.stage.level),objects=new WorldObjects([]);
    for(let n=0;n<600;n++)e.update(dt,level,objects,{x:240,y:168,width:14,height:24});
    assert.notEqual(e.phase,'warning');assert.equal(objects.barrels.length,0);
    e.update(dt,level,objects,{x:80,y:168,width:14,height:24});assert.equal(e.phase,'warning');
    const target=e.facing;for(let n=0;n<30;n++)e.update(dt,level,objects,{x:240,y:168,width:14,height:24});
    assert.equal(e.facing,target,'the telegraphed direction stays committed');g.dispose();
});
