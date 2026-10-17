/** Native-control audit: explore a high route, retrace its approach, then finish. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES,GUAIRA_COURSE_DETOURS,type GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {dockControls} from '../tests/helpers/guairaDockController';
import {continueGuairaCourse} from '../tests/helpers/guairaCourseController';
import {jetCycle} from '../src/adventure/WorldMachineState';
import tapes from '../tests/helpers/guairaExplorationReplays.json';
import type {WorldGame} from '../src/adventure/WorldGame';

const paths:Record<GuairaCourseId,number[][]>={
    travessia:[[344,64],[264,96],[168,144],[120,192]],
    patio:[[330,96],[200,144],[120,208]],
    respiros:[[1064,144],[952,160],[848,208],[772,256],[704,304]],
    subida:[[1936,48],[1860,80],[1800,144]],
    galeria:[[996,64],[888,64],[824,96],[728,144],[672,192]],
    alivio:[[496,176],[440,176],[352,224],[240,240],[164,288],[120,336]],
};
const constructors:Record<GuairaCourseId,new(c:HTMLCanvasElement,s:HTMLElement)=>WorldGame&{finished:boolean}>={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
const id=process.argv[2] as GuairaCourseId,dir=process.env.GUAIRA_TAPE_OUT??'output/guaira/exploration-return-2026-10-17/drafts';
if(!constructors[id])throw Error('A course id is required');
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)}),g=h.create(constructors[id]) as WorldGame&{finished:boolean};
const c=GUAIRA_COURSES[id],d=GUAIRA_COURSE_DETOURS[id],runs:Array<[number,string[]]>=[],damage:number[]=[],notes:unknown[]=[],trace:unknown[]=[];
let held=new Set<string>(),frame=0,returning=false,returnFrames=0,minHelmet=Infinity,maxFeet=-Infinity;
function step(keys:string[]){
    const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
    const helmet=g.player.data.hasHelmet;g.update(1000/60);frame++;
    if(helmet&&!g.player.data.hasHelmet)damage.push(frame);
    const p=g.player.data,feet=p.position.y+p.height,hint=guairaCourseGuidance(g,id)?.hint;
    if(returning){minHelmet=Math.min(minHelmet,p.position.y-10-g.camera.y);maxFeet=Math.max(maxFeet,feet-g.camera.y);if(hint==='RETORNO: PROCURE APOIOS')returnFrames++;}
    trace.push({frame,x:p.position.x-c.start,feet,ground:p.isGrounded,keys,hint,camY:g.camera.y});if(trace.length>180)trace.shift();
    const last=runs.at(-1);if(last&&last[1].join()===keys.join())last[0]++;else runs.push([1,keys]);
}
outer:for(const[n,keys]of tapes[id].runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
    step(keys);const p=g.player.data;
    if(p.isGrounded&&p.position.y+p.height===d.top&&g.foes.find(e=>e.spec.id.endsWith(':detour:guard'))?.dead
        &&g.stage.pickups.filter(p=>p.id.includes(':detour:coin:')).every(p=>g.hasCollectedPickup(p.id)))break outer;
}
const prefixFrames=frame;returning=true;
const {brake,land}=dockControls(g,step);brake();let returned=true;
for(const [x,y] of paths[id]){
    if(id==='alivio'&&x===352){
        const jet=g.objects.bodies.find(b=>b.id.endsWith(':independent-ramal'))!;
        for(let n=0;n<300&&jetCycle(jet,g.objects.time).phase!=='idle';n++)step([]);
    }
    const landed=land(c.start+x,y,undefined,y>g.player.data.position.y+g.player.data.height+16?8:24);
    notes.push({target:[x,y],landed,frame,at:[g.player.data.position.x-c.start,g.player.data.position.y+g.player.data.height]});
    if(!landed){returned=false;break;}
}
const returnEnd=frame;returning=false;
// The dock's low approach is a water gap: regain the same authored steps.
if(returned&&id==='patio')for(const[x,y]of [[200,144],[330,96],[424,48],[500,48],[544,112],[592,160],[640,208]])
    if(!land(c.start+x,y,undefined,y>g.player.data.position.y+g.player.data.height+16?8:24)){returned=false;break;}
const continuation=returned?continueGuairaCourse(g,step):null;
const report={id,frames:frame,coins:g.coins,prefixFrames,returnEnd,returned,returnFrames,minHelmet,maxFeet,finished:g.finished,damage,notes,continuation,runs};
mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${id}-draft.json`,JSON.stringify(report,null,2));
if(!returned||damage.length)writeFileSync(`${dir}/${id}-trace.json`,JSON.stringify(trace,null,2));
console.log(JSON.stringify({...report,runs:undefined}));g.dispose();cleanup.reverse().forEach(f=>f());
if(!returned||!report.finished||damage.length)process.exitCode=1;
