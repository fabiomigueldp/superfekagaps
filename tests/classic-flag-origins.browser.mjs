/** Local Chromium check: native Classic flags, Input, movement and death/clear
 * pipeline on a validated, flat level. Only the level, lethal hit, clock and
 * audio device are controlled; no campaign boss or remote service is used.
 * PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/usr/bin/chromium
 * node --test tests/classic-flag-origins.browser.mjs
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
import { Level } from '/src/world/Level.ts';
import { Player } from '/src/entities/Player.ts';
import { normalizeLevelData } from '/src/world/levelValidation.ts';
import { GameState, TileType, TILE_SIZE, TIME_BONUS_MULTIPLIER } from '/src/constants.ts';
import { controlPreferences } from '/src/engine/ControlPreferences.ts';
import { DATA as first } from '/src/data/levels/level_0_world1-1.ts';
import { DATA as second } from '/src/data/levels/level_1_world1-2.ts';
const canvas=document.querySelector('canvas'), game=new Game(canvas), transitions=[];
game.audio=new Proxy({onStateChange:(from,to)=>transitions.push([from,to]),isEnabled:()=>false},
  {get:(object,key)=>object[key]??(()=>{})});
const rawStorage=()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
const STEP=1000/60;
window.h={game,transitions,rawStorage,TILE_SIZE,TIME_BONUS_MULTIPLIER,
  authoredFlags:[first,second].map(data=>game.buildFlags(data)),
  keys:()=>structuredClone(controlPreferences.keys),
  setup(originX,originY,floorRow=12){
    const x=originX??0,y=originY??0;
    const data=normalizeLevelData({id:'flag-origin-fixture',name:'Bandeiras e origem',width:40,height:16,
      ...(originX===null?{}:{originX}),...(originY===null?{}:{originY}),
      tiles:Array.from({length:16},(_,row)=>Array(40).fill(row>=floorRow?TileType.GROUND:TileType.EMPTY)),
      playerSpawn:{x:x+4,y:y+floorRow},checkpoints:[{x:x+8,y:y+floorRow}],
      goalPosition:{x:x+20,y:y+floorRow},enemies:[],collectibles:[],triggers:[],timeLimit:180,isBossLevel:false});
    game.level=new Level(data);game.player=new Player(data.playerSpawn.x,data.playerSpawn.y);
    game.flags=game.buildFlags(data);game.minions=[];game.boss=null;game.collectibles=[];
    game.levelTime=data.timeLimit;game.state=GameState.PLAYING;
    Object.assign(game.camera,{bounds:game.level.getBounds(),zoom:1,x:x*TILE_SIZE,y:(y+floorRow)*TILE_SIZE-150});
    game.renderer.prepareLevelBackground(data.theme);
    return {data:structuredClone(data),flags:structuredClone(game.flags)};
  },
  snapshot(){return structuredClone({state:game.state,player:game.player.data,flags:game.flags,
    checkpoint:game.activeCheckpoint,score:game.score,lives:game.lives,levelTime:game.levelTime});},
  walkTo(x){let frames=0;while(game.state===GameState.PLAYING&&game.player.data.position.x<x&&frames<240){
    game.update(STEP);frames++;}game.render();return {frames,...h.snapshot()};},
  dieAndRecover(){game.player.die('hit');let frames=0;
    while((game.player.data.isDead||game.player.data.respawnRevealTimer>0)&&frames<240){game.update(STEP);frames++;}
    return {frames,...h.snapshot()};},
  settle(){for(let n=0;n<8;n++)game.update(STEP);game.render();return h.snapshot();}
};canvas.focus();
</script></html>`;

before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    appType: 'custom', server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'classic-flag-origins', configureServer(vite) {
      vite.middlewares.use('/flag-fixture', (_request, response) => {
        response.setHeader('Content-Type', 'text/html'); response.end(fixture);
      });
    } }] });
  await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    assert.equal(new URL(route.request().url()).origin, base, 'all requests stay on the local fixture');
    return route.continue();
  });
  await page.addInitScript(() => {
    window.AudioContext = undefined; navigator.getGamepads = () => [];
    localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { right: ['KeyL'], jump: ['KeyK'], run: ['KeyV'] } }));
    localStorage.setItem('super_feka_gaps_highscore', '12345');
    localStorage.setItem('super_feka_gaps_best_time', '120.5');
    localStorage.setItem('unrelated-project-save', 'untouched');
  });
  t.after(async () => { try { assert.deepEqual(errors, [], 'no browser exceptions'); } finally { await context.close(); } });
  await page.goto(base + '/flag-fixture'); await page.waitForFunction(() => !!window.h);
  return page;
}

for (const [name, originX, originY] of [['default', null, null], ['negative', -5, -20], ['positive', 7, 10]]) {
  test(`${name} origin: walk through checkpoint, respawn there, and finish once with remapped input`, async t => {
    const page = await setup(t);
    const initial = await page.evaluate(([x, y]) => ({ ...h.setup(x, y), storage: h.rawStorage(), keys: h.keys(), authored: h.authoredFlags }), [originX, originY]);
    const checkpoint = initial.data.checkpoints[0];
    await page.keyboard.down('KeyL');
    const crossed = await page.evaluate(x => h.walkTo(x), (checkpoint.x + .5) * 16);
    await page.keyboard.up('KeyL');
    if (process.env.BROWSER_ARTIFACT_DIR) {
      await mkdir(process.env.BROWSER_ARTIFACT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${name}-checkpoint.png` });
    }
    const respawned = await page.evaluate(() => h.dieAndRecover());
    await page.keyboard.down('KeyL');
    const finish = await page.evaluate(x => h.walkTo(x), (initial.data.goalPosition.x + .5) * 16);
    await page.keyboard.up('KeyL');
    const after = await page.evaluate(() => ({ ...h.settle(), storage: h.rawStorage(), keys: h.keys(), transitions: h.transitions,
      data: structuredClone(h.game.level.data), bonus: h.TIME_BONUS_MULTIPLIER }));
    if (process.env.BROWSER_ARTIFACT_DIR) await writeFile(`${process.env.BROWSER_ARTIFACT_DIR}/${name}.json`,
      JSON.stringify({ initial, crossed, respawned, finish, after }, null, 2));
    assert.ok(crossed.frames > 0 && crossed.frames < 240, 'native remapped movement reaches the checkpoint');
    assert.deepEqual(crossed.checkpoint, checkpoint, 'touching the visible flag activates its checkpoint');
    assert.notEqual(crossed.flags[0].state, 'inactive');
    assert.equal(crossed.score, 0);
    assert.ok(respawned.frames > 0 && respawned.frames < 240, 'native death and reveal finish');
    assert.equal(respawned.lives, crossed.lives - 1);
    assert.equal(respawned.player.isDead, false);
    assert.equal(respawned.player.position.x, checkpoint.x * 16);
    assert.equal(respawned.player.position.y + respawned.player.height, checkpoint.y * 16);
    assert.equal(finish.state, 'LEVEL_CLEAR', 'touching the visible goal completes the level');
    assert.equal(finish.score, Math.floor(finish.levelTime) * after.bonus);
    assert.equal(after.score, finish.score, 'continuing updates cannot award the time bonus twice');
    assert.deepEqual(after.transitions, [['PLAYING', 'LEVEL_CLEAR']]);
    assert.deepEqual(after.data, initial.data, 'the authored level is not modified');
    assert.deepEqual(after.storage, initial.storage, 'saves, records, controls and other keys are unchanged');
    assert.deepEqual(after.keys, initial.keys);
  });
}

test('flag contact areas stay within an offset map at its upper edge', async t => {
  const page = await setup(t);
  const { flags, data } = await page.evaluate(() => h.setup(-3, -6, 1));
  const top = data.originY * 16;
  assert.equal(flags[0].trigger.y, top);
  assert.equal(flags[1].trigger.y, top, 'the two-tile goal is clipped against the map origin');
  assert.equal(flags[0].anchor.y, top + 16);
  assert.equal(flags[1].anchor.y, top + 16);
});
