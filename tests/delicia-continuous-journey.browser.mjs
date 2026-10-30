/** Loopback only: actual map/host/app round trips with prepared collection positions.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-continuous-journey.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><canvas id="game-canvas" tabindex="0"></canvas><script type="module">
import '/src/adventure/map.css';
import { WorldGame } from '/src/adventure/WorldGame.ts';
import { freshSave, SAVE_KEY } from '/src/adventure/progress.ts';
import { freshDeliciaSave, DELICIA_SAVE_KEY } from '/src/adventure/delicia/DeliciaProgress.ts';
import { noDeliciaInput } from '/src/adventure/delicia/DeliciaSimulation.ts';
import { keyAction } from '/src/engine/ControlPreferences.ts';
const initial = freshDeliciaSave();
initial.completed=['delicia-1']; initial.selected='delicia-2'; initial.music=.2; initial.effects=.4;
initial.collected=['delicia-2:s1','delicia-2:s2','delicia-2:m5']; initial.lore.push('fundadores');
initial.times={'delicia-1':90}; initial.medals={'delicia-1':['clean']};
initial.checkpoint={stage:'delicia-2',index:2,valves:['v5']};
const initialWorld=freshSave(); initialWorld.preferences={music:.2,effects:.4,voice:.3,shake:false};
if(!localStorage.getItem(DELICIA_SAVE_KEY))localStorage.setItem(DELICIA_SAVE_KEY,JSON.stringify(initial));
if(!localStorage.getItem(SAVE_KEY))localStorage.setItem(SAVE_KEY,JSON.stringify(initialWorld));
const world=new WorldGame(document.querySelector('canvas'));
world.openChapterMap('delicia'); world.start();
let clock=1000;
window.h={world,initial,initialWorld,keyAction,prepared:[],apps:[],get view(){return world.mapView;},get app(){return window.deliciaGame;},
 freeze(){h.app.stopFrames();h.app.last=clock;},
 advance(n=1){const app=h.app;for(let i=0;i<n&&app.screen==='playing';i++){app.loop(clock+=1000/120);app.stopFrames();app.last=clock;}},
 place(kind,target){const sim=h.app.sim;h.prepared.push({kind,x:target.x,y:target.y});
   Object.assign(sim.player,{x:target.x,y:target.y,vx:0,vy:0,grounded:false,invincible:10});},
 collect(id){const sim=h.app.sim,p=sim.stage.pickups.find(p=>p.id===id);h.place('pickup:'+id,{x:p.x-sim.player.w/2,y:p.y-sim.player.h/2});h.app.step(1/120,noDeliciaInput());h.app.renderGame();},
 gate(){const sim=h.app.sim;h.place('final-platform',{x:sim.stage.gate.x-90,y:sim.stage.gate.y+sim.stage.gate.h-sim.player.h});},
 map(){const v=h.view;return {chapter:v.chapter,selected:v.chapterStages[v.chapterIndex].id,journey:v.deliciaJourney,
   stages:v.chapterStages.map(s=>({id:s.id,open:s.open,completed:s.completed,seals:s.seals})),
   status:v.hud.status.textContent,details:v.hud.stageDetails.textContent,focus:document.activeElement.getAttribute('aria-label'),
   canEnter:!v.hud.enterButton.disabled,hosts:document.querySelectorAll('.world-chapter-host').length};},
 saved(){return JSON.parse(localStorage.getItem(DELICIA_SAVE_KEY));},
};
</script></body></html>`;
before(async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
 server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,appType:'custom',server:{host:'127.0.0.1',port:0},plugins:[{name:'continuous-journey',configureServer(vite){vite.middlewares.use('/journey-fixture',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(fixture);});}}]});
 await server.listen();base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
});
after(async()=>{await browser?.close();await server?.close();});
async function activate(page,label,touch){const button=page.getByRole('button',{name:label,exact:true});if(touch)await button.tap();else{await button.focus();await page.keyboard.press('Enter');}}
async function saved(page){return page.evaluate(()=>h.saved());}
async function mapReady(page,selected){await page.waitForFunction(id=>window.h&&!h.world.chapterActive&&h.view.chapter==='delicia'&&h.map().selected===id&&h.map().canEnter&&h.map().hosts===0,selected);}
async function enter(page,touch){
 await activate(page,'Jogar: Pomares da Partilha',touch);
 await page.waitForFunction(()=>window.deliciaGame&&h.world.chapterActive&&!document.querySelector('.world-chapter-loading'));
 await page.evaluate(()=>{h.freeze();h.apps.push(h.app);});
 assert.equal(await page.locator('.world-chapter-host').count(),1);
 while(await page.evaluate(()=>h.app.screen==='dialogue')){await activate(page,'CONTINUAR',touch);await page.evaluate(()=>h.freeze());}
 assert.equal(await page.evaluate(()=>h.app.screen),'playing');
}
async function key(page,code){
 const snapshot=()=>({focus:document.activeElement.tagName,focusClass:document.activeElement.className,screen:h.app.screen,
  touch:h.app.root.classList.contains('dl-has-touch'),
  held:[...h.app.held],pressed:[...h.app.pressed],input:h.app.input(),last:h.app.last,accumulator:h.app.accumulator,
  elapsed:h.app.sim.elapsed,nearby:h.app.sim.nearbyValve?.id,valves:[...h.app.sim.valves]});
 const ready=await page.evaluate(snapshot);await page.keyboard.down(code);const down=await page.evaluate(snapshot);
 const start=await page.evaluate(()=>{const time=h.app.sim.time;h.app.last=performance.now();h.app.requestFrame();return time;});
 await page.waitForFunction(start=>h.app.sim.time>start+.04,start);await page.evaluate(()=>h.freeze());
 const stepped=await page.evaluate(snapshot);await page.keyboard.up(code);
 return {ready,down,stepped};
}
async function screenshot(page,name){if(process.env.BROWSER_ARTIFACT_DIR)await page.screenshot({path:process.env.BROWSER_ARTIFACT_DIR+'/'+name+'.png'});}
async function finish(page){
 await page.evaluate(()=>h.gate());await page.keyboard.down('KeyD');await page.keyboard.down('KeyV');
 const frames=await page.evaluate(()=>{let n=0;while(h.app.screen==='playing'&&n<120){h.advance();n++;}return n;});
 await page.keyboard.up('KeyV');await page.keyboard.up('KeyD');
 assert.ok(frames<120,'Reach the real gate by movement.');
 assert.deepEqual(await page.evaluate(()=>[h.app.screen,h.app.sim.finished]),['clear',true]);
 return page.evaluate(()=>({time:h.app.sim.elapsed,eligible:h.app.sim.recordEligible,detail:h.app.presentation.menus.root.getAttribute('aria-label')}));
}
async function selectTwo(page,touch){
 if(touch)await page.locator('.world-map-chapter-node').nth(1).tap();else await page.keyboard.press('ArrowLeft');
 await mapReady(page,'delicia-2');
 assert.match(await page.evaluate(()=>h.map().status),/Concluída/);
 assert.match(await page.evaluate(()=>h.map().details),/3\/3 selos/);
}
for(const touch of [false,true])test(`${touch?'compact touch':'desktop keyboard'}: checkpoint → completion → actual map host → eligible replay → persisted rewards`,async t=>{
 const context=await browser.newContext({viewport:touch?{width:360,height:640}:{width:1280,height:720},hasTouch:touch,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,base,'Only loopback traffic');return route.continue();});
 await page.addInitScript(()=>{window.AudioContext=undefined;navigator.getGamepads=()=>[];
  if(!localStorage.getItem('super_feka_gaps_controls_v1'))localStorage.setItem('super_feka_gaps_controls_v1',JSON.stringify({keys:{jump:['KeyK'],run:['KeyV'],interact:['KeyL']}}));
  if(!localStorage.getItem('unrelated-project-save'))localStorage.setItem('unrelated-project-save','untouched');});
 t.after(async()=>{try{assert.deepEqual(errors,[]);await page.evaluate(()=>h.world.dispose());}finally{await context.close();}});
 await page.goto(base+'/journey-fixture');await mapReady(page,'delicia-2');
 const initial=await page.evaluate(()=>h.initial),initialWorld=await page.evaluate(()=>h.initialWorld),controls=await page.evaluate(()=>localStorage.getItem('super_feka_gaps_controls_v1'));
 const trace=[{step:'initial-map',state:await page.evaluate(()=>h.map())}];
 assert.deepEqual(await saved(page),initial);
 assert.equal(trace[0].state.stages.find(s=>s.id==='delicia-3').open,false);
 await enter(page,touch);
 const resumed=await page.evaluate(()=>({cp:h.app.sim.checkpoint,position:{x:h.app.sim.player.x,y:h.app.sim.player.y},expected:h.app.sim.stage.checkpoints[2],valves:[...h.app.sim.valves],eligible:h.app.sim.recordEligible}));
 assert.equal(resumed.cp,2);assert.deepEqual(resumed.position,resumed.expected);assert.deepEqual(resumed.valves,['v5']);assert.equal(resumed.eligible,false);
 trace.push({step:'resumed',state:resumed});
 // Real remapped movement from the authored checkpoint to the remaining valve.
 await page.keyboard.down('KeyD');await page.keyboard.down('KeyV');
 const moved=await page.evaluate(()=>{const start=h.app.sim.player.x;let n=0;while(h.app.sim.nearbyValve?.id!=='v11'&&n<120){h.advance();n++;}return {n,dx:h.app.sim.player.x-start,nearby:h.app.sim.nearbyValve?.id};});
 await page.keyboard.up('KeyV');await page.keyboard.up('KeyD');
 assert.equal(moved.nearby,'v11');assert.ok(moved.dx>0);await key(page,'KeyL');
 assert.deepEqual(await page.evaluate(()=>[...h.app.sim.valves]),['v5','v11']);
 await page.evaluate(()=>{h.collect('delicia-2:s3');h.collect('delicia-2:m11');});
 const earned={...initial,collected:[...initial.collected,'delicia-2:s3','delicia-2:m11'],lore:[...initial.lore,'casca'],checkpoint:{...initial.checkpoint,valves:['v5','v11']}};
 assert.deepEqual(await saved(page),earned);
 const partial=await finish(page);assert.equal(partial.eligible,false);assert.match(partial.detail,/TEMPO PARCIAL · SEM RECORDE/);
 const completed={...earned,completed:['delicia-1','delicia-2'],selected:'delicia-3',checkpoint:null};assert.deepEqual(await saved(page),completed);
 trace.push({step:'partial-result',state:partial});
 await screenshot(page,(touch?'touch':'keyboard')+'-partial');
 await activate(page,'SEGUIR VIAGEM',touch);await mapReady(page,'delicia-3');
 assert.equal(await page.evaluate(()=>h.apps[0].disposed&&!h.apps[0].root.isConnected),true);
 const returned=await page.evaluate(()=>h.map());assert.equal(returned.stages.find(s=>s.id==='delicia-3').open,true);assert.match(returned.focus,/Jogar: Aqueduto dos Ecos/);
 assert.equal(returned.stages.find(s=>s.id==='delicia-2').seals,3);trace.push({step:'returned-map',state:returned});
 await selectTwo(page,touch);await enter(page,touch);
 assert.deepEqual(await page.evaluate(()=>({cp:h.app.sim.checkpoint,eligible:h.app.sim.recordEligible,position:{x:h.app.sim.player.x,y:h.app.sim.player.y},spawn:h.app.sim.stage.spawn})),{cp:-1,eligible:true,position:{x:90,y:378},spawn:{x:90,y:378}});
 assert.equal(await page.evaluate(()=>h.apps[0]!==h.apps[1]&&h.apps.length===2),true);
 // Prepare a short full-attempt result; this does not claim a human 30-second run.
 await page.evaluate(()=>{h.app.sim.elapsed=30;h.prepared.push({kind:'replay-clock',seconds:30});});
 for(const id of ['v5','v11']){
  await page.evaluate(id=>{const sim=h.app.sim,v=sim.stage.valves.find(v=>v.id===id);h.place('valve:'+id,{x:v.x,y:v.y-sim.player.h});},id);
  const interaction=await key(page,'KeyL');t.diagnostic(JSON.stringify({id,interaction}));
 }
 assert.deepEqual(await page.evaluate(()=>[...h.app.sim.valves]),['v5','v11']);
 const reward=await finish(page);assert.equal(reward.eligible,true);assert.match(reward.detail,/Travessia sem dano · Os três selos · Ritmo cítrico/);
 const rewarded={...completed,times:{...completed.times,'delicia-2':reward.time},medals:{...completed.medals,'delicia-2':['clean','seals','tempo']}};
 assert.deepEqual(await saved(page),rewarded);trace.push({step:'eligible-result',state:reward});
 await screenshot(page,(touch?'touch':'keyboard')+'-reward');
 await activate(page,'SEGUIR VIAGEM',touch);await mapReady(page,'delicia-3');
 assert.equal(await page.evaluate(()=>h.apps.every(app=>app.disposed&&!app.root.isConnected)),true);
 assert.deepEqual(await saved(page),rewarded);
 const preparation=await page.evaluate(()=>h.prepared),durable=await page.evaluate(()=>localStorage.getItem('super_feka_delicia_v1'));
 assert.deepEqual(await page.evaluate(()=>h.world.store.save),initialWorld);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('super_feka_gaps_world_v1'))),initialWorld);
 assert.equal(await page.evaluate(()=>localStorage.getItem('super_feka_gaps_controls_v1')),controls);
 assert.deepEqual(await page.evaluate(()=>['KeyK','KeyV','KeyL'].map(h.keyAction)),['jump','run','interact']);
 assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-project-save')),'untouched');
 await page.reload();await mapReady(page,'delicia-3');
 assert.equal(await page.evaluate(()=>localStorage.getItem('super_feka_delicia_v1')),durable);
 assert.deepEqual(await saved(page),rewarded);
 await selectTwo(page,touch);
 assert.deepEqual(await saved(page),{...rewarded,selected:'delicia-2'});
 assert.equal(await page.evaluate(()=>h.map().stages.find(s=>s.id==='delicia-2').completed),true);
 trace.push({step:'reload-and-revisit',state:await page.evaluate(()=>h.map())});
 await screenshot(page,(touch?'touch':'keyboard')+'-map');
 t.diagnostic(JSON.stringify({touch,trace,preparation,finalSave:await saved(page)}));
});

for(const action of [{code:'KeyK',held:' ',name:'jump'},{code:'KeyJ',held:'j',name:'seed'}])
test(`first keyboard ${action.name} after touch entry survives the native animation frame`,async t=>{
 const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,base);return route.continue();});
 await page.addInitScript(()=>{window.AudioContext=undefined;navigator.getGamepads=()=>[];
  localStorage.setItem('super_feka_gaps_controls_v1',JSON.stringify({keys:{jump:['KeyK'],run:['KeyV'],interact:['KeyL']}}));});
 t.after(async()=>{try{assert.deepEqual(errors,[]);await page.evaluate(()=>h.world.dispose());}finally{await context.close();}});
 await page.goto(base+'/journey-fixture');await mapReady(page,'delicia-2');await enter(page,true);
 const before=await page.evaluate(()=>({y:h.app.sim.player.y,save:h.saved(),touch:h.app.root.classList.contains('dl-has-touch')}));
 assert.equal(before.touch,true);
 const state=await key(page,action.code);t.diagnostic(JSON.stringify({action,state}));
 assert.ok(state.down.held.includes(action.held));
 assert.ok(state.stepped.held.includes(action.held),'Changing the touch display cannot erase the initiating keyboard owner.');
 assert.equal(state.stepped.touch,false);assert.equal(state.stepped.focus,'CANVAS');
 if(action.name==='jump')assert.ok(await page.evaluate(()=>h.app.sim.player.y)<before.y,'The first jump actually leaves the floor.');
 else assert.equal(await page.evaluate(()=>h.app.sim.projectiles.filter(p=>p.friendly&&p.kind==='seed').length),1,'One press fires one seed.');
 assert.deepEqual(await saved(page),before.save);
 assert.equal(await page.evaluate(()=>h.app.held.size),0,'Keyup still releases the action.');
});
