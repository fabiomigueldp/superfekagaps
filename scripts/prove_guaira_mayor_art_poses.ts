/** Extract a contact sheet of production poses from an input-only native run.
 * Usage: node --import tsx scripts/prove_guaira_mayor_art_poses.ts OUTPUT.png CANVAS_MODULE */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaMayorBrowser } from '../tests/helpers/guairaMayorHarness';
import { drawGuairaMayor } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { pixelText } from '../src/graphics/BitmapFont';

const [output,canvasModule]=process.argv.slice(2);
assert.ok(output&&canvasModule,'OUTPUT.png and CANVAS_MODULE required');
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=guairaMayorBrowser({after:f=>cleanup.push(f as ()=>void)});
for(const o of [h.window,h.document,h.canvas])Object.assign(o,{removeEventListener(){}});
const g=h.create(),tape=JSON.parse(readFileSync('tests/helpers/guairaMayorGroundReplay.json','utf8'));
const marks=new Map<number,string>([
    [102,'PREPARAR'],[122,'ERGUE O CARIMBO'],[142,'PRONTO'],[178,'SALTO'],[200,'IMPACTO'],[300,'ESFORCO 1'],
    [309,'ESFORCO 2'],[318,'ESFORCO 3'],[525,'COMANDO'],[548,'DISPARO'],[1708,'AGUA LIBERADA'],[1810,'DESCANSO'],
]);
const board=createCanvas(960,360),c=board.getContext('2d');
c.imageSmoothingEnabled=false;c.fillStyle='#233638';c.fillRect(0,0,960,360);
let frame=0,index=0;
try{
    for(const [count,keys]of tape.runs){h.keys(keys);for(let j=0;j<count;j++){
        g.update(1000/60);frame++;
        assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
        if(!marks.has(frame))continue;
        const x=index%6*160,y=Math.floor(index/6)*180,m=g.mayor;
        c.fillStyle='#2b4040';c.fillRect(x+2,y+2,156,176);pixelText(c,marks.get(frame)!,x+8,y+12,'#e7b685');
        c.save();c.translate(x,y+22);c.scale(2,2);
        const before=JSON.stringify(m);
        drawGuairaMayor(c,m,m.x+m.width/2-38,m.y+m.height-58,false);
        assert.equal(JSON.stringify(m),before);c.restore();index++;
    }}
    assert.equal(index,marks.size);assert.equal(g.mayor.publicWaterOpen,true);
    mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,board.toBuffer('image/png'));
    console.log(`${index} production poses captured from ${frame} native frames`);
}finally{g.dispose();for(const f of cleanup.reverse())f();}
