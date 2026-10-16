// Actual chapter input and completion; only the 60 Hz scheduler is controlled.
// Never writes an actor pose, camera, object state, clock, checkpoint or result.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const tapes=JSON.parse(fs.readFileSync('tests/helpers/guairaFieldRoutesReplays.json','utf8').replace(/^\uFEFF/,''));
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/field-routes-2026-10-16/browser');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={kind:'real-chapter-native-keyboard-routes',schedulerControlled:true,stepMs:1000/60,physicalDevice:false,runs:[],errors:[]};
 try{
  for(const route of ['travessia','respiros']){
   const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'/?chapter=guaira',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.mapView);
   await page.evaluate(async stage=>window.worldGame.mountChapter('guaira',stage),'guaira-'+route);
   await page.waitForSelector('[data-state="playing"]');await page.bringToFront();await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load(g.stage.id);
    window.__fieldProbe={updates:0,contacts:[],minHelmet:Infinity,maxFeet:0};});
   let held=new Set(),frames=0;const decisions=[];
   for(const[count,keys]of tapes[route].runs){
    const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);
    for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;
    await page.evaluate(count=>{const g=window.worldGame,s=window.__fieldProbe;
     for(let i=0;i<count;i++){g.update(1000/60);s.updates++;const p=g.player.data,f=p.position.y+p.height;
      if(p.isDead||!p.hasHelmet)throw Error('Damage at '+s.updates);
      s.minHelmet=Math.min(s.minHelmet,p.position.y-10-g.camera.y);s.maxFeet=Math.max(s.maxFeet,f-g.camera.y);
      if(p.isGrounded&&!s.contacts.includes(Math.round(f)))s.contacts.push(Math.round(f));}
     g.render();s.finished=g.finished;s.coins=g.coins;
    },count);frames+=count;
    const expected=route==='travessia'?({429:'Dois percursos',608:'Canal de inspeção'})[frames]
     :({701:'Respiro C isolado',753:'Passarela de inspeção',820:'Mirante seco'})[frames];
    if(expected){await page.waitForFunction(text=>document.querySelector('#lab-status')?.textContent.includes(text),expected);
     decisions.push({frame:frames,guidance:await page.locator('#lab-status').textContent()});
     await page.screenshot({path:path.join(out,`${route}-${frames}.png`)});}
   }
   for(const k of held)await page.keyboard.up(k);
   const result=await page.evaluate(()=>window.__fieldProbe);
   assert.equal(result.updates,tapes[route].frames);assert.equal(result.finished,true);assert.equal(result.coins,route==='travessia'?14:7);
   assert.ok(result.minHelmet>=23&&result.maxFeet<=172.01);
   await page.waitForFunction(()=>document.querySelector('#chapter-primary')?.getAttribute('aria-label')==='Continuar a jornada pelo mapa');
   await page.screenshot({path:path.join(out,route+'-complete.png')});await page.locator('#chapter-primary').click();
   await page.waitForSelector('.world-map:not([hidden])');
   report.runs.push({route,...result,decisions,chapterAcceptedCompletion:true,continuedTo:'map'});await context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'native-browser-verification.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
