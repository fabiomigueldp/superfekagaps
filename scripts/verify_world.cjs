// Native artwork export and browser integration checks. Staged views are labelled separately.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const base=process.env.GAME_URL||'http://127.0.0.1:3000';
const out=path.resolve(__dirname,'../docs/world/capturas'),assets=path.resolve(__dirname,'../public/assets/world');
const checks=[],errors=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(assets,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base);await page.waitForFunction(()=>window.worldGame);const shot=name=>page.locator('#game-canvas').screenshot({path:path.join(out,name+'.png')});
  await shot('01-titulo');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.worldGame.state==='intro');
  await page.keyboard.press('Enter');await page.waitForTimeout(30);await page.keyboard.press('Enter');await page.waitForFunction(()=>window.worldGame.state==='map');
  check('Opening reaches the island map using keyboard',true);await shot('02-mapa');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');check('Locked level cannot start',await page.evaluate(()=>window.worldGame.state==='map'));
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await page.waitForFunction(()=>['playing','dialogue'].includes(window.worldGame.state));if(await page.evaluate(()=>window.worldGame.state==='dialogue')){await page.keyboard.press('Enter');await page.waitForTimeout(40);await page.keyboard.press('Enter');}
  // Walk into the first dialogue, dismiss it, then verify movement and pause through normal input.
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
  if(await page.evaluate(()=>window.worldGame.state==='dialogue')){await page.keyboard.press('Enter');await page.waitForTimeout(30);await page.keyboard.press('Enter');}
  const x=await page.evaluate(()=>window.worldGame.player.data.position.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(150);await page.keyboard.up('ArrowRight');
  if(await page.evaluate(()=>window.worldGame.state==='dialogue')){await page.keyboard.press('Enter');await page.waitForTimeout(30);await page.keyboard.press('Enter');}
  check('Keyboard moves Feka',await page.evaluate(x=>window.worldGame.player.data.position.x>x,x));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.worldGame.state==='paused');const paused=await page.locator('#game-canvas').screenshot();await page.waitForTimeout(180);check('Pause preserves the rendered scene',paused.equals(await page.locator('#game-canvas').screenshot()));
  await shot('03-pausa');await page.keyboard.press('Escape');
  for(let w=1;w<=6;w++){
   await page.evaluate(w=>{const g=window.worldGame;g.load(w===2?'2-2':`${w}-3`);const col=[24,39,38,58,27,40][w-1],row=g.stage.level.tiles.findIndex((r,i)=>i>1&&r[col]&&g.stage.level.tiles[i-1][col]===0);g.player.data.position.x=col*16;g.player.data.position.y=row*16-g.player.data.height;g.player.data.isGrounded=true;g.camera.x=Math.max(0,col*16-104);g.camera.y=Math.max(0,g.player.data.position.y-108);g.spoken=new Set(g.stage.dialogues.map(d=>d.id));},w);await page.waitForTimeout(80);await shot(`mundo-${w}`);
   await page.evaluate(w=>{const g=window.worldGame;g.store.save.seen.push(`intro:${w}-5`);g.load(`${w}-5`);},w);await page.waitForTimeout(500);await shot(`chefe-${w}`);
  }
  // Exports rasterized directly from the production sprite generators.
  const exported=await page.evaluate(async()=>{
   const a=await import('/src/adventure/WorldAssets.ts'),m=await import('/src/adventure/WorldMachineAssets.ts'),{SpriteAtlas}=await import('/src/graphics/pixels.ts');const atlas=new SpriteAtlas();
   const entries=[];for(const who of ['CALABREZZO','BIEL','JOAO'])for(const [pose,frame]of Object.entries(a[who]))entries.push({name:`${who.toLowerCase()}-${pose}`,frame});
   for(const [who,frames]of Object.entries(a.BOSS_WALKS))frames.forEach((frame,i)=>entries.push({name:`${who}-walk-${i}`,frame}));
   for(const [who,states]of Object.entries(a.BOSS_LOOPS))for(const [pose,frames]of Object.entries(states))frames.forEach((frame,i)=>entries.push({name:`${who}-${pose}-loop-${i}`,frame}));
   for(const group of ['BARRELS','PRESSURE_BARRELS','SEALS'])a[group].forEach((frame,i)=>entries.push({name:`${group.toLowerCase()}-${i}`,frame}));
   for(const [kind,frames]of Object.entries(a.FOE_FRAMES))frames.forEach((frame,i)=>entries.push({name:`${kind}-${i}`,frame}));
   for(const [skin,frames]of Object.entries(m.NOZZLES))frames.forEach((frame,i)=>entries.push({name:`nozzle-${skin}-${i}`,frame}));
   for(const [skin,poses]of Object.entries(m.CANNONS))for(const [pose,frame]of Object.entries(poses))entries.push({name:`cannon-${skin}-${pose}`,frame});
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.ceil(entries.length/8)*64;const c=canvas.getContext('2d');
   const frames=entries.map((entry,i)=>{const x=i%8*64,y=Math.floor(i/8)*64;atlas.draw(c,entry.frame,a.WORLD_PALETTE,x,y);return {name:entry.name,x,y,width:entry.frame[0].length,height:entry.frame.length};});
   return {png:canvas.toDataURL().split(',')[1],manifest:{width:canvas.width,height:canvas.height,frames,palette:a.WORLD_PALETTE,source:['src/adventure/WorldAssets.ts','src/adventure/WorldMachineAssets.ts']}};
  });fs.writeFileSync(path.join(assets,'sprites.png'),Buffer.from(exported.png,'base64'));fs.writeFileSync(path.join(assets,'sprites.json'),JSON.stringify(exported.manifest,null,2));check('All authored sprite frames export inside their native atlas cells',exported.manifest.frames.length>=220&&exported.manifest.frames.every(f=>f.width>0&&f.width<=64&&f.height>0&&f.height<=64&&f.x+f.width<=exported.manifest.width&&f.y+f.height<=exported.manifest.height));
  for(let world=1;world<=6;world++){
   const png=await page.evaluate(async w=>{const {WorldArt}=await import('/src/adventure/WorldArt.ts'),{ISLANDS}=await import('/src/adventure/campaign.ts');const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');new WorldArt().background(c,ISLANDS[w-1],0,0,0);return canvas.toDataURL().split(',')[1];},world);fs.writeFileSync(path.join(assets,`fundo-${world}.png`),Buffer.from(png,'base64'));
  }
  await page.evaluate(()=>{window.worldGame.state='ending';});await shot('04-final');
  const saved=await page.evaluate(()=>{const g=window.worldGame;g.store.collect('1-1:s1');return localStorage.getItem('super_feka_gaps_world_v1');});await page.reload();await page.waitForFunction(()=>window.worldGame);check('Unique seal survives browser reload',await page.evaluate(()=>window.worldGame.store.save.seals.includes('1-1:s1')));
  check('Save is versioned',JSON.parse(saved).version===1);
  await page.goto(base+'?worldEditor=true');await page.waitForSelector('.world-editor-panel');check('World editor exposes campaign and mechanism authoring',await page.locator('.world-editor-panel select').first().locator('option').count()===30);await page.screenshot({path:path.join(out,'05-editor.png')});
  const dataField=page.getByRole('textbox',{name:'Dados da fase World'});const original=JSON.parse(await dataField.inputValue());const edited={...original,name:'Revisão de autoria'};
  await dataField.fill(JSON.stringify(edited));await page.getByRole('button',{name:'Aplicar JSON'}).click();check('Editor applies authored JSON to runtime',await page.evaluate(()=>window.worldGame.stage.name==='Revisão de autoria'));
  await page.getByRole('button',{name:'Desfazer'}).click();check('Editor undo restores original stage',JSON.parse(await dataField.inputValue()).name===original.name);await page.getByRole('button',{name:'Refazer'}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar fase'}).click();const download=await downloadPromise;check('Editor exports the edited data',JSON.parse(fs.readFileSync(await download.path(),'utf8')).name===edited.name);
  await page.locator('.world-editor-panel select').first().selectOption('4-5');check('Editor clamps camera to selected arena',await page.evaluate(()=>window.worldGame.camera.x===0&&window.worldGame.camera.y===64));
  const editorSave=await page.evaluate(()=>localStorage.getItem('super_feka_gaps_world_v1'));await page.getByRole('button',{name:'Jogar / editar'}).click();check('World editor preview runs',await page.evaluate(()=>!!window.worldGame.player));await page.evaluate(()=>window.worldGame.store.collect('2-1:s1'));check('Editor preview does not change real progress',await page.evaluate(saved=>localStorage.getItem('super_feka_gaps_world_v1')===saved,editorSave));
  const touch=await browser.newPage({viewport:{width:960,height:540},hasTouch:true,isMobile:true});touch.on('pageerror',e=>errors.push(String(e)));await touch.goto(base);await touch.waitForFunction(()=>window.worldGame);await touch.tap('#game-canvas',{position:{x:480,y:333}});check('Touch starts the opening',await touch.evaluate(()=>window.worldGame.state==='intro'));
  const tapNative=async(x,y)=>{const box=await touch.locator('#game-canvas').boundingBox();await touch.touchscreen.tap(box.x+x*box.width/320,box.y+y*box.height/180);await touch.waitForTimeout(100);};
  await tapNative(160,159);await tapNative(160,159);await tapNative(265,169);await touch.waitForFunction(()=>['playing','dialogue'].includes(window.worldGame.state));
  if(await touch.evaluate(()=>window.worldGame.state==='dialogue')){await tapNative(250,158);await tapNative(250,158);}
  const touchX=await touch.evaluate(()=>window.worldGame.player.data.position.x),box=await touch.locator('#game-canvas').boundingBox(),cdp=await touch.context().newCDPSession(touch);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.23,y:box.y+box.height*.88}]});await touch.waitForTimeout(180);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check('Touch direction moves Feka',await touch.evaluate(x=>window.worldGame.player.data.position.x>x,touchX));await touch.close();
  await page.goto(base+'/docs/world/capturas/');await page.waitForFunction(()=>document.images.length===17&&Array.from(document.images).every(im=>im.complete&&im.naturalWidth>0));check('Asset gallery loads all 17 images',true);
  const media=await page.locator('audio').evaluateAll(async nodes=>Promise.all(nodes.map(async n=>{const r=await fetch(n.src);return r.ok&&(await r.arrayBuffer()).byteLength>44;})));check('All ten music previews are available',media.length===10&&media.every(Boolean));
  await page.waitForTimeout(250);const preview=await page.locator('#enemy-preview').screenshot();await page.locator('#enemy-kind').selectOption('loader');await page.locator('#enemy-pose').selectOption('1');await page.waitForTimeout(250);check('Enemy preview reflects selectable animation states',!preview.equals(await page.locator('#enemy-preview').screenshot()));
  const bossPreview=await page.locator('#boss-preview').screenshot();await page.locator('#boss-kind').selectOption('calabrezzoCold');await page.locator('#boss-pose').selectOption('windup');await page.waitForTimeout(200);check('Boss preview shows production poses and the cold variant',!bossPreview.equals(await page.locator('#boss-preview').screenshot()));await page.locator('#animation-toggle').click();await page.waitForTimeout(30);const frozen=await page.locator('#boss-preview').screenshot();await page.waitForTimeout(200);check('Animation previews can be paused for inspection',frozen.equals(await page.locator('#boss-preview').screenshot()));
  await page.goto(base+'/docs/world/capturas/percursos/');await page.waitForFunction(()=>document.querySelector('#stages').options.length===24&&document.querySelector('#route').naturalWidth>0);await page.locator('#stages').selectOption('6-4');await page.waitForFunction(()=>document.querySelector('#route').src.endsWith('6-4.png')&&document.querySelector('#route').complete&&document.querySelector('#route').naturalWidth===2944);check('All 24 routes are selectable as native panoramas',true);
  check('No browser runtime errors',errors.length===0);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({browser:await browser.version(),checks,errors,stagedViews:'World and boss captures use authored data with staged camera/player positions; they are not evidence of full playthroughs.',spriteFrames:exported.manifest.frames.length},null,2));console.log(JSON.stringify({checks:checks.length,spriteFrames:exported.manifest.frames.length,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
