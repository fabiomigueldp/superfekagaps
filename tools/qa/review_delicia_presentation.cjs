const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://localhost:3000';
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/presentation');fs.mkdirSync(out,{recursive:true});
const sizes=[
 {name:'desktop',width:1366,height:900,deviceScaleFactor:1},
 {name:'wide',width:1920,height:1080,deviceScaleFactor:1},
 {name:'fractional-dpr',width:1536,height:864,deviceScaleFactor:1.25},
 {name:'portrait',width:390,height:844,deviceScaleFactor:3,hasTouch:true},
 {name:'landscape',width:844,height:390,deviceScaleFactor:3,hasTouch:true},
];
const report={errors:[],checks:[],screenshots:[]};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const size of sizes){
   const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:size.deviceScaleFactor,hasTouch:!!size.hasTouch});
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push({size:size.name,error:e.stack||e.message}));
   const shot=async(name)=>{const file=`${size.name}-${name}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);};
   const pixels=async(selector,box)=>page.locator(selector).evaluate((canvas,[x,y,w,h])=>{
    const scale=canvas.width/320,c=canvas.getContext('2d'),data=c.getImageData(0,0,canvas.width,canvas.height).data,result=[];
    for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){const i=(Math.floor(row*scale)*canvas.width+Math.floor(col*scale))*4;result.push(data[i],data[i+1],data[i+2],data[i+3]);}return result;
   },box);
   await page.goto(base);await page.waitForFunction(()=>window.worldGame);
   await page.evaluate(()=>{const g=window.worldGame;g.load('1-1');g.dialogueTime=10000;g.closeDialogue();g.toastTimer=0;g.canvas?.focus();});await page.waitForTimeout(180);
   const world=await page.locator('#game-canvas').boundingBox();await shot('world-play');
   await page.evaluate(()=>{const g=window.worldGame;g.showDialogue({id:'qa',speaker:'feka',text:'Uma ilha inteira precisa voltar a compartilhar. Vamos abrir as fontes.',x:0});g.dialogueTime=10000;});await page.waitForTimeout(80);await shot('world-dialogue');
   await page.evaluate(()=>{const g=window.worldGame;g.closeDialogue();g.pause();g.menuSelection=0;g.render();});
   const worldPause=await pixels('#game-canvas',[86,31,148,97]);await shot('world-pause');
   await page.evaluate(()=>{const g=window.worldGame;g.settings('paused');g.menuSelection=0;g.render();});
   const worldSettings=await pixels('#game-canvas',[62,11,196,110]);await shot('world-settings');
   await page.evaluate(async()=>{const g=window.worldGame;g.toMap();g.render();g.mapView.openChapter('delicia','delicia-1');await g.mountChapter('delicia','delicia-1');});
   await page.waitForFunction(()=>window.deliciaGame?.screen==='dialogue');await page.waitForTimeout(250);
   const chapter=await page.locator('.dl-canvas').boundingBox();assert.deepEqual(chapter,world);
   assert.equal(chapter.width/320,Math.floor(Math.min(size.width/320,size.height/180)));
   assert.equal(await page.evaluate(()=>window.deliciaGame.presentation.renderer.constructor===window.worldGame.renderer.constructor),true);
   assert.equal(await page.evaluate(()=>window.deliciaGame.sim.nativePlayer.constructor===window.worldGame.player.constructor),true);
   await page.evaluate(()=>{window.deliciaGame.dialogueTime=10000;window.deliciaGame.renderGame();});await shot('delicia-dialogue');
   for(let i=0;i<8&&await page.evaluate(()=>window.deliciaGame.screen==='dialogue');i++)await page.getByRole('button',{name:'CONTINUAR',exact:true}).click();
   await page.waitForFunction(()=>window.deliciaGame.screen==='playing');await page.waitForTimeout(80);
   const start=await page.evaluate(()=>window.deliciaGame.sim.player.x);
   if(!size.hasTouch){await page.locator('.dl-canvas').focus();await page.keyboard.down('ArrowRight');await page.keyboard.down('Shift');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');await page.keyboard.up('Shift');}
   else{
    const controls=await page.locator('.dl-touch-button').evaluateAll(buttons=>buttons.map(b=>({...b.getBoundingClientRect().toJSON(),name:b.getAttribute('aria-label')})));
    assert.equal(controls.length,8);assert.ok(controls.every(b=>b.width>=44&&b.height>=44));
    const right=page.getByRole('button',{name:'Direita',exact:true});await right.dispatchEvent('pointerdown',{pointerId:31,button:0});await page.waitForTimeout(180);await right.dispatchEvent('pointerup',{pointerId:31,button:0});
   }
   assert.ok(await page.evaluate(()=>window.deliciaGame.sim.player.x)>start+10);
   await shot('delicia-play');
   await page.getByRole('button',{name:'Pausar',exact:true}).click();await page.waitForTimeout(50);
   assert.deepEqual(await pixels('.dl-canvas',[86,31,148,97]),worldPause,'Pause must be the identical World plate and controls');await shot('delicia-pause');
   const frozen=await page.evaluate(()=>window.deliciaGame.sim.time);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.deliciaGame.sim.time),frozen);
   await page.getByRole('button',{name:'OPÇÕES',exact:true}).click();await page.waitForTimeout(50);
   assert.deepEqual(await pixels('.dl-canvas',[62,11,196,110]),worldSettings,'Options header and volume controls must be identical World pixels');await shot('delicia-settings');
   const music=await page.evaluate(()=>window.worldGame.store.save.preferences.music);
   await page.getByRole('button',{name:/^MÚSICA:/}).click();
   assert.notEqual(await page.evaluate(()=>window.worldGame.store.save.preferences.music),music);
   assert.equal(await page.evaluate(()=>window.deliciaGame.audio.musicVolume===window.worldGame.store.save.preferences.music),true);
   await page.getByRole('button',{name:/^VOZES:/}).click();assert.equal(await page.evaluate(()=>window.deliciaGame.audio.voiceVolume===window.worldGame.store.save.preferences.voice),true);
   await page.getByRole('button',{name:'CONTROLES',exact:true}).click();await shot('delicia-controls');
   await page.getByRole('button',{name:'VOLTAR',exact:true}).click();await page.getByRole('button',{name:'MEMÓRIAS',exact:true}).click();await shot('delicia-journal');
   await page.getByRole('button',{name:'VOLTAR',exact:true}).click();await page.getByRole('button',{name:'VOLTAR',exact:true}).click();
   await page.getByRole('button',{name:'VOLTAR AO MAPA',exact:true}).click();await page.waitForFunction(()=>!window.worldGame.chapterActive);
   assert.equal(await page.locator('.delicia').count(),0);assert.equal(await page.evaluate(()=>window.renderer===window.worldGame.renderer),true);
   await page.evaluate(async()=>{await window.worldGame.mountChapter('delicia','delicia-1');});await page.waitForFunction(()=>window.deliciaGame?.screen==='dialogue');
   assert.equal(await page.locator('.delicia').count(),1);assert.equal(await page.locator('.delicia .canvas-menu-accessibility').count(),1);
   if(size.name==='desktop'){
    // Arranged late-game states review layout; these captures do not claim a boss playthrough.
    await page.evaluate(async()=>{const {ALL_DELICIA_STAGES,DELICIA_LORE}=await import('/src/adventure/delicia/DeliciaContent.ts');const a=window.deliciaGame;a.store.save.completed=ALL_DELICIA_STAGES.map(s=>s.id);a.store.save.lore=DELICIA_LORE.map(l=>l.id);a.stopFrames();});
    for(const stage of ['delicia-6','delicia-12'])for(const phase of [1,2,3]){
     await page.evaluate(({stage,phase})=>{const a=window.deliciaGame;a.loadStage(stage,true);Object.assign(a.sim.boss,{phase,hp:Math.ceil(a.sim.boss.maxHp*(1-(phase-1)/3)),pressure:phase*27,beat:'tell',attack:phase===3?'overload':phase===2?'wave':'cup'});a.toastTime=0;a.zoneBannerTime=0;a.renderGame();},{stage,phase});
     await shot(`${stage}-phase-${phase}`);
    }
    await page.evaluate(()=>{const a=window.deliciaGame;a.loadStage('delicia-1',true);a.clearStage();if(a.screen==='dialogue')a.dialogueDone();a.renderGame();});await shot('delicia-clear');
    await page.evaluate(()=>{const a=window.deliciaGame;a.setScreen('dead');a.showDeath();});await shot('delicia-retry');
    await page.evaluate(()=>window.deliciaGame.openJournal(()=>window.deliciaGame.showMap()));await shot('delicia-memory-found');
    await page.evaluate(()=>{const a=window.deliciaGame;a.store.warning='O progresso está apenas nesta sessão. Exporte uma cópia ou tente salvar novamente.';a.setScreen('playing');a.pause();});
    await page.getByRole('button',{name:'REVER PROGRESSO',exact:true}).click();await shot('delicia-save-recovery');
   }
   await page.evaluate(()=>window.deliciaGame.showMap());
   report.checks.push({viewport:size,world,chapter,renderer:'shared',player:'shared',pausePixels:'identical',settingsPixels:'identical',input:'passed',preferences:'shared',returnAndReentry:'passed'});
   await context.close();
  }
  // The old standalone URL now enters the same World map, preserving deployment-relative navigation.
  const page=await browser.newPage();await page.goto(base+'/delicia.html');await page.waitForFunction(()=>window.worldGame?.mapView);
  assert.ok(page.url().includes('chapter=delicia'));assert.equal(await page.locator('.delicia').count(),0);
  report.checks.push({legacyEntry:page.url(),sharedMap:true});await page.close();
  assert.deepEqual(report.errors,[]);
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
