/** Real encounter, settings, Input and Chromium accessibility tree. The clock,
 * audio device and gamepad availability are controlled; all storage is isolated. */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<body style="margin:0;background:#14202d"><canvas id="game-canvas" tabindex="0"></canvas>
<script type="module">
import { HypotheticalGame } from '/src/adventure/hipotetico/HypotheticalGame.ts';
import { controlPreferences, DEFAULT_KEYS } from '/src/engine/ControlPreferences.ts';
import { freshSave, SAVE_KEY } from '/src/adventure/progress.ts';
const save=freshSave();save.completed=['1-1'];save.selected='1-2';
localStorage.setItem(SAVE_KEY,JSON.stringify(save));
const stored=()=>Object.fromEntries(Object.keys(localStorage).filter(key=>key!=='super_feka_gaps_controls_v1')
  .sort().map(key=>[key,localStorage.getItem(key)]));
const originalStorage=stored();
const canvas=document.querySelector('canvas'),game=new HypotheticalGame(canvas);
game.status.id='encounter-status';
window.h={game,canvas,controlPreferences,DEFAULT_KEYS,originalStorage,stored,
  step(n=1){for(let i=0;i<n;i++)game.update(1000/60);},
  text(){game.render();return game.status.textContent;}};
h.step(20);h.text();canvas.focus();
</script></body></html>`;

before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  server = await createServer({ root:fileURLToPath(new URL('../', import.meta.url)), configFile:false,
    appType:'custom', server:{host:'127.0.0.1',port:0}, plugins:[{name:'hypothetical-status-bindings', configureServer(vite) {
      vite.middlewares.use('/status-fixture', (_request,response) => {
        response.setHeader('Content-Type','text/html'); response.end(fixture);
      });
    }}] });
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
});
after(async () => {await browser?.close();await server?.close();});

async function setup(t, keys) {
  const context=await browser.newContext({viewport:{width:960,height:640},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    assert.equal(new URL(route.request().url()).origin,base,'Only loopback requests');return route.continue();
  });
  await page.addInitScript(keys=>{
    window.AudioContext=undefined;navigator.getGamepads=()=>[];
    let id=0;window.requestAnimationFrame=()=>++id;window.cancelAnimationFrame=()=>{};
    if(keys)localStorage.setItem('super_feka_gaps_controls_v1',JSON.stringify({keys}));
    localStorage.setItem('unrelated-project-save','untouched');
  },keys);
  t.after(async()=>{try{assert.deepEqual(errors,[]);await page.evaluate(()=>h.game.dispose());}
    finally{await context.close();}});
  await page.goto(base+'/status-fixture');await page.waitForFunction(()=>!!window.h);
  return page;
}
async function sampleKey(page, code) {
  await page.locator('canvas').focus();await page.keyboard.down(code);
  const state=await page.evaluate(()=>{h.game.input.update();return {...h.game.input.getState()};});
  await page.keyboard.up(code);await page.evaluate(()=>h.game.input.update());return state;
}
async function resume(page) {
  await page.evaluate(()=>h.game.render());
  if(await page.evaluate(()=>h.game.state==='paused'))
    await page.getByRole('button',{name:'CONTINUAR',exact:true}).click();
  assert.equal(await page.evaluate(()=>h.game.state),'playing');
  await page.locator('canvas').focus();
}
async function receipt(page, label, extra={}) {
  const text=await page.evaluate(()=>h.text()),session=await page.context().newCDPSession(page);
  let nodes;
  try {
    const {root}=await session.send('DOM.getDocument');
    const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#encounter-status'});
    ({nodes}=await session.send('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:true}));
  } finally {await session.detach();}
  assert.equal(nodes[0].ignored,false);assert.equal(nodes[0].role.value,'status');
  assert.equal(nodes[0].properties.find(p=>p.name==='live').value.value,'polite');
  assert.ok(nodes.some(node=>node.role?.value==='StaticText'&&node.name?.value===text),'Actual accessible status contains the announcement');
  const preserved=await page.evaluate(()=>({before:h.originalStorage,after:h.stored()}));
  assert.deepEqual(preserved.after,preserved.before,'Campaign and unrelated storage are untouched');
  if(process.env.BROWSER_ARTIFACT_DIR){
    await mkdir(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});
    await writeFile(`${process.env.BROWSER_ARTIFACT_DIR}/${label}.json`,JSON.stringify({text,nodes,preserved,...extra},null,2));
    await page.screenshot({path:`${process.env.BROWSER_ARTIFACT_DIR}/${label}.png`});
  }
  return text;
}
function remappedAnnouncement(text) {
  assert.match(text,/H\/L: mover; V: correr; K: pular; B no ar: sentada; P: pausa/);
  assert.doesNotMatch(text,/Setas: mover|Shift: correr|Espaço: pular|Esc: pausa/);
  assert.doesNotMatch(text,/\bSHIFT\b/,'The contextual advice also names the action rather than an inactive key');
  assert.match(text,/Flávio Bolsonaro Hipotético\. Perseguição\./);
  assert.match(text,/\d lacres\./);
  assert.doesNotMatch(text,/Semente|Rebater/,'No unavailable actions are advertised');
}

test('live remapping and restoration update the accessible encounter without replacing its model',async t=>{
  const page=await setup(t);
  await page.evaluate(()=>{h.originalModel=h.game.fight;h.originalPlayer=h.game.player;});
  await page.keyboard.press('F1');await page.evaluate(()=>{h.step();h.game.render();});
  const help=page.locator('#world-controls-help');await help.waitFor({state:'visible'});
  await help.locator('summary').click();
  for(const [action,key]of [['left','KeyH'],['right','KeyL'],['run','KeyV'],['jump','KeyK'],['down','KeyB'],['pause','KeyP']]){
    await help.getByRole('combobox').nth(1).selectOption(action);
    await help.getByRole('button',{name:/^Alterar /}).click();await page.keyboard.press(key);
  }
  await page.keyboard.press('Escape');await help.waitFor({state:'hidden'});
  const oldJump=await sampleKey(page,'Space'),jump=await sampleKey(page,'KeyK');
  const right=await sampleKey(page,'KeyL'),run=await sampleKey(page,'KeyV'),down=await sampleKey(page,'KeyB'),pause=await sampleKey(page,'KeyP');
  assert.equal(oldJump.jump,false);assert.equal(jump.jump,true);assert.equal(jump.jumpPressed,true);
  assert.equal(right.right,true);assert.equal(run.run,true);assert.equal(down.downPressed,true);assert.equal(pause.pause,true);
  const text=await receipt(page,'live-remapped',{oldJump,jump,right,run,down,pause});
  remappedAnnouncement(text);assert.match(text,/R: retomar o trecho/);
  assert.equal(await page.evaluate(()=>h.game.fight===h.originalModel&&h.game.player===h.originalPlayer),true);

  // Real movement consumes the same configured input after changing the announcement.
  await resume(page);
  await page.keyboard.down('KeyK');
  const motion=await page.evaluate(()=>{const before=h.game.player.data.position.y;h.step();return {before,
    after:h.game.player.data.position.y,vy:h.game.player.data.velocity.y,same:h.game.fight===h.originalModel};});
  await page.keyboard.up('KeyK');assert.ok(motion.after<motion.before);assert.ok(motion.vy<0);assert.equal(motion.same,true);

  await page.keyboard.press('F1');await page.evaluate(()=>h.step());await help.waitFor({state:'visible'});
  await help.getByRole('button',{name:'Restaurar padrão',exact:true}).click();
  await page.keyboard.press('Escape');await help.waitFor({state:'hidden'});
  const restored=await receipt(page,'restored',{motion});
  assert.match(restored,/←\/→: mover; Shift esq\.: correr; Espaço: pular; ↓ no ar: sentada; Esc: pausa/);
  assert.match(restored,/R: retomar o trecho/);
  await resume(page);
  assert.equal((await sampleKey(page,'KeyK')).jump,false);assert.equal((await sampleKey(page,'Space')).jump,true);
  assert.deepEqual(await page.evaluate(()=>h.controlPreferences.keys),await page.evaluate(()=>h.DEFAULT_KEYS));
});

test('persisted bindings are announced on first render and secondary R still cannot retry',async t=>{
  const keys={left:['KeyH'],right:['KeyL'],run:['KeyV'],jump:['KeyK','KeyR'],down:['KeyB'],pause:['KeyP']};
  const page=await setup(t,keys);
  await page.evaluate(()=>{h.originalModel=h.game.fight;h.originalPlayer=h.game.player;});
  const primary=await sampleKey(page,'KeyK'),secondary=await sampleKey(page,'KeyR'),old=await sampleKey(page,'Space');
  assert.equal(primary.jump,true);assert.equal(secondary.jump,true);assert.equal(old.jump,false);
  const text=await receipt(page,'persisted',{primary,secondary,old});
  remappedAnnouncement(text);assert.doesNotMatch(text,/R: retomar o trecho/);
  assert.equal(await page.evaluate(()=>h.game.fight===h.originalModel&&h.game.player===h.originalPlayer),true);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('super_feka_gaps_controls_v1')).keys),keys);
  assert.equal(await page.evaluate(()=>{let changes=0;const observer=new MutationObserver(records=>changes+=records.length);
    observer.observe(h.game.status,{childList:true,characterData:true,subtree:true});h.text();h.text();
    changes+=observer.takeRecords().length;observer.disconnect();return changes;}),0,'Unchanged paints do not repeat the live announcement');
});
