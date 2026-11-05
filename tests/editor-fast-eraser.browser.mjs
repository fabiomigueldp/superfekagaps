import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

const fixture = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(
  '<script type="module" src="/src/main.ts"></script>', `<script type="module">
import { EditorController } from '/src/editor/EditorController.ts';
import { Renderer } from '/src/engine/Renderer.ts';
import { TileType } from '/src/constants.ts';
import { EditorTool, TriggerType, CollectibleType, EnemyType } from '/src/types.ts';
import { CAMPAIGN_LEVELS } from '/src/data/levels/index.ts';
const canvas = document.getElementById('game-canvas');
const source = JSON.stringify(CAMPAIGN_LEVELS);
const editor = new EditorController(canvas, new Renderer(canvas)); editor.init();
const storage = () => JSON.stringify({...localStorage});
const saved = storage();
function point(x,y,type) { const r=canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type,{clientX:r.left+x,clientY:r.top+y,
    button:0,buttons:type==='pointerup'?0:1,pointerId:1,bubbles:true})); }
window.h = { run(kind) {
  const data=editor.createBlankLevel();
  for(const row of data.tiles) row.fill(TileType.BRICK);
  const zone={id:'zone',type:TriggerType.DIALOG,x:32,y:80,width:64,height:16,active:true,oneShot:false,text:'test'};
  const ranks=['trigger','coin','checkpoint','enemy']; const rank=ranks.indexOf(kind);
  if(rank>=0) {
    if(rank===0)data.triggers=[{...zone,id:'lower'},zone];
    if(rank<=1)data.collectibles=[{type:CollectibleType.COIN,position:{x:2,y:5}}];
    if(rank<=2)data.checkpoints=[{x:2,y:5}];
    data.enemies=[{type:EnemyType.MINION,position:{x:2,y:6}}];
    data.goalPosition={x:2,y:5};
  }
  if(kind==='hidden')data.triggers=[zone];
  if(kind==='goal')data.goalPosition={x:6,y:5};
  document.querySelector('[data-tab="'+(kind==='trigger'?'tab-logic':'tab-tiles')+'"]').click();
  editor.loadLevel(data,'',false,true); editor.camera.x=editor.camera.y=0; editor.zoom=1;
  editor.setTool(EditorTool.ERASER);
  const before=JSON.stringify(editor.levelData);
  const start=kind==='reverse'?12:2, end=kind==='reverse'?2:12;
  point(start*16+8,88,'pointerdown');
  point(end*16+8,kind==='diagonal'?168:88,'pointermove');
  point(end*16+8,kind==='diagonal'?168:88,kind==='cancel'?'pointercancel':'pointerup');
  const after=structuredClone(editor.levelData), changed=JSON.stringify(after);
  const dragging=editor.isDragging;
  point(232,88,'pointermove');
  const stopped=JSON.stringify(editor.levelData)===changed;
  editor.restoreHistory(false); const undo=JSON.stringify(editor.levelData)===before, extraUndo=editor.history.canUndo;
  editor.restoreHistory(true); const redo=JSON.stringify(editor.levelData)===changed;
  return {kind,after,undo,redo,extraUndo,dragging,stopped,
    saves:storage()===saved,source:JSON.stringify(CAMPAIGN_LEVELS)===source};
} };
</script>`);

test('fast eraser bridges tile gaps without peeling protected object layers and records one undo per gesture', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,
    appType:'custom',server:{host:'127.0.0.1',port:0},plugins:[{name:'fast-eraser',configureServer(vite){
      vite.middlewares.use('/eraser-fixture',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(fixture);});
    }}]});
  t.after(()=>server.close()); await server.listen();
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
  t.after(()=>browser.close()); const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('eraser-save-sentinel','preserved'));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/eraser-fixture');await page.waitForFunction(()=>!!window.h);
  const cases=[];
  for(const kind of ['forward','reverse','diagonal','cancel','trigger','coin','checkpoint','enemy','hidden','goal'])
    cases.push(await page.evaluate(kind=>h.run(kind),kind));
  t.diagnostic(JSON.stringify(cases.map(({kind,after,undo,redo,extraUndo,dragging})=>({kind,row:after.tiles[5].slice(2,13),
    layers:[after.triggers.length,after.collectibles.length,after.checkpoints.length,after.enemies.length],undo,redo,extraUndo,dragging}))));
  for(const result of cases) {
    const {kind,after}=result;
    assert.equal(result.undo,true);assert.equal(result.redo,true);assert.equal(result.extraUndo,false);
    assert.equal(result.dragging,false);assert.equal(result.stopped,true);assert.equal(result.saves,true);assert.equal(result.source,true);
    if(kind==='diagonal') {
      for(let col=2;col<=12;col++) assert.equal(after.tiles[5+Math.floor((col-2)/2)][col],0,'diagonal tile '+col);
    } else {
      const first=['trigger','coin','checkpoint','enemy'].includes(kind)?(kind==='trigger'?6:3):2;
      for(let col=first;col<=12;col++) if(!(kind==='goal'&&col===6))assert.equal(after.tiles[5][col],0,kind+' tile '+col);
    }
    const expected={trigger:[1,1,1,1],coin:[0,0,1,1],checkpoint:[0,0,0,1],enemy:[0,0,0,0],hidden:[1,0,0,0]};
    if(expected[kind])assert.deepEqual([after.triggers.length,after.collectibles.length,after.checkpoints.length,after.enemies.length],expected[kind]);
    if(['trigger','coin','checkpoint','enemy'].includes(kind))assert.notEqual(after.tiles[5][2],0,'no newly exposed tile is erased');
    if(kind==='trigger')for(let col=2;col<6;col++)assert.notEqual(after.tiles[5][col],0,'removed region remains protected for this gesture');
    if(kind==='goal'){assert.deepEqual(after.goalPosition,{x:6,y:5});assert.notEqual(after.tiles[5][6],0);}
  }
  assert.deepEqual(errors,[]);
});
