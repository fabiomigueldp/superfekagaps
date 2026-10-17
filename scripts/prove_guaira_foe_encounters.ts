/** Native checkpoint replays: only controls and ordinary 60 Hz updates. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {pixelText} from '../src/graphics/BitmapFont';
import tapes from '../tests/helpers/guairaFoeEncounters.json';

const [outArg,canvasArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg,'OUTPUT CANVAS required');
const out=resolve(outArg);mkdirSync(out,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const sheet=createCanvas(1280,612),sc=sheet.getContext('2d');sc.imageSmoothingEnabled=false;
sc.fillStyle='#293535';sc.fillRect(0,0,1280,612);
const selected:Record<string,Array<[number,number,string]>>={
    'pincer-counter':[[60,0,'PINCA - AVISO'],[75,1,'SALTO SOBRE A PINCA'],[84,2,'ATAQUE COMPROMETIDO'],[120,3,'MARGEM DE CHEGADA']],
    'loader-counter':[[125,4,'BARRIL BAIXO'],[162,5,'PASSA SOB A PASSARELA'],[286,6,'SEGUNDO AVISO - ALTO'],[319,7,'SALTO CURTO'],[406,8,'ATAQUE POR CIMA']],
    'pincer-hit':[[75,9,'IGNORAR A PINCA - DANO']], 'loader-hit':[[320,10,'ARCO ALCANCA A PASSARELA'],[329,11,'IGNORAR A ALTURA - DANO']]
};
const posters:Record<string,number>={'pincer-counter':75,'pincer-hit':75,'loader-counter':319,'loader-hit':329};
const routes:Record<string,unknown>={};
for(const[name,tape]of Object.entries(tapes)){
    const clean:Array<()=>void>=[],h=guairaBrowser({after:f=>clean.push(f as ()=>void)});
    for(const t of [h.window,h.document,h.canvas])Object.assign(t,{removeEventListener(){}});
    const screen=createCanvas(640,360),frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
    h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
    const g=new GuairaTraversal(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    const foe=g.foes.find(e=>e.spec.id.endsWith(tape.foeId))!;
    let held=new Set<string>(),n=0,videoFrames=0,minHead=Infinity,maxFeet=0;const damage:number[]=[];
    const frames=join(out,name);mkdirSync(frames,{recursive:true});
    for(const[count,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let i=0;i<count;i++){
            const helmet=g.player.data.hasHelmet;g.update(1000/60);n++;
            if(helmet&&!g.player.data.hasHelmet)damage.push(n);assert.equal(g.player.data.isDead,false);
            minHead=Math.min(minHead,g.player.data.position.y-4-g.camera.y);maxFeet=Math.max(maxFeet,g.player.data.position.y+g.player.data.height-g.camera.y);
            const mark=selected[name].find(m=>m[0]===n);
            if(n%2===0||mark||posters[name]===n){
                const state=()=>JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,c:g.camera,t:g.time});
                const before=state();g.render();assert.equal(state(),before);fc.drawImage(screen,0,0,320,180);
                const png=frame.toBuffer('image/png');
                if(n%2===0)writeFileSync(join(frames,String(++videoFrames).padStart(5,'0')+'.png'),png);
                if(posters[name]===n)writeFileSync(join(out,name+'.png'),png);
                if(mark){const x=mark[1]%4*320,y=Math.floor(mark[1]/4)*204;sc.drawImage(frame,x,y+24);pixelText(sc,mark[2],x+4,y+8,'#efd3a3');}
            }
        }
    }
    assert.deepEqual(damage,tape.damage);assert.equal(foe.dead,tape.killed);assert.equal(n,tape.frames);assert.ok(minHead>=23&&maxFeet<=172.01);
    routes[name]={frames:n,videoFrames,damage,killed:foe.dead,checkpoint:tape.checkpoint,minHead,maxFeet};
    g.dispose();for(const f of clean.reverse())f();
}
writeFileSync(join(out,'encounters.png'),sheet.toBuffer('image/png'));
writeFileSync(join(out,'native-verification.json'),JSON.stringify({nativeInputOnly:true,actorOrClockEdits:false,setup:'ordinary checkpoint loading in test save',simulationHz:60,captureFps:30,routes},null,2));
console.log(JSON.stringify(routes));
