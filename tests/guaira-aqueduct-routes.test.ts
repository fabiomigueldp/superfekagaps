import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {continueGuairaCourse} from './helpers/guairaCourseController';
import {dockControls} from './helpers/guairaDockController';
import type {WorldGame} from '../src/adventure/WorldGame';
import tapes from './helpers/guairaAqueductReplays.json';

function controls(h:ReturnType<typeof sceneLifecycleBrowser>,g:WorldGame){
    let held=new Set<string>(),frame=0;
    return (keys:readonly string[])=>{
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});
        held=next;g.update(1000/60);return ++frame;
    };
}

for(const[name,tape]of Object.entries(tapes))for(const reduced of [false,true])
test(`${name}: native terrain, choices and earned arrival, reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;
    const id=tape.id as 'subida'|'galeria',g=id==='subida'?h.create(GuairaAscent):h.create(GuairaGallery),c=GUAIRA_COURSES[id],step=controls(h,g);
    let upper=0,lower=0,fragile=0,warning=0,live=0,stairs=0;
    const snapshot=()=>JSON.stringify({p:g.player.data,objects:g.objects,foes:g.foes,camera:g.camera,coins:g.coins,tiles:g.level.data.tiles});
    for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        const frame=step(keys),p=g.player.data,feet=p.position.y+p.height,local=p.position.x-c.start;
        assert.ok(p.hasHelmet&&!p.isDead,`no required damage at ${frame}`);
        if(frame>tape.prefixFrames){
            assert.ok(p.position.y-10-g.camera.y>=23&&feet-g.camera.y<=172.01,'whole player is visible');
            if(guairaCourseGuidance(g,id)?.hint==='TABUA CEDE - CONTINUE')fragile++;
            if(id==='subida'){
                if(p.isGrounded&&feet===48&&local>=2736)upper++;
                const loader=g.foes.find(e=>e.spec.id.endsWith(':loader:2880'))!;
                if(loader.phase==='warning'&&local>=2736&&local<2880){
                    warning++;assert.ok(loader.y-g.camera.y>=22&&loader.y+loader.height-g.camera.y<180,'the warning and landing share the view');
                }
            }else{
                const outlet=g.objects.bodies.find(b=>b.id.endsWith(':inspection-outlet'))!;
                if(local>=2440&&local<2584){
                    const loader=g.foes.find(e=>e.spec.id.endsWith(':loader:2560'))!;
                    assert.ok(c.floor-g.camera.y<=176&&loader.y-g.camera.y>=22,'the last fight keeps the receiving floor and whole defender in view');
                }
                if(g.objects.jetDanger(outlet))live++;
                if(p.isGrounded&&local>1952&&local<2256&&feet===c.floor+96)lower++;
                if(p.isGrounded&&local>1968&&local<2256&&feet===c.floor)upper++;
                if(p.isGrounded&&local>=2256&&local<2368&&feet>c.floor){
                    stairs++;assert.ok(c.floor-g.camera.y>22&&c.floor-g.camera.y<176,'exit is visible from the stairs');
                }
            }
        }
        if(frame%150===0){const before=snapshot();g.render();assert.equal(snapshot(),before,'painting cannot alter the encounter');}
    }
    assert.ok(g.finished);assert.equal(g.coins,tape.coins);assert.equal(g.store.save.checkpoint?.index,g.stage.checkpoints.length-1);
    assert.equal(g.player.data.position.y+g.player.data.height,c.finishY??c.floor);
    if(id==='subida')assert.ok(upper>30&&fragile>0&&warning>5,'the climb and the warned throw are actually played');
    else{
        assert.ok(live>0,'the new outlet has a real dangerous cycle');
        assert.equal(g.objects.bodies.find(b=>b.id.endsWith(':inspection-outlet'))!.active,tape.tunnel);
        assert.equal(g.foes.find(e=>e.spec.id.endsWith(':helmet:2112'))!.dead,tape.tunnel);
        assert.equal(g.objects.bodies.find(b=>b.id.endsWith(':workshop-outlet'))!.active,false,'the lower valve only controls its own outlet');
        if(tape.tunnel)assert.ok(lower>30&&stairs>0&&upper===0);else assert.ok(upper>30&&lower===0);
    }
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const id of ['subida','galeria'] as const)test(`${id}: ignoring the new danger causes native failure and an earned retry`,t=>{
    const h=sceneLifecycleBrowser(t),g=id==='subida'?h.create(GuairaAscent):h.create(GuairaGallery),c=GUAIRA_COURSES[id],step=controls(h,g),tape=tapes[id+'-main' as 'subida-main'|'galeria-main'];
    outer:for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        step(keys);const p=g.player.data,x=p.position.x-c.start,feet=p.position.y+p.height;
        if(p.isGrounded&&(id==='subida'?x>=2650&&x<2672&&feet===64:x>=2100&&x<2124&&feet===192))break outer;
    }
    const cp={...g.store.save.checkpoint!};dockControls(g,step).brake();
    let warned=false;
    for(let n=0;n<900&&!g.player.data.isDead;n++){
        step([]);warned||=/TABUA CEDE|PRESSAO|AGUA/.test(guairaCourseGuidance(g,id)?.hint??'');
    }
    assert.ok(g.player.data.isDead&&warned,'the consequence follows a visible warning');
    for(let n=0;n<150;n++)step([]);
    assert.ok(!g.player.data.isDead&&g.player.data.hasHelmet);assert.deepEqual(g.store.save.checkpoint,cp);
    const result=continueGuairaCourse(g,step);assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);g.dispose();
});

test('maintenance permits a real return across the isolated corridor to collect the other route rewards',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaGallery),c=GUAIRA_COURSES.galeria,step=controls(h,g);
    outer:for(const[n,keys]of tapes['galeria-tunnel'].runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        step(keys);const p=g.player.data;
        if(p.isGrounded&&p.position.x>=c.start+2376&&p.position.y+p.height===c.floor)break outer;
    }
    const safe=(keys:string[])=>{step(keys);assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);};
    const {brake,land}=dockControls(g,safe);brake();const before=g.coins;
    for(let n=0;n<100&&g.player.data.position.x>c.start+2318;n++)safe(['ArrowLeft']);brake();
    assert.ok(land(c.start+2216,c.floor));
    for(let n=0;n<150&&g.player.data.position.x>c.start+2004;n++)safe(['ArrowLeft']);brake();
    const outlet=g.objects.bodies.find(b=>b.id.endsWith(':inspection-outlet'))!;
    assert.ok(outlet.active&&!g.objects.jetDanger(outlet));assert.equal(g.coins,before+2,'the upper rewards remain available after maintenance');
    for(let n=0;n<150&&g.player.data.position.x<c.start+2216;n++)safe(['ArrowRight']);brake();
    assert.ok(land(c.start+2392,c.floor));assert.ok(continueGuairaCourse(g,safe).finished);g.dispose();
});
