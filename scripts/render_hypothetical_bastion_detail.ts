/** Explicit animation details for art review, not a played scene. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HypotheticalVanguard} from '../src/adventure/hipotetico/HypotheticalVanguard';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {drawHypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuardArt';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,module]=process.argv.slice(2);
const {createCanvas}=await import(pathToFileURL(resolve(module)).href);
const canvas=createCanvas(960,384),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
const impacts=[0,30,60,90,120,180];
const loaderLabels=['BUSCAR','AVISO ALTO','ERGUE O PESO','SOLTAR','AVISO BAIXO','REABASTECER'];
for(let row=0;row<2;row++)for(let col=0;col<6;col++){
    c.fillStyle=(row+col)%2?'#29434d':'#243b45';c.fillRect(col*160,row*192,160,192);
    const e=row===0?new HypotheticalVanguard({id:'art:vanguard',kind:'minion',x:27,y:224,behavior:'canal'},4,()=>[],{left:0,right:320})
        :new HypotheticalGuard({id:'art:cover',kind:'loader',x:27,y:224,behavior:'canal'},4);
    e.facing=1;e.age=1000;
    if(e instanceof HypotheticalVanguard){
        e.phase='warning';e.actionTicks=20;e.move='cross';
        e.parryAt=1000;e.age+=impacts[col];e.parryPoint={x:37,y:193};
    }else{
        e.phase=col===0||col===5?'rest':col===3?'recoil':'warning';
        e.coveringElite=col===4?'low':'high';
        e.timer=col===1?250:col===2?720:col===3?75:col===4?650:450;
        e.reloadAt=e.age-(col===0?300:620);
        if(col===3)e.lastRelease=e.age-75;
    }
    c.save();c.translate(col*160,row*192);c.scale(2,2);
    c.fillStyle='#667f7d';c.fillRect(0,76,80,1);drawHypotheticalGuard(c,e,0,148);c.restore();
    pixelText(c,row===0?'BLOQUEIO / '+impacts[col]+'MS':loaderLabels[col],col*160+6,row*192+175,'#e2b56d');
}
const file=resolve(destination);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,canvas.toBuffer('image/png'));
console.log(JSON.stringify({file,poses:12,artInspectionOnly:true}));
