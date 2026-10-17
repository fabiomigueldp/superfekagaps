import assert from 'node:assert/strict';
import test from 'node:test';
import {WorldFoe} from '../src/adventure/WorldEnemies';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {STAGES} from '../src/adventure/campaign';
import {TileType as T} from '../src/constants';
import type {FoeKind} from '../src/adventure/types';
import {drawGuairaFoe} from '../src/adventure/experimental/guaira/GuairaFoeArt';

const dt=1000/60;
function arena(kind:FoeKind,x=300){
    const data=structuredClone(STAGES[0].level);data.width=64;data.height=18;data.originX=data.originY=0;
    data.tiles=Array.from({length:18},(_,row)=>Array.from({length:64},()=>row>=12?T.GROUND:T.EMPTY));
    const level=new WorldLevel(data),objects=new WorldObjects([]),foe=new WorldFoe({id:'canal',kind,x,y:192,range:48,behavior:'canal'});
    return {level,objects,foe,step:(player={x:220,y:168,width:14,height:24})=>foe.update(dt,level,objects,player)};
}

for(const direction of [-1,1])test(`canal pincer announces a grounded approach, commits direction and has a finite forward danger: ${direction}`,()=>{
    const a=arena('minion'),e=a.foe;e.facing=direction;e.vx=direction*.55;
    const p={x:e.x+direction*40,y:168,width:14,height:24};a.step(p);
    assert.equal(e.phase,'warning');const origin=e.x;
    for(let n=0;n<26;n++)a.step({...p,x:e.x-direction*80});
    assert.equal(e.phase,'warning');assert.equal(e.x,origin);assert.equal(e.facing,direction);assert.equal(!!e.danger,false);
    const phases=new Set<string>();let dangers=0,travel=0;
    for(let n=0;n<100;n++){
        const x=e.x;a.step({...p,x:800});phases.add(e.phase);travel+=Math.abs(e.x-x);
        if(e.danger){dangers++;assert.equal(e.danger.height,8);assert.equal(e.contact(e.danger,e.danger,false,false),'hurt');}
    }
    assert.ok(phases.has('attack')&&phases.has('rest')&&phases.has('walk'));assert.ok(dangers>=7&&dangers<=10);assert.ok(travel>15);
});

test('a canal pincer cannot stop the patrol under a descending gap jump or acquire through a wall',()=>{
    const a=arena('minion'),e=a.foe;
    for(let n=0;n<20;n++)a.step({x:e.x-30,y:164,width:14,height:24});
    assert.equal(e.phase,'walk');assert.ok(e.distance>10);
    for(let row=8;row<12;row++)a.level.data.tiles[row][Math.floor((e.x-16)/16)]=T.GROUND;
    a.step({x:e.x-40,y:168,width:14,height:24});assert.equal(e.phase,'walk');
});

test('the pincer stays on its bank and remains vulnerable to a falling top contact',()=>{
    const a=arena('minion',320),e=a.foe;
    for(let row=12;row<18;row++)for(let col=0;col<20;col++)a.level.data.tiles[row][col]=T.EMPTY;
    a.step({x:285,y:168,width:14,height:24});for(let n=0;n<35;n++)a.step({x:285,y:168,width:14,height:24});
    assert.equal(e.phase,'attack');assert.ok(e.x>=320);assert.equal(e.y+e.height,192);
    const p={x:e.x+3,y:e.y-20,width:14,height:24};
    assert.equal(e.contact(p,{...p,y:e.y-25},true,false),'kill');assert.equal(e.contact(p,p,false,false),'none');
});

test('broken armour changes the silhouette and pace, while two stomps and a ground pound remain valid',()=>{
    const a=arena('helmet'),e=a.foe,p={x:e.x+2,y:e.y-20,width:14,height:24};
    assert.equal(e.contact(p,{...p,y:e.y-25},true,false),'bounce');assert.equal(e.armor,false);assert.equal(e.phase,'stunned');
    const x=e.x;for(let n=0;n<40;n++)a.step();assert.equal(e.x,x);
    for(let n=0;n<5;n++)a.step();assert.equal(e.phase,'walk');assert.equal(Math.abs(e.vx),.9);
    const second={...p,x:e.x+2};assert.equal(e.contact(second,{...second,y:e.y-25},true,false),'kill');
    const intact=arena('helmet').foe;assert.equal(intact.contact(p,{...p,y:intact.y-25},true,true),'kill');
});

for(const direction of [-1,1])test(`canal charge actually runs, ramps and recovers after its full warning: ${direction}`,()=>{
    const a=arena('charger'),e=a.foe,p={x:e.x+direction*100,y:168,width:14,height:24};a.step(p);
    const x=e.x;for(let n=0;n<47;n++)a.step(p);assert.equal(e.phase,'warning');assert.equal(e.x,x);
    while(e.phase==='warning')a.step(p);
    assert.equal(e.phase,'attack','a zero-speed launch must not be mistaken for a wall collision');
    const speeds:number[]=[];while(e.phase==='attack'){a.step({...p,x:e.x-direction*100});if(e.phase==='attack')speeds.push(Math.abs(e.motionX));}
    assert.equal(e.phase,'rest');assert.equal(e.facing,direction);assert.ok(speeds.length>=40);
    assert.ok(speeds[0]<.5&&speeds.at(-1)!<.5);assert.ok(Math.max(...speeds)>3.7&&Math.max(...speeds)<=3.8+1e-7);
    assert.ok(Math.abs(e.x-x)>130&&Math.abs(e.x-x)<138);
    const target={x:e.x+4,y:e.y-20,width:14,height:24};assert.equal(e.contact(target,{...target,y:e.y-25},true,false),'kill');
});

test('throwers alternate a readable high throw with the original low one and never track after warning',()=>{
    const a=arena('loader'),e=a.foe;
    const warnings:boolean[]=[],throws:Array<{vx:number;vy:number;x:number;y:number}>=[];let phase=e.phase;
    for(let n=0;n<650;n++){
        const locked=e.phase==='warning';a.step({x:locked?380:220,y:168,width:14,height:24});
        if(e.phase==='warning'&&phase!=='warning')warnings.push(e.highThrow);
        if(e.phase==='recoil'&&phase!=='recoil')throws.push({...a.objects.barrels.at(-1)!});phase=e.phase;
        if(throws.length===3)break;
    }
    assert.deepEqual(warnings,[false,true,false]);assert.deepEqual(throws.map(b=>b.vy),[-2.5,-4.8,-2.5]);
    assert.deepEqual(throws.map(b=>b.vx),[-1.8,-2.1,-1.8]);assert.ok(throws.every(b=>b.x===e.x-14&&b.y===e.y-4));
    const apices=throws.slice(0,2).map(b=>{
        const objects=new WorldObjects([]),barrel=objects.spawnBarrel(b.x,b.y,-1);Object.assign(barrel,b);let top=b.y;
        for(let n=0;n<35;n++){objects.update(dt,a.level,220);top=Math.min(top,barrel.y);}return top;
    });
    assert.ok(apices[0]-apices[1]>20,'the second throw has a physically different apex');
});

test('canal throwers cannot acquire targets through masonry or from the unguarded approach',()=>{
    const a=arena('loader');for(let row=8;row<12;row++)a.level.data.tiles[row][16]=T.GROUND;
    for(let n=0;n<240;n++)a.step();assert.equal(a.objects.barrels.length,0);assert.equal(a.foe.phase,'rest');
    const e=new WorldFoe({id:'guard',kind:'loader',x:300,y:192,guardFacing:-1,behavior:'canal'});
    for(let n=0;n<240;n++)e.update(dt,a.level,a.objects,{x:350,y:168,width:14,height:24});
    assert.equal(a.objects.barrels.length,0);
});

test('sweeping claws extend and retract inside their announced maximum envelope',()=>{
    const a=arena('agitator'),e=a.foe;while(e.phase!=='attack')a.step();
    const widths:number[]=[];
    while(e.phase==='attack'){const box=e.danger!;widths.push(box.width);assert.ok(box.x>=e.x-12&&box.x+box.width<=e.x+e.width+12);a.step();}
    assert.ok(widths[0]<Math.max(...widths)&&widths.at(-1)!<Math.max(...widths));assert.equal(Math.max(...widths),e.width+24);
    assert.equal(e.danger,null);const p={x:e.x+2,y:e.y-20,width:14,height:24};assert.equal(e.contact(p,{...p,y:e.y-25},true,false),'kill');
});

test('the trolley rolls between exact endpoints with acceleration, braking and a stationary reversal warning',()=>{
    const a=arena('rail'),e=a.foe;
    for(let leg=0;leg<3;leg++){
        const speeds:number[]=[];while(e.phase==='walk'){a.step();speeds.push(Math.abs(e.motionX));}
        assert.equal(e.phase,'warning');assert.equal(Math.abs(e.x-e.homeX),48);assert.ok(Math.max(...speeds)>1.3&&Math.max(...speeds)<1.36);
        assert.ok(speeds[0]<.15&&speeds.at(-1)!<.15);const x=e.x;
        for(let n=0;n<32;n++){a.step();assert.equal(e.x,x);assert.equal(e.phase,'warning');}
        while(e.phase==='warning')a.step();
    }
});

function paint(e:WorldFoe,reduced=false){
    const calls:unknown[]=[];let depth=0;
    const c={fillStyle:'',globalAlpha:1,save(){depth++;},restore(){depth--;},translate(x:number,y:number){calls.push(['translate',x,y]);},scale(x:number,y:number){calls.push(['scale',x,y]);},
        fillRect(x:number,y:number,w:number,h:number){assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);calls.push([this.fillStyle,x,y,w,h]);}};
    const before=JSON.stringify(e);drawGuairaFoe(c as unknown as CanvasRenderingContext2D,e,e.x-80,e.y-60,reduced);
    assert.equal(JSON.stringify(e),before);assert.equal(depth,0);return JSON.stringify(calls);
}

for(const kind of ['minion','helmet','charger','loader','agitator','rail'] as const)
test(`${kind}: native action frames draw on the pixel grid without changing simulation, including reduced motion`,()=>{
    const a=arena(kind),e=a.foe,frames=new Set<string>();
    for(let n=0;n<340;n++){a.step({x:e.x-40,y:168,width:14,height:24});if(n%5===0){frames.add(paint(e));paint(e,true);}}
    assert.ok(frames.size>=5,'articulated states have distinct silhouettes');
    const paused=paint(e);assert.equal(paint(e),paused);
    const stable=paint(e,true);e.age+=100;assert.equal(paint(e,true),stable,'reduced motion does not depend on idle decoration');
    for(const dt of [0,-1,NaN,Infinity]){const state=JSON.stringify(e);e.update(dt,a.level,a.objects,{x:0,y:0,width:14,height:24});assert.equal(JSON.stringify(e),state);}
    e.dead=true;e.deadTimer=360;assert.equal(paint(e),'[]');
});

test('idle feet do not march while a loader is standing still',()=>{
    const a=arena('loader');a.step({x:800,y:168,width:14,height:24});const before=paint(a.foe);
    for(let n=0;n<12;n++)a.step({x:800,y:168,width:14,height:24});assert.equal(paint(a.foe),before);
});
