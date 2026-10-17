import assert from 'node:assert/strict';
import test from 'node:test';
import {SkeletonBullModel,BULL_RULES as R,bullBoneY} from '../src/adventure/experimental/guaira/SkeletonBullModel';
import {GuairaBullEncounter} from '../src/adventure/experimental/guaira/GuairaBullLab';
import {drawSkeletonBull} from '../src/adventure/experimental/guaira/SkeletonBullArt';
import {drawBullWarning,bullChargeWarningRange} from '../src/adventure/experimental/guaira/GuairaLabArt';
import {guairaBrowser} from './helpers/guairaLabHarness';
import primary from './helpers/guairaLabReplay.json';
import pound from './helpers/guairaBullPoundReplay.json';

const player=(x:number)=>({x,y:200,width:14,height:24});
function ready(health:number,facing:-1|1,cycle=0){
    const b=new SkeletonBullModel();b.health=health;b.x=facing<0?256:16;b.cycle=cycle;b.state='idle';b.stateTick=23;
    b.update(R.tickMs,player(facing<0?10:290));return b;
}
function tick(b:SkeletonBullModel,n:number){for(let i=0;i<n;i++)b.update(R.tickMs,player(b.facing<0?290:10));}
function paint(b:SkeletonBullModel,reduced=false,warning=false){
    const calls:unknown[][]=[];let color='',depth=0;
    const c={get fillStyle(){return color;},set fillStyle(v:string){color=v;},save(){depth++;},restore(){depth--;},translate(){},scale(){},
        fillRect(x:number,y:number,w:number,h:number){assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);calls.push([color,x,y,w,h]);}};
    const before=JSON.stringify(b);if(warning)drawBullWarning(c as unknown as CanvasRenderingContext2D,b);else drawSkeletonBull(c as unknown as CanvasRenderingContext2D,b,reduced);
    assert.equal(JSON.stringify(b),before);assert.equal(depth,0);return calls;
}

for(const facing of [-1,1] as const)test(`final phase announces both passes and locks a complete return tell, facing ${facing}`,()=>{
    const b=ready(2,facing);assert.equal(b.phaseNumber,3);assert.equal(b.chargeCount,2);assert.equal(b.chargeLeg,1);
    for(let i=0;i<R.tell;i++){assert.equal(b.state,'tell');assert.equal(b.facing,facing);assert.equal(b.vulnerable,false);tick(b,1);}
    for(let i=0;i<60&&b.state==='charge';i++)tick(b,1);
    assert.equal(b.state,'turn');assert.equal(b.stateTick,0);assert.equal(b.chargeLeg,2);assert.equal(b.facing,-facing);
    const x=b.x,range=bullChargeWarningRange(b),reduced=paint(b,true),poses=new Set<string>();
    for(let i=0;i<R.turn;i++){
        assert.equal(b.state,'turn');assert.equal(b.x,x);assert.equal(b.facing,-facing);
        assert.equal(b.vulnerable,false);assert.equal(b.openingTicksRemaining,0);
        const top={x:b.x+12,y:b.y-2,width:14,height:24};
        assert.equal(b.contact(top,{...top,y:b.y-30},true),'bounce','closed ribs cannot falsely award a first-pass hit');
        assert.equal(b.health,2);assert.ok(paint(b,false,true).length>0);assert.deepEqual(paint(b,true),reduced);
        poses.add(JSON.stringify(paint(b)));tick(b,1);
    }
    assert.equal(poses.size,6);assert.equal(b.state,'charge');
    for(let i=0;i<60&&!b.vulnerable;i++){
        assert.ok(b.x>=range.left&&b.x+b.width<=range.right);tick(b,1);
    }
    assert.equal(b.state,'brake');assert.equal(b.openingTicksRemaining,R.brake+R.recover);
    const top={x:b.x+12,y:b.y-2,width:14,height:24};assert.equal(b.contact(top,{...top,y:b.y-30},true),'hit');
    assert.equal(b.health,1);assert.deepEqual(b.hazards,[]);assert.equal(b.contact(top,{...top,y:b.y-30},true),'none');
});

for(const facing of [-1,1] as const)for(const health of [6,4,2])test(`health ${health}: bone trajectory, warning and recovery agree, facing ${facing}`,()=>{
    const b=ready(health,facing,2),hopping=health<=4;
    assert.equal(b.state,'rattle');assert.equal(b.bouncingBones,hopping);
    const warning=paint(b,false,true);assert.ok(warning.length>0);
    for(let i=0;i<R.rattle;i++){
        assert.equal(b.state,'rattle');assert.equal(b.stateTick,i);assert.equal(b.facing,facing);
        assert.deepEqual(b.hazards,[]);assert.equal(b.vulnerable,false);tick(b,1);
    }
    const duration=b.boneFlightDuration,levels=new Set<number>();
    for(let age=0;age<duration;age++){
        assert.equal(b.state,'bones');assert.equal(b.vulnerable,false);assert.ok(b.bones.length<=2);
        for(const bone of b.bones){
            assert.equal(bone.y,bullBoneY(b.arena.floor,bone.age,hopping,bone.hopHeight,bone.hopTicks));levels.add(bone.y);
            assert.ok(bone.y>=b.arena.floor-9-bone.hopHeight&&bone.y+bone.height<b.arena.floor);
            assert.equal(bone.vx,facing*(health>4?3:health>2?3.2:3.4));
        }
        const previous=b.bones.map(bone=>({...bone}));tick(b,1);
        if(b.state==='bones')for(const old of previous){
            assert.ok(b.hazards.some(q=>q.x<=old.x+1e-8&&q.x+q.width>=old.x+old.width-1e-8&&q.y<=old.y&&q.y+q.height>=old.y+old.height),'2D swept contact retains the previous pose');
        }
    }
    assert.equal(levels.size>1,hopping);assert.equal(b.state,'recover');assert.equal(b.openingTicksRemaining,R.recover);
    assert.deepEqual(b.hazards,[]);assert.deepEqual(b.visibleBones,[]);
    if(hopping)assert.equal(Math.min(...levels),b.arena.floor-9-(health>2?64:80));
});

test('catch-up cannot swallow the return tell or change the fixed bone arc',()=>{
    const b=ready(2,-1);while(b.state!=='turn')tick(b,1);
    b.update(10000,player(0));assert.equal(b.state,'turn');assert.equal(b.stateTick,6);
    for(const bad of [NaN,Infinity,-1,0]){const before:{tick:number;state:string;x:number}={tick:b.tick,state:b.state,x:b.x};b.update(bad,player(0));assert.deepEqual({tick:b.tick,state:b.state,x:b.x},before);}
    const a=ready(4,-1,2),c=ready(4,-1,2);tick(a,R.rattle);tick(c,R.rattle);a.update(100,player(290));tick(c,6);
    assert.deepEqual(a.bones,c.bones);assert.equal(a.state,c.state);assert.equal(a.stateTick,c.stateTick);
});

test('collapse has six bounded poses, settles exactly once and respects reduced motion',()=>{
    const b=new SkeletonBullModel();b.state='recover';b.health=1;
    const top={x:b.x+12,y:b.y-2,width:14,height:24};assert.equal(b.contact(top,{...top,y:b.y-30},true),'defeated');
    const reduced=paint(b,true),poses=new Set<string>();
    for(let i=0;i<=R.collapse;i++){
        const a=paint(b);poses.add(JSON.stringify(a));assert.deepEqual(paint(b),a);assert.deepEqual(paint(b,true),reduced);
        assert.equal(b.vulnerable,false);assert.deepEqual(b.hazards,[]);
        assert.ok(a.every(([, ,y,,h])=>Number(y)+Number(h)<=35),'bones settle on the original floor');tick(b,1);
    }
    assert.equal(poses.size,6);const settled=paint(b);tick(b,120);assert.deepEqual(paint(b),settled);assert.deepEqual(paint(b,true),reduced);
});

function controls(h:ReturnType<typeof guairaBrowser>,touch:boolean){
    let held=new Set<string>();return (keys:string[])=>{
        if(touch){const x:Record<string,number>={ArrowLeft:.07,ArrowRight:.22,ArrowDown:.5,ShiftLeft:.76,Space:.93};
            h.canvas.dispatch('touchstart',{touches:keys.map((code,i)=>({identifier:i+1,target:h.canvas,clientX:x[code]*640,clientY:330}))});return;}
        const next=new Set(keys);for(const code of held)if(!next.has(code))h.window.dispatch('keyup',{code,key:code==='Space'?' ':code,target:h.canvas});
        for(const code of next)if(!held.has(code))h.window.dispatch('keydown',{code,key:code==='Space'?' ':code,target:h.canvas});held=next;
    };
}
for(const touch of [false,true])for(const reducedMotion of [false,true])test(`native ground-pound route wins all phases: touch=${touch}, reduced=${reducedMotion}`,t=>{
    const h=guairaBrowser(t,{touch,reducedMotion}),g=h.create(),keys=controls(h,touch);
    let frame=0,health=6;const hits:number[]=[],states=new Set<string>();
    for(const [count,codes]of pound.runs as Array<[number,string[]]>){keys(codes);for(let i=0;i<count;i++){
        g.update(R.tickMs);frame++;const b=(g.boss as GuairaBullEncounter).model;states.add(b.state);
        assert.equal(g.player.data.hasHelmet,true,`helmet at ${frame}`);assert.equal(g.player.data.isDead,false);
        if(b.health<health)hits.push(frame);health=b.health;
        if(b.state==='turn'&&b.stateTick===10){
            keys([]); // Native pause clears held inputs; resume with a fresh press.
            g.toggleLabPause();const snap=JSON.stringify({b,p:g.player.data,c:g.camera});
            for(let n=0;n<12;n++){g.update(100);g.render();}assert.equal(JSON.stringify({b,p:g.player.data,c:g.camera}),snap);g.toggleLabPause();keys(codes);
        }
    }}
    assert.equal(frame,pound.frames);assert.deepEqual(hits,pound.expectedHits.map(h=>h.frame+1));
    assert.ok(states.has('turn')&&states.has('bones'));assert.equal(g.boss?.phase,'defeated');assert.deepEqual(g.store.save.completed,[]);
    g.load('guaira-lab');assert.equal(g.boss?.health,6);assert.equal((g.boss as GuairaBullEncounter).model.chargeCount,1);assert.equal((g.boss as GuairaBullEncounter).model.bouncingBones,false);
});

for(const offset of [-3,0,3])test(`native return can be crossed and punished with jump onset shifted ${offset} ticks`,t=>{
    const h=guairaBrowser(t),g=h.create(),keys=controls(h,false);let frame=0;
    const target=primary.markers.returnTell+9;
    for(const [count,codes]of primary.runs as Array<[number,string[]]>){keys(codes);for(let i=0;i<count&&frame<target;i++){g.update(R.tickMs);frame++;}if(frame===target)break;}
    const runs:Array<[number,string[]]>=[[50+offset,['ShiftLeft','ArrowLeft']],[9,['ShiftLeft','ArrowLeft','Space']],[8,['ShiftLeft','ArrowLeft']],[70,[]]];
    for(const [count,codes]of runs){keys(codes);for(let i=0;i<count;i++){
        g.update(R.tickMs);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
        if(g.boss!.health===1)return;
    }}assert.fail('return charge did not leave a reachable opening');
});
