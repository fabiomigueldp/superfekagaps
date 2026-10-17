/** Native inputs only. Use an authored JSON tape to record the real encounter. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaBullEncounter} from '../src/adventure/experimental/guaira/GuairaBullLab';
const [input,output]=process.argv.slice(2);assert.ok(input&&output,'INPUT_TAPE OUTPUT_JSON');
const clean:Array<()=>void>=[],h=guairaBrowser({after:fn=>clean.push(fn as ()=>void)});
for(const o of [h.window,h.document,h.canvas])Object.assign(o,{removeEventListener(){}});
const g=h.create(),tape=JSON.parse(readFileSync(input,'utf8').replace(/^\uFEFF/,'')),runs=tape.runs??tape;
let held=new Set<string>(),frame=0,health=6,last='',helmet=true;
const events:any[]=[],expectedHits:any[]=[],damage:number[]=[],warningFrames:number[]=[],samples:any[]=[];
try{
 for(const [count,codes]of runs){const keys=new Set<string>(codes);
  for(const code of held)if(!keys.has(code))h.window.dispatch('keyup',{code,key:code==='Space'?' ':code,target:h.canvas});
  for(const code of keys)if(!held.has(code))h.window.dispatch('keydown',{code,key:code==='Space'?' ':code,target:h.canvas});held=keys;
  for(let i=0;i<count;i++){
   g.update(1000/60);frame++;const b=(g.boss as GuairaBullEncounter).model,p=g.player.data;
   if(b.state!==last){events.push({frame,state:b.state,tick:b.stateTick,bx:b.x,facing:b.facing,health:b.health,x:p.position.x,feet:p.position.y+p.height});last=b.state;
    if(['tell','turn','rattle'].includes(b.state))warningFrames.push(frame);}
   if(b.health<health)expectedHits.push({frame:frame-1,health:b.health});health=b.health;
   if(helmet&&!p.hasHelmet)damage.push(frame);helmet=p.hasHelmet;
   if(b.state==='rattle'||b.state==='bones'||process.env.GUAIRA_BULL_MEASURE==='1')samples.push({frame,state:b.state,tick:b.stateTick,health:b.health,bx:b.x,x:p.position.x,feet:p.position.y+p.height,vy:p.velocity.y,grounded:p.isGrounded,bones:b.bones.map(v=>({...v})),helmet});
   if(p.isDead)break;
  }if(g.player.data.isDead)break;
 }
 const result={description:'Native keyboard inputs; no actor, health, camera, valve or clock writes.',stepMs:1000/60,frames:frame,runs,expectedHits,warningFrames,expectedFinalHealth:g.boss!.health,damage,dead:g.player.data.isDead,events,samples};
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({frames:frame,hits:expectedHits,damage,dead:result.dead,health:result.expectedFinalHealth,minFeet:Math.min(...samples.map(s=>s.feet))}));
}finally{g.dispose();for(const fn of clean.reverse())fn();}
