import test from 'node:test';
import assert from 'node:assert/strict';
import {ARRIVAL,arrivalGate,arrivalFade,arrivalDeployment} from '../src/adventure/hipotetico/HypotheticalArrival';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {HypotheticalGuard} from '../src/adventure/hipotetico/HypotheticalGuards';
import {HypotheticalBackdrop,backdropBaseline} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {bystanderBounds,bystanderIntersection,bystanderPose} from '../src/adventure/hipotetico/HypotheticalBystanderMotion';
import {drawBystanders} from '../src/adventure/hipotetico/HypotheticalBystanders';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
const dt=1000/60;

test('arrival masks the camera reset, reveals the garrison before release, and raises the physical gate monotonically',()=>{
    assert.equal(arrivalFade('chase',1280,60),1);assert.equal(arrivalFade('siege',0,0),1);
    assert.equal(arrivalFade('siege',16,0),0);assert.equal(arrivalFade('siege',0,0,true),0);
    assert.equal(arrivalDeployment(246),0);assert.equal(arrivalDeployment(270),1);
    let previous:number=ARRIVAL.gateHeight;
    for(let tick=0;tick<=318;tick++){
        const gate=arrivalGate(tick);assert.ok(gate.height<=previous);assert.ok(gate.height>=0);
        if(tick<270){assert.equal(gate.height,120);assert.equal(gate.ready,false);}
        previous=gate.height;
    }
    assert.equal(previous,0);assert.equal(arrivalGate(0,true).height,0);
});

test('Feka can move and jump in the forecourt, but cannot reach hidden enemies or take an opening hit',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    try{
        g.act='siege';g.load('hipotetico-siege',true);h.key('keydown','ArrowRight');h.key('keydown','ShiftLeft');
        let airborne=false;
        for(let tick=1;tick<270;tick++){
            if(tick%48===1)h.key('keydown','Space');if(tick%48===19)h.key('keyup','Space');
            g.update(dt);const p=g.player.getRect();airborne ||= p.y<195;
            assert.ok(p.x+p.width<=96.001,'the native jump cannot bypass the refuge grille');
            assert.equal(g.fight.route.active,false);assert.equal(g.fight.shots.length,0);
            assert.ok(g.foes.every(e=>e instanceof HypotheticalGuard&&!e.awake));
            assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
        }
        assert.ok(airborne);h.key('keyup','Space');
        for(let i=0;i<64;i++)g.update(dt);
        assert.ok(g.player.getRect().x>108);assert.equal(g.fight.route.active,true);
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
        while(g.fight.tick<300)g.update(dt);
        h.key('keydown','r');h.key('keyup','r');
        assert.equal(g.fight.tick,0);assert.equal(g.fight.arrivalSkipped,true);assert.equal(g.fight.backdrop.tick,270);
        assert.equal(g.objects.bodies.find(p=>p.id==='arrival-gate')!.height,0);
        const expected=new HypotheticalBackdrop(true);for(let tick=1;tick<=270;tick++)expected.update(tick);
        assert.deepEqual(g.fight.backdrop.people,expected.people);assert.deepEqual(g.fight.backdrop.breaches,expected.breaches);
        g.replay();g.act='siege';g.load('hipotetico-siege',true);
        assert.equal(g.fight.arrivalSkipped,false);assert.equal(g.fight.arrival.height,120);
    }finally{g.dispose();}
});

test('eight courtyard actors have two usable exits, distinct reactions and matching doorway occlusion for shots',()=>{
    const b=new HypotheticalBackdrop(true),crowd=b.people.filter(p=>p.district===0);
    assert.equal(crowd.length,8);assert.equal(new Set(crowd.map(p=>p.appearance??0)).size,7);
    const exits=crowd.filter(p=>p.exitAtShelter);assert.equal(new Set(exits.map(p=>p.shelter)).size,2);
    let leftRun=false,rightRun=false;
    for(let tick=1;tick<=250;tick++){
        b.update(tick);
        for(const p of exits){
            if(p.velocity<-.1){leftRun=true;assert.equal(bystanderPose(p,tick).running,true);}
            if(p.velocity>.1)rightRun=true;
            const bounds=bystanderBounds(p,tick),direction=Math.sign(p.shelter-p.originX),door=p.shelter-direction*8;
            if(direction<0)assert.ok(bounds.left>=door);else assert.ok(bounds.right<=door);
            if(p.escaped)assert.equal(bystanderIntersection(p,tick,{px:p.x-8,py:-10,x:p.x+8,y:-10}),null);
        }
    }
    assert.ok(leftRun&&rightRun);assert.equal(exits.filter(p=>p.escaped).length,5);
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
    assert.equal(pictures.size,6);
    const parcel={...actors[0],escaped:true};b.people.splice(0,b.people.length,parcel);b.tick=250;
    const after=paint();assert.ok(after.size>20,'the dropped parcel stays in the street after its owner enters the refuge');
    assert.ok([...after.keys()].every(key=>Number(key.split(',')[1])<60),'debris never sinks through the street');
});
