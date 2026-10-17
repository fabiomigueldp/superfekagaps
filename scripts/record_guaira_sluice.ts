import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {continueGuairaCourse} from '../tests/helpers/guairaCourseController';
import {crossGuairaRiceLock} from '../tests/helpers/guairaSluiceController';
import {crossGuairaWarehouse} from '../tests/helpers/guairaDockController';

const root='output/guaira/sluice-routes-2026-10-17',mode=process.argv[2]??'main';
if(!['main','high','recovery','return','exploration','primary-return','warehouse'].includes(mode))throw Error('Unknown sluice route');
const read=(name:string)=>{
    const baseline=`${root}/baseline/${name}.json`;
    return JSON.parse(readFileSync(existsSync(baseline)?baseline:`tests/helpers/${name}.json`,'utf8'));
};
const tape=mode==='main'?read('guairaFieldRoutesReplays').travessia:mode==='primary-return'?read('guairaReturnReplays').travessia:read('guairaExplorationReplays').travessia;
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)}),g=h.create(GuairaTraversal),c=GUAIRA_COURSES.travessia;
let held=new Set<string>(),frames=0,finalePrefixFrames=0;const runs:Array<[number,string[]]>=[],notes:unknown[]=[],damage:number[]=[],trace:unknown[]=[];
const waits=Number(process.env.GUAIRA_SLUICE_WAIT??0);
if(!Number.isInteger(waits)||waits<0)throw Error('GUAIRA_SLUICE_WAIT must be a non-negative frame count');
function step(keys:string[]){
    const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
    const helmet=g.player.data.hasHelmet;g.update(1000/60);frames++;
    if(helmet&&!g.player.data.hasHelmet){damage.push(frames);console.error('HIT',JSON.stringify({frame:frames,x:g.player.data.position.x-c.start,feet:g.player.data.position.y+g.player.data.height,water:g.objects.bodies.filter(b=>b.id.includes(':course:')&&g.objects.jetDanger(b)).map(b=>b.id),foes:g.foes.filter(e=>!e.dead&&Math.abs(e.x-g.player.data.position.x)<48).map(e=>({x:e.x-c.start,y:e.y,kind:e.spec.kind}))}));}
    const p=g.player.data,local=p.position.x-c.start,feet=p.position.y+p.height;
    const item={frame:frames,x:local,feet,at:[local,feet],ground:p.isGrounded,keys,hint:guairaCourseGuidance(g,'travessia')?.hint};
    trace.push(item);if(trace.length>160)trace.shift();
    if(frames%15===0&&local>=576)notes.push(item);
    if(!finalePrefixFrames&&local>=1824&&p.isGrounded)finalePrefixFrames=frames;
    const prior=runs.at(-1);if(prior&&prior[1].join()===keys.join())prior[0]++;else runs.push([1,keys]);
}
outer:for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
    const p=g.player.data;
    if(p.isGrounded&&p.position.y+p.height===c.floor&&p.position.x>=c.start+608)break outer;
    step(keys);
}
const prefixFrames=frames;
for(let i=0;i<waits;i++)step([]);
const route=mode==='high'?'high':mode==='recovery'?'recover':mode==='return'?'return':'low';
const crossed=crossGuairaRiceLock(g,step,route),crossingEnd=frames;
let result=null;
if(crossed&&mode==='warehouse'){
    // Stop the ordinary driver at the next earned checkpoint, then take the
    // warehouse branch. No simulation values are assigned by this authoring tool.
    const advance=(keys:string[])=>{if(g.player.data.position.x<c.start+1824||!g.player.data.isGrounded)step(keys);else throw checkpoint;};
    const checkpoint=Symbol('warehouse approach');
    try{continueGuairaCourse(g,advance);}catch(e){if(e!==checkpoint)throw e;}
    if(crossGuairaWarehouse(g,step))result=continueGuairaCourse(g,step);
}else if(crossed)result=continueGuairaCourse(g,step);
const report={id:'travessia',mode,frames,prefixFrames,crossingEnd,finalePrefixFrames,waits,crossed,finished:g.finished,coins:g.coins,damage,result,notes,runs,
    trace:!g.finished||damage.length?trace:undefined};
const out=process.env.GUAIRA_TAPE_OUT??root+'/drafts';mkdirSync(out,{recursive:true});writeFileSync(`${out}/${mode}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,runs:undefined,notes:undefined,trace:undefined}));g.dispose();cleanup.reverse().forEach(f=>f());
if(!report.finished||damage.length)process.exitCode=1;
