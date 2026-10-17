import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {continueGuairaCourse} from './helpers/guairaCourseController';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES,GUAIRA_COURSE_DETOURS,type GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import type {WorldGame} from '../src/adventure/WorldGame';
import tapes from './helpers/guairaExplorationReplays.json';

const factories:Record<GuairaCourseId,new(c:HTMLCanvasElement,s:HTMLElement)=>WorldGame&{finished:boolean}>={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
function playback(h:ReturnType<typeof sceneLifecycleBrowser>,g:WorldGame){
    let held=new Set<string>(),frame=0;
    const step=(keys:readonly string[])=>{
        const next=new Set(keys);
        for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});
        held=next;g.update(1000/60);return ++frame;
    };
    return {step,to(id:GuairaCourseId,stop:number|(()=>boolean),observe?:(frame:number)=>void){
        for(const[n,keys]of tapes[id].runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
            step(keys);observe?.(frame);if(typeof stop==='number'?frame===stop:stop())return;
        }
    }};
}

for(const id of Object.keys(factories) as GuairaCourseId[])
test(`${id}: descent keeps its route identity through braking and clears it at the receiving bank`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(factories[id]),d=GUAIRA_COURSE_DETOURS[id],course=GUAIRA_COURSES[id];
    const play=playback(h,g);let descending=0,checked=0;
    play.to(id,tapes[id].frames,frame=>{
        const hint=guairaCourseGuidance(g,id),p=g.player.data;
        if(hint?.hint==='DESCIDA: SIGA OS APOIOS')descending++;
        const mark=tapes[id].notes.find(n=>n.frame===frame&&d.returns.some(([l,r,y])=>n.target[0]>=l&&n.target[0]<=r&&n.target[1]===y));
        if(mark){
            checked++;assert.equal(hint?.name,d.name,'return stairs still belong to the optional route');
            assert.doesNotMatch(hint!.hint,/VOLTA|RETORNO/,'a landing brake is not a decision to go back');
            assert.ok(p.position.y-10-g.camera.y>=23,'the full player remains below the HUD');
            if(mark.target[1]===d.returns.at(-1)![2])assert.ok(course.floor-g.camera.y<=176,`the final bank is visible before the last drop: frame=${frame}, floor on screen=${course.floor-g.camera.y}`);
        }
        if(p.isGrounded&&p.position.y+p.height===course.floor&&p.position.x>course.start+d.end)
            assert.notEqual(hint?.name,d.name,'the main route takes over after landing');
    });
    assert.equal(checked,d.returns.length);assert.ok(descending>20);assert.ok(g.finished);g.dispose();
});

for(const id of ['respiros','subida','galeria','alivio'] as const)
test(`${id}: hesitating on a fragile deck really drops to a recoverable route without compulsory damage`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(factories[id]),d=GUAIRA_COURSE_DETOURS[id],course=GUAIRA_COURSES[id];
    const fragile=d.decks.find(p=>p[3])!;
    const mark=tapes[id].notes.find(n=>n.target[0]>=fragile[0]&&n.target[0]<=fragile[1]&&n.target[1]===fragile[2])!;
    const play=playback(h,g);play.to(id,mark.frame);
    const collected=(g as unknown as {collected:Set<string>}).collected,coins=[...collected];
    let warned=false,fell=false;
    for(let n=0;n<90;n++){
        play.step([]);const p=g.player.data;
        warned ||= guairaCourseGuidance(g,id)?.hint==='TABUA CEDE - CONTINUE';
        fell ||= p.position.y+p.height>fragile[2]+40;
        assert.ok(p.hasHelmet&&!p.isDead,'the collapse leaves a chance to recover');
    }
    assert.ok(warned&&fell,'the warning and the physical consequence must both happen');
    if(id==='respiros'){
        assert.equal(guairaCourseGuidance(g,id)?.hint,'APOIO BAIXO: CUIDE DA MARGEM');
        assert.ok(course.floor-g.camera.y<=176,'the floor is visible before leaving the recovery shelf');
        for(let n=0;n<120&&g.player.data.position.y+g.player.data.height<course.floor;n++){
            const p=g.player.data;play.step(p.position.x<course.start+1112?['ArrowRight']:p.velocity.x>.2?['ArrowLeft']:[]);
            assert.ok(p.hasHelmet&&!p.isDead);
        }
    }
    const result=continueGuairaCourse(g,play.step);
    assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);
    for(const coin of coins)assert.ok(collected.has(coin),'falling does not reset collected rewards');
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const id of Object.keys(factories) as GuairaCourseId[])
test(`${id}: a real failed attempt after the upper loop retains its coins and restarts at the earned checkpoint`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(factories[id]),play=playback(h,g);
    const afterBridge=id==='travessia'?1184:id==='patio'?1120:0;
    play.to(id,afterBridge?()=>g.player.data.position.x>=GUAIRA_COURSES[id].start+afterBridge&&g.player.data.isGrounded:tapes[id].notes.at(-1)!.frame);
    const loopCoins=g.stage.pickups.filter(p=>p.id.includes(':detour:coin:')).map(p=>p.id);
    // Intentionally ignore the next obstacle. Death and restart are both native;
    // no health, actor, checkpoint or clock is changed by the test.
    for(let n=0;n<1200&&!g.player.data.isDead&&!g.finished;n++)play.step(['ArrowRight','ShiftLeft']);
    assert.ok(g.player.data.isDead&&!g.finished,'reckless play meets a real consequence');
    const checkpoint={...g.store.save.checkpoint!},coins=g.coins,objects=g.objects;
    for(let n=0;n<240&&g.objects===objects;n++)play.step([]);
    assert.notEqual(g.objects,objects,'the native death timer rebuilds the attempt');
    assert.deepEqual(g.store.save.checkpoint,checkpoint);
    assert.equal(g.player.data.position.x,g.stage.checkpoints[checkpoint.index].x*16);
    assert.equal(g.coins,coins,'retrying does not erase rewards earned on the detour');
    const collected=(g as unknown as {collected:Set<string>}).collected;
    for(const coin of loopCoins)assert.ok(collected.has(coin),'collected coins cannot respawn for farming');
    const result=continueGuairaCourse(g,play.step);
    assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0,'the earned checkpoint has a damage-free way out');
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});
