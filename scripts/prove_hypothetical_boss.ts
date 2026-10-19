/** Source-native captures and movie frames from the same input tape used by the browser and regression test. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {HypotheticalAudio,type WeaponCue} from '../src/adventure/hipotetico/HypotheticalAudio';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import replay from '../tests/helpers/hypotheticalReplay.json';

const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(out,{recursive:true});mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>{cleanup.push(f as ()=>void);}});
const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
// Only the platform boundary is replaced. Feka, physics, scene, camera and time stay native.
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
let held=new Set<string>(),lastPlayer=g.player,n=0,videoFrame=0;
const weaponCues:Array<{frame:number;kind:WeaponCue}>=[],originalWeaponCue=HypotheticalAudio.prototype.play;
HypotheticalAudio.prototype.play=function(kind){weaponCues.push({frame:n,kind});return originalWeaponCue.call(this,kind);};
const covered=new Set<string>(),captures:Array<{file:string;frame:number;act:string;state:string;phase:number;attack:string}>=[];
try{
 for(const [count,keys]of replay.runs as [number,string[]][]){
    const next=new Set(keys);
    for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{key:key==='Space'?' ':key,code:key,target:h.canvas});
    held=next;
    for(let i=0;i<count;i++){
        g.update(1000/60);n++;
        if(g.player!==lastPlayer){held=new Set();lastPlayer=g.player;}
        const b=g.fight;
        if(n%2!==0)continue;
        const state=JSON.stringify({b,p:g.player.data,c:g.camera,guards:g.foes});g.render();assert.equal(JSON.stringify({b,p:g.player.data,c:g.camera,guards:g.foes}),state);
        c.drawImage(screen,0,0,320,180);
        const png=frame.toBuffer('image/png');
        writeFileSync(join(out,'frames',String(videoFrame++).padStart(5,'0')+'.png'),png);
        if(g.act==='siege'&&!g.player.data.isDead){
            const m=b.backdrop.motion,local=m.local,center=m.district*416+222-g.camera.x;
            const moment=local>=150&&local<=154?'prepare':local>=174&&local<=178?'strike'
                :local>=188&&local<=192?'collapse':local>=226&&local<=230?'aftermath':null;
            if(moment&&center>24&&center<296){
                const file=`background-${m.district+1}-${moment}.png`;
                if(!covered.has(file)){covered.add(file);writeFileSync(join(out,file),png);captures.push({file,frame:n,act:g.act,state:m.phase,phase:b.phaseNumber,attack:m.kind});}
            }
        }
        if(g.act==='siege'&&!g.player.data.isDead)for(const e of g.foes){
            if(e.dead||e.x-g.camera.x<8||e.x+e.width-g.camera.x>312||e instanceof HypotheticalGuard&&!e.awake)continue;
            const ready=e.phase==='warning'?e.timer>e.warningDuration*.65:e.phase==='attack'?e.timer>80:e.phase==='recoil'?e.timer<160:e.timer>80;
            const name=`guard-${e.spec.kind}-${e.phase}`;
            if(ready&&!covered.has(name)){
                covered.add(name);const file=name+'.png';writeFileSync(join(out,file),png);
                captures.push({file,frame:n,act:g.act,state:e.phase,phase:b.phaseNumber,attack:e.spec.kind});
            }
            const detail=!(e instanceof HypotheticalGuard)?null
                :e.yielding&&e.distance>40&&g.foes.some(a=>!a.dead&&a!==e&&a.phase==='warning')?'guard-formation'
                :e.phase==='walk'&&e.turnProgress>.35&&e.turnProgress<.8?'guard-pivot'
                :e.spec.kind==='loader'&&e.phase==='rest'&&e.reloadProgress>.45&&e.reloadProgress<.6?'guard-resupply':null;
            if(detail&&!covered.has(detail)){
                covered.add(detail);const file=detail+'.png';writeFileSync(join(out,file),png);
                captures.push({file,frame:n,act:g.act,state:e.phase,phase:b.phaseNumber,attack:e.spec.kind});
            }
        }
        const key=g.act==='duel'?`duel-${b.phaseNumber}-${b.attack}-${b.state}`:g.act==='chase'?`chase-${Math.floor(b.tick/150)}`:`siege-${Math.floor(b.tick/300)}`;
        if(!covered.has(key)&&!g.player.data.isDead&&b.age>10){
            covered.add(key);const file=key+'.png';writeFileSync(join(out,file),png);captures.push({file,frame:n,act:g.act,state:b.state,phase:b.phaseNumber,attack:b.attack});
        }
        const closeup=g.player.data.isDead?null
            :b.act==='chase'&&g.player.data.position.x>=560&&g.player.data.position.x<=568?'chase-span'
            :b.act==='chase'&&g.player.data.isGrounded&&Math.abs(g.player.getRect().y+g.player.getRect().height-168)<.1?'terrace-route'
            :b.act==='chase'&&g.player.data.position.x>=4280&&g.player.data.position.x<=4290?'chase-gateway'
            :b.act==='siege'&&b.route.gateTicks.some(t=>t>=28&&t<=40)?`siege-gate-${b.route.cleared}`
            :b.act==='siege'&&b.route.active&&g.player.data.position.x>b.route.sector.origin+90&&g.player.data.position.x<b.route.sector.origin+155?`siege-district-${b.wave}`
            :b.act==='siege'&&b.tick>=280&&b.tick<=284?'siege-courtyard'
            :b.act==='siege'&&b.backdrop.muzzle>0?'distant-gunfire'
            :b.act==='siege'&&b.backdrop.people.some(p=>p.hitAt!==null&&b.tick-p.hitAt>=8&&b.tick-p.hitAt<=12)?'bystander-fall'
            :b.act==='siege'&&b.casualties===6?'siege-aftermath'
            :b.act!=='duel'?null
            :b.phaseNumber===1&&b.tick>=112&&b.tick<=116?'duel-gate'
            :b.state==='roar'&&b.age>=22&&b.age<=24?'roar-command'
            :b.state==='turn'&&b.pivotAge>=5&&b.pivotAge<=7?'planted-pivot'
            :b.chainStep===2&&b.state==='tell'&&b.age>=14&&b.age<=16?`third-${b.attack}-tell`
            :b.state==='attack'&&b.attack==='charge'&&b.age>=20&&b.age<=22?'rider-lean'
            :b.state==='attack'&&b.attack==='leap'&&b.age>=8&&b.age<=10?'reins-takeoff'
            :b.state==='attack'&&b.attack==='leap'&&b.age>=60&&b.age<=62?'landing-weight'
            :b.state==='attack'&&b.attack==='charge'&&b.events.includes('step')?(b.leg===1?'return-footfall':'grounded-footfall')
            :b.impacts.some(p=>b.tick-p.born<3)?'column-impact'
            :b.state==='attack'&&b.attack==='rifle'&&b.phaseNumber===3&&b.volley===1&&b.age>=50&&b.muzzle>0?'rifle-pressure'
            :b.state==='reload'&&b.age>=10&&b.age<=12?'reload-advance'
            :b.vulnerable&&b.age>=18?'open-window'
            :b.state==='reload'&&b.age>=12&&b.age<=14?'rifle-reload'
            :b.state==='reload'&&b.age>=30&&b.age<=32?'rifle-locked'
            :b.state==='attack'&&b.attack==='leap'&&b.age>=28&&b.age<=30?'airborne-tuck'
            :b.state==='attack'&&b.attack==='tail'&&b.age>=20&&b.age<=22?'tail-sweep'
            :b.state==='attack'&&b.attack==='bite'&&b.age>=24&&b.age<=26?'strike-jaw'
            :b.state==='hurt'&&b.age>=4&&b.age<=6?'recovery-hit'
            :b.chaining&&b.chainStep===1&&b.state==='tell'&&b.age>=12&&b.age<=14?`combo-${b.attack}-tell`
            :b.state==='turn'&&b.age>=18&&b.age<=20?'braced-turn'
            :b.state==='attack'&&b.attack==='charge'&&b.age>=42&&b.age<=44?'charge-brake'
            :b.state==='attack'&&b.attack==='rifle'&&b.heat>.7&&b.muzzle>0?'hot-rifle':null;
        if(closeup&&!covered.has(closeup)){
            covered.add(closeup);const file=closeup+'.png';writeFileSync(join(out,file),png);captures.push({file,frame:n,act:g.act,state:b.state,phase:b.phaseNumber,attack:b.attack});
        }
    }
 }
 assert.equal(g.fight.won,true);
 for(let i=0;i<90;i++){
    // Match the 30fps sampling of the rest of the movie, including the full defeat animation.
    g.update(1000/60);g.update(1000/60);g.render();c.drawImage(screen,0,0,320,180);
    const png=frame.toBuffer('image/png');writeFileSync(join(out,'frames',String(videoFrame++).padStart(5,'0')+'.png'),png);
    if(i===12)writeFileSync(join(out,'defeat-reaction.png'),png);
 }
 writeFileSync(join(out,'victory.png'),frame.toBuffer('image/png'));
 writeFileSync(join(out,'weapon-cues.json'),JSON.stringify({seconds:videoFrame/30,cues:weaponCues}));
 writeFileSync(join(out,'report.json'),JSON.stringify({inputOnly:true,actorCameraClockEdits:false,frames:n,videoFrames:videoFrame,receipt:g.receipt,captures},null,2));
 console.log(JSON.stringify({receipt:g.receipt,captures:captures.length,frames:n,videoFrames:videoFrame}));
}finally{HypotheticalAudio.prototype.play=originalWeaponCue;g.dispose();for(const f of cleanup.reverse())f();}
