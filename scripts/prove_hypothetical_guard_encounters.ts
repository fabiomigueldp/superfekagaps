/** Native input branches: bait the shield, two balcony arcs, last-wave combinations and a flank. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import replay from '../tests/helpers/hypotheticalReplay.json';

const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(out,{recursive:true});mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const captures:Array<{file:string;frame:number;branch:string;phase:string;timer:number;player:{x:number;y:number}}>=[];
const receipts=[];
const damage=[];
const details:Array<{file:string;frame:number;branch:string}>=[];
let videoFrame=0;
for(const branch of ['shield','launcher','batedor-pair','launcher-pair','flank']){
    const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>{cleanup.push(f as ()=>void);}});
    const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
    h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
    h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
    const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    let held=new Set<string>(),n=0,lastPlayer=g.player,branching=false,branchFrame=0,jumpUntil=0,dodgeTarget=150,completedAt=0,flankJump=false;
    const covered=new Set<string>(),inputs:Array<[number,string[]]>=[];
    const tape=(replay.runs as [number,string[]][]).flatMap(([count,keys])=>Array.from({length:count},()=>keys));
    try{
        for(n=0;n<2200;n++){
            const b=g.fight,p=g.player.data;
            const targetWave=branch.endsWith('-pair')?3:2;
            if(!branching&&g.act==='siege'&&(branch==='shield'||branch==='flank'||b.wave===targetWave&&g.foes.some(e=>e.spec.kind==='loader'&&!e.dead))){branching=true;branchFrame=n;}
            let keys=tape[n]??[];
            if(branching){
                if(n%2===0){
                    g.render();c.drawImage(screen,0,0,320,180);
                    writeFileSync(join(out,'frames',String(videoFrame++).padStart(5,'0')+'.png'),frame.toBuffer('image/png'));
                }
                keys=[];
                if(branch==='flank'){
                    const nearest=g.foes.filter(e=>!e.dead).sort((a,b)=>Math.abs(a.x-p.position.x)-Math.abs(b.x-p.position.x))[0];
                    if(nearest){
                        if(p.position.x<282)keys.push('ArrowRight','ShiftLeft');
                        if(!flankJump&&p.isGrounded&&Math.abs(nearest.x-p.position.x)<70){jumpUntil=n+18;flankJump=true;}
                        if(n<jumpUntil)keys.push('Space');
                    }
                }else if(branch==='batedor-pair'){
                    const scout=g.foes.find(e=>!e.dead&&e.spec.kind==='minion');
                    if(scout){
                        const target=scout.x+scout.facing*50;
                        if(Math.abs(p.position.x-target)>4)keys.push(p.position.x<target?'ArrowRight':'ArrowLeft');
                        if('comboStep' in scout&&scout.comboStep===1&&scout.phase==='warning'&&scout.timer>300&&p.isGrounded)jumpUntil=n+18;
                        if(n<jumpUntil)keys.push('Space');
                    }
                }else if(branch==='launcher'||branch==='launcher-pair'){
                    const danger=b.marks.find(m=>Math.abs(m.x-p.position.x)<24);
                    if(danger)dodgeTarget=p.position.x<150?185:120;
                    if(Math.abs(p.position.x-dodgeTarget)>5)keys.push(p.position.x<dodgeTarget?'ArrowRight':'ArrowLeft');
                    if(p.isGrounded&&g.objects.barrels.some(s=>Math.abs(s.x-p.position.x)<55&&s.y>p.position.y-15))jumpUntil=n+18;
                    const ram=g.foes.find(e=>!e.dead&&e.spec.kind==='charger');
                    if(ram&&p.isGrounded&&(ram.phase==='warning'&&ram.timer>510||ram.phase==='attack'&&Math.abs(ram.x-p.position.x)<65))jumpUntil=n+18;
                    if(ram&&!p.isGrounded&&p.position.y+24<ram.y+5&&Math.abs(ram.x+ram.width/2-p.position.x-7)<30)keys.push('ArrowDown');
                    const guards=g.foes.filter(e=>!e.dead&&['helmet','minion'].includes(e.spec.kind)&&Math.abs(e.x-p.position.x)<85).sort((a,b)=>Math.abs(a.x-p.position.x)-Math.abs(b.x-p.position.x));
                    const guard=guards[0];
                    if(p.isGrounded&&!held.has('Space')&&guards.some(e=>e.phase==='warning'&&e.timer>e.warningDuration*.55||e.phase==='attack'&&Math.abs(e.x-p.position.x)<55||e.phase==='walk'&&Math.abs(e.x-p.position.x)<45))jumpUntil=n+18;
                    if(guard&&!p.isGrounded&&p.position.y+24<guard.y+5&&Math.abs(guard.x+guard.width/2-p.position.x-7)<30)keys.push('ArrowDown');
                    if(guard&&!p.isGrounded&&p.position.y+24>guard.y&&Math.abs(guard.x+guard.width/2-p.position.x-7)<36){
                        keys=keys.filter(k=>k!=='ArrowLeft'&&k!=='ArrowRight');keys.push(guard.x>p.position.x?'ArrowLeft':'ArrowRight');
                    }
                    if(n<jumpUntil)keys.push('Space');
                }
            }
            const next=new Set(keys);
            for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
            for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
            held=next;
            if(inputs.length&&JSON.stringify(inputs.at(-1)![1])===JSON.stringify(keys))inputs.at(-1)![0]++;else inputs.push([1,keys]);
            const hadHelmet=p.hasHelmet;
            g.update(1000/60);if(g.player!==lastPlayer){held=new Set();lastPlayer=g.player;}
            if(branching&&(hadHelmet&&!p.hasHelmet||p.isDead))damage.push({branch,frame:n,x:p.position.x,y:p.position.y,dead:p.isDead,
                guards:g.foes.filter(e=>!e.dead).map(e=>({kind:e.spec.kind,x:e.x,y:e.y,phase:e.phase,timer:e.timer})),barrels:g.objects.barrels.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy})),marks:b.marks});
            if(branching){
                for(const guard of g.foes){
                    if(guard.dead||!(guard instanceof HypotheticalGuard))continue;
                    const detail=guard.yielding&&guard.distance>40&&g.foes.some(a=>a!==guard&&!a.dead&&a.phase==='warning')?'guard-formation':
                        guard.phase==='walk'&&Number(guard.turnProgress)>.35&&Number(guard.turnProgress)<.8?'guard-pivot':
                        guard.spec.kind==='loader'&&guard.phase==='rest'&&Number(guard.reloadProgress)>.45&&Number(guard.reloadProgress)<.6?'guard-resupply':null;
                    if(detail&&!details.some(d=>d.file===detail+'.png')){
                        g.render();c.drawImage(screen,0,0,320,180);const file=detail+'.png';writeFileSync(join(out,file),frame.toBuffer('image/png'));details.push({file,frame:n,branch});
                    }
                    if(branch==='flank'&&detail==='guard-pivot')covered.add('pivot');
                }
                const e=g.foes.find(e=>!e.dead&&e.spec.kind===(branch==='shield'?'helmet':branch==='batedor-pair'?'minion':'loader'));
                if(e){
                    const ready=e.phase==='warning'?e.timer>e.warningDuration*.8:e.phase==='attack'?e.timer>100:e.phase==='recoil'?e.timer>30:false;
                    const combo='comboStep' in e?Number(e.comboStep)+1:1;
                    const key=branch==='shield'?`guard-shield-${e.phase}`:branch.endsWith('-pair')?`guard-${branch}-${combo}-${e.phase}`:`guard-throw-${e.phase==='warning'?(e.highThrow?'high':'low'):(e.highThrow?'low':'high')}-${e.phase}`;
                    if(ready&&!covered.has(key)&&!g.player.data.isDead){
                        covered.add(key);g.render();c.drawImage(screen,0,0,320,180);const file=key+'.png';
                        writeFileSync(join(out,file),frame.toBuffer('image/png'));
                        captures.push({file,frame:n,branch,phase:e.phase,timer:e.timer,player:{...g.player.data.position}});
                    }
                }
                if(covered.size>=(branch==='flank'?1:branch==='shield'?2:4)&&!completedAt)completedAt=n;
                if(g.player.data.isDead||n-branchFrame>650||completedAt&&n-completedAt>=90)break;
            }
        }
        receipts.push({branch,inputOnly:true,actorCameraClockEdits:false,frames:n,receipt:g.receipt,captures:covered.size});
        writeFileSync(join(out,`inputs-${branch}.json`),JSON.stringify(inputs));
    }finally{g.dispose();for(const f of cleanup.reverse())f();}
}
writeFileSync(join(out,'guard-encounters.json'),JSON.stringify({inputOnly:true,actorCameraClockEdits:false,videoFrames:videoFrame,receipts,captures,details,damage},null,2));
assert.equal(captures.filter(c=>c.branch==='shield').length,2);
assert.equal(captures.filter(c=>c.branch==='launcher').length,4);
assert.equal(captures.filter(c=>c.branch==='batedor-pair').length,4);
assert.equal(captures.filter(c=>c.branch==='launcher-pair').length,4);
assert.equal(details.length,3,'Formation, planted turn and resupply must appear in actual input branches');
assert.equal(receipts.find(r=>r.branch==='flank')?.captures,1);
assert.ok(receipts.every(r=>r.receipt.deaths===0),'Each attack demonstration must remain survivable using native controls');
console.log(JSON.stringify({receipts,captures}));
