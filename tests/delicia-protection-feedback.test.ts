import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DeliciaArt } from '../src/adventure/delicia/DeliciaArt';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';
import { PLAYER_PALETTE } from '../src/assets/playerSpriteSpec';
import { drawPlayerProtection } from '../src/graphics/playerProtectionArt';
import { ART } from '../src/graphics/palette';

function fixture(t:TestContext){
    const stage=structuredClone(DELICIA_STAGES[0]);stage.enemies=[];stage.hazards=[];stage.machines=[];
    const sim=new DeliciaSimulation(stage),art=new DeliciaArt();
    type Mark=[number,number,number,number,unknown];
    const marks:Mark[]=[],players:unknown[][]=[];let playerEnd=0;
    const state:Record<string,unknown>={};
    const context=new Proxy(state,{get(target,key:string){
        if(key in target)return target[key];
        if(key==='fillRect')return(x:number,y:number,w:number,h:number)=>marks.push([x,y,w,h,target.fillStyle]);
        return()=>{};
    }}) as unknown as CanvasRenderingContext2D;
    t.mock.method(art.atlas,'draw',(...args:unknown[])=>{if(args[2]===PLAYER_PALETTE){players.push(args);playerEnd=marks.length;}});
    const draw=(reduced:boolean)=>{marks.length=0;players.length=0;sim.particles=[];const before=structuredClone(sim);art.draw(context,sim,reduced);assert.deepEqual(structuredClone(sim),before);return{players:players.length,tint:players[0]?.[7],cue:marks.slice(playerEnd)};};
    const expected=()=>{marks.length=0;drawPlayerProtection(context,Math.round(sim.player.x/3)-Math.round(sim.cameraX/3)+7,Math.round(sim.player.y/3)-Math.round(sim.cameraY/3)+11);return [...marks];};
    return{sim,draw,expected};
}
test('reduced damage protection is exactly the shared World marker and never obscures Feka',t=>{
    const h=fixture(t);assert.deepEqual(h.draw(true),{players:1,tint:undefined,cue:[]});h.sim.hurt(h.sim.player.x+50);
    const expected=h.expected();assert.equal(expected.length,12);
    for(const time of [0,.08,.16,.24,.32,1.4]){h.sim.time=time;assert.deepEqual(h.draw(true),{players:1,tint:undefined,cue:expected});}
});
test('ordinary damage uses the World tint while reduced motion keeps the sprite colors steady',t=>{
    const h=fixture(t);h.sim.player.invincible=.1;assert.equal(h.draw(false).tint,ART.paper);assert.equal(h.draw(true).tint,undefined);
    h.sim.player.invincible=.2;assert.equal(h.draw(false).tint,undefined);assert.equal(h.draw(false).players,1);
});
test('the parry window remains distinct from the damage marker',t=>{
    const h=fixture(t);h.sim.player.parryTime=.2;const parry=h.draw(true).cue;assert.equal(parry.length,3);
    h.sim.player.invincible=1;assert.deepEqual(h.draw(true).cue,[...h.expected(),...parry]);
});
for(const protection of ['damage','fall'] as const)test(`${protection} protection ends with its simulation timer`,t=>{
    const h=fixture(t);if(protection==='damage')h.sim.hurt(h.sim.player.x+50);else{h.sim.player.y=h.sim.stage.height;h.sim.update(1/60,noDeliciaInput());}
    assert.ok(h.sim.player.invincible>0);assert.equal(h.draw(true).cue.length,12);
    const hp=h.sim.player.health;h.sim.hurt(h.sim.player.x+50);assert.equal(h.sim.player.health,hp);
    for(let i=0;i<150&&h.sim.player.invincible>0;i++)h.sim.update(1/60,noDeliciaInput());
    assert.equal(h.sim.player.invincible,0);assert.equal(h.draw(true).cue.length,0);
});
test('held running has no hidden dash or invulnerability cue',t=>{
    const h=fixture(t);h.sim.update(1/60,{...noDeliciaInput(),run:true,right:true});assert.equal(h.sim.player.invincible,0);assert.equal(h.sim.player.dashTime,0);assert.equal(h.draw(true).cue.length,0);
});
