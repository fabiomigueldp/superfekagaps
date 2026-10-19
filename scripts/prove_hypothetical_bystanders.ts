/** Explicit art inspection poses, separate from the native-play screenshots. */
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { HypotheticalBackdrop } from '../src/adventure/hipotetico/HypotheticalBackdrop';
import { drawBystanders } from '../src/adventure/hipotetico/HypotheticalBystanders';
import { pixelText } from '../src/graphics/BitmapFont';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href),canvas=createCanvas(320,180),c=canvas.getContext('2d');
c.fillStyle='#243b43';c.fillRect(0,0,320,180);
for(const [i,title] of ['ALERTA','CORRER','ABRIGO','RECUO','QUEDA'].entries())pixelText(c,title,i*64+5,5,'#e7cb9c');
for(let row=0;row<4;row++)for(let col=0;col<5;col++){
    const b=new HypotheticalBackdrop(true),p=b.people[[0,1,3,4][row]];b.people.splice(0,b.people.length,p);b.tick=100;
    Object.assign(p,{x:col*64+25,escaped:false,velocity:col===1?.6:0,distance:col===1?14+row:0,
        hitAt:col>=3?b.tick-(col===3?6:38):null,alertAt:col===0?120:0,stoppedAt:col===2?70:null,threatenedAt:col===2?90:null,startledAt:col===2?94:null});
    const y=20+row*40;c.fillStyle=(row+col)%2?'#344e50':'#2d454a';c.fillRect(col*64,y,64,40);
    c.fillStyle='#6d8279';c.fillRect(col*64+5,y+29,54,1);
    const snapshot=JSON.stringify(b);drawBystanders(c,b,y+28,false);assert.equal(JSON.stringify(b),snapshot);
}
mkdirSync(dirname(resolve(destination)),{recursive:true});writeFileSync(resolve(destination),canvas.toBuffer('image/png'));
console.log(JSON.stringify({inspectionOnly:true,poses:20,width:320,height:180}));
