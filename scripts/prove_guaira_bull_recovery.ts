/** Record native inputs, including missed openings; painting cannot alter simulation. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaBullEncounter} from '../src/adventure/experimental/guaira/GuairaBullLab';
import {pixelText} from '../src/graphics/BitmapFont';

const [outArg,canvasArg,tapeArg]=process.argv.slice(2);
assert.ok(outArg&&canvasArg&&tapeArg,'OUTPUT, CANVAS_MODULE and REPLAY required');
const out=resolve(outArg),tape=JSON.parse(readFileSync(tapeArg,'utf8').replace(/^\uFEFF/,''));
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
mkdirSync(join(out,'frames'),{recursive:true});
const cleanup:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanup.push(fn as ()=>void)});
for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
const screen=createCanvas(640,360),frame=createCanvas(320,180),fc=frame.getContext('2d');
fc.imageSmoothingEnabled=false;h.canvas.getContext=()=>screen.getContext('2d');
const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
const g=h.create();g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
const marks=new Map<number,string>(tape.snapshots??[]),cols=3,rows=Math.max(1,Math.ceil(marks.size/cols));
const atlas=createCanvas(cols*320,rows*204),ac=atlas.getContext('2d');
ac.fillStyle='#262d2b';ac.fillRect(0,0,atlas.width,atlas.height);
let held=new Set<string>(),n=0,health=6,helmet=true,dead=false,cell=0;
const audit={nativeInputOnly:true,actorOrClockEdits:false,captureFps:60,frames:0,hitFrames:[] as number[],damageFrames:[] as number[],minHead:Infinity,finished:false,
    samples:[] as unknown[],snapshots:[] as unknown[]};
for(const [count,keys]of tape.runs as Array<[number,string[]]>){
    const next=new Set(keys);
    for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
    for(let i=0;i<count;i++){
        g.update(tape.stepMs??1000/60);n++;
        const b=(g.boss as GuairaBullEncounter).model,p=g.player.data;
        if(b.health<health)audit.hitFrames.push(n);health=b.health;
        if((helmet&&!p.hasHelmet)||(!dead&&p.isDead))audit.damageFrames.push(n);helmet=p.hasHelmet;dead=p.isDead;
        audit.minHead=Math.min(audit.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
        audit.samples.push({frame:n,state:b.state,stateTick:b.stateTick,health:b.health,bx:b.x,facing:b.facing,px:p.position.x,feet:p.position.y+p.height,
            helmet,dead,bones:b.visibleBones});
        const state=()=>JSON.stringify({boss:g.boss,player:g.player.data,objects:g.objects,camera:g.camera,time:g.time});
        const before=state();g.render();assert.equal(state(),before,'painting must be read-only');
        fc.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
        writeFileSync(join(out,'frames',String(n).padStart(5,'0')+'.png'),png);
        if(marks.has(n)){
            const file=`frame-${n}.png`;writeFileSync(join(out,file),png);
            const x=cell%cols*320,y=Math.floor(cell/cols)*204;
            ac.putImageData(fc.getImageData(0,0,320,180),x,y+24);
            pixelText(ac,marks.get(n)!,x+6,y+8,'#f0ddae');cell++;
            audit.snapshots.push({frame:n,file,caption:marks.get(n)});
        }
    }
}
assert.equal(n,tape.frames);assert.deepEqual(audit.hitFrames,tape.expectedHits.map((v:{frame:number})=>v.frame+1));
assert.deepEqual(audit.damageFrames,tape.damage??[]);assert.ok(audit.minHead>=23);
assert.deepEqual(g.store.save.completed,[]);audit.frames=n;audit.finished=g.boss?.phase==='defeated';
if(marks.size)writeFileSync(join(out,'atlas.png'),atlas.toBuffer('image/png'));
writeFileSync(join(out,'proof.json'),JSON.stringify(audit,null,2)+'\n');
g.dispose();for(const fn of cleanup.reverse())fn();
console.log(JSON.stringify({...audit,samples:undefined,snapshots:undefined}));
