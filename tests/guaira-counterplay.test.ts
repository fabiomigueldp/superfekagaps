import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {WorldFoe} from '../src/adventure/WorldEnemies';
import {drawGuairaFoe} from '../src/adventure/experimental/guaira/GuairaFoeArt';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import type {GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import tapes from './helpers/guairaCounterplayReplays.json';

const scenes={travessia:GuairaTraversal,subida:GuairaAscent,respiros:GuairaRespiros,alivio:GuairaRelief};
const dt=1000/60;
for(const[name,tape]of Object.entries(tapes))for(const reduced of [false,true])
test(`${name}: the real checkpoint encounter has visible counterplay and no mandatory hit; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;const Scene=scenes[tape.course as keyof typeof scenes],g=h.create<InstanceType<typeof Scene>>(Scene);
    g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(tape.foeId))!,contacts:Array<{frame:number;result:string;phase:string;pound:boolean}>=[];
    let frame=0,held=new Set<string>();const hints=new Set<string>(),phases=new Set<string>();
    const contact=e.contact.bind(e);e.contact=(p,previous,falling,pound)=>{
        const phase=e.phase,result=contact(p,previous,falling,pound);
        if(result==='bounce'||result==='kill')contacts.push({frame:frame+1,result,phase,pound});return result;
    };
    const snapshot=()=>JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,c:g.camera,t:g.time});
    for(const[count,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let n=0;n<count;n++){
            g.update(dt);frame++;const p=g.player.data;
            assert.ok(!p.isDead&&p.hasHelmet,`${name} at ${frame}`);assert.ok(p.position.y-4-g.camera.y>=23&&p.position.y+p.height-g.camera.y<=172.01);
            const hint=guairaCourseGuidance(g,tape.course as GuairaCourseId)?.hint??'';hints.add(hint);phases.add(e.phase);
            if(name==='helmet-stomps'&&frame===100)assert.equal(hint,'COURACA QUEBRADA: ATAQUE','the first bounce retains the exposed target below');
            if(name==='charger-counter'&&frame===120)assert.equal(hint,'AGORA: ATAQUE POR CIMA','the porters ledge retains the recovery opening below');
            if(!e.dead&&p.isGrounded&&Math.abs(e.x-p.position.x)<90&&Math.abs(e.y+e.height-p.position.y-p.height)<65){
                assert.ok(e.y-20-g.camera.y>=23&&e.y+e.height-g.camera.y<=180,`guard, tell and landing remain visible at ${frame}`);
            }
            if(frame%20===0){const before=snapshot();g.render();assert.equal(snapshot(),before);}
        }
    }
    assert.equal(frame,tape.frames);assert.ok(e.dead);assert.deepEqual(contacts,tape.contacts.map(({frame,result,phase,pound})=>({frame,result,phase,pound})));
    if(name.startsWith('rail')){assert.ok(hints.has('VAGONETE FREOU: ATAQUE'));assert.ok(hints.has('VAGONETE: SENTADA OU ESPERE'));}
    if(name==='charger-counter'){assert.ok(phases.has('attack'));assert.ok(hints.has('AGORA: ATAQUE POR CIMA'));}
    if(name==='agitator-counter'){assert.ok(phases.has('attack'));assert.ok(hints.has('PINCAS RECOLHIDAS: SALTE'));}
    if(name==='helmet-stomps')assert.equal(e.armor,false);
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const direction of [-1,1])test(`the trolley roof distinguishes a moving stomp, an open brake and a ground pound: ${direction}`,()=>{
    for(const phase of ['walk','warning'] as const)for(const pound of [false,true]){
        const e=new WorldFoe({id:'rail',kind:'rail',x:100,y:192,behavior:'canal'});e.phase=phase;e.facing=direction;
        const p={x:e.x+4,y:e.y-20,width:14,height:24},result=e.contact(p,{...p,y:e.y-25},true,pound);
        const guarded=phase==='walk'&&!pound;assert.equal(result,guarded?'bounce':'kill');assert.equal(e.dead,!guarded);
        assert.equal(e.hp,1,'a blocked stomp cannot secretly consume armour or health');
    }
    const e=new WorldFoe({id:'rail',kind:'rail',x:100,y:192,behavior:'canal'});e.phase='warning';
    assert.equal(e.contact(e,e,false,false),'hurt','the open roof does not make side contact safe');
});
test('the new roof rule is opt-in and leaves a legacy trolley stompable',()=>{
    const e=new WorldFoe({id:'legacy',kind:'rail',x:100,y:192});const p={x:104,y:e.y-20,width:14,height:24};
    assert.equal(e.contact(p,{...p,y:e.y-25},true,false),'kill');
});

for(const name of ['charger-counter','rail-window'] as const)for(const reduced of [false,true])
test(`${name}: the opening freezes during a native pause and resumes from the same state; reduced=${reduced}`,t=>{
    const tape=tapes[name],Scene=scenes[tape.course as keyof typeof scenes],h=sceneLifecycleBrowser(t);h.media.matches=reduced;
    const g=h.create<InstanceType<typeof Scene>>(Scene);g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    let frame=0,held=new Set<string>();const until=name==='charger-counter'?tapes[name].marks.recovery+3:tapes[name].marks.open+5;
    outer:for(const[count,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let n=0;n<count;n++){g.update(dt);if(++frame===until)break outer;}
    }
    for(const k of held)h.window.dispatch('keyup',{code:k,target:h.canvas});
    h.window.dispatch('keydown',{code:'Escape',key:'Escape',target:h.canvas});g.update(dt);h.window.dispatch('keyup',{code:'Escape',key:'Escape',target:h.canvas});
    assert.equal(g.state,'paused');const snapshot=()=>JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,c:g.camera,t:g.time}),before=snapshot();
    for(let n=0;n<90;n++){g.update(dt);g.render();}assert.equal(snapshot(),before);
    if(g instanceof GuairaAscent)g.toggleAscentPause();else if(g instanceof GuairaRelief)g.toggleReliefPause();
    g.update(dt);assert.notEqual(snapshot(),before);g.dispose();
});

function silhouette(e:WorldFoe,reduced=false){
    const rows:unknown[]=[];let depth=0;
    const c={fillStyle:'',globalAlpha:1,save(){depth++;},restore(){depth--;},translate(){},scale(){},
        fillRect(x:number,y:number,w:number,h:number){assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);if(y<0&&y>=-e.height-4)rows.push([this.fillStyle,x,y,w,h,this.globalAlpha]);}};
    const before=JSON.stringify(e);drawGuairaFoe(c as unknown as CanvasRenderingContext2D,e,0,0,reduced);assert.equal(JSON.stringify(e),before);assert.equal(depth,0);return JSON.stringify(rows);
}
test('the charging brace and exposed recovery use distinct progressive body poses, not only text',()=>{
    const e=new WorldFoe({id:'charger',kind:'charger',x:100,y:192,behavior:'canal'});
    e.phase='warning';const brace=[0,300,600].map(t=>{e.timer=t;return silhouette(e);});assert.equal(new Set(brace).size,3);
    e.phase='rest';const recovery=[0,500,1000].map(t=>{e.timer=t;return silhouette(e);});assert.equal(new Set(recovery).size,3);
    for(const pose of recovery)assert.ok(!brace.includes(pose));
});
test('moving and braking trolley roofs remain distinguishable with reduced motion, and block feedback does not flash',()=>{
    const e=new WorldFoe({id:'rail',kind:'rail',x:100,y:192,behavior:'canal'});
    const closed=silhouette(e,true);e.flash=95;assert.equal(silhouette(e,true),closed);
    e.phase='warning';const open=silhouette(e,true);assert.notEqual(open,closed);assert.equal(silhouette(e,true),open);
});
