import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES,GUAIRA_MAINTENANCE_ROUTES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {continueGuairaCourse} from './helpers/guairaCourseController';
import {dockControls} from './helpers/guairaDockController';
import type {WorldGame} from '../src/adventure/WorldGame';
import tapes from './helpers/guairaMaintenanceReplays.json';

function controls(h:ReturnType<typeof sceneLifecycleBrowser>,g:WorldGame){
    let held=new Set<string>(),frame=0;
    return (keys:readonly string[])=>{
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});
        held=next;g.update(1000/60);return ++frame;
    };
}

for(const id of ['respiros','alivio'] as const)for(const reduced of [false,true])
test(`${id}: a complete native maintenance route changes one outlet, earns its rewards and rejoins; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;
    const g=id==='respiros'?h.create(GuairaRespiros):h.create(GuairaRelief),c=GUAIRA_COURSES[id],d=GUAIRA_MAINTENANCE_ROUTES[id]!,step=controls(h,g),tape=tapes[id];
    const guard=g.foes.find(e=>e.spec.id.endsWith(':maintenance:guard'))!,outlet=g.objects.bodies.find(b=>b.id.endsWith(':course:'+d.outlet))!;
    const phases=new Set<string>();let tells=0,descent=0,live=0,upper=0;
    const snapshot=()=>JSON.stringify({p:g.player.data,o:g.objects,c:g.camera,foes:g.foes,coins:g.coins,tiles:g.level.data.tiles});
    for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        const frame=step(keys),p=g.player.data,feet=p.position.y+p.height,local=p.position.x-c.start;
        assert.ok(p.hasHelmet&&!p.isDead,`no required hit at ${frame}`);
        if(frame>tape.prefixFrames&&local<d.end){
            assert.ok(p.position.y-10-g.camera.y>=23&&feet-g.camera.y<=172,'whole player visible');
            if(g.objects.jetDanger(outlet))live++;
            if(!guard.dead&&guard.x+guard.width>g.camera.x&&guard.x<g.camera.x+320){phases.add(guard.phase);}
            if(/MEXEDOR|PINCAS|VAGONETE/.test(guairaCourseGuidance(g,id)?.hint??''))tells++;
            if(p.isGrounded&&feet===d.top){
                upper++;
                if(!guard.dead)assert.ok(guard.y-g.camera.y>=22&&guard.y+guard.height-g.camera.y<172,'guard and stable landing share the view');
            }
            if(p.isGrounded&&d.returns.some(([left,right,top])=>feet===top&&local+p.width>left&&local<right))descent++;
        }
        if(frame%150===0){const before=snapshot();g.render();assert.equal(snapshot(),before,'paint cannot run the encounter');}
    }
    assert.ok(g.finished&&outlet.active&&guard.dead&&upper>20&&tells>5&&descent>0&&live>0);
    assert.equal(g.coins,tape.coins);assert.ok(phases.has('warning'));
    assert.ok(phases.has(id==='respiros'?'attack':'walk'));
    for(const b of g.objects.bodies.filter(b=>b.id.includes(':course:')&&b.kind==='jet'&&b!==outlet))assert.equal(b.active,false,'maintenance isolates only the linked outlet');
    const collected=(g as unknown as {collected:Set<string>}).collected;
    for(const p of g.stage.pickups.filter(p=>p.id.includes(':maintenance:coin:')))assert.ok(collected.has(p.id),'all new rewards reachable: '+p.id);
    assert.equal(g.store.save.checkpoint?.index,g.stage.checkpoints.length-1);assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const id of ['respiros','alivio'] as const)
test(`${id}: walking into the machine is dangerous; native retry keeps earned coins and a playable main route`,t=>{
    const h=sceneLifecycleBrowser(t),g=id==='respiros'?h.create(GuairaRespiros):h.create(GuairaRelief),c=GUAIRA_COURSES[id],d=GUAIRA_MAINTENANCE_ROUTES[id]!,step=controls(h,g);
    outer:for(const[n,keys]of tapes[id].runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        step(keys);const p=g.player.data;
        if(p.isGrounded&&p.position.y+p.height===d.top&&p.position.x>=c.start+d.decks[2][0]&&p.position.x<c.start+d.guard.x-20)break outer;
    }
    dockControls(g,step).brake();const cp={...g.store.save.checkpoint!},coins=g.coins;
    let warned=false;
    for(let n=0;n<900&&!g.player.data.isDead;n++){
        const x=g.player.data.position.x-c.start;
        step(x<d.guard.x?['ArrowRight']:x>d.guard.x+8?['ArrowLeft']:[]);
        warned||=/MEXEDOR|PINCAS|VAGONETE/.test(guairaCourseGuidance(g,id)?.hint??'');
    }
    assert.ok(g.player.data.isDead&&warned,'real damage follows the native machine and visible tell');
    for(let n=0;n<150;n++)step([]);
    assert.ok(!g.player.data.isDead&&g.player.data.hasHelmet);assert.deepEqual(g.store.save.checkpoint,cp);assert.equal(g.coins,coins);
    const result=continueGuairaCourse(g,step);assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);g.dispose();
});

for(const id of ['respiros','alivio'] as const)
test(`${id}: the maintenance branch permits returning to the floor before continuing`,t=>{
    const h=sceneLifecycleBrowser(t),g=id==='respiros'?h.create(GuairaRespiros):h.create(GuairaRelief),c=GUAIRA_COURSES[id],d=GUAIRA_MAINTENANCE_ROUTES[id]!,step=controls(h,g);
    const outlet=g.objects.bodies.find(b=>b.id.endsWith(':course:'+d.outlet))!;
    outer:for(const[n,keys]of tapes[id].runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        step(keys);if(outlet.active&&g.player.data.isGrounded)break outer;
    }
    let returning=0;const before=g.coins;
    const safe=(keys:string[])=>{step(keys);assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);if(guairaCourseGuidance(g,id)?.hint==='RETORNO: PROCURE APOIOS')returning++;};
    const {brake,land}=dockControls(g,safe);brake();
    assert.ok(land(c.start+d.decks[2][0]+20,d.top,undefined,8));
    for(const [left,right,y]of [...d.decks.slice(0,2)].reverse())assert.ok(land(c.start+(left+right)/2,y,undefined,8));
    assert.ok(land(c.start+d.entry-32,c.floor,undefined,8));
    assert.ok(returning>10&&outlet.active);assert.ok(g.coins>=before);
    const result=continueGuairaCourse(g,safe);assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);g.dispose();
});
