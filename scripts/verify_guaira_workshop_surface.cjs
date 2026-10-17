const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync('tests/helpers/'+name+'.json','utf8').replace(/^\uFEFF/,''));
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/whole-experience-2026-10-16/surface-browser');
const base=process.env.FEKA_UI_URL||'http://localhost:3000';
const exploration=process.env.GUAIRA_EXPLORATION==='1'?read('guairaExplorationReplays'):null;
const finales=process.env.GUAIRA_FINALES==='1'?read('guairaFinaleReplays'):null;
const docks=process.env.GUAIRA_DOCKS==='1'?read('guairaDockReplays'):null;
const aqueduct=process.env.GUAIRA_AQUEDUCT==='1'?read('guairaAqueductReplays'):null;
const maintenance=process.env.GUAIRA_MAINTENANCE==='1'?read('guairaMaintenanceReplays'):null;
const returns=process.env.GUAIRA_RETURNS==='1'?read('guairaReturnReplays'):null;
const sluice=process.env.GUAIRA_SLUICE==='1'?read('guairaSluiceReplays'):null;
const records=!!returns||process.env.GUAIRA_SAVE_EXPLORATION==='1';
const courseStages={travessia:'guaira-travessia',patio:'guaira-patio-comportas',respiros:'guaira-respiros',subida:'guaira-subida',galeria:'guaira-galeria',alivio:'guaira-camara-alivio'};
const scenes=sluice?Object.entries(sluice).map(([key,tape])=>{
 const pause=tape.notes.find(n=>n.frame>tape.prefixFrames&&n.at[0]>875&&n.at[0]<928);
 return ['guaira-travessia','guaira-travessia',tape,pause.frame,key];
}):returns?Object.entries(returns).map(([key,tape])=>[key==='galeria'?'gallery':key==='alivio'?'relief':courseStages[key],courseStages[key],tape,tape.notes[0].frame,key])
:maintenance?Object.entries(maintenance).map(([key,tape])=>{
 const id=courseStages[key];
 const pause=key==='travessia'?tape.notes.find(n=>n.frame>tape.prefixFrames&&n.at[0]>875&&n.at[0]<928)
  :tape.notes.find(n=>n.frame>tape.prefixFrames&&n.at[0]>(key==='respiros'?1580:1192)&&/MEXEDOR|PINCAS|VAGONETE/.test(n.hint));
 return [key==='alivio'?'relief':id,id,tape,pause.frame,key];
}):aqueduct?Object.entries(aqueduct).map(([key,tape])=>{
 const id=tape.id==='subida'?'guaira-subida':'guaira-galeria';
 const pause=tape.notes.find(n=>n.frame>tape.prefixFrames&&n.at[0]>(tape.id==='subida'?2640:2100));
 return [tape.id==='galeria'?'gallery':id,id,tape,pause.frame,key];
}):docks?Object.entries(docks).map(([key,tape])=>{
 const id=tape.id==='travessia'?'guaira-travessia':'guaira-patio-comportas';
 const pause=tape.notes.find(n=>n.frame>tape.prefixFrames&&n.at[0]>(tape.id==='travessia'?2180:2220));
 return [id,id,tape,pause.frame,key];
}):finales?Object.entries(finales).map(([key,tape])=>{
 const id=tape.id==='respiros'?'guaira-respiros':'guaira-camara-alivio';
 const pause=tape.notes.find(n=>n.at[0]>(tape.id==='respiros'?2640:1900));
 return [tape.id==='alivio'?'relief':id,id,tape,pause.frame,key];
}):exploration?Object.entries({travessia:'guaira-travessia',patio:'guaira-patio-comportas',respiros:'guaira-respiros',subida:'guaira-subida',galeria:'guaira-galeria',alivio:'guaira-camara-alivio'})
 .map(([key,id])=>[key==='galeria'?'gallery':key==='alivio'?'relief':id,id,exploration[key],exploration[key].notes[1].frame])
 :[['gallery','guaira-galeria',read('guairaReadableRoutesReplays').galeria,1037],['relief','guaira-camara-alivio',read('guairaReliefRoutesReplays').high,1013]];
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'}),report={physicalDevice:false,mountsForVisualInspection:true,checks:[],errors:[]};
 try{
  for(const touch of [false,true])for(const [entry,id,tape,pauseAt,variant=entry]of scenes){
   const viewport=touch?{width:844,height:390}:{width:1280,height:800};
   const context=await browser.newContext({viewport,hasTouch:touch,reducedMotion:touch?'reduce':'no-preference'}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'/?chapter=guaira',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.mapView);
   await page.evaluate(async entry=>window.worldGame.mountChapter('guaira',entry),entry);await page.waitForSelector('[data-state="playing"]');
   await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load(g.stage.id);window.__experienceFrames=0;});
   let held=new Set(),frames=0,pause;
   async function keys(codes){
    if(touch)await page.evaluate(codes=>{const actions={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',KeyX:'run',ShiftLeft:'run',Space:'jump'},order=Object.keys(actions),previous=window.__heldGuaira||[];
     for(const k of previous)if(!codes.includes(k))window.dispatchEvent(new PointerEvent('pointerup',{pointerId:order.indexOf(k)+10,pointerType:'touch',button:0,buttons:0,bubbles:true}));
     for(const k of codes)if(!previous.includes(k))document.querySelector('#guaira-touch-controls [data-action="'+actions[k]+'"]').dispatchEvent(new PointerEvent('pointerdown',{pointerId:order.indexOf(k)+10,pointerType:'touch',button:0,buttons:1,bubbles:true,cancelable:true}));
     window.__heldGuaira=codes;
    },codes);
    else {const next=new Set(codes);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}
   }
   for(const [count,codes]of [[tape.initialSettleFrames||0,[]],...tape.runs]){
    let left=count;await keys(codes);
    while(left){const n=frames<pauseAt?Math.min(left,pauseAt-frames):left;
     await page.evaluate(n=>{const g=window.worldGame;for(let i=0;i<n;i++){g.update(1000/60);window.__experienceFrames++;if(g.player.data.isDead||!g.player.data.hasHelmet)throw Error('damage '+g.stage.id+' '+window.__experienceFrames);}g.render();},n);frames+=n;left-=n;
     if(frames===pauseAt&&!pause){
      if(records)await page.screenshot({path:path.join(out,variant+'-'+(touch?'touch':'keyboard')+'-playing.png')});
      await keys([]);await page.locator('#chapter-primary').click();
      pause=await page.evaluate(()=>{const g=window.worldGame,c=document.querySelector('#game-canvas');g.render();const pixels=c.toDataURL(),state=JSON.stringify({p:g.player.data,c:g.camera,o:g.objects,t:g.time});for(let i=0;i<90;i++){g.update(1000/60);g.render();}const r=c.getBoundingClientRect();return{paused:g.state==='paused',pixelsFrozen:pixels===c.toDataURL(),stateFrozen:state===JSON.stringify({p:g.player.data,c:g.camera,o:g.objects,t:g.time}),fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
      assert.ok(pause.paused&&pause.pixelsFrozen&&pause.stateFrozen&&pause.fits);await page.screenshot({path:path.join(out,variant+'-'+(touch?'touch':'keyboard')+'-pause.png')});
      await page.locator('#chapter-primary').click();await page.locator('#game-canvas').focus();await keys(codes);
     }
    }
   }
   await keys([]);const result=await page.evaluate(()=>{const g=window.worldGame;return{id:g.stage.id,finished:g.finished,coins:g.coins,frames:window.__experienceFrames};});
   assert.equal(result.id,id);assert.equal(result.finished,true);assert.equal(result.coins,tape.coins);assert.equal(result.frames,frames);
   await page.screenshot({path:path.join(out,variant+'-'+(touch?'touch':'keyboard')+'-complete.png')});
   let exploration;
   if(records&&(!sluice||variant==='high'||variant==='return')){
    const kind=sluice&&(variant==='high'||variant==='return')||maintenance&&!returns?'maintenance':'detour';
    const expected=await page.evaluate(async kind=>{
     const m=await import('/src/adventure/experimental/guaira/GuairaCourseExploration.ts'),g=window.worldGame;
     const d=await import('/src/adventure/DevelopmentProgress.ts'),key='super_feka_gaps_world_v1';
     const r=m.GUAIRA_EXPLORATION_ROUTES.find(r=>r.stageId===g.stage.id&&r.id.endsWith(':'+kind));
     return {id:r.id,total:r.total,name:r.route.name,actual:m.sampleGuairaExploration(g)[r.id],saveKey:d.siteDevelopmentUnlockEnabled()?d.developmentSaveKey(key):key};
    },kind);
    assert.equal(expected.actual.length,expected.total);
    await page.waitForFunction(e=>JSON.parse(localStorage.getItem(e.saveKey))?.guaira.exploration?.[e.id]?.length===e.total,expected);
    await page.locator(entry==='gallery'||entry==='relief'?'#chapter-map-return':'#chapter-primary').click();await page.waitForSelector('.world-map:not([hidden])');
    const title=await page.evaluate(entry=>window.worldGame.mapView.chapterStages.find(s=>s.id===entry).name,entry);
    const select=async()=>{
     await page.getByRole('button',{name:new RegExp('^(Fase \\d+|Entrada alternativa|Desvio opcional): '+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.')}).click();
     await page.waitForFunction(e=>{const p=document.querySelector('.world-map-exploration');return p&&!p.hidden&&p.textContent.includes(e.name+' · '+e.total+'/'+e.total+' moedas');},expected);
    };
    await select();
    await page.screenshot({path:path.join(out,variant+'-'+(touch?'touch':'keyboard')+'-map.png')});
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.mapView);
    if(touch)await page.setViewportSize({width:390,height:844});
    await select();
    exploration=await page.evaluate(e=>{const p=document.querySelector('.world-map-exploration'),f=document.querySelector('.world-map-footer').getBoundingClientRect();
     return{...e,record:JSON.parse(localStorage.getItem(e.saveKey)).guaira.exploration[e.id],mapText:p.textContent,
      reloaded:true,viewport:{width:innerWidth,height:innerHeight},fits:f.left>=0&&f.right<=innerWidth&&f.top>60&&f.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth};},expected);
    assert.ok(exploration.fits);assert.deepEqual(exploration.record,expected.actual);
    await page.screenshot({path:path.join(out,variant+'-'+(touch?'touch':'keyboard')+'-reload.png')});
   }
   report.checks.push({variant,touch,reduced:touch,viewport,pause,...result,exploration});await context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
