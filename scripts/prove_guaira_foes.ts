/** Sprite studies use the real foe clocks on a native flat tile floor. They
 * illustrate action poses, not a player's completion of a level. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {WorldFoe} from '../src/adventure/WorldEnemies';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {drawGuairaFoe} from '../src/adventure/experimental/guaira/GuairaFoeArt';
import {pixelText} from '../src/graphics/BitmapFont';
import {STAGES} from '../src/adventure/campaign';
import {TileType as T} from '../src/constants';
import type {FoeKind} from '../src/adventure/types';
import {guairaTraversalStage} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {guairaAscentStage} from '../src/adventure/experimental/guaira/GuairaAscent';
import {guairaJunctionStage} from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import {guairaRespirosStage} from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import {guairaGalleryStage} from '../src/adventure/experimental/guaira/gallery/GuairaGalleryStage';
import {guairaReliefStage} from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';

const [outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg,'OUTPUT CANVAS BASELINE required');
const out=resolve(outArg);mkdirSync(out,{recursive:true});mkdirSync(join(out,'animation'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const oldFile=join(out,'previous-art.ts'),base=resolve('src/adventure/experimental/guaira');
writeFileSync(oldFile,readFileSync(join(baselineArg,'GuairaFoeArt.ts'),'utf8').replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>`from ${JSON.stringify(pathToFileURL(resolve(base,relative+'.ts')).href)}`));
const previous=(await import(pathToFileURL(oldFile).href)).drawGuairaFoe as typeof drawGuairaFoe;
const kinds:FoeKind[]=['minion','helmet','charger','loader','agitator','rail'];
const names=['PINCADEIRO','COURACA','INVESTIDOR','CARREGADOR','MEXEDOR','VAGONETE'];
const marks=[[0,40,50,66,72,78,86,100],[0,40,119,121,132,152,165,200],[0,40,60,87,95,110,125,150],
    [0,92,115,139,143,260,285,310],[0,94,115,138,144,155,180,200],[0,12,32,50,65,90,110,125]];
const phases={walk:'MOVER',rest:'APOIO',warning:'PREPARAR',attack:'ATACAR',recoil:'RECOLHER',stunned:'SEM COURACA'};
const models=kinds.map(kind=>{
    const data=structuredClone(STAGES[0].level);data.width=64;data.height=18;data.originX=data.originY=0;
    data.tiles=Array.from({length:18},(_,row)=>Array.from({length:64},()=>row>=12?T.GROUND:T.EMPTY));
    return {e:new WorldFoe({id:kind,kind,x:300,y:192,range:48,behavior:'canal'}),level:new WorldLevel(data),objects:new WorldObjects([])};
});
const tile=createCanvas(106,90),tc=tile.getContext('2d');tc.imageSmoothingEnabled=false;
const atlas=createCanvas(8*212,6*180),ac=atlas.getContext('2d');ac.imageSmoothingEnabled=false;
const compare=createCanvas(6*212,2*180),cc=compare.getContext('2d');cc.imageSmoothingEnabled=false;
const movie=createCanvas(320,180),mc=movie.getContext('2d');mc.imageSmoothingEnabled=false;
const paint=(index:number,old=false)=>{
    const e=models[index].e;tc.fillStyle='#303038';tc.fillRect(0,0,106,90);
    tc.fillStyle='#705b4c';tc.fillRect(0,62,106,3);tc.fillStyle='#423d3a';tc.fillRect(0,65,106,25);
    pixelText(tc,names[index],4,4,'#eed9af');
    const before=JSON.stringify(e);(old?previous:drawGuairaFoe)(tc,e,e.x-42,130,false);assert.equal(JSON.stringify(e),before);
    pixelText(tc,old?'ANTES':e.dead?'DERROTADO':e.spec.kind==='loader'&&e.phase==='warning'?(e.highThrow?'ARREMESSO ALTO':'ARREMESSO BAIXO'):phases[e.phase],4,78,'#d5b9e1');
    return tile;
};
const states:unknown[]=[];
for(let frame=0;frame<480;frame++){
    for(let index=0;index<models.length;index++){
        const {e,level,objects}=models[index];
        if(frame>0)e.update(1000/60,level,objects,{x:frame<40?800:e.x-40,y:168,width:14,height:24});
        if(index===1&&(frame===120||frame===420)){
            const p={x:e.x+2,y:e.y-20,width:14,height:24};e.contact(p,{...p,y:e.y-25},true,false);
        }
        const slot=marks[index].indexOf(frame);
        if(slot>=0){ac.drawImage(paint(index),slot*212,index*180,212,180);states.push({kind:e.spec.kind,frame,phase:e.phase,high:e.highThrow,armored:e.armor});}
        if(frame===0){cc.drawImage(paint(index,true),index*212,0,212,180);cc.drawImage(paint(index),index*212,180,212,180);}
        if(frame%2===0)mc.drawImage(paint(index),(index%3)*107,Math.floor(index/3)*90);
    }
    if(frame%2===0)writeFileSync(join(out,'animation',String(frame/2+1).padStart(5,'0')+'.png'),movie.toBuffer('image/png'));
}
writeFileSync(join(out,'enemy-atlas.png'),atlas.toBuffer('image/png'));
writeFileSync(join(out,'before-after.png'),compare.toBuffer('image/png'));
const inventory=[guairaTraversalStage(),guairaJunctionStage(),guairaRespirosStage(),guairaAscentStage(),guairaGalleryStage(),guairaReliefStage()].map(stage=>({
    id:stage.id,count:stage.foes.length,families:Object.fromEntries(kinds.map(kind=>[kind,stage.foes.filter(e=>e.kind===kind).length])),
    enemies:stage.foes.map(e=>({id:e.id,kind:e.kind,x:e.x,feet:e.y,range:e.range,behavior:e.behavior}))
}));
assert.ok(inventory.every(s=>s.enemies.every(e=>e.behavior==='canal')));
writeFileSync(join(out,'art-verification.json'),JSON.stringify({kind:'authored-pose-study-not-player-replay',simulationHz:60,captureFps:30,frames:480,inventory,states,readOnlyPaint:true},null,2));
console.log(JSON.stringify(inventory.map(({id,count,families})=>({id,count,families}))));
