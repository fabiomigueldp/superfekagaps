import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {continueGuairaCourse} from '../tests/helpers/guairaCourseController';
import {crossGuairaWarehouse,crossGuairaRiceBanks,dockControls} from '../tests/helpers/guairaDockController';
const root='output/guaira/docks-design-2026-10-17';
const id=process.argv[2] as 'travessia'|'patio',high=process.argv[3]==='high',wait=Number(process.env.GUAIRA_DOCK_WAIT??0);
if(!['travessia','patio'].includes(id)||!Number.isInteger(wait)||wait<0)throw Error('valid id and wait required');
const inputFile=process.env.GUAIRA_DOCK_FILE??'guairaExplorationReplays',inputKey=process.env.GUAIRA_DOCK_KEY??id;
const file='tests/helpers/'+inputFile+'.json',backup=root+'/baseline/'+inputFile+'.json';
if(!existsSync(backup))writeFileSync(backup,readFileSync(file));
const data=JSON.parse(readFileSync(backup,'utf8')),tape=inputKey==='main'?data:data[inputKey];
const cleanup:any[]=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f)}),g=id==='travessia'?h.create(GuairaTraversal):h.create(GuairaJunction),c=GUAIRA_COURSES[id];
let held=new Set<string>(),frames=0;const runs:Array<[number,string[]]>=[],damage:number[]=[],trace:any[]=[],notes:any[]=[],ride:Record<string,number>={},dead=new Set();
function step(keys:string[]){
 const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
 const helmet=g.player.data.hasHelmet;g.update(1000/60);frames++;const p=g.player.data,feet=p.position.y+p.height;
 if(helmet&&!p.hasHelmet){damage.push(frames);console.error('HIT',JSON.stringify({frame:frames,x:p.position.x-c.start,feet,v:p.velocity,keys,barrels:g.objects.barrels.map(b=>({x:b.x-c.start,y:b.y})),foes:g.foes.filter(e=>Math.abs(e.x-p.position.x)<120).map(e=>({x:e.x-c.start,y:e.y,kind:e.spec.kind,phase:e.phase}))}));}
 const prior=runs.at(-1);if(prior&&prior[1].join()===keys.join())prior[0]++;else runs.push([1,keys]);
 for(const b of g.objects.bodies)if(b.id.includes(':transfer-')&&p.isGrounded&&Math.abs(feet-b.y)<1&&p.position.x+p.width>b.x&&p.position.x<b.x+b.width)ride[b.id]=(ride[b.id]??0)+1;
 for(const e of g.foes)if(e.dead)dead.add(e.spec.id);
 trace.push({frame:frames,x:p.position.x-c.start,feet,v:{...p.velocity},ground:p.isGrounded,keys,platforms:g.objects.bodies.filter(b=>b.id.includes(':transfer-')).map(b=>({id:b.id,y:b.y,dy:b.y-b.py}))});if(trace.length>120)trace.shift();
 if(frames%15===0)notes.push({frame:frames,at:[p.position.x-c.start,feet],coins:g.coins});
}
outer:for(const[n,keys]of [[tape.initialSettleFrames??0,[]],...(Array.isArray(tape)?tape:tape.runs)])for(let i=0;i<n;i++){
 const p=g.player.data;
 if(p.isGrounded&&p.position.x>=c.start+(id==='travessia'?1824:2016))break outer;
 step(keys as string[]);
}
const prefixFrames=frames;dockControls(g,step).brake();for(let i=0;i<wait;i++)step([]);
const upper=id==='travessia'?(high?crossGuairaWarehouse(g,step):crossGuairaRiceBanks(g,step)):true;
const result=upper?continueGuairaCourse(g,step):null;
const report={id,high,wait,frames,prefixFrames,coins:g.coins,finished:g.finished,damage,ride,dead:[...dead],position:g.player.data.position,
 checkpoint:g.store.save.checkpoint?.index,result,notes,runs,trace:g.finished&&!damage.length?undefined:trace};
const out=process.env.GUAIRA_TAPE_OUT??root+'/drafts';mkdirSync(out,{recursive:true});writeFileSync(`${out}/${id}-${high?'high':'low'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,runs:undefined,trace:undefined,notes:undefined}));g.dispose();for(const f of cleanup.reverse())f();
if(!g.finished||damage.length)process.exitCode=1;

