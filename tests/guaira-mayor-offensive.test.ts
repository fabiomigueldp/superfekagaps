import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaMayorModel, MAYOR_RULES as R, MAYOR_ARENA as A, mayorOverlaps, type MayorAccess } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { drawGuairaMayorStampTarget } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';
import ground from './helpers/guairaMayorGroundReplay.json';
import upper from './helpers/guairaMayorReplay.json';
import interrupt from './helpers/guairaMayorInterruptReplay.json';
import type { Rect } from '../src/types';

const closed:MayorAccess={valveActive:false,liftReady:false,registerOpened:false};
const ready:MayorAccess={valveActive:true,liftReady:true,registerOpened:true};
function until(m:GuairaMayorModel,state:string,a=closed){
    for(let i=0;i<1800&&m.state!==state;i++)m.update(R.tickMs,a);
    assert.equal(m.state,state);
}
function phase(n:number,player={x:100,y:200,width:14,height:24}){
    const m=new GuairaMayorModel();
    for(let i=1;i<n;i++){
        until(m,'recover');m.update(R.tickMs,ready);
        const p={x:m.opening.x,y:m.y-1,width:14,height:24};assert.equal(m.contact(p,{...p,y:m.y-25},true),'hit');
    }
    until(m,'vault',{...closed,player});return m;
}
type Tape={runs:(number|string[])[][];frames:number};
function replay(h:ReturnType<typeof guairaMayorBrowser>,g:ReturnType<ReturnType<typeof guairaMayorBrowser>['create']>,tape:Tape,end=tape.frames){
    let n=0;for(const [count,keys]of tape.runs as Array<[number,string[]]>){h.run(g,Math.min(count,end-n),keys);n+=Math.min(count,end-n);if(n===end)break;}
}

for(const phaseNumber of [2,3])for(const x of [80,248])test(`phase ${phaseNumber}, x ${x}: pursuit commits before departure and every reversal has a full tell`,()=>{
    const m=phase(phaseNumber,{x,y:x>200?136:200,width:14,height:24}),initial=m.rush!;
    assert.ok(Object.isFrozen(initial)&&Object.isFrozen(initial.lane)&&Object.isFrozen(initial.rect));
    const directions:number[]=[];
    until(m,'rushWarning');
    do{
        const rush=m.rush!,start=m.x;directions.push(rush.direction);
        for(let t=0;t<m.rushWarningDuration;t++){
            assert.equal(m.x,start);assert.deepEqual(m.rush!.lane,rush.lane);
            assert.equal(m.rush!.progress,t/m.rushWarningDuration);
            assert.equal(m.dangers.length,m.jets.length*5,'only previously announced packets can persist during preparation');
            m.update(R.tickMs,{...closed,player:{x:t%2?0:300,y:100,width:14,height:24}});
        }
        assert.equal(m.state,'rush');assert.ok(m.dangers.length>=4);
        let travelled=0,previous=m.x;
        while(m.state==='rush'){
            m.update(R.tickMs,closed);travelled+=Math.abs(m.x-previous);
            assert.ok(Math.abs(m.x-previous)<=R.finalRushSpeed+.0001,'bounded physical speed');previous=m.x;
        }
        assert.equal(m.state,'brake');assert.ok(travelled>=190,'the attack actually crosses the arena');
        for(let i=0;i<R.brake;i++)m.update(R.tickMs,closed);
    }while(m.state==='rushWarning');
    assert.equal(m.state,'warning');assert.equal(directions.length,phaseNumber===3?2:1);
    if(directions.length===2)assert.equal(directions[1],-directions[0]);
    assert.equal(initial.phase,'approach','earlier observations stay immutable');
});

test('balcony pressure is chosen before approach, can be dodged, and cutting water removes it',()=>{
    for(const balcony of [false,true]){
        const m=phase(2,{x:260,y:balcony?136:200,width:14,height:24});
        until(m,'rushWarning',{...closed,player:{x:260,y:balcony?200:136,width:14,height:24}});
        assert.equal(!!m.crossfire,balcony,'late movement cannot invent or erase a high shot');
        until(m,'rush');assert.equal(m.jets.length,balcony?1:0);
    }
    const cuts=interrupt.events.filter(e=>e.kind==='interrupt');assert.equal(cuts.length,2);
    for(const cut of cuts){
        const nextHit=interrupt.hitFrames.find(f=>f>cut.frame)!;
        const sequence=interrupt.events.filter(e=>e.frame>cut.frame&&e.frame<nextHit).map(e=>e.kind);
        assert.ok(sequence.includes('rush')&&sequence.includes('stamp'));
        assert.ok(!sequence.includes('jet')&&!sequence.includes('waves'));
    }
});

for(const x of [20,260])test(`aim distinguishes the dry floor under a platform from its walkable top at x=${x}`,()=>{
    const targets=[224,x<100?176:160].map(feet=>{
        const m=new GuairaMayorModel();until(m,'warning',{...closed,player:{x,y:feet-24,width:14,height:24}});return m.stampTarget;
    });
    assert.equal(targets[0].y+targets[0].height,A.floor);
    assert.equal(targets[1].y+targets[1].height,x<100?A.refuge.y:A.deckY);
});

for(const reduced of [false,true])test(`rush damage matches every painted water pixel, including empty shoulders (reduced=${reduced})`,()=>{
    const m=phase(3);until(m,'rush');for(let i=0;i<12;i++)m.update(R.tickMs,closed);
    const pixels=new Set<string>();let paths:Rect[]=[],clips:Rect[][]=[];const stack:Rect[][][]=[];
    const c={fillStyle:'',save(){stack.push([...clips]);},restore(){clips=stack.pop()!;},beginPath(){paths=[];},
        rect(x:number,y:number,width:number,height:number){paths.push({x,y,width,height});},clip(){clips=[...clips,paths];},
        fillRect(x:number,y:number,w:number,h:number){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)
            if(clips.every(group=>group.some(q=>xx>=q.x&&xx<q.x+q.width&&yy>=q.y&&yy<q.y+q.height)))pixels.add(`${xx},${yy}`);}};
    const before=JSON.stringify(m);drawGuairaMayorStampTarget(c as unknown as CanvasRenderingContext2D,m,0,0,reduced);
    assert.equal(JSON.stringify(m),before);assert.equal(stack.length,0);assert.ok(pixels.size>500);
    // Raster edges round world positions; compare the same projected contours.
    const contours=m.dangers.map(q=>({...q,x:Math.round(q.x),y:Math.round(q.y)}));
    for(let y=194;y<226;y++)for(let x=0;x<320;x++){
        const p={x:x+.1,y:y+.1,width:.8,height:.8};assert.equal(contours.some(q=>mayorOverlaps(p,q)),pixels.has(`${x},${y}`));
    }
    m.cancelAttacks();assert.equal(m.dangers.length,0);assert.equal(m.rush,null);assert.equal(m.crossfire,null);
});

for(const [name,tape]of [['floor',ground],['balcony',upper]] as const)test(`${name}: ignoring a rush loses the native helmet, correct input preserves it`,t=>{
    const h=guairaMayorBrowser(t),g=h.create();
    const tell=tape.events.find(e=>e.kind==='rushWarning')!.frame;
    replay(h,g,tape,tell);h.keys([]);
    let contactFrame=0;
    for(let n=0;n<120&&g.player.data.hasHelmet;n++){
        g.update(R.tickMs);
        if(!g.player.data.hasHelmet){contactFrame=n+1;assert.ok(g.mayor.dangers.some(q=>mayorOverlaps(q,g.player.getRect())));}
    }
    assert.ok(contactFrame>=R.rushWarning,'a full visual warning precedes the hit');
    assert.equal(g.player.data.hasHelmet,false);assert.equal(g.mayor.sealsRemaining,2);
    h.keys([]);g.load(A.id);replay(h,g,tape);assert.equal(g.mayor.publicWaterOpen,true);assert.equal(g.player.data.hasHelmet,true);
});

for(const state of ['vault','rushWarning','rush','brake'])test(`native pause, blur, retry and painting preserve ${state}`,t=>{
    const h=guairaMayorBrowser(t),g=h.create();
    const marker=upper.notes.find(n=>n.label.startsWith(state+':'))!.frame;
    replay(h,g,upper,marker+2);h.keys([]);
    const snapshot=()=>JSON.stringify({m:g.mayor,p:g.player.data,o:g.objects,c:g.camera});
    let before=snapshot();g.render();assert.equal(snapshot(),before);
    for(const pause of [()=>g.toggleLabPause(),()=>h.window.dispatch('blur')]){
        pause();before=snapshot();h.run(g,100);g.render();assert.equal(snapshot(),before);g.toggleLabPause();
    }
    g.load(A.id);assert.equal(g.mayor.state,'intro');assert.equal(g.mayor.rush,null);assert.equal(g.mayor.dangers.length,0);
});

for(const offset of [-4,0,4])test(`a floor dodge has a usable timing margin at offset ${offset}`,t=>{
    const h=guairaMayorBrowser(t),g=h.create();
    const jump=ground.notes.find(n=>n.label==='jump-rush-1')!.frame;
    replay(h,g,ground,jump-4);h.run(g,4+offset,[]);h.run(g,18,['Space']);
    for(let i=0;i<100&&g.mayor.state!=='warning';i++)h.run(g,1);
    assert.equal(g.mayor.state,'warning');assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
});

test('the complete balcony route keeps nearby water threats inside the camera while preserving the helmet margin',t=>{
    const h=guairaMayorBrowser(t),g=h.create();let checks=0;
    for(const [n,keys]of upper.runs as Array<[number,string[]]>){h.keys(keys);for(let i=0;i<n;i++){
        g.update(R.tickMs);const p=g.player.getRect(),feet=p.y+p.height;
        for(const q of g.mayor.dangers){
            const horizontalGap=Math.max(q.x-p.x-p.width,p.x-q.x-q.width,0);
            const verticalGap=Math.max(q.y-feet,p.y-q.y-q.height,0);
            if(horizontalGap>48||verticalGap>20)continue;
            assert.ok(q.y-g.camera.y<180&&q.y+q.height-g.camera.y>23,'an immediately nearby threat remains in the playable view');checks++;
        }
    }}
    assert.ok(checks>40);
});
