import test from 'node:test';
import assert from 'node:assert/strict';
import {ARRIVAL,arrivalGate,arrivalFade,arrivalDeployment} from '../src/adventure/hipotetico/HypotheticalArrival';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {HypotheticalBackdrop,backdropBaseline,BACKDROP_RIG} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {bystanderBounds,bystanderIntersection,bystanderPose} from '../src/adventure/hipotetico/HypotheticalBystanderMotion';
import {drawBystanders} from '../src/adventure/hipotetico/HypotheticalBystanders';
import {OPENING,arrivalOpeningAt,drawOpeningAftermath} from '../src/adventure/hipotetico/HypotheticalOpening';
import {distantRiderPose} from '../src/adventure/hipotetico/HypotheticalArt';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
const dt=1000/60;

test('arrival masks the camera reset, reveals the garrison before release, and raises the physical gate monotonically',()=>{
    assert.equal(arrivalFade('chase',1280,60),1);assert.equal(arrivalFade('siege',0,0),1);
    assert.equal(arrivalFade('siege',16,0),0);assert.equal(arrivalFade('siege',0,0,true),0);
    assert.equal(arrivalDeployment(ARRIVAL.deployment),0);assert.equal(arrivalDeployment(ARRIVAL.release),1);
    let previous:number=ARRIVAL.gateHeight;
    for(let tick=0;tick<=ARRIVAL.release+ARRIVAL.lift;tick++){
        const gate=arrivalGate(tick);assert.ok(gate.height<=previous);assert.ok(gate.height>=0);
        if(tick<ARRIVAL.release){assert.equal(gate.height,120);assert.equal(gate.ready,false);}
        previous=gate.height;
    }
    assert.equal(previous,0);assert.equal(arrivalGate(0,true).height,0);
});

test('Feka can move and jump in the forecourt, but cannot reach hidden enemies or take an opening hit',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    try{
        g.act='siege';g.load('hipotetico-siege',true);h.key('keydown','ArrowRight');h.key('keydown','ShiftLeft');
        let airborne=false;
        for(let tick=1;tick<ARRIVAL.release;tick++){
            if(tick%48===1)h.key('keydown','Space');if(tick%48===19)h.key('keyup','Space');
            g.update(dt);const p=g.player.getRect();airborne ||= p.y<195;
            const limit=tick<ARRIVAL.firstRelease?ARRIVAL.firstGateX:ARRIVAL.gateX;
            assert.ok(p.x+p.width<=limit+.001,'native jumps cannot bypass either closed grille');
            assert.equal(g.fight.route.active,false);assert.equal(g.fight.shots.length,0);
            assert.ok(g.foes.every(e=>e instanceof HypotheticalGuard&&!e.awake));
            assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
        }
        assert.ok(airborne);h.key('keyup','Space');
        for(let i=0;i<160&&g.fight.arrivalTime<ARRIVAL.release+ARRIVAL.lift;i++)g.update(dt);
        assert.ok(g.player.getRect().x>ARRIVAL.gateX+12);assert.equal(g.fight.route.active,true);assert.ok(g.camera.x>0);
        assert.equal(g.objects.bodies.find(p=>p.id==='arrival-gate')!.height,0);
    }finally{g.dispose();}
});

test('native pause freezes arrival and retry restores the aftermath without repeating the protected wait',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    try{
        g.act='siege';g.load('hipotetico-siege',true);for(let i=0;i<150;i++)g.update(dt);
        h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');assert.equal(g.state,'paused');
        const snapshot=()=>JSON.stringify({fight:g.fight,objects:g.objects.bodies,p:g.player.data});
        const before=snapshot();for(let i=0;i<30;i++){g.update(dt);g.render();}assert.equal(snapshot(),before);
        h.key('keydown','Escape');g.update(dt);h.key('keyup','Escape');
        h.key('keydown','ArrowRight');h.key('keydown','ShiftLeft');
        while(g.fight.arrivalTime<ARRIVAL.release+30)g.update(dt);
        h.key('keyup','ArrowRight');h.key('keyup','ShiftLeft');
        const previous=g.fight.backdrop,tick=previous.tick,people=structuredClone(previous.people),breaches=[...previous.breaches];
        h.key('keydown','r');h.key('keyup','r');
        assert.equal(g.fight.tick,0);assert.equal(g.fight.arrivalSkipped,true);assert.equal(g.fight.backdrop.tick,tick);
        assert.equal(g.objects.bodies.find(p=>p.id==='arrival-gate')!.height,0);
        assert.equal(g.fight.backdrop,previous);assert.deepEqual(g.fight.backdrop.people,people);assert.deepEqual(g.fight.backdrop.breaches,breaches);
        assert.equal(g.player.getRect().x,304);
        assert.equal(g.objects.bodies.find(p=>p.id==='arrival-forecourt')!.height,0);
        g.replay();g.act='siege';g.load('hipotetico-siege',true);
        assert.equal(g.fight.arrivalSkipped,false);assert.equal(g.fight.arrival.height,120);
    }finally{g.dispose();}
});

test('seventeen arrival actors have four usable exits, distinct reactions and matching doorway occlusion for shots',()=>{
    const b=new HypotheticalBackdrop(true),crowd=b.people.filter(p=>p.district===0);
    assert.equal(crowd.length,17);assert.equal(new Set(crowd.map(p=>p.appearance??0)).size,16);
    const exits=crowd.filter(p=>p.exitAtShelter);assert.equal(new Set(exits.map(p=>p.shelter)).size,4);
    let leftRun=false,rightRun=false;
    for(let tick=1;tick<=ARRIVAL.release;tick++){
        b.update(tick);
        for(const p of exits){
            if(p.velocity<-.1){leftRun=true;assert.equal(bystanderPose(p,tick).running,true);}
            if(p.velocity>.1)rightRun=true;
            const bounds=bystanderBounds(p,tick),direction=Math.sign(p.shelter-p.originX),door=p.shelter-direction*8;
            if(direction<0)assert.ok(bounds.left>=door);else assert.ok(bounds.right<=door);
            if(p.escaped)assert.equal(bystanderIntersection(p,tick,{px:p.x-8,py:-10,x:p.x+8,y:-10}),null);
        }
    }
    assert.ok(leftRun&&rightRun);assert.equal(exits.filter(p=>p.escaped).length,10);
    // At the ordinary camera height, the background feet sit above the garrison door lintel.
    assert.ok(backdropBaseline(64)<=224-64-32);
});

test('NPC variations paint distinct pixels and preserve dropped belongings after their owner escapes',()=>{
    const b=new HypotheticalBackdrop(true),actors=b.people.filter(p=>p.exitAtShelter);
    const pictures=new Set<string>();
    const paint=()=>{
        const pixels=new Map<string,string>();
        const c={fillStyle:'',fillRect(x:number,y:number,w:number,h:number){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.set(`${xx},${yy}`,this.fillStyle);}};
        drawBystanders(c as unknown as CanvasRenderingContext2D,b,60,true);return pixels;
    };
    for(const actor of actors){
        const p={...actor,x:40,originX:40,shelter:120,depth:0,exitAtShelter:false,belonging:undefined};
        b.people.splice(0,b.people.length,p);pictures.add(JSON.stringify([...paint()]));
    }
    assert.equal(pictures.size,actors.length);
    const parcel={...actors[0],escaped:true};b.people.splice(0,b.people.length,parcel);b.tick=250;
    const after=paint();assert.ok(after.size>20,'the dropped parcel stays in the street after its owner enters the refuge');
    assert.ok([...after.keys()].every(key=>Number(key.split(',')[1])<60),'debris never sinks through the street');
});

test('the second plaza waits for Feka, resumes through ordinary movement and keeps the action in view',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    try{
        g.act='siege';g.load('hipotetico-siege',true);
        for(let i=0;i<1000;i++)g.update(dt);
        assert.equal(g.fight.arrivalTime,ARRIVAL.hold);assert.equal(g.fight.destroyed,1);
        const before=JSON.stringify(g.fight.backdrop);
        for(let i=0;i<120;i++)g.update(dt);
        assert.equal(JSON.stringify(g.fight.backdrop),before,'waiting cannot repeat shots, reactions or debris');
        assert.ok(g.fight.backdrop.people.filter(p=>p.district===0&&p.originX>=336).every(p=>p.hitAt===null&&p.reactionTimes.length===0));
        h.key('keydown','ArrowRight');h.key('keydown','ShiftLeft');
        let secondContact=false;
        for(let i=0;i<500&&g.fight.arrivalTime<ARRIVAL.release;i++){
            g.update(dt);
            if(g.player.getRect().x>=ARRIVAL.watchX){h.key('keyup','ArrowRight');h.key('keyup','ShiftLeft');}
            if(g.fight.backdrop.events.includes('break')&&Number(g.fight.destroyed)===2){
                secondContact=true;const sx=g.fight.backdrop.x+70*BACKDROP_RIG.scale-g.camera.x;
                assert.ok(sx>0&&sx<320,'the new contact is inside the native viewport');
            }
            const px=g.player.getRect().x-g.camera.x;assert.ok(px>=0&&px<306);
            assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
            assert.ok(g.foes.every(e=>e instanceof HypotheticalGuard&&!e.awake));
        }
        assert.ok(secondContact);assert.equal(g.fight.arrivalTime,ARRIVAL.release);
        assert.equal(g.fight.arrival.ready,true);assert.equal(g.fight.route.active,false);
    }finally{g.dispose();}
});

test('opening mauling clamps, thrashes, rips apart and devours the first petista with persistent gore and stained jaws',()=>{
    const b=new HypotheticalBackdrop(true),thuds:number[]=[];
    assert.ok(arrivalOpeningAt(56).jaw>.85,'jaws open wide during the lunge');
    assert.ok(arrivalOpeningAt(OPENING.clamp).jaw<.5,'jaws snap shut on clamp');
    assert.ok(arrivalOpeningAt(OPENING.rip).jaw>.7,'jaws wrench open during the dismemberment rip');
    assert.ok(arrivalOpeningAt(OPENING.toss).jaw>.75,'jaws open to toss the upper torso');
    assert.ok(arrivalOpeningAt(OPENING.occluded).jaw<.28,'jaws crunch shut to swallow the torso');
    assert.ok(arrivalOpeningAt(89).jaw>arrivalOpeningAt(OPENING.occluded).jaw,'post-swallow chew cycle');
    for(let tick=1;tick<=OPENING.join;tick++){
        b.update(tick);
        if(b.events.includes('distant-thud'))thuds.push(tick);
        assert.equal((distantRiderPose(b).gore??0)>0,tick>=OPENING.clamp);
    }
    assert.deepEqual(thuds,[OPENING.clamp,OPENING.contact]);
    const record=(tick:number,reduced:boolean)=>{
        const pixels=new Map<string,string>();
        const c={fillStyle:'',fillRect(x:number,y:number,w:number,h:number){
            for(let yy=Math.round(y);yy<Math.round(y+h);yy++)for(let xx=Math.round(x);xx<Math.round(x+w);xx++)pixels.set(`${xx},${yy}`,this.fillStyle);
        }};
        drawOpeningAftermath(c as unknown as CanvasRenderingContext2D,tick,116,reduced);
        return pixels;
    };
    const thrash=record(68,false),rip=record(76,false),settled=record(140,false),reducedSettled=record(140,true);
    assert.ok(thrash.size>80,'clamped victim and puncture spray render in the jaws');
    assert.ok(rip.size>thrash.size,'dismemberment geyser, visceral strands and flying limbs expand the silhouette');
    assert.deepEqual(settled,reducedSettled,'settled blood pools, severed limbs, cap and torn star-shirt match in reduced motion');
    assert.ok([...settled.values()].includes('#f0e6d7'),'torn red star-shirt preserves white star pixels on the street');
    assert.ok([...settled.keys()].every(k=>Number(k.split(',')[1])<=116),'gore and severed remains never sink below the street');
});

