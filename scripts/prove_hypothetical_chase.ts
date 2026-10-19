/** Complete pursuit via recorded keyboard input. Camera, actors and clock remain native. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalAudio,type WeaponCue} from '../src/adventure/hipotetico/HypotheticalAudio';
import {CHASE_BREAKS} from '../src/adventure/hipotetico/HypotheticalLayout';
import {CHASE_QUAYS,chaseQuayX} from '../src/adventure/hipotetico/HypotheticalChaseLife';
import {chaseTerraceFall,chaseMaterialAt,chaseRuinAt,chaseCollapsedEdge} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {hypotheticalChaseInputs} from '../tests/helpers/hypotheticalRoutes';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)});
const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
let held=new Set<string>(),n=0,videoFrames=0,lastState=g.fight.state;
const covered=new Set<string>(),captures:unknown[]=[],attacks:unknown[]=[],cues:Array<{frame:number;kind:WeaponCue}>=[];
const terraceContacts:Array<{worldX:number;frame:number;screenX:number;visible:boolean}>=[];
const terraceReleases:Array<{worldX:number;frame:number;playerClearance:number;cause:string}>=[];
const play=HypotheticalAudio.prototype.play;HypotheticalAudio.prototype.play=function(kind){cues.push({frame:n,kind});return play.call(this,kind);};
try{
 for(const [count,input]of hypotheticalChaseInputs('upper')){
    const next=new Set(input);
    for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{key:k==='Space'?' ':k,code:k,target:h.canvas});
    for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{key:k==='Space'?' ':k,code:k,target:h.canvas});held=next;
    for(let i=0;i<count;i++){
        n++;g.update(1000/60);if(g.act!=='chase')continue;
        const b=g.fight,p=g.player.getRect();assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
        if(b.state==='tell'&&lastState!=='tell')attacks.push({frame:n,x:p.x,kind:b.pursuitKind,warningTicks:b.warningTicks});lastState=b.state;
        const names:string[]=[];
        for(const [j,site]of CHASE_QUAYS.entries()){
            const at=b.chaseReactions[j],age=at===-1?-1:b.tick-at,x=chaseQuayX(site.x,g.camera.x);
            if([1,4,7,9].includes(j)&&x>0&&x<235){
                if(age===0)names.push(`pursuit-life-${site.kind}-notice`);
                if(age===30)names.push(`pursuit-life-${site.kind}-reaction`);
            }
        }
        if(b.chaseBreaks[3]>=0&&b.tick-b.chaseBreaks[3]===12)names.push('pursuit-life-water-surge');
        for(const [j,d]of CHASE_BREAKS.entries()){
            const sx=d.x-g.camera.x,at=b.chaseBreaks[j],age=b.tick-at;
            if(at<0&&sx>=250&&sx<254)names.push(`pursuit-site-${j+1}-approach`);
            if(at>=0&&age===14&&sx>0&&sx<320)names.push(`pursuit-destruction-${j+1}`);
            if(at>=0&&age===32&&sx>-20&&sx<320)names.push(`pursuit-site-${j+1}-fall`);
            const hit=chaseRuinAt(age,d.kind==='crane'?78:d.kind==='sluice'?58:69);
            if(at>=0&&hit.groundAge>=0&&hit.groundAge<1&&sx>-35&&sx<320)names.push(`pursuit-ruin-${d.kind}-contact`);
        }
        for(const d of b.terraceDebris){
            const age=b.tick-d.born,fall=chaseTerraceFall(d,age),sx=d.x+fall.contactX-g.camera.x,material=chaseMaterialAt(d.x)==='iron'?'iron':'wood';
            if(age===0)terraceReleases.push({worldX:d.x,frame:n,playerClearance:p.x-d.x-d.width,cause:d.x<chaseCollapsedEdge(b.x)?'lost-bank':'head-strike'});
            if(fall.splashAge>=0&&fall.splashAge<1)terraceContacts.push({worldX:d.x,frame:n,screenX:sx,visible:sx>5&&sx<315});
            if(sx>5&&sx<315){
                if(age===3)names.push(`pursuit-platform-${material}-release`);
                if(fall.splashAge>=0&&fall.splashAge<1)names.push(`pursuit-platform-${material}-contact`);
                if(fall.splashAge>=7&&fall.splashAge<8)names.push(`pursuit-platform-${material}-spray`);
            }
        }
        for(const impact of b.impacts)if(b.tick-impact.born===6&&impact.x-g.camera.x>8&&impact.x-g.camera.x<312&&impact.y-g.camera.y<178)names.push(`pursuit-impact-${impact.material}`);
        if(b.state==='attack'&&b.pursuitKind==='ram'&&b.age===48)names.push('pursuit-ram-recovery');
        if(b.terraceDebris.some(d=>b.tick-d.born===8&&d.x+d.width-g.camera.x>12))names.push('pursuit-terrace-fall');
        if(b.state==='tell'&&b.age===30)names.push(`pursuit-${b.pursuitKind}-warning`);
        if(b.state==='attack'&&b.age===13)names.push(`pursuit-${b.pursuitKind}-attack`);
        if(g.player.data.isGrounded&&p.y<155&&p.x>800&&p.x<864)names.push('pursuit-upper-route');
        if(p.x>1790&&p.x<1800)names.push('pursuit-cargo');
        if(p.x>2304&&p.x<2312)names.push('pursuit-checkpoint');
        if(p.x>3030&&p.x<3040)names.push('pursuit-rhythm');
        if(p.x>4280&&p.x<4290)names.push('pursuit-gateway');
        if(n%2===0||names.some(name=>!covered.has(name))){
            const before=JSON.stringify({b,p:g.player.data,camera:g.camera,tiles:g.level.data.tiles});g.render();
            assert.equal(JSON.stringify({b,p:g.player.data,camera:g.camera,tiles:g.level.data.tiles}),before);
            c.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
            if(n%2===0)writeFileSync(join(out,'frames',String(videoFrames++).padStart(5,'0')+'.png'),png);
            for(const name of names)if(!covered.has(name)){
                covered.add(name);writeFileSync(join(out,name+'.png'),png);captures.push({file:name+'.png',frame:n,x:p.x,state:b.state,kind:b.pursuitKind,camera:{...g.camera}});
                if(name==='pursuit-low-attack'){
                    h.media.matches=true;g.render();c.drawImage(screen,0,0,320,180);writeFileSync(join(out,'pursuit-reduced.png'),frame.toBuffer('image/png'));h.media.matches=false;
                    assert.equal(JSON.stringify({b,p:g.player.data,camera:g.camera,tiles:g.level.data.tiles}),before);
                }
            }
        }
    }
 }
 assert.equal(g.act,'siege');assert.equal(g.receipt.deaths,0);assert.equal(attacks.length,7);
 for(const i of [1,2,3,4,5,6])assert.ok(covered.has(`pursuit-destruction-${i}`));
 assert.equal(terraceContacts.length,10);assert.ok(terraceContacts.filter(c=>c.visible).length>=8);
 const report={inputOnly:true,actorCameraClockEdits:false,frames:n,videoFrames,seconds:videoFrames/30,receipt:g.receipt,attacks,terraceReleases,terraceContacts,captures};
 writeFileSync(join(out,'pursuit-verification.json'),JSON.stringify(report,null,2));writeFileSync(join(out,'weapon-cues.json'),JSON.stringify({seconds:videoFrames/30,cues}));
 console.log(JSON.stringify({passed:true,frames:n,videoFrames,captures:captures.length,attacks:attacks.length}));
}finally{HypotheticalAudio.prototype.play=play;g.dispose();for(const f of clean.reverse())f();}
