import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance,guairaWarehouseRoute} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {carrierMotionErrors} from '../src/adventure/WorldCarrierMotion';
import {carrierMounts} from '../src/adventure/WorldCarrierStructure';
import {supportsStanding} from '../src/world/tileRules';
import {continueGuairaCourse} from './helpers/guairaCourseController';
import {crossGuairaTransfer,dockControls} from './helpers/guairaDockController';
import type {WorldGame} from '../src/adventure/WorldGame';
import replays from './helpers/guairaDockReplays.json';

function controls(h:ReturnType<typeof sceneLifecycleBrowser>,g:WorldGame){
    let held=new Set<string>(),frames=0;
    return {step(keys:readonly string[]){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});
        held=next;g.update(1000/60);return ++frames;
    }};
}

for(const [name,tape]of Object.entries(replays))for(const reduced of [false,true])
test(`${name}: native choices, readable receiving surfaces and complete arrival; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;
    const id=tape.id as 'travessia'|'patio',g=id==='travessia'?h.create(GuairaTraversal):h.create(GuairaJunction),c=GUAIRA_COURSES[id],play=controls(h,g);
    const rides=new Set<string>();let carried=0,fragile=0,banks=0,refuge=0,preview=0,steps=0,warning=0;
    const state=()=>JSON.stringify({p:g.player.data,objects:g.objects,foes:g.foes,camera:g.camera,coins:g.coins,tiles:g.level.data.tiles});
    for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        const oldY=g.player.data.position.y,frame=play.step(keys),p=g.player.data,feet=p.position.y+p.height,local=p.position.x-c.start;
        assert.ok(!p.isDead&&p.hasHelmet,`no mandatory damage at ${frame}`);
        if(frame>tape.prefixFrames){
            assert.ok(p.position.y-10-g.camera.y>=23&&feet-g.camera.y<=172.01,'full avatar fits');
            if(guairaCourseGuidance(g,id)?.hint==='TABUA CEDE - CONTINUE')fragile++;
            if(id==='travessia'){
                if(p.isGrounded&&local>=2240&&local<2304&&feet===c.floor)banks++;
                if(p.isGrounded&&local>=2432&&local<2528&&guairaWarehouseRoute(g)){
                    assert.ok(!keys.includes('Space'),'the descending staircase is walked without a blind jump');steps++;
                }
                const loader=g.foes.find(e=>e.spec.id.endsWith(':loader:2048'))!;
                if(loader.phase==='warning'&&!loader.dead&&feet>c.floor-60&&local<2048){
                    assert.ok(loader.y>=g.camera.y+22&&loader.y+loader.height<=g.camera.y+180,'ground approach shows the actual warning');warning++;
                }
            }else{
                for(const b of g.objects.bodies.filter(b=>b.id.includes(':transfer-'))){
                    if(p.isGrounded&&Math.abs(feet-b.y)<1&&p.position.x+p.width>b.x&&p.position.x<b.x+b.width){
                        rides.add(b.id);if(keys.length===0)carried+=Math.abs(p.position.y-oldY);
                    }
                }
                if(p.isGrounded&&local>=2336&&local<2384&&feet===c.floor-48)refuge++;
                if(!p.isGrounded&&feet<c.floor-80&&(local>=2240&&local<2336||local>=2480&&local<2528)){
                    assert.ok(c.floor-48-g.camera.y<=176,`the island/receiving dock remains visible at the jump apex: frame ${frame}, x ${local}, feet ${feet}, y ${c.floor-48-g.camera.y}`);preview++;
                }
            }
        }
        if(frame%150===0){const before=state();g.render();assert.equal(state(),before,'rendering is read only');}
    }
    assert.ok(g.finished);assert.equal(g.coins,tape.coins);assert.equal(g.store.save.checkpoint?.index,g.stage.checkpoints.length-1);
    if(id==='travessia'){
        const guard=g.foes.find(e=>e.spec.id.endsWith(':helmet:2096'))!,loader=g.foes.find(e=>e.spec.id.endsWith(':loader:2048'))!;
        assert.equal(guard.dead,tape.high);assert.equal(loader.dead,!tape.high,'the approaches confront different defenders');
        if(tape.high)assert.ok(fragile>0&&steps>10);else assert.ok(banks>5&&fragile===0&&warning>20);
    }else{
        assert.equal(rides.size,2);assert.ok(carried>20&&refuge>10&&preview>8,'both motors carry a passenger and the island allows a pause');
        for(const b of g.objects.bodies.filter(b=>b.id.includes(':transfer-'))){
            assert.deepEqual(carrierMotionErrors(b),[]);
            for(const m of carrierMounts(b,g.level))assert.ok(m&&supportsStanding(g.level.getTile(g.level.worldToCol(m.x),g.level.worldToRow(m.y+.01))),'hoist foundations meet real terrain');
        }
    }
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const id of ['travessia','patio'] as const)test(`${id}: a missed crossing causes a real fall and an earned-checkpoint retry`,t=>{
    const h=sceneLifecycleBrowser(t),g=id==='travessia'?h.create(GuairaTraversal):h.create(GuairaJunction),play=controls(h,g),c=GUAIRA_COURSES[id];
    const tape=id==='travessia'?replays['travessia-high']:replays['patio-low'];
    outer:for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        play.step(keys);const p=g.player.data,local=p.position.x-c.start,feet=p.position.y+p.height;
        if(p.isGrounded&&(id==='travessia'?local>=2214&&local<2230&&feet===c.floor-96:local>=2210&&local<2240&&feet<c.floor-16))break outer;
    }
    const cp={...g.store.save.checkpoint!};
    if(id==='patio')for(let n=0;n<100&&g.player.data.position.x<c.start+2280;n++)play.step(['ArrowRight']);
    let warned=false;
    for(let n=0;n<180&&!g.player.data.isDead;n++){
        play.step([]);warned||=guairaCourseGuidance(g,id)?.hint==='TABUA CEDE - CONTINUE';
    }
    assert.ok(g.player.data.isDead,'missing a support has a real consequence');if(id==='travessia')assert.ok(warned);
    for(let n=0;n<150;n++)play.step([]);
    assert.ok(!g.player.data.isDead&&g.player.data.hasHelmet);assert.deepEqual(g.store.save.checkpoint,cp);
    assert.equal(g.player.data.position.x,g.stage.checkpoints[cp.index].x*16);
    const result=continueGuairaCourse(g,play.step);assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);g.dispose();
});

test('the transfer island permits a long observation pause, followed by a native continuation on another motor phase',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaJunction),play=controls(h,g),c=GUAIRA_COURSES.patio;
    outer:for(const[n,keys]of replays['patio-low'].runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        play.step(keys);const p=g.player.data;
        if(p.isGrounded&&p.position.x>=c.start+2340&&p.position.x<c.start+2370&&p.position.y+p.height===c.floor-48)break outer;
    }
    dockControls(g,play.step).brake();const position={...g.player.data.position};
    for(let n=0;n<600;n++)play.step([]);
    assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);assert.ok(Math.abs(g.player.data.position.x-position.x)<1);assert.equal(g.player.data.position.y,position.y);
    assert.equal(guairaCourseGuidance(g,'patio')?.hint,'ILHA FIRME: OBSERVE O ELEVADOR');
    const safeStep=(keys:string[])=>{play.step(keys);assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead,'the delayed continuation requires no damage');};
    assert.ok(crossGuairaTransfer(g,safeStep).ok);assert.ok(continueGuairaCourse(g,safeStep).finished);g.dispose();
});

