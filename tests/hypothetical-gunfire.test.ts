import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalModel, HYPOTHETICAL } from '../src/adventure/hipotetico/HypotheticalModel';
import { HypotheticalBackdrop } from '../src/adventure/hipotetico/HypotheticalBackdrop';
import { gunTracerStart, gunCasingPosition, gunRecoil } from '../src/adventure/hipotetico/HypotheticalGunfire';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const player={x:100,y:200,width:14,height:24},dt=HYPOTHETICAL.step;
test('concentrated volleys escalate in speed and cadence, preserving lock and recovery timing',()=>{
    for(const [i,health] of [9,6,3].entries()){
        const b=new HypotheticalModel('duel',health);b.state='rest';b.age=31;b.cycle=[0,2,1][i];b.update(dt,player);
        assert.equal(b.attack,'rifle');
        for(let tick=0;tick<b.warningTicks;tick++)b.update(dt,player);
        const fired:number[]=[],speeds:number[]=[];
        for(let frame=0;frame<200&&String(b.state)==='attack';frame++){
            b.update(dt,player);
            if(b.events.includes('shot')){fired.push(b.age);const s=b.shots.at(-1)!;speeds.push(Math.hypot(s.vx,s.vy));}
        }
        assert.equal(fired.length,i===2?9:6);assert.equal(fired[2]-fired[1],6-i);
        assert.ok(fired[3]-fired[2]>=18,'leave a readable breath between concentrated groups');
        assert.ok(speeds.every(s=>Math.abs(s-[5.2,5.8,6.4][i])<1e-8));
        assert.equal(fired.at(-1),[49,43,61][i]);
        assert.equal(b.state,i?'reload':'recover');
    }
});
test('tracers in both directions start at birth and never invent a flight behind the muzzle',()=>{
    for(const vx of [-6.4,6.4])for(const reduced of [false,true])for(let age=0;age<10;age++){
        const origin={x:140,y:80},vy=2,s={x:origin.x+vx*age,y:origin.y+vy*age,vx,vy,age};
        const start=gunTracerStart(s,reduced);
        assert.ok((start.x-origin.x)*Math.sign(vx)>=-1e-8);
        assert.ok(start.y>=origin.y&&start.y<=s.y);
        assert.ok(Math.abs(s.x-start.x)<=Math.abs(vx)*(reduced?1:2.25)+1e-8);
    }
});
test('casings eject, fall, bounce and settle on the ground at both rendering depths',()=>{
    for(const scale of [1,.6875])for(const dir of [-1,1]){
        const x=120,y=224-76*scale;let rises=false,falls=false;
        for(let age=0;age<64;age++){
            const p=gunCasingPosition(x,y,dir,age,224,scale);
            assert.ok(p.y<=223+1e-8);assert.ok((p.x-x)*dir<=1e-8);
            rises ||= p.y<y-5*scale;falls ||= p.y>y+40*scale;
        }
        assert.ok(rises&&falls);assert.equal(gunCasingPosition(x,y,dir,63,224,scale).y,223);
    }
});
test('background masonry hits resolve on the street and retain their last visible segment',()=>{
    const b=new HypotheticalBackdrop(true);let hits=0;
    for(let tick=1;tick<=1200;tick++){
        b.update(tick);
        for(const p of b.impacts.filter(p=>p.born===tick&&p.material==='stone')){
            assert.ok(Math.abs(p.y+1)<1e-8);assert.equal(p.ny,-1);
            assert.ok(p.fromY!<p.y);assert.ok(p.fromX!<=p.x);hits++;
        }
        assert.ok(b.casings.length<=6);assert.ok(b.impacts.length<=18);
    }
    assert.ok(hits>=8);assert.equal(b.casualties,7);
});
test('cancellation clears ignition as well as bullets and recoil returns fully between bursts',()=>{
    const b=new HypotheticalModel('duel');b.state='attack';b.attack='rifle';b.update(dt,player);
    assert.equal(b.muzzle,5);assert.equal(gunRecoil(b.muzzle),4.8);
    b.cancelAttacks();assert.equal(b.muzzle,0);assert.equal(b.shots.length,0);assert.equal(gunRecoil(b.muzzle),0);
    const recoil=[5,4,3,2,1,0].map(gunRecoil);assert.ok(recoil.every((v,i)=>!i||v<recoil[i-1]));
});

for(const evade of [false,true])test(`native final-phase volley ${evade?'allows a committed run to cover':'punishes standing in the locked line'}`,t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    // Start a focused encounter on its authored floor; subsequent motion uses ordinary keyboard input.
    g.act='duel';g.load('hipotetico-duel',true);
    g.player.data.position={x:130,y:200};g.player.data.isGrounded=true;
    g.fight.health=3;g.fight.state='rest';g.fight.age=31;g.fight.cycle=1;
    g.update(dt);assert.equal(g.fight.attack,'rifle');
    for(let tick=0;tick<20;tick++)g.update(dt);
    const aim=[g.fight.targetX,g.fight.targetY];
    if(evade){h.key('keydown','ArrowLeft');h.key('keydown','Shift');}
    let fired=0;
    for(let tick=0;tick<100;tick++){
        g.update(dt);if(g.fight.events.includes('shot'))fired++;
        if(tick<23)assert.deepEqual([g.fight.targetX,g.fight.targetY],aim);
    }
    assert.ok(fired>=9);assert.equal(g.player.data.hasHelmet,evade);
    if(evade)assert.equal(g.player.data.isDead,false);
    g.dispose();
});
