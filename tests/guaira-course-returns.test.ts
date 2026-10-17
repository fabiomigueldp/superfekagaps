import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES,type GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance,updateGuairaCourseNavigation} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {sampleGuairaExploration} from '../src/adventure/experimental/guaira/GuairaCourseExploration';
import type {WorldGame} from '../src/adventure/WorldGame';
import tapes from './helpers/guairaReturnReplays.json';

const constructors:Record<GuairaCourseId,new(c:HTMLCanvasElement,s:HTMLElement)=>WorldGame&{finished:boolean}>={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
for(const id of Object.keys(constructors) as GuairaCourseId[])for(const reduced of [false,true])
test(`${id}: native round trip keeps its discoveries, readable landings and a complete route; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;
    const g=h.create(constructors[id]),c=GUAIRA_COURSES[id],tape=tapes[id];
    let held=new Set<string>(),frame=0,returnHints=0,coinsBefore=0;
    const snapshot=()=>JSON.stringify({p:g.player.data,c:g.camera,o:g.objects,foes:g.foes,coins:g.coins,tiles:g.level.data.tiles});
    for(const[n,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let i=0;i<n;i++){
            const previousCameraX=g.camera.x;
            g.update(1000/60);frame++;const p=g.player.data;
            assert.ok(p.hasHelmet&&!p.isDead,`intact at ${frame}`);
            if(frame===tape.prefixFrames)coinsBefore=g.coins;
            if(frame>tape.prefixFrames&&frame<=tape.returnEnd){
                assert.ok(Math.abs(g.camera.x-previousCameraX)<=8.01,'turning back pans smoothly across the full preview offset');
                assert.ok(p.position.y-10-g.camera.y>=23&&p.position.y+p.height-g.camera.y<=172,'whole player stays visible');
                returnHints+=Number(guairaCourseGuidance(g,id)?.hint==='RETORNO: PROCURE APOIOS');
                const note=tape.notes.find(note=>note.frame===frame);
                if(note){
                    assert.ok(p.isGrounded&&Math.abs(p.position.y+p.height-note.target[1])<1,'actual return foothold');
                    assert.ok(c.start+note.target[0]-g.camera.x>=0&&c.start+note.target[0]-g.camera.x<320,'receiving support on screen');
                }
            }
            if(frame%120===0){const before=snapshot();g.render();assert.equal(snapshot(),before);}
        }
    }
    assert.ok(returnHints>30);assert.ok(g.finished);assert.equal(frame,tape.frames);assert.equal(g.coins,tape.coins);assert.ok(g.coins>=coinsBefore);
    assert.ok((sampleGuairaExploration(g)?.[`${id}:detour`]?.length??0)>=3);
    assert.deepEqual(g.store.save.completed,[],'isolated native run cannot award campaign receipts');g.dispose();
});

test('turning back previews the active grate ahead on the left, before contact',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaRelief),c=GUAIRA_COURSES.alivio;
    // Isolated presentation fixture; completed-route proofs above use inputs only.
    g.player.data.position={x:c.start+500,y:200};updateGuairaCourseNavigation(g,'alivio',true);
    g.player.data.position.x=c.start+450;updateGuairaCourseNavigation(g,'alivio');g.objects.time=1200;
    const jet=g.objects.bodies.find(b=>b.id.endsWith(':independent-ramal'))!;
    assert.ok(g.objects.jetDanger(jet));assert.ok(g.player.data.position.x>jet.x+jet.width,'no collision yet');
    assert.equal(guairaCourseGuidance(g,'alivio')?.hint,'AGUA NA GRELHA');
    g.dispose();
});
