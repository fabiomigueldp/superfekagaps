import assert from 'node:assert/strict';
import test from 'node:test';
import {guairaAscentBrowser} from './helpers/guairaAscentHarness';
import {GUAIRA_ASCENT as G} from '../src/adventure/experimental/guaira/GuairaAscent';
import {chapterGuidance} from '../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';
import tape from './helpers/guairaRooftopReplay.json';

type Run=[number,string[]];
type H=ReturnType<typeof guairaAscentBrowser>;
type Game=ReturnType<H['create']>;
const dt=1000/60,feet=(g:Game)=>g.player.data.position.y+g.player.data.height;
function input(h:H,keys:string[],touch=false){
 if(!touch){h.keys(keys);return;}
 const x:Record<string,number>={ArrowLeft:.08,ArrowRight:.22,ArrowDown:.5,ShiftLeft:.78,Space:.93};
 const touches=keys.map((key,i)=>({identifier:i+1,target:h.canvas,clientX:x[key]*640,clientY:330}));
 h.canvas.dispatch(touches.length?'touchstart':'touchend',{touches});
}
function play(h:H,g:Game,runs:Run[],touch=false,observe=(_n:number)=>{}){
 let n=0;for(const[count,keys]of runs){input(h,keys,touch);for(let i=0;i<count;i++){g.update(dt);observe(++n);}}return n;
}
const prefix=tape.runs.slice(0,15) as Run[];
function visible(g:Game,x:number,y:number,w=32){
 assert.ok(x>=g.camera.x&&x+w<=g.camera.x+320,`landing x${x}..${x+w} visible`);
 assert.ok(y-g.camera.y>=24&&y-g.camera.y<=172,`landing y${y} visible: ${y-g.camera.y}`);
}

for(const touch of [false,true])for(const reducedMotion of [false,true])
 test(`workshop route and lower inspection finish through native input, touch=${touch}, reduced=${reducedMotion}`,t=>{
  const h=guairaAscentBrowser(t,{touch,reducedMotion}),g=h.create(),supports=new Set<number>();
  let lastY=g.camera.y,liftRides=0;
  const frames=play(h,g,tape.runs as Run[],touch,n=>{
   const p=g.player.data;assert.equal(p.isDead,false);assert.equal(p.hasHelmet,true);
   assert.ok(p.position.y-10-g.camera.y>=23);assert.ok(feet(g)-g.camera.y<=172);
   assert.ok(Math.abs(g.camera.y-lastY)<=8.001);lastY=g.camera.y;
   if(p.isGrounded)supports.add(Math.round(feet(g)));
   if(n>=439&&n<=619){
    const lift=g.objects.get(G.liftId)!;
    if(p.isGrounded&&Math.abs(feet(g)-lift.y)<.001&&p.position.x+p.width>lift.x&&p.position.x<lift.x+lift.width)liftRides++;
   }
   if(n===439){visible(g,544,192,48);g.render();assert.match(h.status.textContent,/telhado.*esquerda/);}
   if(n===488){visible(g,608,144,64);g.render();assert.match(h.status.textContent,/mais alto à direita/);}
   if(n===548){visible(g,768,144,48);g.render();assert.match(chapterGuidance(h.status.textContent,''),/corra e salte.*Shift ou botão/);}
   if(n>=558&&n<=602)visible(g,768,144,48);
  });
  assert.equal(frames,tape.frames);assert.equal(g.finished,true);assert.equal(g.coins,tape.coins);assert.equal(liftRides,0);
  assert.equal(g.store.save.checkpoint?.index,g.stage.checkpoints.length-1);
  for(const top of [368,336,304,256,192,144,240])assert.ok(supports.has(top),`native support ${top} used`);
  const collected=(g as unknown as {collected:Set<string>}).collected;
  assert.equal([...collected].filter(id=>id.startsWith('guaira-subida:roof:')).length,4);
  assert.equal([...collected].filter(id=>id.startsWith('guaira-subida:inspection:')).length,3);
  const state=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,coins:g.coins,t:g.time});
  const before=state();g.render();g.render();assert.equal(state(),before);
 });

for(const runup of [4,6,8,10,12,14])for(const hold of [12,16,20,24,36,52])
 test(`roof transfer accepts ${runup} running frames and ${hold} held jump frames`,t=>{
  const h=guairaAscentBrowser(t),g=h.create();play(h,g,prefix);h.run(g,runup,['ArrowRight','ShiftLeft']);
  let landed=false;h.keys(['ArrowRight','ShiftLeft','Space']);
  for(let n=0;n<54;n++){
   if(n===hold)h.keys(['ArrowRight','ShiftLeft']);g.update(dt);
   assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
   if(!landed)visible(g,768,144,32);
   if(g.player.data.isGrounded&&g.player.data.position.x>=754&&feet(g)===144)landed=true;
  }
  assert.equal(landed,true,'reaches the native terrace, not the lift underneath');
 });

test('workshop route does not depend on elevator phase across an entire ten-second cycle',t=>{
 const h=guairaAscentBrowser(t),g=h.create();
 for(let delay=0;delay<600;delay+=10){
  h.keys([]);g.load(G.id);play(h,g,tape.runs.slice(0,11) as Run[]);h.run(g,delay);
  play(h,g,tape.runs.slice(11,18) as Run[]);
  assert.ok(g.player.data.position.x>=800);assert.equal(feet(g),144);assert.equal(g.coins,9);
  assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.store.save.checkpoint?.index,1);
 }
});

for(const hold of [1,3,6])for(const delay of [0,120,300])
 test(`short ${hold}-frame jump at phase offset ${delay} returns to the workshop without resetting`,t=>{
  const h=guairaAscentBrowser(t),g=h.create();play(h,g,prefix);h.run(g,delay);
  h.run(g,10,['ArrowRight','ShiftLeft']);h.run(g,hold,['ArrowRight','ShiftLeft','Space']);
  h.run(g,55-hold,['ArrowRight','ShiftLeft']);h.run(g,50);
  assert.equal(feet(g),368);assert.equal(g.player.data.isDead,false);assert.equal(g.store.save.checkpoint?.index,0);
  const coins=g.coins,objects=g.objects,time=g.objects.time;
  for(let n=0;n<90&&g.player.data.position.x>680;n++)h.run(g,1,['ArrowLeft']);
  h.run(g,20);h.run(g,30,['Space']);h.run(g,30);h.run(g,36,['ArrowLeft','Space']);h.run(g,30);
  assert.equal(feet(g),256);assert.equal(g.player.data.isGrounded,true);assert.equal(g.player.data.hasHelmet,true);
  assert.equal(g.objects,objects);assert.ok(g.objects.time>time);assert.equal(g.coins,coins);
  // The player can retry the climb. No coin can be farmed by falling and returning.
  h.run(g,19,['ArrowLeft','Space']);h.run(g,25);h.run(g,40,['ArrowRight','Space']);h.run(g,20);
  assert.equal(feet(g),144);assert.equal(g.coins,coins);assert.equal(g.finished,false);
 });

test('roof preserves pause, local checkpoints and native attempt coin accounting',t=>{
 const h=guairaAscentBrowser(t),g=h.create();play(h,g,prefix);
 h.keys([]);g.toggleAscentPause();
 const snapshot=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,t:g.time,coins:g.coins});
 const before=snapshot();h.run(g,120);g.render();assert.equal(snapshot(),before);g.toggleAscentPause();
 const coins=g.coins,old=g.player;old.die('fall'); // Explicit death stimulus; the route itself has a dry recovery floor.
 for(let n=0;n<180&&g.player===old;n++)h.run(g,1);
 assert.notEqual(g.player,old);assert.equal(g.player.data.position.x,528);assert.equal(feet(g),304);assert.equal(g.coins,coins);
 g.load(G.id);assert.equal(g.coins,0);assert.equal(g.store.save.checkpoint,null);
});
