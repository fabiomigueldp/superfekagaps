/** Two alternate approaches, reached from the title entrance with native input. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { sceneLifecycleBrowser } from '../tests/helpers/sceneLifecycleHarness';
import routes from '../tests/helpers/hypotheticalUpperRoutes.json';

const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const { createCanvas }=await import(pathToFileURL(resolve(canvasModule)).href);
const report=[];let videoFrame=0;
for(const route of routes){
    const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)});
    const screen=createCanvas(640,360),frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
    h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
    h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
    const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    let held=new Set<string>(),previousPlayer=g.player,n=0;
    const captures=[],sourceFrames=[];
    try{
        for(const [count,keys] of route.runs as [number,string[]][]){
            const next=new Set(keys);
            for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{key:k==='Space'?' ':k,code:k,target:h.canvas});
            for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{key:k==='Space'?' ':k,code:k,target:h.canvas});held=next;
            for(let i=0;i<count;i++){
                g.update(1000/60);n++;
                if(g.player!==previousPlayer){held=new Set();previousPlayer=g.player;}
                if(n<route.branchAt)continue;
                const before=JSON.stringify({b:g.fight,p:g.player.data,c:g.camera,o:g.objects});
                g.render();assert.equal(JSON.stringify({b:g.fight,p:g.player.data,c:g.camera,o:g.objects}),before);
                c.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');
                if(n%2===0){writeFileSync(join(out,'frames',`${String(videoFrame++).padStart(5,'0')}.png`),png);sourceFrames.push(n);}
                const landing=route.landings.find(l=>l.frame===n);
                if(landing){
                    assert.equal(g.player.data.isGrounded,true);assert.equal(g.player.data.position.y,landing.y);
                    const file=`upper-${route.link+1}-${landing.deck.startsWith('siege-link-')?'link':'arrival'}.png`;
                    writeFileSync(join(out,file),png);captures.push({file,frame:n,x:g.player.data.position.x,y:g.player.data.position.y});
                }
            }
        }
        assert.equal(captures.length,2);assert.equal(g.receipt.deaths,route.deathsAtBranch);
        report.push({route:route.link+1,inputOnly:true,actorCameraClockEdits:false,deathsDuringApproach:g.receipt.deaths-route.deathsAtBranch,sourceFrames,captures,receipt:g.receipt});
    }finally{g.dispose();for(const f of cleanup.reverse())f();}
}
writeFileSync(join(out,'upper-routes.json'),JSON.stringify({branches:report,videoFrames:videoFrame},null,2));
console.log(JSON.stringify({branches:report.map(r=>({route:r.route,captures:r.captures,receipt:r.receipt})),videoFrames:videoFrame}));
