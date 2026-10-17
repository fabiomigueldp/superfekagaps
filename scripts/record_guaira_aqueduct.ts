import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {continueGuairaCourse} from '../tests/helpers/guairaCourseController';
import {crossGuairaAqueduct,crossGuairaInspection} from '../tests/helpers/guairaAqueductController';
import {dockControls} from '../tests/helpers/guairaDockController';
const root='output/guaira/aqueduct-design-2026-10-17';
const id=process.argv[2] as 'subida'|'galeria',tunnel=process.argv[3]==='tunnel',wait=Number(process.env.GUAIRA_AQUEDUCT_WAIT??0);
if(!['subida','galeria'].includes(id)||!Number.isInteger(wait)||wait<0)throw Error('valid id and wait required');
const inputFile=process.env.GUAIRA_AQUEDUCT_FILE??'guairaExplorationReplays',inputKey=process.env.GUAIRA_AQUEDUCT_KEY??id;
const file='tests/helpers/'+inputFile+'.json',backup=root+'/baseline/'+inputFile+'.json';mkdirSync(root+'/baseline',{recursive:true});
if(!existsSync(backup))writeFileSync(backup,readFileSync(file));
const data=JSON.parse(readFileSync(backup,'utf8')),tape=inputKey==='main'?data:data[inputKey];
const cleanup:any[]=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f)}),g=id==='subida'?h.create(GuairaAscent):h.create(GuairaGallery),c=GUAIRA_COURSES[id];
let held=new Set<string>(),frames=0;const runs:Array<[number,string[]]>=[],damage:number[]=[],trace:any[]=[],notes:any[]=[];
function step(keys:string[]){
 const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
 const helmet=g.player.data.hasHelmet;g.update(1000/60);frames++;const p=g.player.data,feet=p.position.y+p.height;
 if(helmet&&!p.hasHelmet){damage.push(frames);console.error('HIT',JSON.stringify({frame:frames,x:p.position.x-c.start,feet,keys,foes:g.foes.filter(e=>Math.abs(e.x-p.position.x)<180).map(e=>({x:e.x-c.start,y:e.y,phase:e.phase})),barrels:g.objects.barrels}));}
 const prior=runs.at(-1);if(prior&&prior[1].join()===keys.join())prior[0]++;else runs.push([1,keys]);
 trace.push({frame:frames,x:p.position.x-c.start,feet,v:{...p.velocity},ground:p.isGrounded,keys});if(trace.length>120)trace.shift();
 if(frames%15===0)notes.push({frame:frames,at:[p.position.x-c.start,feet],coins:g.coins});
}
outer:for(const[n,keys]of [[tape.initialSettleFrames??0,[]],...(Array.isArray(tape)?tape:tape.runs)])for(let i=0;i<n;i++){
 const p=g.player.data;if(p.isGrounded&&p.position.x>=c.start+(id==='subida'?2272:1696))break outer;step(keys as string[]);
}
const prefixFrames=frames;dockControls(g,step).brake();for(let i=0;i<wait;i++)step([]);
const ok=id==='subida'?crossGuairaAqueduct(g,step):crossGuairaInspection(g,step,tunnel);
const result=ok?continueGuairaCourse(g,step):null;
const report={id,tunnel,wait,frames,prefixFrames,coins:g.coins,finished:g.finished,damage,dead:g.foes.filter(e=>e.dead).map(e=>e.spec.id),
 isolated:g.objects.bodies.find(b=>b.id.endsWith(':inspection-outlet'))?.active,position:g.player.data.position,
 checkpoint:g.store.save.checkpoint?.index,result,notes,runs,trace:g.finished&&!damage.length?undefined:trace};
const out=process.env.GUAIRA_TAPE_OUT??root+'/drafts';mkdirSync(out,{recursive:true});writeFileSync(`${out}/${id}-${tunnel?'tunnel':'main'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,runs:undefined,trace:undefined,notes:undefined}));g.dispose();for(const f of cleanup.reverse())f();
if(!report.finished||damage.length)process.exitCode=1;
