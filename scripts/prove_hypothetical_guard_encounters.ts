/** The authored siege played from the campaign entrance using native keyboard input. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {SIEGE_SECTORS} from '../src/adventure/hipotetico/HypotheticalSiege';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import replay from '../tests/helpers/hypotheticalReplay.json';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
const captures:Array<{file:string;frame:number;sector:number;x:number}>=[],gates:Array<{frame:number;cleared:number;x:number}>=[],damage=[];
const covered=new Set<string>(),defeated=new Set<string>();
const vaultEvents:Array<{frame:number;id:string;phase:string;x:number;y:number;targetX:number;targetY:number}>=[],vaultStates=new WeakMap<HypotheticalGuard,string>();
const videoSourceFrames:number[]=[],locks:Array<{frame:number;sector:number;remaining:number}>=[];
let remaining=[2,3,4];
let held=new Set<string>(),lastPlayer=g.player,n=0,videoFrame=0,cleared=0,priorDeaths=0;
try{
 for(const [count,keys] of replay.runs as [number,string[]][]){
    const next=new Set(keys);
    for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{key:k==='Space'?' ':k,code:k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{key:k==='Space'?' ':k,code:k,target:h.canvas});held=next;
    for(let j=0;j<count;j++){
        const helmet=g.player.data.hasHelmet;g.update(1000/60);n++;
        if(g.player!==lastPlayer){held=new Set();lastPlayer=g.player;}
        if(g.act!=='siege')continue;
        const b=g.fight,p=g.player.data,route=b.route;
        for(let i=0;i<3;i++)if(route.remaining[i]!==remaining[i]){
            locks.push({frame:n,sector:i+1,remaining:route.remaining[i]});remaining=[...route.remaining];
        }
        if(route.cleared>cleared){cleared=route.cleared;gates.push({frame:n,cleared,x:p.position.x});}
        for(const e of g.foes)if(e.dead)defeated.add(e.spec.id);
        for(const e of g.foes)if(e instanceof HypotheticalGuard&&e.vaultTarget){
            const state=e.dead?'defeated':e.phase;
            if(vaultStates.get(e)!==state){
                vaultStates.set(e,state);vaultEvents.push({frame:n,id:e.spec.id,phase:state,x:e.x,y:e.y,targetX:e.vaultTarget.x,targetY:e.vaultTarget.y});
            }
        }
        if(helmet&&!p.hasHelmet||g.receipt.deaths>priorDeaths)damage.push({frame:n,dead:p.isDead,x:p.position.x,sector:route.entered+1});
        priorDeaths=g.receipt.deaths;
        if(n%2)continue;
        const snapshot=JSON.stringify({b,p,guards:g.foes,camera:g.camera});g.render();assert.equal(JSON.stringify({b,p,guards:g.foes,camera:g.camera}),snapshot);
        c.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
        videoSourceFrames.push(n);
        writeFileSync(join(out,'frames',`${String(videoFrame++).padStart(5,'0')}.png`),png);
        if(p.isDead)continue;
        const names:string[]=[];
        if(route.active&&p.position.x>route.sector.origin+100&&p.position.x<route.sector.origin+160)names.push(`district-${route.entered+1}`);
        for(const [i,s]of SIEGE_SECTORS.entries()){
            const gx=s.gate-g.camera.x;
            if(gx>30&&gx<285&&route.gateTicks[i]>0){
                if(route.gateTicks[i]<68)names.push(`gate-${i+1}-opening`);
                names.push(`gate-${i+1}-${route.gatePhase(i)}`);
                if(route.gateHeight(i)<200&&p.position.x>s.gate-20&&p.position.x<s.gate+40)names.push(`gate-${i+1}-passage`);
            }
        }
        if(route.active&&route.remaining[route.entered]<route.currentSector.guards.length&&route.remaining[route.entered]>0)
            names.push(`locks-${route.entered+1}`);
        if(p.isGrounded&&p.position.y+p.height<224)names.push(`scaffold-${route.entered+1}`);
        for(const e of g.foes){
            if(!(e instanceof HypotheticalGuard)||!e.awake||e.dead||e.x-g.camera.x<12||e.x+e.width-g.camera.x>308)continue;
            if(e.phase==='warning'&&e.timer>e.warningDuration*.65||e.phase==='attack'&&e.timer>100||e.phase==='recoil'&&e.timer>40||e.phase==='stunned')names.push(`guard-${e.wave}-${e.spec.kind}-${e.phase}`);
            if(!e.armor)names.push(`broken-${e.spec.kind}`);
            if(e.vaultTarget&&((e.phase==='warning'&&e.timer>450)||(e.phase==='attack'&&e.timer>120&&e.timer<350)||(e.phase==='rest'&&e.timer>80&&e.timer<250)))names.push(`vault-${e.phase}`);
            if(e.age-e.impactAt>20&&e.age-e.impactAt<180)names.push('charger-collision');
        }
        for(const name of names)if(!covered.has(name)){
            covered.add(name);const file=name+'.png';writeFileSync(join(out,file),png);captures.push({file,frame:n,sector:route.entered+1,x:p.position.x});
        }
    }
    if(g.act==='duel')break;
 }
 assert.equal(g.act,'duel');assert.equal(cleared,3);assert.equal(defeated.size,9);
 for(let i=1;i<=3;i++)assert.ok(covered.has(`gate-${i}-passage`),`visible traversal of gate ${i}`);
 assert.ok(vaultEvents.some(e=>e.phase==='attack'),'a flanker vault is exercised in native play');
 const report={inputOnly:true,actorCameraClockEdits:false,videoFrames:videoFrame,videoSourceFrames,receipt:g.receipt,guardsDefeated:defeated.size,gates,locks,vaultEvents,captures,damage};
 writeFileSync(join(out,'guard-encounters.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{g.dispose();for(const f of cleanup.reverse())f();}
