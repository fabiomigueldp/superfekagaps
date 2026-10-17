/** Development replay authoring: only keyboard events and ordinary fixed steps.
 * No player/foe/clock/collision edits. Logs decisions for reproducible tuning. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { GuairaAscent } from '../src/adventure/experimental/guaira/GuairaAscent';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GUAIRA_COURSES, type GuairaCourseId } from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import { jetCycleTick } from '../src/adventure/WorldMachineState';
import { supportsStanding } from '../src/world/tileRules';
import { TileType as T } from '../src/constants';

const id=(process.argv[2]??'travessia') as GuairaCourseId;
const constructors={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
const read=(name:string)=>JSON.parse(readFileSync('tests/helpers/'+name+'.json','utf8').replace(/^\uFEFF/,''));
const prefixes={travessia:read('guairaFieldRoutesReplays').travessia,patio:read('guairaJunctionOptionalReplay'),respiros:read('guairaFieldRoutesReplays').respiros,
    subida:read('guairaRooftopReplay'),galeria:read('guairaReadableRoutesReplays').galeria,alivio:read('guairaReliefRoutesReplays').high};
const cleanup:Array<()=>void>=[],h=guairaBrowser({after:f=>cleanup.push(f as ()=>void)});
for(const target of [h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
const g=new constructors[id](h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
let held=new Set<string>(),frame=0,damage:number[]=[],deaths=0;
const runs:Array<[number,string[]]>=[],gaps:any[]=[],decisions:any[]=[];
const input=(keys:string[])=>{
    const next=new Set(keys);
    for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
};
const step=(keys:string[])=>{
    input(keys);const before=g.player.data.hasHelmet,dead=g.player.data.isDead;
    g.update(1000/60);frame++;
    if(before&&!g.player.data.hasHelmet)damage.push(frame);
    if(!dead&&g.player.data.isDead)deaths++;
    const last=runs.at(-1);if(last&&last[1].join(',')===keys.join(','))last[0]++;else runs.push([1,keys]);
};
const rawTape=process.argv[3]?process.argv[4]?JSON.parse(readFileSync(process.argv[3],'utf8'))[process.argv[4]]:JSON.parse(readFileSync(process.argv[3],'utf8')):prefixes[id];
const tape=Array.isArray(rawTape)?{runs:rawTape}:rawTape;
for(const [n,keys]of [[tape.initialSettleFrames??0,[]],...tape.runs])for(let i=0;i<n;i++)step(keys);
const prefixFrames=frame,course=GUAIRA_COURSES[id];
let jumpUntil=0,restUntil=0,poundAt=0,lockedX:number|null=null,lastX=g.player.data.position.x,stuck=0;
const decide=(why:string,keys:string[])=>{decisions.push({frame,why,x:g.player.data.position.x,feet:g.player.data.position.y+g.player.data.height});return keys;};
for(let limit=0;limit<12000&&!g.finished&&deaths===0;limit++){
    const p=g.player.data,x=p.position.x,feet=p.position.y+p.height;
    if(p.isDead)break;
    let keys:string[]=['ArrowRight','ShiftLeft'];
    if(frame<restUntil)keys=[];
    else if(poundAt&&frame>=poundAt){keys=['ArrowDown'];if(p.isGrounded){poundAt=0;jumpUntil=0;restUntil=frame+18;lockedX=null;}}
    else if(frame<jumpUntil)keys=[...(lockedX===null?['ArrowRight','ShiftLeft']:[]),'Space'];
    else if(lockedX!==null){keys=[];if(p.isGrounded){lockedX=null;restUntil=frame+8;}}
    else if(p.isGrounded){
        const plate=g.objects.bodies.find(b=>b.id.includes(':course:')&&b.kind==='switch'&&!b.active&&b.y+8===feet&&b.x-x<1&&b.x+b.width>x+7);
        const lid=id==='galeria'&&x>=course.start+224&&x<course.start+267&&feet===course.floor;
        if(plate||lid){lockedX=x;jumpUntil=frame+12;poundAt=frame+13;keys=decide('pound', ['Space']);}
        else {
            const upcoming=g.objects.bodies.find(b=>b.kind==='jet'&&!b.active&&b.x+b.width>x&&b.x-(x+p.width)<42&&b.x>x);
            const tick=upcoming?jetCycleTick(upcoming,g.objects.time):0;
            const crossMs=upcoming?(upcoming.width+60)/3.5*1000/60:0;
            if(upcoming&&feet>upcoming.y&&tick>1800-crossMs-180&&tick<2540)
                keys=decide('wait-water',x+p.width>upcoming.x-4||x+p.width+Math.max(0,p.velocity.x*6)>upcoming.x-4&&p.velocity.x>.1?['ArrowLeft']:[]);
            else {
                const col=g.level.worldToCol(x+p.width+16),row=g.level.worldToRow(feet+1);
                const tile=g.level.getTile(col,row);
                const obstacle=g.level.getTile(col,g.level.worldToRow(feet-8));
                const enemy=g.foes.find(e=>!e.dead&&e.x+e.width>x&&e.x-x<92&&e.x-x>8&&Math.abs(e.y+e.height-feet)<32);
                const barrel=g.objects.barrels.find(b=>b.life>0&&b.x>x&&b.x-x<78&&b.y+16>=feet-24);
                const moving=g.objects.bodies.find(b=>b.kind==='lift'&&b.id.includes(':course:bridge')&&x+p.width+20>=b.x&&x<b.x);
                const gap=!supportsStanding(tile)&&!g.objects.bodies.some(b=>['lift','platform','support'].includes(b.kind)&&Math.abs(b.y-feet)<3&&x+p.width+16>=b.x&&x+p.width+16<b.x+b.width);
                if(moving&&(!moving.active||Math.abs(moving.y-moving.to!.y)>1))keys=decide('wait-bridge',[]);
                else if(gap||enemy||barrel||supportsStanding(obstacle)&&obstacle!==T.PLATFORM&&obstacle!==T.PLATFORM_FALLING){
                    if(id==='galeria'&&x>=course.start+192&&x<course.start+272&&feet===course.floor){keys=['ArrowRight'];}
                    else {jumpUntil=frame+24;keys=decide(enemy?'enemy':barrel?'barrel':gap?'gap':'step',[...keys,'Space']);if(gap)gaps.push({x,feet,frame});}
                }
            }
        }
    }
    // Do not hold a horizontal input against the underground retaining wall.
    if(id==='galeria'&&x>=course.start+260&&x<course.start+304&&feet<course.floor+80&&!p.isGrounded&&!poundAt)keys=[];
    if(id==='galeria'&&x<448&&x>=432)keys=['ArrowRight'];
    // A stomp is a fresh upward impulse, not a promise of another landing.
    // Brake above the next bank instead of drifting into a second channel.
    if(!p.isGrounded&&frame>=jumpUntil&&p.velocity.y<0&&g.foes.some(e=>e.dead&&e.deadTimer<120)){
        lockedX=x;keys=[];
    }
    step(keys);
    if(Math.abs(p.position.x-lastX)<.05)stuck++;else stuck=0;lastX=p.position.x;
    if(stuck>600){console.log('STUCK',JSON.stringify({x,feet,keys}));break;}
}
const result={id,frames:frame,prefixFrames,finished:g.finished,damage,deaths,coins:g.coins,kills:g.foes.filter(e=>e.dead).map(e=>e.spec.id),position:g.player.data.position,runs,decisions,gaps};
mkdirSync('output/guaira/course-design-2026-10-16',{recursive:true});
writeFileSync(process.env.GUAIRA_TAPE_OUT??`output/guaira/course-design-2026-10-16/${id}-draft.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,runs:undefined,decisions:undefined,gaps:undefined}));
g.dispose();for(const fn of cleanup.reverse())fn();
