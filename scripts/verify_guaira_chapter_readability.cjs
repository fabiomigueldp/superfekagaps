// All eight scenes in isolated browser saves. Each opening is mounted for
// inspection; subsequent scenes use the ordinary map and optional continuation.
// Ordinary keyboard events drive each level; only the simulation scheduler is held at 60 Hz.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync('tests/helpers/'+name+'.json','utf8').replace(/^\uFEFF/,''));
const field=read('guairaFieldRoutesReplays'),routes=read('guairaReadableRoutesReplays');
const rooftop=process.env.GUAIRA_ASCENT_ROUTE==='roof';
const normalCampaign=process.env.GUAIRA_NORMAL_CAMPAIGN==='1';
const gamepad=process.env.GUAIRA_GAMEPAD==='1';
const stages=[
 ['guaira-travessia','Travessia da Vala Seca',field.travessia,field.travessia.coins,'Passagem dos Respiros'],
 ['guaira-respiros','Passagem dos Respiros',field.respiros,field.respiros.coins,'Ossabravo espera'],
 ['guaira-lab','Ossabravo',read('guairaLabReplay'),0,'Suba à Casa'],
 ['guaira-subida','Subida à Casa da Vazão',rooftop?read('guairaRooftopReplay'):routes.subida,rooftop?read('guairaRooftopReplay').coins:routes.subida.coins,'enfrente o Prefeito'],
 ['guaira-prefeito','Prefeito da Vazão',read('guairaMayorReplay'),0,'Ramal público aberto']
];
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/chapter-readability-2026-10-16/browser');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={kind:'native-campaign-eight-scenes-complete-'+(gamepad?'standard-gamepad':'keyboard')+'-routes',normalCampaign,openingsMountedForInspection:!normalCampaign,followingEntries:'ordinary map walking and optional continuation',mapSelection:'native phase buttons',entryAndCompletion:gamepad?'standard Gamepad API confirm':'native buttons',stepMs:1000/60,physicalDevice:false,checks:[],entries:[],errors:[]};
 try{
  async function fresh(){const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
   page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
   if(gamepad)await page.addInitScript(()=>{
    window.__guairaPad={index:0,id:'Guaíra browser verification',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__guairaPad]});
   });
   if(normalCampaign)await page.addInitScript(()=>{
    // Isolated test profile: prerequisites stop at the end of Factory. No Guaíra
    // receipt, legacy Serra access or development flag is injected.
    if(!localStorage.getItem('super_feka_gaps_world_v1'))localStorage.setItem('super_feka_gaps_world_v1',JSON.stringify({version:1,
     completed:Array.from({length:15},(_,i)=>`${Math.floor(i/5)+1}-${i%5+1}`),selected:'3-5',seals:[],secrets:[],seen:[],times:{},checkpoint:null,
     preferences:{music:0,effects:0,voice:0,shake:false},guaira:{version:1,opening:'guaira-travessia',completed:[],selectedScene:'guaira-travessia',resumeScene:null,optional:{gallery:false,relief:false},audioEnabled:false}}));
   });
   await page.goto(base+'/?chapter=guaira',{waitUntil:'domcontentloaded',timeout:45000});await page.waitForFunction(()=>window.worldGame?.mapView,{},{timeout:60000});
   if(normalCampaign)assert.equal(await page.evaluate(async()=>{const d=await import('/src/adventure/DevelopmentProgress.ts');return d.hasDevelopmentAccess(window.worldGame.store.save);}),false,'run against a VITE_DEVELOPMENT_UNLOCKED_SAVE=false server');
   return{context,page};}
  async function activate(page,button){
   if(!gamepad){await button.click();return;}
   await button.focus();
   await page.evaluate(()=>{const p=window.__guairaPad,g=window.worldGame;p.buttons.forEach(b=>{b.pressed=false;b.value=0;});g.update(1000/60);p.buttons[0].pressed=true;p.buttons[0].value=1;g.update(1000/60);});
  }
  async function enter(page,title){
   await page.waitForSelector('.world-map:not([hidden])');
   await page.evaluate(()=>{
    window.__guairaWalk=[];clearInterval(window.__guairaWalkTimer);
    window.__guairaWalkTimer=setInterval(()=>{const j=window.worldGame?.mapView?.guairaJourney;
     if(j?.point)window.__guairaWalk.push({x:j.point.x,y:j.point.y,arrived:j.arrived,destination:j.destination,entered:j.entered});},30);
   });
   await page.getByRole('button',{name:new RegExp('^(Fase \\d+|Entrada alternativa|Desvio opcional): '+escape(title)+'\\.')}).click();
   const travel=page.getByRole('button',{name:'Viajar: '+title,exact:true});
   if(await travel.isVisible())await activate(page,travel);
   // No skip/teleport: Feka must arrive before the normal entry action exists.
   const entry=page.getByRole('button',{name:new RegExp('^(Entrar|Jogar): '+escape(title)+'$')});
   await entry.waitFor({state:'visible',timeout:30000});await activate(page,entry);
   await page.waitForSelector('[data-state="playing"]');
   const walk=await page.evaluate(()=>{clearInterval(window.__guairaWalkTimer);return window.__guairaWalk;});
   report.entries.push({title,samples:walk.length,positions:new Set(walk.map(p=>`${p.x},${p.y}`)).size,walk});
   assert.ok(walk.length&&walk.some(p=>!p.destination),'entry follows an actual map arrival');
  }
  async function play(page,id,tape,coins,message){
   await page.bringToFront();await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load(g.stage.id);window.__guairaReadability={frames:0,minHead:Infinity,maxFeet:0};});
   if(gamepad)await page.evaluate(()=>{window.__guairaPad.buttons.forEach(b=>{b.pressed=false;b.value=0;});window.worldGame.update(1000/60);});
   let held=new Set();
   for(const[count,keys]of [[tape.initialSettleFrames||0,[]],...tape.runs]){
    if(gamepad)await page.evaluate(keys=>{const map={ArrowLeft:14,ArrowRight:15,ArrowDown:13,ShiftLeft:2,Space:0},pressed=keys.map(k=>{if(!(k in map))throw Error('unknown controller input '+k);return map[k];});window.__guairaPad.buttons.forEach((b,i)=>{b.pressed=pressed.includes(i);b.value=b.pressed?1:0;});},keys);
    else {const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);
     for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}
    await page.evaluate(n=>{const g=window.worldGame,s=window.__guairaReadability;
     for(let i=0;i<n;i++){g.update(1000/60);s.frames++;const p=g.player.data;
      if(p.isDead||!p.hasHelmet)throw Error('damage at '+g.stage.id+':'+s.frames);
      s.minHead=Math.min(s.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
      s.maxFeet=Math.max(s.maxFeet,p.position.y+p.height-g.camera.y);}
     g.render();
    },count);
   }
   for(const k of held)await page.keyboard.up(k);
   if(gamepad)await page.evaluate(()=>{window.__guairaPad.buttons.forEach(b=>{b.pressed=false;b.value=0;});});
   if(message)await page.waitForFunction(text=>document.querySelector('#lab-status')?.textContent.includes(text),message);
   const state=await page.evaluate(()=>{const g=window.worldGame;return{...window.__guairaReadability,id:g.stage.id,coins:g.coins,
    finished:g.finished??g.mayor?.publicWaterOpen??(g.boss?.phase==='defeated'),status:document.querySelector('#lab-status')?.textContent};});
   assert.equal(state.id,id);assert.equal(state.finished,true);assert.equal(state.coins,coins);assert.ok(state.minHead>=23&&state.maxFeet<=172.01);
   await page.screenshot({path:path.join(out,id+'-complete.png')});report.checks.push(state);console.log(id+' completed ('+state.frames+' updates)');
  }
  const {context,page}=await fresh();
  for(let i=0;i<stages.length;i++){
   const [id,title,tape,coins,message]=stages[i];
   if(i===0&&!normalCampaign){await page.evaluate(async()=>window.worldGame.mountChapter('guaira','guaira-travessia'));await page.waitForSelector('[data-state="playing"]');}
   else await enter(page,title);
   await play(page,id,tape,coins,message);
   await activate(page,page.locator('#chapter-primary'));await page.waitForSelector('.world-map:not([hidden])');
   const completed=await page.evaluate(()=>window.worldGame.store.save.guaira.completed);
   assert.deepEqual(completed,stages.slice(0,i+1).map(x=>x[0]));
   if(normalCampaign){
    const gate=await page.evaluate(async()=>{const p=await import('/src/adventure/progress.ts');return{serra:p.isUnlocked('4-1',window.worldGame.store.save),stages:window.worldGame.mapView.chapterStages};});
    assert.equal(gate.serra,i===4);assert.equal(gate.stages.length,8);
    assert.ok(gate.stages.filter(s=>!s.optional).every((s,index)=>s.open===(index<=i+1)));
    if(i===0){
     await enter(page,'Pátio das Comportas');
     await play(page,'guaira-patio-comportas',read('guairaJunctionOptionalReplay'),read('guairaJunctionOptionalReplay').coins,'Percurso alternativo explorado');
     await activate(page,page.locator('#chapter-primary'));await page.waitForSelector('.world-map:not([hidden])');
     const progress=await page.evaluate(()=>window.worldGame.store.save.guaira);
     assert.deepEqual(progress.completed,['guaira-travessia']);assert.equal(progress.alternateCompleted,true);
     assert.equal(progress.opening,'guaira-travessia');assert.equal(progress.selectedScene,'guaira-respiros');
     await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.mapView);
     assert.equal(await page.evaluate(()=>window.worldGame.store.save.guaira.alternateCompleted),true);
    }
   }
  }
  await page.screenshot({path:path.join(out,'chapter-map-complete.png')});
  await enter(page,'Galeria dos Remendos');await play(page,'guaira-galeria',routes.galeria,routes.galeria.coins,'Acesso à Câmara de Alívio aberto');
  await activate(page,page.locator('#chapter-primary'));await page.waitForFunction(()=>window.worldGame?.stage?.id==='guaira-camara-alivio');
  await play(page,'guaira-camara-alivio',read('guairaReliefRoutesReplays').high,read('guairaReliefRoutesReplays').high.coins,null);
  await page.waitForFunction(()=>document.querySelector('#chapter-primary')?.getAttribute('aria-label')==='Tentar outra rota na Câmara de Alívio');
  await activate(page,page.locator('#chapter-map-return'));await page.waitForSelector('.world-map:not([hidden])');
  assert.equal(await page.evaluate(()=>window.worldGame.store.save.guaira.completed.length),5,'optional rooms preserve main receipts');
  if(normalCampaign){
   const complete=await page.evaluate(()=>({progress:window.worldGame.store.save.guaira,stages:window.worldGame.mapView.chapterStages}));
   assert.ok(complete.progress.optional.gallery&&complete.progress.optional.relief&&complete.progress.alternateCompleted);
   assert.ok(complete.stages.every(s=>s.open&&s.completed));report.final=complete;
   await page.screenshot({path:path.join(out,'whole-map-complete.png')});
  }
  await context.close();
  const alternative=await fresh();
  if(normalCampaign)await enter(alternative.page,'Pátio das Comportas');
  else await alternative.page.evaluate(async()=>window.worldGame.mountChapter('guaira','guaira-patio-comportas'));
  await alternative.page.waitForSelector('[data-state="playing"]');
  await play(alternative.page,'guaira-patio-comportas',read('guairaJunctionOptionalReplay'),read('guairaJunctionOptionalReplay').coins,'Passagem dos Respiros');
  await activate(alternative.page,alternative.page.locator('#chapter-primary'));await alternative.page.waitForSelector('.world-map:not([hidden])');
  assert.deepEqual(await alternative.page.evaluate(()=>window.worldGame.store.save.guaira.completed),['guaira-patio-comportas']);
  await alternative.context.close();assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({passed:report.passed,scenes:report.checks.length,errors:report.errors}));
})().catch(e=>{console.error(e);process.exitCode=1});
