// All eight scenes in isolated browser saves. Each opening is mounted for
// inspection; subsequent scenes use the ordinary map and optional continuation.
// Ordinary keyboard events drive each level; only the simulation scheduler is held at 60 Hz.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync('tests/helpers/'+name+'.json','utf8').replace(/^\uFEFF/,''));
const field=read('guairaFieldRoutesReplays'),routes=read('guairaReadableRoutesReplays');
const rooftop=process.env.GUAIRA_ASCENT_ROUTE==='roof';
const stages=[
 ['guaira-travessia','Travessia da Vala Seca',field.travessia,14,'Passagem dos Respiros'],
 ['guaira-respiros','Passagem dos Respiros',field.respiros,7,'Ossabravo espera'],
 ['guaira-lab','Ossabravo',read('guairaLabReplay'),0,'Suba à Casa'],
 ['guaira-subida','Subida à Casa da Vazão',rooftop?read('guairaRooftopReplay'):routes.subida,rooftop?12:7,'enfrente o Prefeito'],
 ['guaira-prefeito','Prefeito da Vazão',read('guairaMayorReplay'),0,'Ramal público aberto']
];
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/chapter-readability-2026-10-16/browser');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={kind:'native-campaign-eight-scenes-complete-keyboard-routes',openingsMountedForInspection:true,followingEntries:'ordinary map walking and optional continuation',stepMs:1000/60,physicalDevice:false,checks:[],errors:[]};
 try{
  async function fresh(){const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
   page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'/?chapter=guaira',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.mapView);return{context,page};}
  async function enter(page,title){
   await page.waitForSelector('.world-map:not([hidden])');
   await page.getByRole('button',{name:new RegExp('^(Fase \\d+|Entrada alternativa|Desvio opcional): '+escape(title)+'\\.')}).click();
   const travel=page.getByRole('button',{name:'Viajar: '+title,exact:true});
   if(await travel.isVisible())await travel.click();
   // No skip/teleport: Feka must arrive before the normal entry action exists.
   await page.getByRole('button',{name:new RegExp('^(Entrar|Jogar): '+escape(title)+'$')}).click({timeout:30000});
   await page.waitForSelector('[data-state="playing"]');
  }
  async function play(page,id,tape,coins,message){
   await page.bringToFront();await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load(g.stage.id);window.__guairaReadability={frames:0,minHead:Infinity,maxFeet:0};});
   let held=new Set();
   for(const[count,keys]of [[tape.initialSettleFrames||0,[]],...tape.runs]){
    const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);
    for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;
    await page.evaluate(n=>{const g=window.worldGame,s=window.__guairaReadability;
     for(let i=0;i<n;i++){g.update(1000/60);s.frames++;const p=g.player.data;
      if(p.isDead||!p.hasHelmet)throw Error('damage at '+g.stage.id+':'+s.frames);
      s.minHead=Math.min(s.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
      s.maxFeet=Math.max(s.maxFeet,p.position.y+p.height-g.camera.y);}
     g.render();
    },count);
   }
   for(const k of held)await page.keyboard.up(k);
   if(message)await page.waitForFunction(text=>document.querySelector('#lab-status')?.textContent.includes(text),message);
   const state=await page.evaluate(()=>{const g=window.worldGame;return{...window.__guairaReadability,id:g.stage.id,coins:g.coins,
    finished:g.finished??g.mayor?.publicWaterOpen??(g.boss?.phase==='defeated'),status:document.querySelector('#lab-status')?.textContent};});
   assert.equal(state.id,id);assert.equal(state.finished,true);assert.equal(state.coins,coins);assert.ok(state.minHead>=23&&state.maxFeet<=172.01);
   await page.screenshot({path:path.join(out,id+'-complete.png')});report.checks.push(state);console.log(id+' completed ('+state.frames+' updates)');
  }
  const {context,page}=await fresh();
  for(let i=0;i<stages.length;i++){
   const [id,title,tape,coins,message]=stages[i];
   if(i===0){await page.evaluate(async()=>window.worldGame.mountChapter('guaira','guaira-travessia'));await page.waitForSelector('[data-state="playing"]');}
   else await enter(page,title);
   await play(page,id,tape,coins,message);
   await page.locator('#chapter-primary').click();await page.waitForSelector('.world-map:not([hidden])');
   const completed=await page.evaluate(()=>window.worldGame.store.save.guaira.completed);
   assert.deepEqual(completed,stages.slice(0,i+1).map(x=>x[0]));
  }
  await page.screenshot({path:path.join(out,'chapter-map-complete.png')});
  await enter(page,'Galeria dos Remendos');await play(page,'guaira-galeria',routes.galeria,5,'Acesso à Câmara de Alívio aberto');
  await page.locator('#chapter-primary').click();await page.waitForFunction(()=>window.worldGame?.stage?.id==='guaira-camara-alivio');
  await play(page,'guaira-camara-alivio',read('guairaReliefRoutesReplays').high,5,null);
  await page.waitForFunction(()=>document.querySelector('#chapter-primary')?.getAttribute('aria-label')==='Tentar outra rota na Câmara de Alívio');
  await page.locator('#chapter-map-return').click();await page.waitForSelector('.world-map:not([hidden])');
  assert.equal(await page.evaluate(()=>window.worldGame.store.save.guaira.completed.length),5,'optional rooms preserve main receipts');
  await context.close();
  const alternative=await fresh();await alternative.page.evaluate(async()=>window.worldGame.mountChapter('guaira','guaira-patio-comportas'));
  await alternative.page.waitForSelector('[data-state="playing"]');
  await play(alternative.page,'guaira-patio-comportas',read('guairaJunctionOptionalReplay'),3,'Passagem dos Respiros');
  await alternative.page.locator('#chapter-primary').click();await alternative.page.waitForSelector('.world-map:not([hidden])');
  assert.deepEqual(await alternative.page.evaluate(()=>window.worldGame.store.save.guaira.completed),['guaira-patio-comportas']);
  await alternative.context.close();assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({passed:report.passed,scenes:report.checks.length,errors:report.errors}));
})().catch(e=>{console.error(e);process.exitCode=1});
