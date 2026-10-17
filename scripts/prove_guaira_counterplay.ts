/** Native checkpoint inputs captured at 30 fps. Pose comparison is labelled
 * separately and cannot stand in for the recorded combat. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {WorldFoe} from '../src/adventure/WorldEnemies';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {STAGES} from '../src/adventure/campaign';
import {TileType as T} from '../src/constants';
import {drawGuairaFoe} from '../src/adventure/experimental/guaira/GuairaFoeArt';
import {pixelText} from '../src/graphics/BitmapFont';
import tapes from '../tests/helpers/guairaCounterplayReplays.json';

const[outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg,'OUTPUT CANVAS BASELINE required');
const out=resolve(outArg);mkdirSync(out,{recursive:true});const{createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const scenes={travessia:GuairaTraversal,subida:GuairaAscent,respiros:GuairaRespiros,alivio:GuairaRelief};
const h=tapes['helmet-stomps'].marks,c=tapes['charger-counter'].marks,a=tapes['agitator-counter'].marks,w=tapes['rail-window'].marks,p=tapes['rail-pounds'].marks;
const selected:Record<string,Array<[number,string]>>={
    'helmet-stomps':[[h.approach,'COURACA INTACTA'],[h.broken,'PRIMEIRO PISAO'],[h.broken+14,'PROTECAO QUEBRADA'],[h.defeated,'SEGUNDO PISAO']],
    'charger-counter':[[c.warning,'PREPARA A INVESTIDA'],[c.warning+30,'ESQUIVA PARA O BEIRAL'],[c.recovery+5,'TESTA EXPOSTA'],[c.defeated,'CONTRA-ATAQUE']],
    'agitator-counter':[[a.approach,'ESPERE NA MARGEM'],[a.open-20,'PINCAS ESTENDIDAS'],[a.open,'ABERTURA DO GIRO'],[a.defeated,'PISAO SEM DANO']],
    'rail-window':[[w.approach,'TETO FECHADO'],[w.open,'FREOU - TETO ABERTO'],[w.open+9,'SALTO NA ABERTURA'],[w.defeated,'PISAO NO PILOTO']],
    'rail-pounds':[[p.closed,'PROTEGIDO EM MOVIMENTO'],[p.blocked-4,'APROXIMACAO'],[p.blocked,'PISAO REBATIDO'],[p.defeated,'SENTADA ROMPE O TETO']]
};
const posters:Record<string,number>={'helmet-stomps':h.broken,'charger-counter':c.warning+30,'agitator-counter':a.open-20,'rail-window':w.open+9,'rail-pounds':p.blocked};
const sheet=createCanvas(1280,1020),sc=sheet.getContext('2d');sc.imageSmoothingEnabled=false;sc.fillStyle='#293535';sc.fillRect(0,0,1280,1020);
const routes:Record<string,unknown>={};let row=0;
for(const[name,tape]of Object.entries(tapes)){
    const clean:Array<()=>void>=[],h=guairaBrowser({after:f=>clean.push(f as ()=>void)});
    for(const target of [h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
    const screen=createCanvas(640,360),frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
    h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
    const Scene=scenes[tape.course as keyof typeof scenes],g=new Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(tape.foeId))!;
    let held=new Set<string>(),n=0,videoFrames=0,minHead=Infinity,maxFeet=0,hiddenAttackFrames=0;
    const contact=e.contact.bind(e),contacts:Array<{frame:number;result:string;phase:string;pound:boolean}>=[];
    e.contact=(p,previous,falling,pound)=>{const phase=e.phase,result=contact(p,previous,falling,pound);
        if(result==='bounce'||result==='kill')contacts.push({frame:n+1,result,phase,pound});return result;};
    const frames=join(out,name);mkdirSync(frames,{recursive:true});
    for(const[count,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let i=0;i<count;i++){
            g.update(1000/60);n++;const p=g.player.data;assert.ok(p.hasHelmet&&!p.isDead);
            minHead=Math.min(minHead,p.position.y-4-g.camera.y);maxFeet=Math.max(maxFeet,p.position.y+p.height-g.camera.y);
            if(!e.dead&&e.phase==='attack'&&Math.abs(e.x-p.position.x)<180&&(e.y-g.camera.y<23||e.y+e.height-g.camera.y>180))hiddenAttackFrames++;
            const mark=selected[name].findIndex(m=>m[0]===n);
            if(n%2===0||mark>=0||posters[name]===n){
                const before=JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,t:g.time,c:g.camera});g.render();assert.equal(JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,t:g.time,c:g.camera}),before);
                fc.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
                if(n%2===0)writeFileSync(join(frames,String(++videoFrames).padStart(5,'0')+'.png'),png);
                if(posters[name]===n)writeFileSync(join(out,name+'.png'),png);
                if(mark>=0){sc.drawImage(frame,mark*320,row*204+24);pixelText(sc,selected[name][mark][1],mark*320+4,row*204+8,'#efd3a3');}
            }
        }
    }
    assert.equal(n,tape.frames);assert.ok(e.dead);assert.deepEqual(contacts,tape.contacts.map(({frame,result,phase,pound})=>({frame,result,phase,pound})));
    routes[name]={frames:n,videoFrames,minHead,maxFeet,hiddenAttackFrames,checkpoint:tape.checkpoint,contacts,damage:[]};row++;
    g.dispose();for(const f of clean.reverse())f();
}
writeFileSync(join(out,'encounters.png'),sheet.toBuffer('image/png'));

const oldFile=join(out,'previous-art.ts'),base=resolve('src/adventure/experimental/guaira');
writeFileSync(oldFile,readFileSync(join(baselineArg,'GuairaFoeArt.ts'),'utf8').replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>`from ${JSON.stringify(pathToFileURL(resolve(base,relative+'.ts')).href)}`));
const previous=(await import(pathToFileURL(oldFile).href)).drawGuairaFoe as typeof drawGuairaFoe;
const atlas=createCanvas(1272,720),ac=atlas.getContext('2d');ac.imageSmoothingEnabled=false;
const tile=createCanvas(106,90),tc=tile.getContext('2d');let group=0;
for(const kind of ['charger','rail'] as const){
    const data=structuredClone(STAGES[0].level);data.width=64;data.height=18;data.originX=data.originY=0;
    data.tiles=Array.from({length:18},(_,y)=>Array.from({length:64},()=>y>=12?T.GROUND:T.EMPTY));
    const level=new WorldLevel(data),objects=new WorldObjects([]),e=new WorldFoe({id:kind,kind,x:300,y:192,range:32,behavior:'canal'});
    const marks=kind==='charger'?[1,24,47,68,94,142]:[1,20,36,45,68,105];
    for(let n=1;n<=142;n++){
        e.update(1000/60,level,objects,{x:220,y:168,width:14,height:24});const slot=marks.indexOf(n);if(slot<0)continue;
        for(const old of [true,false]){
            tc.fillStyle='#303038';tc.fillRect(0,0,106,90);tc.fillStyle='#705b4c';tc.fillRect(0,62,106,3);
            pixelText(tc,old?'ANTES':'REVISAO',4,4,'#eed9af');(old?previous:drawGuairaFoe)(tc,e,e.x-42,130);
            pixelText(tc,e.phase==='warning'?kind==='rail'?old?'FREANDO':'TETO ABERTO':'PREPARAR':e.phase==='rest'?'EXPOSTO':e.phase==='attack'?'INVESTIDA':'MOVIMENTO',4,78,'#b9d5a4');
            ac.drawImage(tile,slot*212,(group*2+(old?0:1))*180,212,180);
        }
    }group++;
}
writeFileSync(join(out,'recovery-atlas.png'),atlas.toBuffer('image/png'));
writeFileSync(join(out,'native-verification.json'),JSON.stringify({nativeInputOnly:true,actorOrClockEdits:false,setup:'ordinary checkpoint loading in test save',simulationHz:60,captureFps:30,poseStudy:'recovery-atlas is a separate comparison, not player completion',routes},null,2)+'\n');
console.log(JSON.stringify(routes));
