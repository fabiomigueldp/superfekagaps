import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {guairaControlConnection,drawGuairaControlConnection} from '../src/adventure/experimental/guaira/GuairaControlConnections';
import {GUAIRA_PIPE_COLORS as P} from '../src/adventure/experimental/guaira/GuairaPipeArt';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {drawGuairaPressureOutlet} from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import {guairaTraversalStage,GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {guairaJunctionStage} from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import {guairaRespirosStage} from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import {guairaAscentStage,GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {guairaGalleryStage} from '../src/adventure/experimental/guaira/gallery/GuairaGalleryStage';
import {guairaReliefStage} from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import type {WorldGame} from '../src/adventure/WorldGame';
import {jetCycle} from '../src/adventure/WorldMachineState';

function raster(draw:(c:CanvasRenderingContext2D)=>void){
 const pixels=new Map<string,string>();let color='';const stack:string[]=[];
 const c={get fillStyle(){return color;},set fillStyle(v:string){color=v;},globalAlpha:1,
  save(){stack.push(color);},restore(){color=stack.pop()!;},
  fillRect(x:number,y:number,w:number,h:number){
   assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.set(`${xx},${yy}`,color);
  }};
 draw(c as unknown as CanvasRenderingContext2D);assert.equal(stack.length,0);return pixels;
}

test('all 11 course links have unbroken sight glass in both directions, with clamps entirely on a straight span',()=>{
 let count=0,left=0,short=0;
 for(const factory of [guairaTraversalStage,guairaJunctionStage,guairaRespirosStage,guairaAscentStage,guairaGalleryStage,guairaReliefStage]){
  const o=new WorldObjects(factory().mechanisms);
  for(const b of o.bodies.filter(b=>b.kind==='switch'&&b.id.includes(':course:'))){
   count++;const target=o.get(b.link!)!,link=guairaControlConnection(b,target),v=link.vertices,s=link.saddle;
   left+=Number(v[2][0]<v[1][0]);short+=Number(s.vertical);
   assert.deepEqual(v[0],[b.x+b.width/2,b.y+b.height]);
   assert.ok(v.at(-1)![0]>=target.x&&v.at(-1)![0]<=target.x+target.width);
   assert.equal(v.at(-1)![1],target.kind==='jet'?target.y+target.height+6:target.to!.y+14);
   assert.ok(v.slice(1).some((end,i)=>{
    const start=v[i],axis=s.vertical?1:0,fixed=s.vertical?0:1,at=s.vertical?s.y:s.x;
    return start[fixed]===end[fixed]&&start[fixed]===(s.vertical?s.x:s.y)
     &&at-7>Math.min(start[axis],end[axis])+4&&at+7<Math.max(start[axis],end[axis])-4;
   }),b.id+' has a bracket outside its pipe');
   const cx=b.x-80,cy=b.y-60;
   for(const wet of [true,false])for(const reduced of [false,true]){
    target.active=target.kind==='jet'?!wet:wet;
    const before=JSON.stringify(o),draw=()=>raster(c=>drawGuairaControlConnection(c,b,target,cx,cy,1920,reduced));
    const p=draw();assert.equal(JSON.stringify(o),before);assert.deepEqual(p,draw());
    for(const [wx,wy]of link.flow){
     const color=p.get(`${wx-cx},${wy-cy}`);
     assert.ok(wet?[P.water,P.glint].includes(color!):color===P.dry,`${b.id}: sight glass interrupted at ${wx},${wy}: ${color}`);
    }
   }
  }
 }
 assert.equal(count,11);assert.equal(left,2);assert.equal(short,2);
});

test('a connection stays anchored when its deck travels; reloading cannot retain the old target or route',()=>{
 const stage=guairaTraversalStage(),o=new WorldObjects(stage.mechanisms),l=new WorldLevel(stage.level);
 const b=o.bodies.find(b=>b.id.endsWith(':course:bridge:784:valve'))!,target=o.get(b.link!)!;
 const original=guairaControlConnection(b,target);o.activate(b.id);
 for(let n=0;n<160;n++){o.update(1000/60,l,b.x);assert.equal(guairaControlConnection(b,target),original);}
 assert.equal(target.y,target.to!.y);assert.notEqual(target.y,target.home!.y);
 const fresh=new WorldObjects(stage.mechanisms),freshB=fresh.get(b.id)!,freshT=fresh.get(target.id)!;
 assert.notEqual(guairaControlConnection(freshB,freshT),original);assert.deepEqual(guairaControlConnection(freshB,freshT),original);
});

test('the receiving gauge distinguishes manual isolation from an ordinary dry interval and preserves the reopening warning',()=>{
 const o=new WorldObjects(guairaRespirosStage().mechanisms),b=o.get('guaira-respiro-c-isolation')!,target=o.get(b.link!)!;
 o.time=0;while(jetCycle(target,o.time).phase!=='idle')o.time+=20;
 const cx=target.x-80,cy=target.y+target.height-140;
 const draw=(reduced=false)=>raster(c=>drawGuairaPressureOutlet(c,target,cx,cy,o.time,reduced));
 const badge=(p:Map<string,string>)=>[...p].filter(([key])=>{const[x,y]=key.split(',').map(Number);return x>=66&&x<79&&y>=72&&y<85;});
 const dry=badge(draw());assert.ok(o.activate(b.id));const closed=badge(draw());
 assert.notDeepEqual(closed,dry);assert.deepEqual(closed,badge(draw(true)));assert.equal(jetCycle(target,o.time).danger,null);
 o.time+=500;b.timer=0;assert.ok(o.activate(b.id));assert.equal(jetCycle(target,o.time).phase,'charging');
 const charging=badge(draw());assert.notDeepEqual(charging,closed);assert.notDeepEqual(charging,dry);
});

function atControl(g:WorldGame,suffix:string){
 const b=g.objects.bodies.find(b=>b.kind==='switch'&&b.id.endsWith(suffix))!;
 assert.ok(b);g.player.data.position={x:b.x+6,y:b.y+b.height-g.player.data.height};g.player.data.isGrounded=true;
 return b;
}
test('bridge guidance waits for exact arrival, covers lowering and does not claim the second channel is safe',t=>{
 const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),b=atControl(g,':course:bridge:784:valve'),bridge=g.objects.get(b.link!)!;
 assert.equal(guairaCourseGuidance(g,'travessia')?.hint,'PULE + BAIXO NO REGISTRO');
 assert.ok(g.objects.activate(b.id));
 for(let n=0;n<160&&bridge.y!==bridge.to!.y;n++){
  assert.equal(guairaCourseGuidance(g,'travessia')?.hint,'PONTE SUBINDO: ESPERE');g.objects.update(1000/60,g.level,b.x);
 }
 assert.equal(bridge.y,bridge.to!.y);assert.equal(guairaCourseGuidance(g,'travessia')?.hint,'PONTE PRONTA A DIREITA');
 assert.match(guairaCourseGuidance(g,'travessia')!.detail,/segundo canal continuam ativos/);
 assert.ok(g.objects.activate(b.id));assert.equal(guairaCourseGuidance(g,'travessia')?.hint,'PONTE DESCENDO: ESPERE');
 g.dispose();
});

test('underground feedback identifies the upstairs outlet and the actual exit without leaking to the upper corridor',t=>{
 const h=sceneLifecycleBrowser(t),g=h.create(GuairaGallery),b=atControl(g,':inspection-outlet:valve');
 assert.match(guairaCourseGuidance(g,'galeria')!.detail,/acima e à esquerda/);
 assert.ok(g.objects.activate(b.id));assert.equal(guairaCourseGuidance(g,'galeria')?.hint,'GRELHA DO ALTO FECHADA');
 assert.match(guairaCourseGuidance(g,'galeria')!.detail,/degraus à direita/);
 g.player.data.position.y-=52;assert.equal(guairaCourseGuidance(g,'galeria')?.hint,'GRELHA DO ALTO FECHADA','the immediate rebound keeps the result');
 g.objects.update(1900,g.level,b.x);assert.notEqual(guairaCourseGuidance(g,'galeria')?.hint,'GRELHA DO ALTO FECHADA','an unrelated floor cannot inherit feedback');
 atControl(g,':inspection-outlet:valve');assert.ok(g.objects.activate(b.id));
 assert.equal(guairaCourseGuidance(g,'galeria')?.hint,'SAIDA REABERTA: CUIDADO');
 g.dispose();
});

test('the ascent waiting ledge retains its bridge response after the short rebound feedback expires',t=>{
 const h=sceneLifecycleBrowser(t),g=h.create(GuairaAscent),b=atControl(g,':course:bridge:800:valve');
 g.objects.activate(b.id);g.objects.update(2000,g.level,b.x);
 g.player.data.position={x:2094,y:80-g.player.data.height};
 assert.equal(guairaCourseGuidance(g,'subida')?.hint,'PONTE SUBINDO: ESPERE');
 g.objects.update(1500,g.level,b.x);assert.equal(guairaCourseGuidance(g,'subida')?.hint,'PONTE PRONTA A DIREITA');
 g.player.data.position.y=48-g.player.data.height;
 assert.notEqual(guairaCourseGuidance(g,'subida')?.hint,'PONTE PRONTA A DIREITA','the response does not leak to an unrelated upper level');g.dispose();
});

test('counterpressure feedback names only the changed outlet and never hides an immediate enemy tell',t=>{
 const h=sceneLifecycleBrowser(t),g=h.create(GuairaRelief),b=atControl(g,':counterpressure-b:valve');
 assert.ok(g.objects.activate(b.id));assert.equal(guairaCourseGuidance(g,'alivio')?.hint,'SEGUNDA GRELHA FECHADA');
 assert.match(guairaCourseGuidance(g,'alivio')!.detail,/somente a segunda/);assert.match(guairaCourseGuidance(g,'alivio')!.detail,/primeira continua/);
 const foe=g.foes.find(e=>e.spec.kind==='loader')!;foe.x=b.x+50;foe.y=b.y+8-foe.height;foe.phase='warning';
 assert.equal(guairaCourseGuidance(g,'alivio')?.hint,'ARREMESSO A CAMINHO');g.dispose();
});

test('immediate water retains priority and feedback cannot follow the player onto a different upper branch',t=>{
 const h=sceneLifecycleBrowser(t),g=h.create(GuairaRespiros),b=atControl(g,':workshop-grate:valve');g.objects.activate(b.id);
 const jet=g.objects.bodies.find(v=>v.kind==='jet'&&v.id!==b.link)!;
 jet.x=b.x+22;jet.y=b.y-96;jet.height=104;jet.phase=0;jet.active=false;g.objects.time=2100;
 assert.equal(guairaCourseGuidance(g,'respiros')?.hint,'AGUA NA GRELHA');
 jet.active=true;g.player.data.isGrounded=false;g.player.data.position.y-=120;
 assert.notEqual(guairaCourseGuidance(g,'respiros')?.hint,'GRELHA DA OFICINA FECHADA','feedback cannot follow a different upper branch');g.dispose();
});
