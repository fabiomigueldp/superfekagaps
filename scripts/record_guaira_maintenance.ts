import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {continueGuairaCourse} from '../tests/helpers/guairaCourseController';
import {crossGuairaMaintenance} from '../tests/helpers/guairaMaintenanceController';
import {dockControls} from '../tests/helpers/guairaDockController';
const root='output/guaira/maintenance-design-2026-10-17';
const id=process.argv[2] as 'respiros'|'alivio',wait=Number(process.env.GUAIRA_MAINTENANCE_WAIT??0);
if(!['respiros','alivio'].includes(id)||!Number.isInteger(wait)||wait<0)throw Error('valid id and wait required');
const tapes=JSON.parse(readFileSync(root+'/baseline/guairaExplorationReplays.json','utf8')),tape=tapes[id];
const cleanup:any[]=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f)}),g=id==='respiros'?h.create(GuairaRespiros):h.create(GuairaRelief),c=GUAIRA_COURSES[id];
let held=new Set<string>(),frames=0;const runs:Array<[number,string[]]>=[],damage:number[]=[],trace:any[]=[],notes:any[]=[];
function step(keys:string[]){
 const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
 const helmet=g.player.data.hasHelmet;g.update(1000/60);frames++;const p=g.player.data,feet=p.position.y+p.height;
 if(helmet&&!p.hasHelmet){damage.push(frames);console.error(JSON.stringify({hit:frames,trace:trace.slice(-16)}));}
 const prior=runs.at(-1);if(prior&&prior[1].join()===keys.join())prior[0]++;else runs.push([1,keys]);
 trace.push({frame:frames,x:p.position.x-c.start,feet,v:{...p.velocity},ground:p.isGrounded,keys,
  guards:g.foes.filter(e=>e.spec.id.includes(':maintenance:')).map(e=>({x:e.x-c.start,phase:e.phase,timer:e.timer,dead:e.dead}))});if(trace.length>120)trace.shift();
 if(frames%10===0)notes.push({frame:frames,at:[p.position.x-c.start,feet],coins:g.coins,hint:guairaCourseGuidance(g,id)?.hint});
}
outer:for(const[n,keys]of tape.runs)for(let i=0;i<n;i++){
 const p=g.player.data;if(p.isGrounded&&p.position.x>=c.start+(id==='respiros'?1300:980))break outer;step(keys);
}
const prefixFrames=frames;dockControls(g,step).brake();for(let i=0;i<wait;i++)step([]);
const ok=crossGuairaMaintenance(g,step,id),result=ok?continueGuairaCourse(g,step):null;
const report={id,wait,frames,prefixFrames,coins:g.coins,finished:g.finished,damage,dead:g.foes.filter(e=>e.dead).map(e=>e.spec.id),
 isolated:g.objects.bodies.filter(b=>b.kind==='jet'&&b.active).map(b=>b.id),position:g.player.data.position,checkpoint:g.store.save.checkpoint?.index,
 result,notes,runs,trace:g.finished&&!damage.length?undefined:trace};
const out=process.env.GUAIRA_TAPE_OUT??root+'/drafts';mkdirSync(out,{recursive:true});writeFileSync(`${out}/${id}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,runs:undefined,trace:undefined,notes:undefined}));g.dispose();for(const f of cleanup.reverse())f();
if(!report.finished||damage.length)process.exitCode=1;
