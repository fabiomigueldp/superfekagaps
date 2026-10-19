/** Native-input proof for the extended siege. Visual output is limited to the
 * peaceful foreground gathering and the new bastion; the full tape verifies victory. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalVanguard} from '../src/adventure/hipotetico/HypotheticalVanguard';
import {HypotheticalAudio,type WeaponCue} from '../src/adventure/hipotetico/HypotheticalAudio';
import replay from '../tests/helpers/hypotheticalReplay.json';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
let held=new Set<string>(),previous=g.player,n=0,frames=0,videoFrom=-1;
const cues:Array<{frame:number;kind:WeaponCue}>=[],play=HypotheticalAudio.prototype.play;
HypotheticalAudio.prototype.play=function(kind){cues.push({frame:n,kind});return play.call(this,kind);};
const captures:Array<{file:string;frame:number;playerX:number;sceneTick:number}>=[],seen=new Set<string>();
const scenes:Array<{frame:number;street:number;cameraX:number;siteX:number}>=[];
try{
 for(const [count,keys] of replay.runs as [number,string[]][]){
    const next=new Set(keys);
    for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});held=next;
    for(let i=0;i<count;i++){
        g.update(1000/60);n++;
        if(g.player!==previous){held=new Set();previous=g.player;}
        if(g.act!=='siege')continue;
        const b=g.fight,elite=g.foes.find(e=>e instanceof HypotheticalVanguard) as HypotheticalVanguard|undefined;
        if(b.events.includes('break'))scenes.push({frame:n,street:b.backdrop.motion.district,cameraX:g.camera.x,siteX:b.backdrop.motion.x+48});
        let shot=b.tick===24&&!b.arrivalSkipped?'forecourt':null;
        if(b.route.entered===3&&!g.player.data.isDead){
            if(elite?.phase==='warning')shot=elite.move+'-tell';
            if(elite?.phase==='attack'&&elite.actionTicks>=12)shot=elite.move+'-action';
            if(elite?.phase==='stunned')shot='vanguard-hit';
            if(b.backdrop.motion.local>=180&&b.backdrop.motion.local<=190)shot='bastion-destruction';
            if(b.route.cleared===4&&b.route.gateTicks[3]>=30)shot='bastion-open';
        }
        const movie=b.route.cleared>=3&&!g.player.data.isDead&&n%2===0;
        if(!movie&&(!shot||seen.has(shot)))continue;
        const before=JSON.stringify({b,p:g.player.data,foes:g.foes});g.render();assert.equal(JSON.stringify({b,p:g.player.data,foes:g.foes}),before);
        c.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
        if(movie){if(videoFrom<0)videoFrom=n-1;writeFileSync(join(out,'frames',String(frames++).padStart(5,'0')+'.png'),png);}
        if(shot&&!seen.has(shot)){
            seen.add(shot);const file=shot+'.png';writeFileSync(join(out,file),png);
            captures.push({file,frame:n,playerX:g.player.getRect().x,sceneTick:b.backdrop.tick});
        }
    }
 }
 assert.equal(g.receipt.won,true);
 writeFileSync(join(out,'audio-cues.json'),JSON.stringify({seconds:frames/30,cues:cues.filter(c=>c.frame>=videoFrom&&c.frame<videoFrom+frames*2).map(c=>({...c,frame:c.frame-videoFrom}))}));
 writeFileSync(join(out,'native-verification.json'),JSON.stringify({receipt:g.receipt,inputFrames:n,videoFrames:frames,captures,scenes},null,2));
 console.log(JSON.stringify({receipt:g.receipt,inputFrames:n,videoFrames:frames,captures,scenes}));
}finally{HypotheticalAudio.prototype.play=play;g.dispose();for(const f of clean.reverse())f();}
