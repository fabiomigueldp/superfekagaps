import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaMayorModel, MAYOR_RULES as R, MAYOR_ARENA as A, type MayorAccess } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { drawGuairaMayorFeedback } from '../src/adventure/experimental/guaira/GuairaMayorFeedbackArt';
import { MAYOR_PALETTE as P } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';
import retry from './helpers/guairaMayorRetryReplay.json';

const closed:MayorAccess={valveActive:false,liftReady:false,registerOpened:false};
const ready:MayorAccess={valveActive:true,liftReady:true,registerOpened:false};
const opened:MayorAccess={...ready,registerOpened:true};
function advance(m:GuairaMayorModel,n:number,access=closed){for(let i=0;i<n;i++)m.update(R.tickMs,access);}
function until(m:GuairaMayorModel,state:string,access=closed){for(let i=0;i<1600;i++){m.update(R.tickMs,access);if(m.state===state)return;}assert.fail('missing '+state);}
function hit(m:GuairaMayorModel){const p={x:m.opening.x,y:m.y-1,width:14,height:24};return m.contact(p,{...p,y:m.y-25},true);}
function phase(n:number){const m=new GuairaMayorModel();for(let i=1;i<n;i++){until(m,'recover');m.update(R.tickMs,opened);assert.equal(hit(m),'hit');}until(m,'jetWarning');return m;}

for(const seal of [2,3])test(`seal ${seal}: failed openings rotate three complete advertised phrases, then repeat`,()=>{
    const m=phase(seal),phrases:string[][]=[];
    for(let cycle=0;cycle<4;cycle++){
        const sequence=m.salvo!.sequence,plan=sequence.map(s=>s.lane+':'+s.direction);
        assert.ok(Object.isFrozen(sequence)&&sequence.every(Object.isFrozen));phrases.push(plan);
        for(let shot=0;shot<sequence.length;shot++){
            assert.equal(m.state,'jetWarning');const warning=m.salvo!,previous=JSON.stringify(warning);
            assert.equal(warning.progress,0);assert.equal(warning.shot,shot+1);assert.deepEqual(warning.sequence,sequence);
            for(let tick=0;tick<m.jetWarningDuration;tick++){
                assert.equal(m.salvo!.lane,sequence[shot].lane);assert.equal(m.salvo!.direction,sequence[shot].direction);
                assert.equal(m.salvo!.progress,tick/m.jetWarningDuration);
                m.update(R.tickMs,{...closed,player:{x:tick%2?4:290,y:100,width:14,height:24}});
            }
            assert.equal(JSON.stringify(warning),previous,'snapshots cannot change under a moving player');
            assert.equal(m.state,'jetBurst');const j=m.jets.at(-1)!;
            assert.equal(j.y,sequence[shot].lane==='high'?144:208);assert.equal(j.direction,sequence[shot].direction);
            assert.equal(j.x,j.direction===1?8:282,'every projectile starts at a real nozzle');
            advance(m,m.jetBeatDuration);
        }
        until(m,'recover');advance(m,m.recoveryTicksRemaining);until(m,'jetWarning');
    }
    assert.equal(new Set(phrases.slice(0,3).map(p=>p.join('|'))).size,3);
    assert.deepEqual(phrases[3],phrases[0]);assert.equal(m.sealsRemaining,4-seal);
});

test('a successful seal restarts the next phase with its authored introductory phrase',()=>{
    const m=phase(2);until(m,'recover');advance(m,m.recoveryTicksRemaining);until(m,'jetWarning');
    assert.equal(m.salvo!.lane,'low');until(m,'recover');m.update(R.tickMs,opened);assert.equal(hit(m),'hit');
    until(m,'jetWarning');assert.deepEqual(m.salvo!.sequence,[{lane:'low',direction:1},{lane:'high',direction:-1},{lane:'low',direction:-1}]);
});

test('late fresh input waits for actual lift arrival, then grants one bounded opening',()=>{
    const m=phase(2);until(m,'recover');advance(m,R.recover-5);
    m.update(R.tickMs,{...opened,liftReady:false});
    advance(m,70,{...ready,liftReady:false});assert.equal(m.state,'recover');assert.equal(m.vulnerable,false);
    assert.equal(m.counterpressure,null,'pressure cannot fire while the platform is in transit');
    m.update(R.tickMs,ready);assert.equal(m.vulnerable,true);assert.equal(m.recoveryTicksRemaining,R.minimumOpening);
    assert.equal(m.recoveryProgress,0);
    // Repeated fresh toggles cannot refill the opening or schedule another seam.
    for(let i=0;i<R.minimumOpening-1;i++){
        m.update(R.tickMs,i%2?opened:closed);
        assert.equal(m.recoveryTicksRemaining,R.minimumOpening-i-1);
        assert.ok(m.recoveryProgress>0);
    }
    m.update(R.tickMs,opened);assert.equal(m.state,'idle');assert.equal(m.vulnerable,false);
    assert.equal(m.counterpressure,null);assert.equal(m.sealsRemaining,2);
});

test('an obstructed or repeatedly toggled lift cannot hold the encounter forever',()=>{
    const m=phase(2);until(m,'recover');advance(m,R.recover-1);
    m.update(R.tickMs,{...opened,liftReady:false});
    for(let i=0;i<R.liftArrivalBudget;i++)m.update(R.tickMs,{...opened,liftReady:false});
    assert.equal(m.state,'idle');assert.equal(m.danger,null);assert.equal(m.vulnerable,false);
    until(m,'jetWarning');assert.equal(m.salvo!.shot,1);assert.equal(m.registerOpenedThisCycle,false);
});

test('the first seal still times out if no register is used; dt clamp cannot skip the approach',()=>{
    const m=new GuairaMayorModel();until(m,'recover');advance(m,R.recover-5);
    const before=JSON.stringify(m);for(const dt of [0,-1,NaN,Infinity])m.update(dt,opened);assert.equal(JSON.stringify(m),before);
    m.update(10000,{...opened,liftReady:false});assert.equal(m.state,'recover');assert.equal(m.vulnerable,false);
    assert.equal(m.stateTick,R.recover+1);assert.ok(m.recoveryTicksRemaining>70);
    const other=new GuairaMayorModel();until(other,'recover');advance(other,R.recover);assert.equal(other.state,'idle');
});

function raster(m:GuairaMayorModel,reduced=false,cx=0,cy=64){
    const pixels=new Map<string,string>();let color='',depth=0;
    const c={get fillStyle(){return color;},set fillStyle(value:string){color=value;},
        save(){depth++;},restore(){depth--;},beginPath(){},rect(){},clip(){},
        fillRect(x:number,y:number,w:number,h:number){assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);
            for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.set(`${xx},${yy}`,color);
        }};
    const before=JSON.stringify(m);drawGuairaMayorFeedback(c as unknown as CanvasRenderingContext2D,m,cx,cy,reduced);
    assert.equal(JSON.stringify(m),before);assert.equal(depth,0);return pixels;
}

for(const register of ['lower','upper'] as const)test(`${register}: cut feedback belongs to the used register and shares the fixed clock`,()=>{
    const m=phase(2);until(m,'jetBurst');m.update(R.tickMs,{...opened,liftReady:false,register});
    const e=m.feedback.find(e=>e.kind==='interrupt')!,plate=register==='upper'?A.upperValve:A.valve;
    assert.ok(Object.isFrozen(e));assert.equal(e.x,plate.x+plate.width/2);assert.equal(e.y,plate.y+4);
    const first=raster(m),still=raster(m,true);assert.deepEqual(raster(m),first);assert.ok(first.size>5);
    const water=new Set<string>([P.water,P.waterLight,P.waterShade]);assert.ok([...first.values()].every(c=>!water.has(c)),'feedback cannot impersonate damaging water');
    advance(m,8,{...ready,liftReady:false});assert.notDeepEqual(raster(m),first);assert.deepEqual(raster(m,true),still);
    const age=e.age;assert.equal(e.age,age);const snap=JSON.stringify(m);
    for(const dt of [0,-1,NaN,Infinity])m.update(dt,closed);assert.equal(JSON.stringify(m),snap);
    advance(m,42,closed);assert.equal(m.feedback.some(e=>e.kind==='interrupt'),false);
    assert.ok(m.feedback.every(e=>e.kind==='landing'),'the new landing has independent feedback');
});

test('each hit breaks the matching physical seal; repeated contact cannot emit duplicate effects',()=>{
    const m=new GuairaMayorModel();
    for(let remaining=2;remaining>=0;remaining--){
        until(m,'recover');m.update(R.tickMs,opened);assert.equal(hit(m),remaining?'hit':'defeated');
        const e=m.feedback.at(-1)!;assert.equal(e.seal,remaining);assert.equal(e.x,244+remaining*7);assert.equal(e.y,193);
        assert.equal(e.kind,remaining?'seal':'release');const events=m.feedback.length;assert.equal(hit(m),'none');assert.equal(m.feedback.length,events);
        assert.ok(raster(m).size>0);const initial=e.age;advance(m,12);assert.equal(e.age,initial);
    }
    advance(m,90);assert.equal(m.feedback.length,0);assert.equal(m.publicWaterOpen,true);
});

for(const touch of [false,true])for(const reducedMotion of [false,true])
test(`native missed opening, changed phrase and late lift remain winnable: touch=${touch}, reduced=${reducedMotion}`,t=>{
    const h=guairaMayorBrowser(t,{touch,reducedMotion}),g=h.create();let frame=0,seals=3;
    const hits:number[]=[],lateSwitches:number[]=[],arrivals:number[]=[];
    for(const [count,keys]of retry.runs as Array<[number,string[]]>){
        if(touch)h.canvas.dispatch('touchstart',{touches:keys.map((key,i)=>({identifier:i+1,target:h.canvas,
            clientX:(key==='ArrowLeft'?.07:key==='ArrowRight'?.22:key==='ArrowDown'?.5:.93)*640,clientY:330}))});else h.keys(keys);
        for(let i=0;i<count;i++){
            const wasReady=g.mayor.vulnerable;g.update(R.tickMs);frame++;
            assert.equal(g.player.data.hasHelmet,true,`frame ${frame}`);assert.equal(g.player.data.isDead,false);
            assert.ok(Math.round(g.player.data.position.y)-Math.round(g.camera.y)-4>=26);
            if(frame===retry.salvoWarningFrames[2])assert.deepEqual(g.mayor.salvo!.sequence,[{lane:'low',direction:-1},{lane:'high',direction:-1}]);
            if(g.mayor.sealsRemaining===2&&g.mayor.cycle===3&&g.objects.events.some(e=>e.kind==='switch'))lateSwitches.push(frame);
            if(g.mayor.sealsRemaining===2&&g.mayor.cycle===3&&!wasReady&&g.mayor.vulnerable){
                arrivals.push(frame);assert.equal(g.objects.get(A.liftId)!.y,A.deckY);
                assert.equal(g.mayor.recoveryTicksRemaining,R.minimumOpening);assert.equal(g.mayor.recoveryProgress,0);
            }
            if(g.mayor.sealsRemaining<seals){hits.push(frame);seals=g.mayor.sealsRemaining;}
        }
    }
    assert.equal(lateSwitches.length,1);assert.deepEqual(arrivals,[retry.seamWarningFrames[1]]);
    assert.equal(arrivals[0]-lateSwitches[0],70,'late input still earns the complete native lift trip');assert.deepEqual(hits,retry.hitFrames);
    assert.equal(g.mayor.publicWaterOpen,true);assert.ok(g.player.data.position.x<100);
    assert.deepEqual(g.store.save.completed,[]);assert.deepEqual(h.storageCalls,[]);
});
