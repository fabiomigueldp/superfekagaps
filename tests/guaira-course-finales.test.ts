import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {carrierMotionErrors} from '../src/adventure/WorldCarrierMotion';
import {continueGuairaCourse} from './helpers/guairaCourseController';
import replays from './helpers/guairaFinaleReplays.json';
import type {WorldGame} from '../src/adventure/WorldGame';

function controls(h:ReturnType<typeof sceneLifecycleBrowser>,g:WorldGame){
    let held=new Set<string>(),frames=0;
    return {step(keys:readonly string[]){
        const next=new Set(keys);
        for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});
        held=next;g.update(1000/60);return ++frames;
    }};
}
for(const [name,tape]of Object.entries(replays))for(const reduced of [false,true])
test(`${name}: distinct finale decisions survive a complete native run; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;
    const id=tape.id as 'respiros'|'alivio',g=id==='respiros'?h.create(GuairaRespiros):h.create(GuairaRelief),c=GUAIRA_COURSES[id],play=controls(h,g);
    let ride=0,carryDistance=0,fragile=0,landingPreview=0;const live=new Set<string>();
    const snapshot=()=>JSON.stringify({p:g.player.data,o:g.objects,c:g.camera,e:g.foes,coins:g.coins,tiles:g.level.data.tiles});
    for(const [count,keys]of tape.runs as Array<[number,string[]]>)for(let n=0;n<count;n++){
        const before=g.player.data.position.x,frame=play.step(keys),p=g.player.data,feet=p.position.y+p.height,local=p.position.x-c.start;
        assert.ok(p.hasHelmet&&!p.isDead,`no forced damage at ${frame}`);
        if(frame>tape.prefixFrames){
            assert.ok(p.position.y-10-g.camera.y>=23&&feet-g.camera.y<=172.01,'full player remains framed');
            const body=g.objects.bodies.find(b=>b.id.endsWith(':pump-carriage'));
            if(body&&p.isGrounded&&Math.abs(feet-body.y)<1&&p.position.x+p.width>body.x&&p.position.x<body.x+body.width){
                ride++;if(keys.length===0&&body.x>body.px)carryDistance+=p.position.x-before;
            }
            if(guairaCourseGuidance(g,id)?.hint==='TABUA CEDE - CONTINUE')fragile++;
            if(id==='respiros'&&local>=2656&&local<2704&&feet<c.floor-40){
                assert.ok(c.floor-g.camera.y<=176,'the receiving service board is visible before landing');landingPreview++;
            }
            for(const b of g.objects.bodies)if(b.id.includes(':counterpressure-')&&g.objects.jetDanger(b))live.add(b.id);
        }
        if(frame%120===0){const before=snapshot();g.render();assert.equal(snapshot(),before,'rendering cannot change the route');}
    }
    assert.ok(g.finished);assert.equal(g.coins,tape.coins);
    assert.equal(g.store.save.checkpoint?.index,g.stage.checkpoints.length-1);
    if(id==='respiros'){
        assert.deepEqual(carrierMotionErrors(g.objects.bodies.find(b=>b.id.endsWith(':pump-carriage'))!),[]);
        if(tape.high){assert.ok(ride>200&&carryDistance>180,'the native platform actually carries the passenger');assert.equal(fragile,0);}
        else {assert.ok(fragile>15&&landingPreview>5,'the lower route commits to the visible fragile walk');}
    }else{
        assert.ok(live.has(`${g.stage.id}:course:counterpressure-a`),'first discharge remains live');
        const b=g.objects.bodies.find(b=>b.id.endsWith(':counterpressure-b'))!;
        assert.equal(b.active,tape.high,'only the chosen maintenance route closes the second outlet');
        if(tape.high)assert.ok(g.foes.find(e=>e.spec.id.endsWith(':helmet:1904'))?.dead,'the valve approach has a defeated guard');
        else assert.ok(live.has(b.id),'the floor route crosses both independent live cycles');
    }
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

test('the service walk has a real fall, followed by a restart at the earned pump-basin checkpoint',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaRespiros),play=controls(h,g),c=GUAIRA_COURSES.respiros;
    const tape=replays['respiros-low'];
    outer:for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        play.step(keys);const p=g.player.data;
        if(p.isGrounded&&p.position.x>c.start+2600&&p.position.x<c.start+2630)break outer;
    }
    const checkpoint={...g.store.save.checkpoint!};let warned=false;
    for(let n=0;n<150&&!g.player.data.isDead;n++){
        play.step([]);warned||=guairaCourseGuidance(g,'respiros')?.hint==='TABUA CEDE - CONTINUE';
    }
    assert.ok(warned&&g.player.data.isDead,'hesitating over the basin cannot remain safe indefinitely');
    for(let n=0;n<150;n++)play.step([]);
    assert.ok(!g.player.data.isDead&&g.player.data.hasHelmet);assert.deepEqual(g.store.save.checkpoint,checkpoint);
    assert.equal(g.player.data.position.x,g.stage.checkpoints[checkpoint.index].x*16);
    const result=continueGuairaCourse(g,play.step);assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);g.dispose();
});
