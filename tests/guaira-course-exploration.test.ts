import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES,GUAIRA_COURSE_DETOURS,type GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import tapes from './helpers/guairaExplorationReplays.json';
import type {WorldGame} from '../src/adventure/WorldGame';

const constructors:Record<GuairaCourseId,new(c:HTMLCanvasElement,s:HTMLElement)=>WorldGame&{finished:boolean}>={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
const dt=1000/60;
for(const id of Object.keys(constructors) as GuairaCourseId[])for(const reduced of [false,true])
test(`${id}: the optional upper loop collects its rewards, defeats its guard and rejoins a complete native run; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;const g=h.create(constructors[id]);
    let held=new Set<string>(),frames=0,detourFrames=0;
    const snapshot=()=>JSON.stringify({p:g.player.data,o:g.objects,c:g.camera,foes:g.foes,coins:g.coins,tiles:g.level.data.tiles});
    for(const[n,keys]of tapes[id].runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
        for(let i=0;i<n;i++){
            g.update(dt);frames++;const p=g.player.data;
            assert.ok(!p.isDead&&p.hasHelmet,`no required damage at ${frames}`);
            if(p.position.x>=GUAIRA_COURSES[id].start){
                assert.ok(p.position.y-10-g.camera.y>=23,'full helmet stays below HUD');
                assert.ok(p.position.y+p.height-g.camera.y<=172.01,'feet remain visible');
                assert.ok(p.position.x-g.camera.x>=23.99&&p.position.x+p.width-g.camera.x<=320,'horizontal framing');
                if(guairaCourseGuidance(g,id)?.hint==='DESVIO ALTO - MOEDAS E RISCO')detourFrames++;
                if(tapes[id].notes.some(note=>note.frame===frames)){
                    const d=GUAIRA_COURSE_DETOURS[id],local=p.position.x-GUAIRA_COURSES[id].start,feet=p.position.y+p.height;
                    const next=d.returns.find(([left,right,top])=>right>local&&left-local<180&&top>feet+8);
                    if(next&&local>=d.decks.at(-1)![0]-24){
                        assert.ok(next[2]-g.camera.y>=24&&next[2]-g.camera.y<=176,`next descent is visible before departure at ${frames}`);
                        assert.ok(GUAIRA_COURSES[id].start+next[0]>=g.camera.x&&GUAIRA_COURSES[id].start+next[1]<=g.camera.x+320,'full receiving deck visible');
                    }
                }
            }
            if(frames%90===0){const before=snapshot();g.render();assert.equal(snapshot(),before,'drawing cannot advance any game state');}
        }
    }
    assert.ok(g.finished);assert.equal(frames,tapes[id].frames);assert.equal(g.coins,tapes[id].coins);
    assert.ok(detourFrames>20,'optional path is identified during play');
    assert.ok(g.foes.find(e=>e.spec.id.endsWith(':detour:guard'))?.dead);
    const collected=(g as unknown as {collected:Set<string>}).collected;
    for(const p of g.stage.pickups.filter(p=>p.id.includes(':detour:coin:')))assert.ok(collected.has(p.id),p.id);
    assert.deepEqual(g.store.save.completed,[],'preview does not complete campaign stages');g.dispose();
});

test('a nearby enemy tell takes priority over a distant active grate; water below a beam does not replace upper-route guidance',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaRespiros),course=GUAIRA_COURSES.respiros;
    // Isolated presentation fixtures, not a completion proof.
    g.player.data.position={x:course.start+2056,y:course.floor-24};g.objects.time=50;
    const loader=g.foes.find(e=>e.spec.kind==='loader')!;loader.phase='warning';
    assert.equal(guairaCourseGuidance(g,'respiros')?.hint,'ARREMESSO A CAMINHO');
    g.player.data.position={x:course.start+960,y:136};
    assert.equal(guairaCourseGuidance(g,'respiros')?.hint,'DESVIO ALTO - MOEDAS E RISCO');g.dispose();
});

test('sustained backtracking previews the left route, while a short brake does not flip the camera',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),course=GUAIRA_COURSES.travessia;
    const index=g.stage.checkpoints.findIndex(p=>p.x*16===course.start+608);
    g.store.save.checkpoint={stage:g.stage.id,index,helmet:true};g.load(g.stage.id,true);
    const start=g.camera.x;
    h.key('keydown','ArrowLeft');for(let i=0;i<5;i++)g.update(dt);h.key('keyup','ArrowLeft');
    assert.ok(g.camera.x>start-20,'a small correction keeps forward preview');
    assert.doesNotMatch(guairaCourseGuidance(g,'travessia')!.hint,/VOLTA/,'braking does not contradict the forward camera');
    h.key('keydown','ArrowLeft');for(let i=0;i<30;i++)g.update(dt);h.key('keyup','ArrowLeft');
    assert.ok(g.player.data.position.x-g.camera.x>150,'the camera now previews the route behind');
    assert.equal(guairaCourseGuidance(g,'travessia')!.hint,'SENTADA QUEBRA A COURACA','the helmet now ahead on the left outranks generic return guidance');g.dispose();
});
