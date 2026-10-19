/** Isolated animation study, explicitly separate from the input-only gameplay proof. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {box} from '../src/adventure/WorldPainting';
import {pixelText} from '../src/graphics/BitmapFont';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawChaseTerrace,drawChaseCollapse,drawChaseLandmarks} from '../src/adventure/hipotetico/HypotheticalChaseArt';
import {chaseTerraceFall,chaseRuinAt} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {CHASE_BREAKS,CHASE_TERRACES} from '../src/adventure/hipotetico/HypotheticalLayout';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const canvas=createCanvas(320,180),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
const stage=(age:number,contact:number)=>age<0?'INTEIRA':age<contact?'QUEDA':age<contact+16?'CONTATO':age<65?'ACOMODA':'REPOUSO';
const frames=180;
for(let frame=0;frame<frames;frame++){
    const part=frame<90?0:1,local=frame%90,age=local*2-45,p=CHASE_TERRACES[part===0?1:8],site=part===0?1:3;
    const b=new HypotheticalModel('chase');b.x=-1000;b.tick=300+Math.max(0,age);b.chaseBreaks=CHASE_BREAKS.map(()=>-1000);b.chaseBreaks[site]=age<0?-1:300;
    if(age>=0)b.terraceDebris=[{...p,born:300}];
    box(c,0,0,320,180,'#182f3b');box(c,0,24,320,117,'#506e76');box(c,0,141,320,8,'#3c7380');
    for(let x=3;x<320;x+=27){box(c,x,144,14,1,'#679b96');box(c,x+9,148,8,1,'#79aaa5');}
    const before=JSON.stringify(b);
    c.save();c.beginPath();c.rect(0,25,159,124);c.clip();
    if(age<0)drawChaseTerrace(c,p,p.x-47,100);else drawChaseCollapse(c,b,p.x-47,100,false);
    c.restore();
    c.save();c.beginPath();c.rect(161,25,159,124);c.clip();drawChaseLandmarks(c,b,CHASE_BREAKS[site].x-232,100,false);c.restore();
    assert.equal(JSON.stringify(b),before);
    box(c,159,24,2,125,'#819c94');
    pixelText(c,part===0?'MADEIRA':'METAL',14,9,'#dac69f');pixelText(c,part===0?'GUINDASTE':'COMPORTA',175,9,'#dac69f');
    pixelText(c,stage(age,chaseTerraceFall(p,0).contact),14,156,'#a6c2b2');
    pixelText(c,stage(age,chaseRuinAt(0,part===0?78:58).beamContact),175,156,'#a6c2b2');
    pixelText(c,'ESTUDO ISOLADO - DESENHO DO JOGO',14,170,'#879f9b');
    const png=canvas.toBuffer('image/png');writeFileSync(join(out,'frames',String(frame).padStart(5,'0')+'.png'),png);
    if(frame===38)writeFileSync(join(out,'rupture-inspection.png'),png);
}
writeFileSync(join(out,'inspection.json'),JSON.stringify({inspectionOnly:true,representsGameplayCamera:false,productionDrawing:true,gameplayProof:'pursuit-verification.json',frames,seconds:frames/30,renderPure:true},null,2));
console.log(JSON.stringify({passed:true,inspectionOnly:true,frames,seconds:frames/30}));
