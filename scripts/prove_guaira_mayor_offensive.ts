/** Production rendering at 30 fps from native 60 Hz, input-only complete fights. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaMayorBrowser } from '../tests/helpers/guairaMayorHarness';
import { MAYOR_RULES as R } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { pixelText } from '../src/graphics/BitmapFont';

const [outArg,canvasArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg,'OUTPUT CANVAS_MODULE');
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const out=resolve(outArg);mkdirSync(out,{recursive:true});
const routes={upper:'guairaMayorReplay',ground:'guairaMayorGroundReplay',interrupt:'guairaMayorInterruptReplay',wait:'guairaMayorJumpPulseReplay',retry:'guairaMayorRetryReplay'};
const report:any={nativeInputOnly:true,actorOrClockEdits:false,stepMs:R.tickMs,captureFps:30,routes:{}};
for(const [route,file]of Object.entries(routes)){
    if(process.env.GUAIRA_MAYOR_CAPTURE&&!process.env.GUAIRA_MAYOR_CAPTURE.split(',').includes(route))continue;
    const tape=JSON.parse(readFileSync('tests/helpers/'+file+'.json','utf8'));
    const cleanup:Array<()=>void>=[],h=guairaMayorBrowser({after:f=>cleanup.push(f as ()=>void)});
    for(const o of [h.window,h.document,h.canvas])Object.assign(o,{removeEventListener(){}});
    const screen=createCanvas(640,360),frame=createCanvas(320,180),atlas=createCanvas(1280,612);
    const fc=frame.getContext('2d'),ac=atlas.getContext('2d');fc.imageSmoothingEnabled=ac.imageSmoothingEnabled=false;
    ac.fillStyle='#252b2d';ac.fillRect(0,0,1280,612);
    h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
    h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
    const g=h.create();g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    const dir=join(out,route+'-frames');mkdirSync(dir,{recursive:true});
    const marks=new Map<number,string>();
    for(const n of tape.notes){
        const label=n.label.split(':')[0];
        if(['vault','rushWarning','rush','brake'].includes(label)&&marks.size<9)
            marks.set(n.frame+(label==='vault'?15:label==='rushWarning'?18:label==='rush'?16:6),label==='vault'?'DESCIDA':label==='rushWarning'?'PREPARACAO':label==='rush'?'INVESTIDA':'FRENAGEM');
    }
    marks.set(tape.hitFrames[1],'CONTRA-ATAQUE');marks.set(tape.hitFrames[2],'AGUA LIBERADA');
    const audit:any={frames:0,hitFrames:[],minHelmet:Infinity,maxFeet:-Infinity,damage:[],screens:[],events:tape.events};
    let n=0,index=0,video=0,seals=3;
    for(const [count,keys]of tape.runs){h.keys(keys);for(let i=0;i<count;i++){
        g.update(R.tickMs);n++;const p=g.player.data,m=g.mayor;
        if(p.isDead||!p.hasHelmet)audit.damage.push(n);
        if(m.sealsRemaining<seals){audit.hitFrames.push(n);seals=m.sealsRemaining;}
        audit.minHelmet=Math.min(audit.minHelmet,Math.round(p.position.y)-Math.round(g.camera.y)-4);
        audit.maxFeet=Math.max(audit.maxFeet,Math.round(p.position.y+p.height)-Math.round(g.camera.y));
        if(n%2===0||marks.has(n)){
            const snapshot=JSON.stringify({p:g.player.data,m:g.mayor,o:g.objects,c:g.camera});g.render();
            assert.equal(JSON.stringify({p:g.player.data,m:g.mayor,o:g.objects,c:g.camera}),snapshot,'paint cannot advance combat');
            fc.drawImage(screen,0,0,320,180);
            if(n%2===0)writeFileSync(join(dir,String(++video).padStart(5,'0')+'.png'),frame.toBuffer('image/png'));
            if(marks.has(n)&&index<12){
                const file=route+'-'+n+'.png';writeFileSync(join(out,file),frame.toBuffer('image/png'));
                const x=index%4*320,y=Math.floor(index/4)*204;ac.putImageData(fc.getImageData(0,0,320,180),x,y+24);
                pixelText(ac,marks.get(n)!,x+6,y+8,'#f4dca9');audit.screens.push({frame:n,file,label:marks.get(n)});index++;
            }
        }
    }}
    assert.equal(g.mayor.publicWaterOpen,true);assert.deepEqual(audit.hitFrames,tape.hitFrames);
    assert.deepEqual(audit.damage,[]);assert.ok(audit.minHelmet>=26);assert.ok(audit.maxFeet<=180);
    assert.ok(g.player.data.position.x<100&&g.player.data.isGrounded);
    audit.frames=n;audit.videoFrames=video;audit.complete=true;report.routes[route]=audit;
    writeFileSync(join(out,route+'-atlas.png'),atlas.toBuffer('image/png'));
    g.dispose();for(const f of cleanup.reverse())f();
    console.log(JSON.stringify({route,frames:n,hitFrames:audit.hitFrames,minHelmet:audit.minHelmet,complete:true}));
}
writeFileSync(join(out,'native-verification.json'),JSON.stringify(report,null,2)+'\n');
