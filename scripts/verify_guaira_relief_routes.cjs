// Real chapter controls: Gallery -> Relief -> Other route -> Retry -> Map.
// Keyboard events drive every route. Only the scheduler is controlled at 60 Hz.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const tapes=JSON.parse(fs.readFileSync('tests/helpers/guairaReliefRoutesReplays.json','utf8').replace(/^\uFEFF/,''));
const gallery=JSON.parse(fs.readFileSync('tests/helpers/guairaReadableRoutesReplays.json','utf8')).galeria;
const interval=JSON.parse(fs.readFileSync('tests/helpers/guairaReliefReplay.json','utf8')).interval;
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/relief-routes-2026-10-16/browser');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={kind:'real-chapter-native-keyboard-relief-routes',schedulerControlled:true,stepMs:1000/60,physicalDevice:false,runs:[],errors:[]};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?chapter=guaira',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.mapView);
  await page.evaluate(async()=>window.worldGame.mountChapter('guaira','gallery'));
  async function prepare(){
   await page.waitForSelector('[data-state="playing"]');await page.bringToFront();await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load(g.stage.id);
    window.__reliefProbe={updates:0,contacts:[],minHelmet:Infinity,maxFeet:0};});
  }
  async function play(name,runs,expectedCoins){
   let held=new Set(),frames=0;const decisions=[];
   for(const[count,keys]of runs){
    const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);
    for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;
    await page.evaluate(count=>{const g=window.worldGame,s=window.__reliefProbe;
     for(let i=0;i<count;i++){g.update(1000/60);s.updates++;const p=g.player.data,f=p.position.y+p.height;
      if(p.isDead||!p.hasHelmet)throw Error('Damage at '+s.updates);
      s.minHelmet=Math.min(s.minHelmet,p.position.y-10-g.camera.y);s.maxFeet=Math.max(s.maxFeet,f-g.camera.y);
      if(p.isGrounded&&!s.contacts.includes(Math.round(f)))s.contacts.push(Math.round(f));}
     g.render();s.finished=g.finished;s.coins=g.coins;s.challenge=g.routes?.snapshot;s.reliefOpened=g.reliefOpened;
    },count);frames+=count;
    const expected=name==='opened'?({171:'A tampa está acima',396:'corra até a borda',476:'patamar abaixo à direita',536:'Patamar de saída'})[frames]
     :name==='high'?({409:'corra até a borda',488:'patamar abaixo à direita',548:'Patamar de saída'})[frames]:null;
    if(expected){await page.waitForFunction(text=>document.querySelector('#lab-status')?.textContent.includes(text),expected);
     decisions.push({frame:frames,guidance:await page.locator('#lab-status').textContent()});
     await page.screenshot({path:path.join(out,`${name}-${frames}.png`)});
    }
   }
   for(const k of held)await page.keyboard.up(k);
   const result=await page.evaluate(()=>window.__reliefProbe);assert.equal(result.finished,true);assert.equal(result.coins,expectedCoins);
   assert.ok(result.minHelmet>=23&&result.maxFeet<=172.001);report.runs.push({name,...result,decisions});return result;
  }
  await prepare();await play('gallery',gallery.runs,5);
  await page.waitForFunction(()=>document.querySelector('#chapter-primary')?.getAttribute('aria-label')==='Seguir para a Câmara de Alívio, continuação opcional');
  await page.locator('#chapter-primary').click();await page.waitForFunction(()=>window.worldGame?.stage?.id==='guaira-camara-alivio');
  await prepare();const first=await play('opened',tapes.opened.runs,5);assert.equal(first.reliefOpened,true);
  await page.waitForFunction(()=>document.querySelector('#chapter-primary')?.getAttribute('aria-label')==='Tentar outra rota na Câmara de Alívio');
  await page.locator('#chapter-primary').click();await page.waitForFunction(()=>window.worldGame?.routes?.snapshot.goal==='keep-lid-and-helmet'&&!window.worldGame.finished);
  await prepare();const second=await play('high',tapes.high.runs,5);assert.equal(second.reliefOpened,false);assert.equal(second.challenge.verdict,'met');
  await page.waitForFunction(()=>document.querySelector('#lab-status')?.textContent.includes('Objetivo opcional cumprido'));
  await page.screenshot({path:path.join(out,'high-complete.png')});
  // Retry belongs to the real pause menu, including after an optional finish.
  await page.locator('#game-canvas').focus();await page.keyboard.down('Escape');
  await page.evaluate(()=>{window.worldGame.update(1000/60);window.worldGame.render();});await page.keyboard.up('Escape');
  await page.waitForSelector('[data-state="paused"]');
  await page.locator('#chapter-options').click();
  await page.locator('#chapter-retry').click();await page.waitForFunction(()=>window.worldGame?.routes?.snapshot.goal==='keep-lid-and-helmet'&&!window.worldGame.finished);
  await prepare();const third=await play('interval',interval,0);assert.equal(third.challenge.verdict,'met');
  await page.waitForFunction(()=>document.querySelector('#chapter-primary')?.getAttribute('aria-label')==='Tentar outra rota na Câmara de Alívio');
  await page.locator('#chapter-map-return').click();await page.waitForSelector('.world-map:not([hidden])');
  report.continuation='gallery -> relief -> other-route -> retry -> map';report.passed=true;
  assert.deepEqual(report.errors,[]);await context.close();
 }finally{fs.writeFileSync(path.join(out,'native-browser-verification.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
