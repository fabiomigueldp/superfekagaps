/** Explicit art poses only. Gameplay verification uses the native keyboard replay separately. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { HypotheticalGuard } from '../src/adventure/hipotetico/HypotheticalGuards';
import { drawHypotheticalGuard } from '../src/adventure/hipotetico/HypotheticalGuardArt';
import { pixelText } from '../src/graphics/BitmapFont';
import type { FoeSpec } from '../src/adventure/types';
const [destination,canvasModule]=process.argv.slice(2);
assert.ok(destination&&canvasModule,'Pass output PNG and canvas module paths');
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const canvas=createCanvas(1280,640),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
const kinds:readonly FoeSpec['kind'][]=['minion','helmet','charger','loader'];
// The atlas poses are explicit; this supplies the second throw's high-arc cue without advancing a live scene.
class InspectionGuard extends HypotheticalGuard { override get highThrow(){return this.comboStep===1;} }
const names=['BATEDOR','BLINDADO','ARIETE','LANCADOR'];
const states=['MOVER','PREPARAR','ATACAR','RECUPERAR','2/2','IMPACTO','VIRAR','APOIO'];
for(const [row,kind] of kinds.entries())for(let col=0;col<10;col++){
    c.fillStyle=(row+col)%2?'#30434b':'#293e47';c.fillRect(col*128,row*128,128,128);
    const e=new InspectionGuard({id:'inspection',kind,x:20,y:54,behavior:'canal'},3);
    Object.assign(e,{phase:['walk','warning','attack','rest','warning','stunned'][col],timer:col===1||col===4?e.warningDuration*.85:120,
        age:1000,distance:6,motionX:col===0?.55:0,armor:col!==5,armorLostAt:col===5?900:-Infinity,facing:col===5?-1:1});
    if(kind==='loader'&&col===2){e.phase='recoil';e.lastRelease=920;}
    if(col===4){e.comboStep=1;e.timer=e.warningDuration*.85;if(kind==='helmet'){e.phase='stunned';e.armor=false;e.armorLostAt=900;}if(kind==='charger')e.phase='rest';}
    if(col===5){e.dead=true;e.deadTimer=100;}
    if(col>=6){
        e.phase='walk';e.armor=true;
        if(kind==='loader'){e.phase='rest';e.reloadAt=e.age-(col===6?320:650);}
        else if(kind==='charger'){e.phase='attack';e.timer=col===6?70:660;}
        else if(col===6)e.turnAt=e.age-85;
        else {e.yielding=true;if(kind==='helmet'){e.armor=false;e.motionX=-.9;}}
    }
    if(col>=8){
        e.yielding=false;e.armor=true;e.comboStep=kind==='minion'?1:0;e.turnAt=-Infinity;
        e.phase=kind==='loader'?'recoil':'attack';e.timer=col===8?110:kind==='loader'?360:kind==='charger'?680:255;
        e.motionX=kind==='loader'?0:1.5;e.distance=col===8?12:19;
        if(kind==='loader')e.lastRelease=e.age-e.timer;
        if(kind==='charger'&&col===9){e.armor=false;e.phase='stunned';e.armorLostAt=e.age-200;}
    }
    const snapshot=JSON.stringify(e);
    c.save();c.translate(col*128,row*128);c.scale(2,2);
    boxFloor();drawHypotheticalGuard(c,e,0,0);c.restore();
    const label=col>=8?(kind==='loader'?(col===8?'RECOLHER':'BUSCAR 2/2'):kind==='charger'&&col===9?'TETO QUEBRADO':col===8?'PASSADA':'DESFECHO'):
        col>=6&&kind==='loader'?(col===6?'BUSCAR':'CARREGAR'):col>=6&&kind==='charger'?(col===6?'ARRANCAR':'FREAR'):
        col===4&&kind==='helmet'?'SEM CAPA':col===4&&kind==='charger'?'FREAR':states[col];
    pixelText(c,`${names[row]} / ${label}`,col*128+4,row*128+117,'#e7cb9c');
    assert.equal(JSON.stringify(e),snapshot,'Rendering must not advance an enemy');
}
const vaultLabels=['AGACHAR','IMPULSO','RECOLHER','DESCER','POUSAR','RECUPERAR','RETOMAR','COLIDIR','FRAGMENTOS','ASSENTAR'];
for(let col=0;col<10;col++){
    c.fillStyle=col%2?'#30434b':'#293e47';c.fillRect(col*128,512,128,128);
    const e=new InspectionGuard({id:'tactics',kind:col<7?'minion':'charger',x:20,y:54,behavior:'canal'},3);
    e.age=2000;e.facing=1;
    if(col<7){
        e.vaultTarget={x:20,y:34,floor:54,supportId:'inspection',steps:30,fromX:8,fromFloor:54};
        e.phase=col===0?'warning':col<4?'attack':col<6?'rest':'walk';
        e.timer=[620,50,230,430,90,350,100][col];
        if(col>=4&&col<=5)e.vaultLandedAt=e.age-e.timer;
        if(col===6){e.vaultTarget=null;e.motionX=.96;e.distance=8;}
    }else{
        e.phase='rest';e.timer=[0,0,0,0,0,0,0,45,160,280][col];e.impactAt=e.age-e.timer;
    }
    const snapshot=JSON.stringify(e);
    c.save();c.translate(col*128,512);c.scale(2,2);boxFloor();drawHypotheticalGuard(c,e,0,0);c.restore();
    pixelText(c,vaultLabels[col],col*128+4,629,'#e7cb9c');
    assert.equal(JSON.stringify(e),snapshot);
}
function boxFloor(){c.fillStyle='#485950';c.fillRect(0,54,64,1);}
const file=resolve(destination);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,canvas.toBuffer('image/png'));
console.log(JSON.stringify({file,width:1280,height:640,poses:50,artInspectionOnly:true}));
