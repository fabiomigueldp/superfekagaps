import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/entities/Player';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { TileType, COYOTE_TIME, JUMP_BUFFER_TIME } from '../src/constants';
import { GroundPoundState, type InputState } from '../src/types';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';
import { DELICIA_UNIT as U } from '../src/adventure/delicia/DeliciaNative';
import { DeliciaCollision } from '../src/adventure/delicia/DeliciaCollision';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const idle:InputState={left:false,right:false,jump:false,run:false,down:false,downPressed:false,jumpPressed:false,jumpReleased:false,start:false,pause:false,mute:false};

test('World and Delícia replay identical walk, run, brake, reversal, short/full jump and pound trajectories',()=>{
    const world=new WorldLevel({id:'native-parity',name:'Parity',width:125,height:60,
        tiles:Array.from({length:60},(_,row)=>Array<number>(125).fill(row>=20?TileType.GROUND:TileType.EMPTY)),
        playerSpawn:{x:5,y:20},enemies:[],collectibles:[],triggers:[],checkpoints:[],goalPosition:{x:120,y:20},timeLimit:180,isBossLevel:false});
    const stage={...structuredClone(DELICIA_STAGES[0]),width:6000,height:3000,spawn:{x:240,y:888},
        floors:[{x:0,y:960,w:6000,h:2040,material:'stone' as const}],enemies:[],pickups:[],hazards:[],machines:[],valves:[],checkpoints:[],echoes:[],zones:[],gate:{x:5800,y:870,w:60,h:90}};
    const sim=new DeliciaSimulation(stage),player=new Player(5,20);
    let jumps=0,impacts=0;
    for(let frame=0;frame<280;frame++){
        const jumpPressed=[20,65,145,205].includes(frame),jump=frame>=20&&frame<21||frame>=65&&frame<105||frame>=145&&frame<190||frame>=205&&frame<245;
        const jumpReleased=[21,105,190,245].includes(frame),downPressed=frame===160;
        const input={...idle,right:frame<120||frame>=200,left:frame>=135&&frame<180,run:frame>=60&&frame<200,jump,jumpPressed,jumpReleased,down:downPressed,downPressed};
        const result=player.update(1000/60,input,world);
        sim.update(1/60,{...noDeliciaInput(),left:input.left,right:input.right,run:input.run,jump,jumpPressed,jumpReleased,pound:downPressed});
        near(sim.player.x/U,player.data.position.x);near(sim.player.y/U,player.data.position.y);
        near(sim.player.vx/(U*60),player.data.velocity.x);near(sim.player.vy/(U*60),player.data.velocity.y);
        assert.equal(sim.player.grounded,player.data.isGrounded,`ground contact at frame ${frame}`);assert.equal(sim.nativePlayer.data.groundPoundState,player.data.groundPoundState);
        assert.equal(sim.player.pounding,player.data.groundPoundState===GroundPoundState.FALL);
        assert.equal(sim.events.some(e=>e.kind==='jump'),!!result.jumpStarted);
        if(result.jumpStarted)jumps++;if(result.groundPoundImpact)impacts++;
        assert.ok(sim.player.coyote*1000<=COYOTE_TIME+.001);assert.ok(sim.player.buffer*1000<=JUMP_BUFFER_TIME+.001);
    }
    assert.equal(jumps,4);assert.equal(impacts,1);assert.equal(sim.damageTaken,0);
});

test('chapter collision catches solid sides and ceilings, preserves one-way undersides, and lands on the nearest floor',()=>{
    const world=new DeliciaCollision(320,[{index:0,x:100,y:80,width:50,height:50,previousY:80,solid:true,spring:false},
        {index:1,x:100,y:50,width:50,height:4,previousY:50,solid:false,spring:false}]);
    const wall={x:80,y:85,width:14,height:24};const side=world.resolveCollision(wall,{x:20,y:0});near(side.position.x,86);near(side.velocity.x,0);
    const below={x:110,y:133,width:14,height:24};const ceiling=world.resolveCollision(below,{x:0,y:-8});near(ceiling.position.y,130);near(ceiling.velocity.y,0);
    const ledge={x:110,y:56,width:14,height:24};near(world.resolveCollision(ledge,{x:0,y:-8}).position.y,48);
    const fall={x:110,y:20,width:14,height:24};const landing=world.resolveCollision(fall,{x:0,y:50});near(landing.position.y,26);assert.equal(landing.grounded,true);assert.equal(world.support,1);
});

test('a chapter stomp shares World rebound and its brief contact protection',()=>{
    const stage=structuredClone(DELICIA_STAGES[0]);stage.enemies=[{kind:'pulp',x:200,y:406,patrol:0}];stage.hazards=[];stage.machines=[];
    const sim=new DeliciaSimulation(stage),e=sim.enemies[0],reference=new Player(0,0);
    sim.player.x=e.x;sim.player.y=e.y-sim.player.h-2;sim.player.vy=500;
    sim.update(1/60,noDeliciaInput());reference.bounceFromSurface(e.y/U);
    assert.equal(e.state,'dead');near(sim.player.y/U,reference.data.position.y);near(sim.player.vy/(U*60),reference.data.velocity.y);
    near(sim.player.invincible*1000,reference.data.invincibleTimer);assert.equal(sim.player.grounded,false);assert.equal(sim.player.health,4);
});

test('damage cancels native pound windup and a checkpoint fall clears stale movement state',()=>{
    const stage=structuredClone(DELICIA_STAGES[0]);stage.enemies=[];stage.hazards=[];stage.machines=[];
    const sim=new DeliciaSimulation(stage);sim.player.y=150;
    sim.update(1/60,{...noDeliciaInput(),pound:true});assert.equal(sim.nativePlayer.data.groundPoundState,GroundPoundState.WINDUP);
    sim.hurt(sim.player.x+50);sim.update(1/60,noDeliciaInput());
    assert.equal(sim.nativePlayer.data.groundPoundState,GroundPoundState.NONE);assert.ok(sim.player.vy<0);
    sim.nativePlayer.data.groundPoundState=GroundPoundState.RECOVERY;sim.nativePlayer.data.groundPoundTimer=100;
    sim.player.y=stage.height;sim.player.coyote=.1;sim.player.buffer=.1;sim.update(1/60,noDeliciaInput());
    assert.equal(sim.nativePlayer.data.groundPoundState,GroundPoundState.NONE);assert.equal(sim.nativePlayer.data.isJumping,false);
    assert.equal(sim.player.coyote,0);assert.equal(sim.player.buffer,0);near(sim.player.y,stage.spawn.y);
    sim.update(1/60,{...noDeliciaInput(),right:true});assert.ok(sim.player.x>stage.spawn.x);
});
