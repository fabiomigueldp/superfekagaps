/** Native play only: no scene/actor/camera/time assignment. Capture visible scenery beats. */
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { bystanderPose } from '../src/adventure/hipotetico/HypotheticalBystanders';
import { sceneLifecycleBrowser } from '../tests/helpers/sceneLifecycleHarness';
import replay from '../tests/helpers/hypotheticalReplay.json';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(out,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),ctx=frame.getContext('2d');ctx.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
const captures:Array<{file:string;frame:number;tick:number;district:number;phase:string;camera:{x:number;y:number};reduced:boolean}>=[],covered=new Set<string>();
let held=new Set<string>(),last=g.player,n=0;
try{
 for(const [count,keys] of replay.runs as [number,string[]][]){
    const next=new Set(keys);
    for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    held=next;
    for(let i=0;i<count;i++){
        g.update(1000/60);n++;if(g.player!==last){held=new Set();last=g.player;}
        if(g.act!=='siege'||g.player.data.isDead)continue;
        const b=g.fight,a=b.backdrop,m=a.motion,visible=(x:number)=>x-g.camera.x>20&&x-g.camera.x<300;
        const framed=(x:number)=>x-g.camera.x>60&&x-g.camera.x<282;
        const names:string[]=[],local=m.local,center=m.district*416+222;
        if(visible(center)){
            const moment=local>=148&&local<=152?'prepare':local>=175&&local<=178?'strike'
                :local>=190&&local<=194?'collapse':local>=213&&local<=217?'settle':null;
            if(moment)names.push(`scene-${m.district+1}-${moment}`);
            if(g.camera.y<20&&m.active)names.push('scene-high-camera');
        }
        if(b.marks.some(p=>b.tick-p.born===42))names.push('scene-rubble-transfer');
        if(a.people.some(p=>visible(p.x)&&p.hitAt===null&&p.velocity>.1))names.push('scene-civilian-running');
        if(a.people.some(p=>visible(p.x)&&p.hitAt!==null&&a.tick-p.hitAt>=12&&a.tick-p.hitAt<=16))names.push('scene-civilian-fall');
        if(a.people.some(p=>visible(p.x)&&!p.escaped&&p.fleeing&&bystanderPose(p,a.tick).lookBack))names.push('scene-survivors');
        if(a.aimedPerson?.clothes==='star-shirt'&&framed(a.aimedPerson.x)&&local>=96&&local<=105)names.push('scene-npc-aim');
        if(local>=120&&local<=128&&a.people.some(p=>framed(p.x)&&p.hitAt===null&&bystanderPose(p,a.tick).crouch===1))names.push('scene-npc-cover');
        if(a.people.some(p=>framed(p.x)&&p.clothes==='star-shirt'&&p.hitAt!==null&&a.tick-p.hitAt>=4&&a.tick-p.hitAt<=7))names.push('scene-npc-reaction');
        if(a.people.some(p=>framed(p.x)&&p.clothes==='star-shirt'&&!p.escaped&&p.fleeing&&p.velocity>.7&&bystanderPose(p,a.tick).lookBack))names.push('scene-npc-escape');
        for(const name of names){
            if(covered.has(name))continue;covered.add(name);
            const snapshot=JSON.stringify({model:b,player:g.player.data,camera:g.camera,foes:g.foes});
            g.render();assert.equal(JSON.stringify({model:b,player:g.player.data,camera:g.camera,foes:g.foes}),snapshot);
            ctx.drawImage(screen,0,0,320,180);writeFileSync(join(out,name+'.png'),frame.toBuffer('image/png'));
            captures.push({file:name+'.png',frame:n,tick:a.tick,district:m.district+1,phase:m.phase,camera:{x:g.camera.x,y:g.camera.y},reduced:false});
            if(name==='scene-3-collapse'){
                h.media.matches=true;g.render();ctx.drawImage(screen,0,0,320,180);writeFileSync(join(out,'scene-reduced.png'),frame.toBuffer('image/png'));
                h.media.matches=false;assert.equal(JSON.stringify({model:b,player:g.player.data,camera:g.camera,foes:g.foes}),snapshot);
                captures.push({...captures[captures.length-1],file:'scene-reduced.png',reduced:true});
            }
        }
    }
 }
 assert.equal(g.receipt.won,true);
 for(const i of [1,2,3])assert.ok(covered.has(`scene-${i}-collapse`),`District ${i} contact must be visible during normal play`);
 assert.ok(covered.has('scene-high-camera'));
 for(const name of ['aim','cover','reaction','escape'])assert.ok(covered.has(`scene-npc-${name}`),`NPC ${name} must be visible in ordinary play`);
 const report={inputOnly:true,actorCameraClockEdits:false,frames:n,receipt:g.receipt,captures};
 writeFileSync(join(out,'scenery-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,frames:n,captures:captures.length,receipt:g.receipt}));
}finally{g.dispose();for(const f of cleanup.reverse())f();}
