/** Record a directed keyboard run for animation/arena review. No position, HP,
 * protection, scene-time or camera edits; this is not the regression test suite. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalVanguard} from '../src/adventure/hipotetico/HypotheticalVanguard';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import replay from '../tests/helpers/hypotheticalReplay.json';
const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
let held=new Set<string>(),previous=g.player,n=0,frames=0,jump=0;
const inputs:string[][]=[],resets=new Set<number>(),captures:Array<{file:string;frame:number;hp:number;move:string;phase:string}>=[];
const covered=new Set<string>(),actions:Array<{frame:number;move:string;strike:number;phase:string;hp:number}>=[];
let lastPhase='';
let lastCover='',lastParry=-Infinity;
const supportEvents:Array<{frame:number;phase:string;arc:string;barrels:number}>=[];
const parries:number[]=[];
function step(keys:string[],record=false){
    const next=new Set(keys);
    for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    held=next;inputs.push(keys);g.update(1000/60);n++;
    if(g.player!==previous){held=new Set();previous=g.player;resets.add(n);jump=0;}
    if(!record||g.act!=='siege')return;
    const e=g.foes.find(e=>e instanceof HypotheticalVanguard) as HypotheticalVanguard|undefined;
    if(e){
        const phase=e.move+':'+e.phase+':'+e.strike+':'+e.hp;
        if(phase!==lastPhase){lastPhase=phase;actions.push({frame:n,move:e.move,strike:e.strike,phase:e.phase,hp:e.hp});}
        if(e.parryAt!==lastParry){lastParry=e.parryAt;if(Number.isFinite(e.parryAt))parries.push(n);}
    }
    const support=g.foes.find(f=>f instanceof HypotheticalGuard&&f.spec.kind==='loader'&&f.wave===4&&!f.dead) as HypotheticalGuard|undefined;
    if(support?.coveringElite){
        const phase=support.phase+':'+support.coveringElite;
        if(phase!==lastCover){lastCover=phase;supportEvents.push({frame:n,phase:support.phase,arc:support.coveringElite,barrels:g.objects.barrels.length});}
    }else lastCover='';
    if(n%2)return;
    g.render();c.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
    writeFileSync(join(out,'frames',String(frames++).padStart(5,'0')+'.png'),png);
    const name=g.player.data.isDead?null:g.fight.route.cleared===4?'passage-open':e&&e.age-e.parryAt<120?'guard-parry'
        :support?.coveringElite&&support.phase==='warning'&&support.timer>=240?'cover-'+support.coveringElite
        :e?.phase==='stunned'?'counterattack'
        :e?.phase==='warning'&&e.actionTicks>=12?e.move+'-tell':e?.phase==='attack'&&e.actionTicks>=8?e.move+'-action':null;
    if(name&&!covered.has(name)){
        covered.add(name);writeFileSync(join(out,name+'.png'),png);
        captures.push({file:name+'.png',frame:n,hp:e?.hp??0,move:e?.move??'',phase:e?.phase??''});
    }
}
try{
 const original=(replay.runs as [number,string[]][]).flatMap(([count,keys])=>Array.from({length:count},()=>keys));
 for(const keys of original.slice(0,3286))step(keys);
 console.log(JSON.stringify({start:n,act:g.act,cleared:g.fight.route.cleared,player:g.player.getRect()}));
 for(let i=0;i<2400&&g.act==='siege';i++){
    const p=g.player.getRect(),target=g.foes.find(e=>!e.dead&&e instanceof HypotheticalVanguard)??g.foes.find(e=>!e.dead);
    const keys:string[]=[];
    if(!target||g.fight.route.cleared===4)keys.push('ArrowRight','ShiftLeft');
    else{
        const gap=target.x+target.width/2-p.x-p.width/2;
        if(Math.abs(gap)>5)keys.push(gap>0?'ArrowRight':'ArrowLeft','ShiftLeft');
        if(g.player.data.isGrounded&&Math.abs(gap)<125&&jump===0&&!held.has('Space'))jump=18;
        if(jump>0){keys.push('Space');jump--;}
        if(!g.player.data.isGrounded&&p.y+p.height<target.y&&Math.abs(gap)<13&&g.player.data.velocity.y>=-.5)keys.push('ArrowDown');
    }
    step(keys,true);
 }
 const siegeReceipt={...g.receipt},siegeEndFrame=g.act==='duel'?n:undefined;
 const sourceSiegeEnd=(replay as {siegeEndFrame?:number}).siegeEndFrame??3748;
 if(g.act==='duel')for(const keys of original.slice(sourceSiegeEnd))step(keys);
 const runs:Array<[number,string[]]>=[];
 for(const [i,keys] of inputs.entries()){
    const last=runs[runs.length-1];
    if(last&&!resets.has(i)&&JSON.stringify(last[1])===JSON.stringify(keys))last[0]++;else runs.push([1,keys]);
 }
 writeFileSync(join(out,'recorded-input.json'),JSON.stringify({siegeEndFrame,receipt:g.receipt,runs}));
 const report={kind:'directed native-keyboard capture',suiteRun:false,inputFrames:n,videoFrames:frames,fps:30,
    siegeReceipt,finalReceipt:g.receipt,captures,actions,supportEvents,parries};
 writeFileSync(join(out,'capture.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{g.dispose();for(const f of clean.reverse())f();}
