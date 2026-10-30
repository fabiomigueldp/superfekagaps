/** Loopback only: real campaign map/host/native completion/return with a prepared final segment.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/guaira-map-return-progress.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
let browser, server, base;
const fixture=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><canvas id="game-canvas" tabindex="0"></canvas><script type="module">
import '/src/adventure/map.css';
import { WorldGame } from '/src/adventure/WorldGame.ts';
import { freshSave, SAVE_KEY } from '/src/adventure/progress.ts';
import { GUAIRA_TRAVERSAL } from '/src/adventure/experimental/guaira/GuairaTraversal.ts';
import { GUAIRA_COURSES } from '/src/adventure/experimental/guaira/GuairaCourseDesign.ts';
const initial=freshSave();initial.completed=['3-5'];initial.selected='3-5';
initial.times={'3-5':80};initial.seals=['1-1:s1'];initial.preferences={music:.2,effects:.4,voice:.3,shake:false};
if(!localStorage.getItem(SAVE_KEY))localStorage.setItem(SAVE_KEY,JSON.stringify(initial));
const world=new WorldGame(document.querySelector('canvas'));
world.openChapterMap('guaira');world.mapView.markGuairaArrival();world.mapView.openChapter('guaira');world.start();
window.h={world,initial,get view(){return world.mapView;},get game(){return window.worldGame;},
 saved(){return JSON.parse(localStorage.getItem(SAVE_KEY));},raw(){return localStorage.getItem(SAVE_KEY);},
 snapshot(){return {selected:h.view.chapterStages[h.view.chapterIndex].id,journey:h.view.guairaJourney,
 stages:h.view.chapterStages.map(s=>({id:s.id,open:s.open,completed:s.completed})),status:h.view.hud.status.textContent,
 focus:document.activeElement.getAttribute('aria-label'),active:world.chapterActive,
 saved:h.saved().guaira,cacheSame:h.view.save===world.store.save,cache:h.view.save.guaira};},
 prepare(){const game=h.game;game.running=false;game.cancelFrame();
   // Only the native attempt is prepared: a valid late checkpoint restores solved bridges.
   game.store.save.checkpoint={stage:GUAIRA_TRAVERSAL.id,index:game.stage.checkpoints.length-1,helmet:true};
   game.load(GUAIRA_TRAVERSAL.id,true);
   Object.assign(game.player.data.position,{x:GUAIRA_TRAVERSAL.finishX-16,y:GUAIRA_COURSES.travessia.floor-game.player.data.height});
   Object.assign(game.player.data.velocity,{x:0,y:0});
   game.player.data.isGrounded=true;
   return {checkpoint:game.store.save.checkpoint,position:{...game.player.data.position},
     finished:game.finished,bridgeReady:game.bridgeReady,finalBridgeReady:game.finalBridgeReady,alive:!game.player.data.isDead};
 },
};
</script></body></html>`;
before(async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,appType:'custom',server:{host:'127.0.0.1',port:0},plugins:[{name:'guaira-return-boundary',configureServer(vite){vite.middlewares.use('/return-fixture',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(fixture);});}}]});
 await server.listen();base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
});
after(async()=>{await browser?.close();await server?.close();});
test('native Guaira completion returns to the next unlocked map doorway using the persisted save',async t=>{
 const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,base);return route.continue();});
 await page.addInitScript(()=>{window.AudioContext=undefined;navigator.getGamepads=()=>[];
  if(!localStorage.getItem('super_feka_gaps_controls_v1'))localStorage.setItem('super_feka_gaps_controls_v1',JSON.stringify({keys:{right:['KeyL'],jump:['KeyK'],run:['KeyV']}}));
  if(!localStorage.getItem('unrelated-project-save'))localStorage.setItem('unrelated-project-save','untouched');});
 t.after(async()=>{try{assert.deepEqual(errors,[]);await page.evaluate(()=>h.world.dispose());}finally{await context.close();}});
 await page.goto(base+'/return-fixture');
 await page.waitForFunction(()=>window.h&&!h.world.chapterActive&&h.view.guairaJourney.arrived==='guaira-travessia'&&!h.view.hud.enterButton.disabled);
 const initial=await page.evaluate(()=>h.snapshot()),unrelated=await page.evaluate(()=>{const save=h.saved();delete save.guaira;return {save,controls:localStorage.getItem('super_feka_gaps_controls_v1'),sentinel:localStorage.getItem('unrelated-project-save')};});
 assert.deepEqual(initial.saved.completed,[]);assert.equal(initial.stages.find(s=>s.id==='guaira-respiros').open,false);
 await page.getByRole('button',{name:'Jogar: Travessia da Vala Seca',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>h.world.chapterActive&&h.game!==h.world&&h.game.stage.id==='guaira-travessia'&&!document.querySelector('.world-chapter-loading'));
 const prepared=await page.evaluate(()=>h.prepare());assert.equal(prepared.finished,false);assert.equal(prepared.alive,true);
 assert.equal(prepared.bridgeReady,true);assert.equal(prepared.finalBridgeReady,true);
 await page.locator('.world-chapter-host #game-canvas').focus();await page.keyboard.down('KeyL');
 const reached=await page.evaluate(()=>{let frames=0;while(!h.game.finished&&frames<120){h.game.update(1000/60);frames++;}return {frames,finished:h.game.finished,alive:!h.game.player.data.isDead,x:h.game.player.data.position.x};});
 await page.keyboard.up('KeyL');assert.equal(reached.finished,true);assert.equal(reached.alive,true);assert.ok(reached.frames<120);
 await page.waitForFunction(()=>h.saved().guaira.completed.includes('guaira-travessia'));
 const completed=await page.evaluate(()=>{h.native=h.game;return h.snapshot();});
 assert.equal(completed.saved.selectedScene,'guaira-respiros');assert.equal(completed.saved.resumeScene,'guaira-travessia');
 await page.getByRole('button',{name:'Continuar a jornada pelo mapa',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!h.world.chapterActive&&document.querySelectorAll('.world-chapter-host').length===0);
 await page.evaluate(()=>h.world.render());
 const returned=await page.evaluate(()=>h.snapshot());
 const proof={initial,prepared,reached,completed,returned};
 t.diagnostic(JSON.stringify({prepared,reached,returned}));
 if(process.env.BROWSER_ARTIFACT_DIR){
  writeFileSync(process.env.BROWSER_ARTIFACT_DIR+'/observations.json',JSON.stringify(proof,null,2));
  await page.screenshot({path:process.env.BROWSER_ARTIFACT_DIR+'/returned.png'});
 }
 assert.equal(returned.selected,'guaira-respiros','The completed native stage recommends its newly unlocked next doorway');
 assert.equal(returned.journey.arrived,'guaira-respiros');assert.equal(returned.journey.entered,null);
 assert.equal(returned.saved.resumeScene,null);assert.deepEqual(returned.saved.completed,['guaira-travessia']);
 assert.equal(returned.stages.find(s=>s.id==='guaira-travessia').completed,true);
 assert.equal(returned.stages.find(s=>s.id==='guaira-respiros').open,true);
 assert.equal(returned.focus,'Jogar: Passagem dos Respiros');assert.equal(await page.evaluate(()=>h.native.isDisposed),true);
 const raw=await page.evaluate(()=>h.raw());
 await page.reload();await page.waitForFunction(()=>window.h&&h.view.guairaJourney?.arrived==='guaira-respiros');
 assert.equal(await page.evaluate(()=>h.raw()),raw);assert.equal((await page.evaluate(()=>h.snapshot())).selected,'guaira-respiros');
 assert.deepEqual(await page.evaluate(()=>{const save=h.saved();delete save.guaira;return {save,controls:localStorage.getItem('super_feka_gaps_controls_v1'),sentinel:localStorage.getItem('unrelated-project-save')};}),unrelated);
});
