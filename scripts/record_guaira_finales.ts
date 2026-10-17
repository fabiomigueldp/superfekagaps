import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {playGuairaFinale} from '../tests/helpers/guairaFinaleController';
const id=process.argv[2] as 'respiros'|'alivio',high=process.argv[3]!=='low';
if(!['respiros','alivio'].includes(id))throw Error('Expected respiros or alivio');
const wait=Number(process.env.GUAIRA_FINALE_WAIT??0);if(!Number.isInteger(wait)||wait<0)throw Error('Invalid wait');
const tape=JSON.parse(readFileSync('tests/helpers/guairaExplorationReplays.json','utf8'))[id];
const cleanup:any[]=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f)}),g=id==='respiros'?h.create(GuairaRespiros):h.create(GuairaRelief);
let held=new Set<string>(),frames=0;const runs:Array<[number,string[]]>=[],damage:number[]=[],trace:any[]=[],notes:any[]=[];
const course=GUAIRA_COURSES[id];
let rideFrames=0,fragileFrames=0,liveJets=0,warningFrames=0;
const step=(keys:string[])=>{
 const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
 const p=g.player.data,helmet=p.hasHelmet;g.update(1000/60);frames++;if(helmet&&!p.hasHelmet)damage.push(frames);
 const previous=runs.at(-1);if(previous&&previous[1].join()===keys.join())previous[0]++;else runs.push([1,keys]);
 const carrier=g.objects.bodies.find(b=>b.id.endsWith(':pump-carriage'));
 if(carrier&&p.isGrounded&&Math.abs(p.position.y+p.height-carrier.y)<1&&p.position.x+p.width>carrier.x&&p.position.x<carrier.x+carrier.width)rideFrames++;
 const local=p.position.x-course.start;
 if(local>2500&&g.level.getFallingPlatformRenderData().some(b=>b.phase!=='falling'&&Math.abs(g.level.rowToWorldY(b.row)-p.position.y-p.height)<1&&g.level.colToWorldX(b.col)<p.position.x+p.width&&g.level.colToWorldX(b.col)+16>p.position.x))fragileFrames++;
 if(g.objects.bodies.some(b=>b.id.includes(':counterpressure-')&&g.objects.jetDanger(b)))liveJets++;
 if(g.foes.some(e=>e.spec.x>course.start+(id==='respiros'?2368:1600)&&e.phase==='warning'))warningFrames++;
 if(frames%15===0&&local>(id==='respiros'?2368:1600))notes.push({frame:frames,at:[local,p.position.y+p.height],camera:{...g.camera}});
 trace.push({frame:frames,x:local,feet:p.position.y+p.height,v:{...p.velocity},ground:p.isGrounded,keys});if(trace.length>120)trace.shift();
};
outer:for(const[n,keys]of tape.runs)for(let i=0;i<n;i++){
 const p=g.player.data;if(p.isGrounded&&p.position.x>=course.start+(id==='respiros'?2368:1600))break outer;step(keys);
}
const prefixFrames=frames,result=playGuairaFinale(g,id,high,step,wait);
const report={id,high,wait,frames,prefixFrames,finished:g.finished,damage,dead:g.player.data.isDead,coins:g.coins,rideFrames,fragileFrames,liveJets,warningFrames,
 valve:g.objects.bodies.find(b=>b.id.endsWith(':counterpressure-b:valve'))?.active,guardDefeated:g.foes.find(e=>e.spec.id.endsWith(':helmet:1904'))?.dead,result,notes,runs,trace:damage.length||!g.finished?trace:undefined};
const out=process.env.GUAIRA_TAPE_OUT??'output/guaira/encounter-polish-2026-10-17/finales';mkdirSync(out,{recursive:true});
writeFileSync(`${out}/${id}-${high?'high':'low'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,runs:undefined,trace:undefined,notes:undefined}));
g.dispose();for(const f of cleanup.reverse())f();if(!report.finished||damage.length)process.exitCode=1;
