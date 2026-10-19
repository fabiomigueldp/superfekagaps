/** Chase-to-courtyard footage produced exclusively by native keyboard input. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalAudio,type WeaponCue} from '../src/adventure/hipotetico/HypotheticalAudio';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import replay from '../tests/helpers/hypotheticalReplay.json';

const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
let held=new Set<string>(),lastPlayer=g.player,n=0,videoFrames=0;
const start=1162,cues:Array<{frame:number;kind:WeaponCue}>=[],captures:unknown[]=[];
const moments=new Map([[36,'arrival-crowd'],[74,'arrival-flight'],[112,'arrival-volley'],[146,'arrival-reaction'],
    [174,'arrival-ram'],[188,'arrival-collapse'],[226,'arrival-aftermath'],[260,'arrival-deployment'],[294,'arrival-opening'],[330,'arrival-combat']]);
const play=HypotheticalAudio.prototype.play;HypotheticalAudio.prototype.play=function(kind){if(n>=start)cues.push({frame:n-start,kind});return play.call(this,kind);};
try{
 outer:for(const [count,keys]of replay.runs as [number,string[]][]){
    const next=new Set(keys);
    for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});held=next;
    for(let i=0;i<count;i++){
        n++;g.update(1000/60);
        if(g.player!==lastPlayer){held=new Set();lastPlayer=g.player;}
        const b=g.fight;
        if(g.act==='siege'&&b.tick<270){
            assert.ok(g.foes.every(e=>e instanceof HypotheticalGuard&&!e.awake));assert.equal(b.shots.length,0);
            assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
        }
        const moment=g.act==='siege'?moments.get(b.tick):undefined;
        if(n>=start&&(n%2===0||moment)){
            const before=JSON.stringify({b,p:g.player.data,c:g.camera,foes:g.foes});g.render();
            assert.equal(JSON.stringify({b,p:g.player.data,c:g.camera,foes:g.foes}),before);
            c.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
            if(n%2===0)writeFileSync(join(out,'frames',String(videoFrames++).padStart(5,'0')+'.png'),png);
            if(moment){writeFileSync(join(out,moment+'.png'),png);captures.push({file:moment+'.png',inputFrame:n,tick:b.tick,
                crowd:b.backdrop.people.filter(p=>p.district===0).map(p=>({x:p.x,escaped:p.escaped,hitAt:p.hitAt})),
                gate:b.arrival,guardsActive:b.route.active});}
        }
        if(g.act==='siege'&&b.tick>=480)break outer;
    }
 }
 assert.equal(captures.length,10);assert.equal(g.act,'siege');assert.equal(g.receipt.deaths,0);
 writeFileSync(join(out,'weapon-cues.json'),JSON.stringify({seconds:videoFrames/30,cues}));
 const report={inputOnly:true,actorCameraClockEdits:false,recordedFromInputFrame:start,inputFrames:n,videoFrames,
    seconds:videoFrames/30,receipt:g.receipt,captures};
 writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({frames:videoFrames,captures:captures.length,receipt:g.receipt}));
}finally{HypotheticalAudio.prototype.play=play;g.dispose();for(const f of clean.reverse())f();}
