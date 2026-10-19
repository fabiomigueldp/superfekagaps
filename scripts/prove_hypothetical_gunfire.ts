/** Every capture comes from ordinary input playback at the native camera and clock. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import replay from '../tests/helpers/hypotheticalReplay.json';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(out,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),ctx=frame.getContext('2d');ctx.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
const captures:Array<{file:string;frame:number;act:string;phase:number;age:number;reduced:boolean}>=[],covered=new Set<string>();
let held=new Set<string>(),last=g.player,n=0;
try{
 for(const [count,keys]of replay.runs as [number,string[]][]){
    const next=new Set(keys);
    for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    held=next;
    for(let i=0;i<count;i++){
        g.update(1000/60);n++;if(g.player!==last){held=new Set();last=g.player;}
        if(g.player.data.isDead)continue;
        const b=g.fight,a=b.backdrop,visible=(x:number)=>x-g.camera.x>22&&x-g.camera.x<298,names:string[]=[];
        if(g.act==='siege'&&visible(a.barrel.x)){
            if(a.muzzle===5)names.push('gun-distant-ignition');
            if(a.impacts.some(p=>p.born===a.tick&&p.material==='stone'&&visible(p.x)))names.push('gun-distant-impact');
        }
        if(g.act==='duel'&&b.attack==='rifle'){
            if(b.phaseNumber===1&&b.muzzle===5)names.push('gun-close-ignition');
            if(b.phaseNumber===3&&b.shots.filter(s=>s.kind==='bullet').length>=3)names.push('gun-dense-volley');
            if(b.impacts.some(p=>p.born===b.tick&&p.nx!==0))names.push('gun-cover-impact');
            if(b.state==='attack'&&b.age===b.rifleLastShot+9)names.push('gun-cooling');
        }
        for(const name of names){
            if(covered.has(name))continue;covered.add(name);
            const snapshot=JSON.stringify({model:b,player:g.player.data,camera:g.camera,foes:g.foes});
            const paint=(file:string,reduced=false)=>{
                h.media.matches=reduced;g.render();ctx.drawImage(screen,0,0,320,180);
                writeFileSync(join(out,file),frame.toBuffer('image/png'));
                assert.equal(JSON.stringify({model:b,player:g.player.data,camera:g.camera,foes:g.foes}),snapshot);
                captures.push({file,frame:n,act:g.act,phase:b.phaseNumber,age:b.age,reduced});
            };
            paint(name+'.png');
            if(name==='gun-close-ignition'){paint('gun-reduced.png',true);h.media.matches=false;}
        }
    }
 }
 assert.equal(g.receipt.won,true);assert.equal(covered.size,6);assert.equal(captures.length,7);
 const report={inputOnly:true,actorCameraClockEdits:false,frames:n,receipt:g.receipt,captures};
 writeFileSync(join(out,'gunfire-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,captures:captures.length,receipt:g.receipt}));
}finally{g.dispose();for(const f of cleanup.reverse())f();}
