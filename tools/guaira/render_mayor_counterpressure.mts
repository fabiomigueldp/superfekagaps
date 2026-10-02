/** Offline QA only. Uses the real Lab, Player, input, HUD and production painters.
 * Usage: node --import tsx tools/guaira/render_mayor_counterpressure.mts RUNTIME OUT BASELINE_ART
 * Optional MAYOR_CANVAS_MODULE points at an already installed @napi-rs/canvas.
 * BASELINE_ART contains historical GuairaMayorArt.ts and GuairaMayorArenaArt.ts.
 * Runtime must include the counterpressure model and cautious replay fixture.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]),out=resolve(process.argv[3]),baseline=resolve(process.argv[4]);
const load=(file:string)=>import(pathToFileURL(file).href);
const {Canvas}=await load(root+'/tests/helpers/guairaLabHarness.ts');
const {guairaMayorBrowser}=await load(root+'/tests/helpers/guairaMayorHarness.ts');
const priorActor=await load(baseline+'/GuairaMayorArt.ts');
const priorArena=await load(baseline+'/GuairaMayorArenaArt.ts');
const require=createRequire(import.meta.url);
const {createCanvas,GlobalFonts}=require(process.env.MAYOR_CANVAS_MODULE??'@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','ProofSans');
const surfaces=new WeakMap(),contexts=new WeakMap();
Canvas.prototype.getContext=function(){
    if(contexts.has(this))return contexts.get(this);
    const surface=createCanvas(this.width,this.height);surfaces.set(this,surface);
    for(const key of ['width','height'])Object.defineProperty(this,key,{configurable:true,get:()=>surface[key],set:v=>{surface[key]=v;}});
    const ctx=surface.getContext('2d'),proxy=new Proxy(ctx,{
        get:(target,key)=>key==='drawImage'?(image,...args)=>target.drawImage(surfaces.get(image)??image,...args):typeof target[key]==='function'?target[key].bind(target):target[key],
        set:(target,key,v)=>{target[key]=v;return true;}
    });contexts.set(this,proxy);return proxy;
};
mkdirSync(out+'/animation-frames',{recursive:true});mkdirSync(out+'/native',{recursive:true});
const recording=JSON.parse(readFileSync(root+'/tests/helpers/guairaMayorReplay.json','utf8'));
const frames=new Map([[502,'Warning 60 ticks'],[532,'Warning 30 ticks'],[561,'Last warning tick'],[562,'First danger tick'],[585,'Last danger tick'],[586,'Clear route'],[637,'Top-hit approach']]);
const rows=[],report=[],animation=[];
for(const mode of ['keyboard','legacy-touch','reduced-motion']){
    const cleanups=[],h=guairaMayorBrowser({after:f=>cleanups.push(f)},{touch:mode==='legacy-touch',reducedMotion:mode==='reduced-motion'}),game=h.create();
    let frame=0;
    const current=game.art.objects;
    function capture(old=false){
        game.art.objects=old?(c,objects,cx,cy)=>{
            priorArena.drawGuairaMayorObjects(c,objects,game.mayor,cx,cy,game.time,game.reducedMotion);
            priorActor.drawGuairaMayorStampTarget(c,game.mayor,cx,cy,game.reducedMotion);
            priorActor.drawGuairaMayor(c,game.mayor,cx,cy,game.reducedMotion);
        }:current;
        const before=JSON.stringify({player:game.player.data,mayor:game.mayor,time:game.time,save:game.store.save});
        game.render();assert.equal(JSON.stringify({player:game.player.data,mayor:game.mayor,time:game.time,save:game.store.save}),before,'painting must not advance simulation');
        const native=createCanvas(320,180),c=native.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(surfaces.get(h.canvas),0,0,320,180);
        return native;
    }
    for(const[count,keys]of recording.runs){
        h.keys(keys);
        for(let n=0;n<count;n++){
            game.update(recording.stepMs);frame++;
            assert.ok(game.player.data.hasHelmet&&!game.player.data.isDead,`cautious replay hit at ${frame}`);
            const selected=mode==='keyboard'?frames.has(frame):frame===562;
            const animated=mode==='keyboard'&&frame>=480&&frame<=652;
            if(!selected&&!animated)continue;
            const old=capture(true),fresh=capture(false);
            if(selected){
                const label=mode==='keyboard'?frames.get(frame):mode==='legacy-touch'?'Legacy touch • first danger':'Reduced motion • first danger';
                rows.push({frame,label,old,fresh});
                writeFileSync(`${out}/native/${mode}-${frame}-before.png`,old.toBuffer('image/png'));
                writeFileSync(`${out}/native/${mode}-${frame}-after.png`,fresh.toBuffer('image/png'));
                report.push({frame,mode,label,phase:game.mayor.counterpressure,vulnerable:game.mayor.vulnerable,player:{...game.player.data.position},cameraY:game.camera.y,hint:game.boss.hint});
            }
            if(animated){
                const pair=createCanvas(1280,398),c=pair.getContext('2d');c.fillStyle='#241f27';c.fillRect(0,0,1280,398);c.font='17px ProofSans';c.fillStyle='#f0ddae';c.imageSmoothingEnabled=false;
                const pulse=game.mayor.counterpressure,label=pulse?`${pulse.phase} • ${pulse.ticksRemaining} ticks left`:'route clear';
                c.fillText(`PRIOR PAINTER • same native state • frame ${frame}`,12,24);c.fillText(`PRESSURE ORDER • ${label}`,652,24);c.drawImage(old,0,38,640,360);c.drawImage(fresh,640,38,640,360);
                writeFileSync(`${out}/animation-frames/${String(animation.length).padStart(4,'0')}.png`,pair.toBuffer('image/png'));animation.push(frame);
            }
        }
    }
    assert.equal(game.mayor.publicWaterOpen,true);for(const f of cleanups)f();
}
const sheet=createCanvas(1280,rows.length*390+38),c=sheet.getContext('2d');c.fillStyle='#241f27';c.fillRect(0,0,sheet.width,sheet.height);c.imageSmoothingEnabled=false;c.font='19px ProofSans';c.fillStyle='#f0ddae';
c.fillText('PRIOR PAINTER • same native model state',12,26);c.fillText('COUNTERPRESSURE • production painter',652,26);
rows.forEach((p,i)=>{const y=38+i*390;c.font='16px ProofSans';c.fillStyle='#f0ddae';c.fillText(`${p.label} • frame ${p.frame}`,12,y+22);c.fillText(`${p.label} • frame ${p.frame}`,652,y+22);c.drawImage(p.old,0,y+30,640,360);c.drawImage(p.fresh,640,y+30,640,360);});
writeFileSync(out+'/before-after-contact-sheet.png',sheet.toBuffer('image/png'));
writeFileSync(out+'/native-state-proof.json',JSON.stringify({runtime:root,baseline,rows:report,animationFrames:animation,method:'Offline native Canvas painters; browser boundaries stubbed; no browser capture'},null,2));
console.log(JSON.stringify({out,rows:rows.length,animationFrames:animation.length,allThreeSeals:true}));
