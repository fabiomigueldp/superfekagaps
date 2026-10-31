/** Native Classic entry and frame loop in local Chromium. The second case only
 * translates the first authored, non-boss level; its terrain and rules stay the
 * same. Audio devices and RAF time are controlled; physics and input are real.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<style>body{margin:0;background:#171324}canvas{display:block;margin:auto}</style>
<canvas id="game-canvas" tabindex="0"></canvas><script type="module">
import { Game } from '/src/game/Game.ts';
import { ALL_LEVELS } from '/src/data/levels/index.ts';
import { normalizeLevelData } from '/src/world/levelValidation.ts';
import { GameState, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '/src/constants.ts';
import { controlPreferences } from '/src/engine/ControlPreferences.ts';
const offset=new URLSearchParams(location.search).has('shift')?{x:-100,y:-40}:{x:0,y:0};
const data=structuredClone(ALL_LEVELS[0]);
data.originX=(data.originX??0)+offset.x;data.originY=(data.originY??0)+offset.y;
for(const p of [data.playerSpawn,data.goalPosition,...data.checkpoints,
  ...data.enemies.map(e=>e.position),...data.collectibles.map(c=>c.position)]){p.x+=offset.x;p.y+=offset.y;}
for(const t of data.triggers){t.x+=offset.x*TILE_SIZE;t.y+=offset.y*TILE_SIZE;}
if(data.theme?.underground)data.theme.underground.startRow+=offset.y;
ALL_LEVELS[0]=normalizeLevelData(data);
const loadedSource=JSON.stringify(ALL_LEVELS[0]);
let now=1000,id=0;const frames=new Map();
Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
window.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};
window.cancelAnimationFrame=id=>frames.delete(id);
const game=new Game(document.querySelector('canvas'));
game.audio=new Proxy({isEnabled:()=>false},{get:(object,key)=>object[key]??(()=>{})});
game.state=GameState.MENU;
window.h={game,offset,loadedSource,
  storage:()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])),
  keys:()=>structuredClone(controlPreferences.keys),
  source:()=>JSON.stringify(ALL_LEVELS[0]),
  snapshot(){return structuredClone({state:game.state,player:game.player?.getRect(),
    camera:game.camera,levelTime:game.levelTime,totalRunTime:game.totalRunTime,
    width:GAME_WIDTH/(game.camera.zoom||1),height:GAME_HEIGHT/(game.camera.zoom||1)});},
  frame(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(now);},
  follow(){const result=[];for(let i=0;i<40;i++){h.frame(1000/60);result.push(h.snapshot());}return result;}
};game.start();document.querySelector('canvas').focus();
</script></html>`;

before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    appType: 'custom', server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'classic-entry-camera', configureServer(vite) {
      vite.middlewares.use('/entry-fixture', (_request, response) => {
        response.setHeader('Content-Type', 'text/html'); response.end(fixture);
      });
    } }] });
  await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => { await browser?.close(); await server?.close(); });

function visible(frame) {
  const p=frame.player,c=frame.camera;
  return p.x>=c.x && p.x+p.width<=c.x+frame.width && p.y>=c.y && p.y+p.height<=c.y+frame.height;
}

for (const shifted of [false, true]) test(`${shifted ? 'translated' : 'authored'} non-boss level is visible from its first playable frame`, async t => {
  const context=await browser.newContext({viewport:{width:960,height:540},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    assert.equal(new URL(route.request().url()).origin,base,'only local requests');return route.continue();
  });
  await page.addInitScript(()=>{
    window.AudioContext=undefined;navigator.getGamepads=()=>[];
    localStorage.setItem('super_feka_gaps_controls_v1',JSON.stringify({keys:{right:['KeyL'],jump:['KeyK']}}));
    localStorage.setItem('super_feka_gaps_highscore','12345');
    localStorage.setItem('super_feka_gaps_best_time','120.5');
    localStorage.setItem('unrelated-project-save','untouched');
  });
  t.after(async()=>{try{assert.deepEqual(errors,[],'no browser errors');}finally{await context.close();}});
  await page.goto(base+'/entry-fixture'+(shifted?'?shift':''));await page.waitForFunction(()=>!!window.h);
  const before=await page.evaluate(()=>({storage:h.storage(),keys:h.keys(),source:h.source()}));
  await page.keyboard.press('Enter');
  const entry=await page.evaluate(()=>{h.frame(17);return h.snapshot();});
  const label=shifted?'translated':'authored';
  if(process.env.BROWSER_ARTIFACT_DIR){
    await mkdir(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});
    await page.screenshot({path:process.env.BROWSER_ARTIFACT_DIR+'/'+label+'-entry.png'});
  }
  await page.keyboard.down('KeyL');const following=await page.evaluate(()=>h.follow());await page.keyboard.up('KeyL');
  const after=await page.evaluate(()=>({storage:h.storage(),keys:h.keys(),source:h.source()}));
  if(process.env.BROWSER_ARTIFACT_DIR)await writeFile(process.env.BROWSER_ARTIFACT_DIR+'/'+label+'.json',
    JSON.stringify({entry,following,before,after,firstVisible:[entry,...following].findIndex(visible)},null,2));
  assert.equal(entry.state,'PLAYING','Enter used the native menu and level loader');
  assert.equal(entry.totalRunTime,0,'inspect the entry before physics has had time to settle the camera');
  assert.equal(visible(entry),true,'the loaded player must be inside the first playable view');
  assert.equal(entry.camera.targetX,entry.camera.x);assert.equal(entry.camera.targetY,entry.camera.y);
  assert.ok(entry.camera.x>=entry.camera.bounds.minX&&entry.camera.x+entry.width<=entry.camera.bounds.maxX);
  assert.ok(entry.camera.y>=entry.camera.bounds.minY&&entry.camera.y+entry.height<=entry.camera.bounds.maxY);
  assert.ok(following.every(visible),'native tracking keeps the first ordinary movement visible');
  assert.ok(following.at(-1).player.x>entry.player.x+50,'remapped KeyL still moves the native player');
  assert.ok(following.at(-1).totalRunTime>0,'the native fixed-step simulation runs');
  assert.deepEqual(after,before,'loading/tracking preserves source data, saves, records and bindings');
});
