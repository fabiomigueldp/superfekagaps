/** Author a complete optional-route tape using native controls and fixed steps.
 * The waypoint driver reads positions; it never moves actors or rewinds clocks. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {continueGuairaCourse} from '../tests/helpers/guairaCourseController';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES,GUAIRA_COURSE_DETOURS,type GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import type {WorldGame} from '../src/adventure/WorldGame';
const id=process.argv[2] as GuairaCourseId;
const constructors:Record<GuairaCourseId,new(c:HTMLCanvasElement,s:HTMLElement)=>WorldGame&{finished:boolean}>={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
const read=(file:string)=>JSON.parse(readFileSync('tests/helpers/'+file+'.json','utf8'));
const tapes={travessia:read('guairaFieldRoutesReplays').travessia,patio:read('guairaJunctionOptionalReplay'),respiros:read('guairaFieldRoutesReplays').respiros,
    subida:read('guairaRooftopReplay'),galeria:read('guairaReadableRoutesReplays').galeria,alivio:read('guairaReliefRoutesReplays').high};
const waitFrames=Number(process.env.GUAIRA_DETOUR_WAIT??0);
if(!Number.isInteger(waitFrames)||waitFrames<0)throw Error('GUAIRA_DETOUR_WAIT must be a non-negative frame count');
// Wait at the Portaria checkpoint, before entering the charger's acquisition
// range. Waiting in the warned attack lane is deliberately unsafe.
const starts={travessia:238,patio:180,respiros:700,subida:waitFrames?1760:1780,galeria:802,alivio:104};
// x is the centre of the avatar, y is the real deck surface.
const paths:Record<GuairaCourseId,number[][]>={
    travessia:[[344,64],[438,64],[466,64],[536,128],[608,192]],patio:[[330,96],[424,48],[486,48],[500,48],[544,112],[592,160],[640,208]],
    respiros:[[772,256],[848,208],[952,160],[1064,144],[1168,144],[1188,144],[1256,224],[1312,304]],
    subida:[[1860,80],[1936,48],[2020,48],[2038,48],[2080,96],[2120,144]],
    galeria:[[888,64],[996,64],[1104,48],[1124,48],[1184,112],[1256,160],[1290,192]],
    alivio:[[164,288],[240,240],[352,224],[440,176],[496,176],[552,144],[572,144],[608,224],[656,288],[704,336]],
};
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)}),g=h.create(constructors[id]);
const course=GUAIRA_COURSES[id],detour=GUAIRA_COURSE_DETOURS[id];
let held=new Set<string>(),frames=0;const runs:Array<[number,string[]]>=[],damage:number[]=[],notes:unknown[]=[],trace:unknown[]=[];
function step(keys:string[]){
    const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
    const helmet=g.player.data.hasHelmet;g.update(1000/60);frames++;if(helmet&&!g.player.data.hasHelmet)damage.push(frames);
    const p=g.player.data;trace.push({frame:frames,x:p.position.x-course.start,feet:p.position.y+p.height,vy:p.velocity.y,ground:p.isGrounded,keys,foes:g.foes.filter(e=>Math.abs(e.x-p.position.x)<130).map(e=>({kind:e.spec.kind,phase:e.phase,dead:e.dead,timer:e.deadTimer,x:e.x-course.start}))});if(trace.length>90)trace.shift();
    const prev=runs.at(-1);if(prev&&prev[1].join()===keys.join())prev[0]++;else runs.push([1,keys]);
}
outer:for(const[n,keys]of tapes[id].runs)for(let i=0;i<n;i++){
    const p=g.player.data;if(p.position.x>=course.start+starts[id]&&p.isGrounded)break outer;step(keys);
}
const prefixFrames=frames;
// Let the native clocks advance at the approach to exercise different patrol
// and pressure phases. No actor, enemy or clock is moved for this survey.
for(let i=0;i<waitFrames;i++)step([]);
for(const[wx,y]of paths[id]){
    let airborne=false,elapsed=0,landed=false,jumpStart=0;
    // Release a jump held by the incoming replay before attempting another one.
    step([]);
    for(;elapsed<180&&!g.player.data.isDead;elapsed++){
        const guard=g.foes.find(e=>e.spec.id.endsWith(':detour:guard')&&!e.dead);
        const attack=guard&&Math.abs(wx-detour.guard.x)<40;
        const target=attack?guard.x+guard.width/2:course.start+wx;
        const p=g.player.data,feet=p.position.y+p.height,dx=target-(p.position.x+p.width/2),v=p.velocity.x;
        if(p.isGrounded&&Math.abs(feet-y)<1&&Math.abs(dx)<9&&!attack){landed=true;break;}
        let keys:string[]=[];
        const stopping=Math.abs(v)*Math.abs(v)/.6;
        if(dx>3)keys=v>0&&dx<stopping*.65?['ArrowLeft']:['ArrowRight',...(dx>42?['ShiftLeft']:[])];
        if(dx< -3)keys=v<0&&-dx<stopping*.65?['ArrowRight']:['ArrowLeft',...(dx< -42?['ShiftLeft']:[])];
        if(!airborne&&p.isGrounded&&(feet!==y||Math.abs(dx)>30||attack)){keys.push('Space');airborne=true;jumpStart=elapsed;}
        else if(airborne&&!p.isGrounded&&elapsed-jumpStart<24)keys.push('Space');
        else if(p.isGrounded){airborne=false;}
        if(guard&&Math.abs(guard.x+guard.width/2-(p.position.x+p.width/2))<20&&feet<guard.y&&p.velocity.y>=0)keys=keys.filter(k=>k!=='Space').concat('ArrowDown');
        step(keys);
    }
    notes.push({target:[wx,y],landed,elapsed,frame:frames,at:[g.player.data.position.x-course.start,g.player.data.position.y+g.player.data.height],coins:g.coins,damage:[...damage]});
    if(!landed)break;
}
const collected=(g as unknown as {collected:Set<string>}).collected;
const rewards=g.stage.pickups.filter(p=>p.id.includes(':detour:coin:')).map(p=>({id:p.id,collected:collected.has(p.id)}));
const result=continueGuairaCourse(g,step);
const report={id,frames,prefixFrames,waitFrames,coins:g.coins,finished:g.finished,damage,rewards,position:g.player.data.position,guardDefeated:g.foes.find(e=>e.spec.id.endsWith(':detour:guard'))?.dead,notes,runs,continuation:result};
const out=process.env.GUAIRA_TAPE_OUT??'output/guaira/exploration-polish-2026-10-16';mkdirSync(out,{recursive:true});writeFileSync(`${out}/${id}-draft.json`,JSON.stringify(report,null,2));
if(!report.finished||damage.length)writeFileSync(`${out}/${id}-trace.json`,JSON.stringify(trace,null,2));
console.log(JSON.stringify({...report,runs:undefined}));g.dispose();for(const fn of cleanup.reverse())fn();
