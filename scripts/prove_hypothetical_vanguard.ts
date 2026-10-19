/** Explicit sprite inspection. These cells are not a gameplay recording. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalVanguard,type VanguardMove} from '../src/adventure/hipotetico/HypotheticalVanguard';
import {drawVanguard} from '../src/adventure/hipotetico/HypotheticalVanguardArt';
import {pixelText} from '../src/graphics/BitmapFont';
const [destination,module]=process.argv.slice(2);assert.ok(destination&&module);
const {createCanvas}=await import(pathToFileURL(resolve(module)).href);
const canvas=createCanvas(1024,480),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
const names=['INVESTIDA','CORTE DUPLO','SALTO'],labels=['GUARDA','PREPARAR','ARMAR','IMPULSO','CONTATO','DESFECHO','RECUPERAR','ATINGIDO'];
for(const [row,move] of (['rush','cross','vault'] as VanguardMove[]).entries())for(let col=0;col<8;col++){
    c.fillStyle=(row+col)%2?'#29434d':'#243b45';c.fillRect(col*128,row*160,128,160);
    const e=new HypotheticalVanguard({id:'inspection:vanguard',kind:'minion',x:20,y:224,behavior:'canal'},4,()=>[],{left:0,right:320});
    e.move=move;e.facing=1;e.age=1200;e.distance=col*4;
    e.phase=col===0?'walk':col<3?'warning':col<6?'attack':col===6?'rest':'stunned';
    e.actionTicks=[0,17,30,4,12,20,6,4][col];e.timer=e.actionTicks*1000/60;
    e.motionX=col===0||e.phase==='attack'?2:0;
    if(col===7)e.hp=2;
    if(move==='cross'&&col===2){e.strike=1;e.actionTicks=22;}
    if(move==='vault'&&col>=1&&col<=6){
        e.landing={x:20,y:224};
        if(col===3||col===4){e.y-=col===3?7:18;e.vy=-3;}
        if(col===5||col===6){e.landed=true;e.landingAge=3;}
    }
    const before=JSON.stringify(e);c.save();c.translate(col*128,row*160);c.scale(2,2);
    c.fillStyle='#667f7d';c.fillRect(0,60,64,1);drawVanguard(c,e,0,164);c.restore();
    pixelText(c,names[row],col*128+5,row*160+5,'#dfb96f');
    pixelText(c,labels[col],col*128+5,row*160+146,'#c8d8c6');assert.equal(JSON.stringify(e),before);
}
const file=resolve(destination);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,canvas.toBuffer('image/png'));
console.log(JSON.stringify({file,poses:24,artInspectionOnly:true}));
