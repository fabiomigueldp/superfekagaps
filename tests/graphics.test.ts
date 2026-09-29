import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { BackgroundGenerator } from '../src/engine/BackgroundGenerator';
import { Renderer } from '../src/engine/Renderer';
import { playerDeathMotion } from '../src/graphics/playerDeathMotion';
import { PLAYER_SPRITES, PLAYER_PALETTE } from '../src/assets/playerSpriteSpec';
import { SpriteAtlas, VisualClock, animationIndex } from '../src/graphics/pixels';
import { terrainMask, lavaOffset } from '../src/graphics/TilePainter';
import { pixelText, textWidth, wrapText } from '../src/graphics/BitmapFont';
import { SPRITE_PALETTE, MINION_FRAMES, MINION_SQUASH, BOSS_FRAMES, YASMIN_FRAMES, COIN_FRAMES, FANTA_SPRITE, PROJECTILE_FRAMES } from '../src/graphics/sprites';
import { TileType } from '../src/constants';
import { normalizeLevelData } from '../src/world/levelValidation';
import { getLevelByIndex } from '../src/data/levels';

class RecordingContext {
  fillStyle = '';
  imageSmoothingEnabled = false;
  globalAlpha = 1;
  rectangles: {x:number;y:number;w:number;h:number;color:string}[] = [];
  images: unknown[][] = [];
  fillRect(x:number,y:number,w:number,h:number) { this.rectangles.push({x,y,w,h,color:this.fillStyle}); }
  drawImage(...args:unknown[]) { this.images.push(args); }
  save() {}
  restore() {}
}
function canvasHarness(t:TestContext) {
  const created:{width:number;height:number;ctx:RecordingContext}[]=[];
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.assign(globalThis,{document:{createElement:()=>{
    const canvas={width:0,height:0,ctx:new RecordingContext(),getContext(){return this.ctx;}};
    created.push(canvas);return canvas;
  }}});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');});
  return created;
}

test('authored actors and items have stable frame bounds and complete palettes',()=>{
  const groups:[readonly (readonly string[])[],number,number][]=[
    [[...MINION_FRAMES,MINION_SQUASH],18,20],
    [[BOSS_FRAMES.idle,...BOSS_FRAMES.walk,BOSS_FRAMES.windup,BOSS_FRAMES.smash,BOSS_FRAMES.hurt,BOSS_FRAMES.shoot,BOSS_FRAMES.dead],40,48],
    [YASMIN_FRAMES,20,30],[COIN_FRAMES,16,16],[[FANTA_SPRITE],16,16],[PROJECTILE_FRAMES,10,10]
  ];
  for(const [frames,w,h] of groups)for(const frame of frames){
    assert.equal(frame.length,h);assert.ok(frame.some(row=>/[^_]/.test(row)));
    for(const row of frame){assert.equal(row.length,w);for(const symbol of row)assert.ok(symbol in SPRITE_PALETTE,symbol);}
  }
  assert.equal(new Set(MINION_FRAMES.map(f=>f.join(''))).size,3); // Neutral pose is reused between opposite steps.
  assert.equal(new Set(COIN_FRAMES.map(f=>f.join(''))).size,4); // Narrowing and widening intentionally reuse artwork.
});

test('death pose remains readable through impact, tumble and disappearance',()=>{
  const frames=[PLAYER_SPRITES.deathImpact,PLAYER_SPRITES.deathCrouch,PLAYER_SPRITES.deathRise,PLAYER_SPRITES.deathFall];
  assert.equal(new Set(frames.map(frame=>frame.join(''))).size,4);
  assert.ok(frames.every(frame=>frame.length===26 && frame.every(row=>row.length===16 && [...row].every(symbol=>symbol in PLAYER_PALETTE))));
  const impact=playerDeathMotion(0),crouch=playerDeathMotion(120),lift=playerDeathMotion(500),fall=playerDeathMotion(900),gone=playerDeathMotion(1300);
  assert.equal(impact.y,0);
  assert.ok(crouch.y>impact.y);
  assert.ok(lift.y<impact.y);
  assert.ok(fall.y>lift.y);
  assert.deepEqual([impact.pose,crouch.pose,lift.pose,fall.pose],['deathImpact','deathCrouch','deathRise','deathFall']);
  assert.equal(gone.alpha,0);
});

test('renderer draws every death phase with authored frames',(t)=>{
  canvasHarness(t);
  const target=new RecordingContext();
  const renderer=Object.create(Renderer.prototype) as any;
  Object.assign(renderer,{atlas:new SpriteAtlas(),offscreenCtx:target});
  const player={position:{x:90,y:80},width:14,height:24,facingRight:true,isDead:true,
    deathKind:'hit',deathTimerMax:1500,deathTimer:1500};
  for(const elapsed of [0,120,350,900]){
    player.deathTimer=1500-elapsed;
    renderer.drawPlayer(player,{x:0,y:0});
  }
  assert.equal(target.images.length,4);
});

test('sprite atlas caches by frame, palette, facing and tint without blending pixels',(t)=>{
  const canvases=canvasHarness(t),atlas=new SpriteAtlas(),target=new RecordingContext();
  const frame=['A_','_B'],palette={_:null,A:'#123456',B:'#abcdef'};
  const draw=(p=palette,flip=false,tint?:string)=>atlas.draw(target as unknown as CanvasRenderingContext2D,frame,p,3.3,8.8,flip,1,tint);
  draw();draw();assert.equal(canvases.length,1);
  assert.deepEqual(target.images[0].slice(1),[3,9,2,2]);
  draw(palette,true);assert.deepEqual(canvases[1].ctx.rectangles.map(r=>[r.x,r.y]),[[1,0],[0,1]]);
  draw({...palette,A:'#ffffff'});assert.equal(canvases[2].ctx.rectangles[0].color,'#ffffff');
  draw(palette,false,'#f5efd3');draw(palette,false,'#f5efd3');assert.equal(canvases.length,4);
  assert.equal(target.imageSmoothingEnabled,false);
});

test('background motifs are deterministic and recolouring preserves geometry',(t)=>{
  const canvases=canvasHarness(t);
  const spec={type:'hills' as const,color:'#528575',scrollFactor:.4};
  BackgroundGenerator.generateLayer(spec,640,180);
  BackgroundGenerator.generateLayer(spec,640,180);
  BackgroundGenerator.generateLayer({...spec,color:'#756d76'},640,180);
  assert.deepEqual(canvases[0].ctx.rectangles,canvases[1].ctx.rectangles);
  const shapes=(index:number)=>canvases[index].ctx.rectangles.map(({x,y,w,h})=>({x,y,w,h}));
  assert.deepEqual(shapes(0),shapes(2));
  for(const rect of shapes(0))assert.ok(Object.values(rect).every(Number.isInteger));
});

test('visual time depends on simulation delta, not draw rate or wall clock',()=>{
  const slow=new VisualClock(),fast=new VisualClock();
  for(let i=0;i<30;i++)slow.advance(1000/30);
  for(let i=0;i<60;i++)fast.advance(1000/60);
  assert.ok(Math.abs(slow.time-fast.time)<.001);
  const frame=animationIndex(fast.time,6,110);
  for(let i=0;i<144;i++)assert.equal(animationIndex(fast.time,6,110),frame);
  fast.advance(Number.NaN);fast.advance(-100);assert.ok(Math.abs(slow.time-fast.time)<.001);
});

test('terrain connections and the visible lava surface follow the collision grid',()=>{
  const tiles=[[0,1,0],[20,1,2],[0,15,0]];
  assert.equal(terrainMask(tiles,1,1),15);
  tiles[0][1]=TileType.EMPTY;assert.equal(terrainMask(tiles,1,1),14);
  assert.equal(lavaOffset([[0],[TileType.LAVA_TOP]],1,0),4);
  assert.equal(lavaOffset([[TileType.LAVA_TOP],[TileType.LAVA_FILL]],1,0),0);
});

test('contact and falling platforms remain visible at their shifted world coordinates',()=>{
  const r=Object.create(Renderer.prototype) as Renderer;
  const calls:unknown[][]=[];
  Object.assign(r,{offscreenCtx:new RecordingContext(),drawTile:(...args:unknown[])=>calls.push(args)});
  r.drawFallingPlatforms([{col:3,row:5,phase:'contact',timer:0,contact:20}],{x:-70,y:-20} as any,-8,-4);
  assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(0,3),[TileType.PLATFORM_FALLING,-10,36]);
  r.drawFallingPlatforms([{col:3,row:5,phase:'falling',timer:150,contact:20}],{x:-70,y:-20} as any,-8,-4);
  assert.deepEqual(calls[1].slice(0,3),[TileType.PLATFORM_FALLING,-10,42]);
});

test('bitmap text wraps long Portuguese words and draws accents on integer pixels',()=>{
  const lines=wrapText('JOÃOZÃO: A PRÓXIMA AVENTURA EXTRAORDINARIAMENTE DIVERTIDA',64);
  assert.ok(lines.length>1);assert.ok(lines.every(line=>textWidth(line)<=64));
  const c=new RecordingContext();pixelText(c as unknown as CanvasRenderingContext2D,'JOÃOZÃO AÇÃO ↑',2,4);
  assert.ok(c.rectangles.some(r=>r.y===2));
  assert.ok(c.rectangles.every(r=>[r.x,r.y,r.w,r.h].every(Number.isInteger)));
  assert.equal(textWidth('JOÃOZÃO'),textWidth('JOAOZAO'));
});

test('biomes survive level round trips, legacy levels still work, invalid names fail',()=>{
  const data=structuredClone(getLevelByIndex(0)!);
  assert.equal(normalizeLevelData(data).theme?.biome,'meadow');
  delete data.theme!.biome;assert.equal(normalizeLevelData(data).theme?.biome,undefined);
  assert.throws(()=>normalizeLevelData({...data,theme:{...data.theme,biome:'unknown'}}),/theme.biome/);
});
