/* UI regression and screenshots in isolated saves. Prepared result/combat states
 * are presentation coverage, not a completed playthrough or a physical-pad test. */
const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://127.0.0.1:3030';
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/ui-v4/ui');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],arrangedCases:['A virtual standard controller exercises menu navigation. Result screens and unlocked phases are arranged in an isolated profile.']};
const check=name=>report.checks.push(name);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
  const button=(name)=>page.getByRole('button',{name,exact:true});
  await page.goto(base+'/delicia.html');await page.waitForFunction(()=>window.deliciaGame?.art.images.size===13);
  await shot('title');
  await button('Opções').click();await page.getByRole('slider').first().focus();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'title');
  check('Escape from a focused volume slider returns to the title');
  await button('Memórias').click();assert.equal(await page.locator('.dl-lore-entry').count(),1);await shot('journal');
  await button('Voltar').click();await button('Jogar').click();
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'map');assert.ok(await button('Bloqueada').isDisabled());
  await page.keyboard.press('ArrowLeft');await shot('map');
  await button('Fases').click();assert.equal(await page.locator('.dl-stage-row').count(),12);
  await shot('stage-list');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dl-stage-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('.dl-pin.selected').focus();await page.keyboard.press('Enter');await shot('dialogue');await button('Pular').click();
  await page.keyboard.press('Escape');await shot('pause');
  const run=await page.evaluate(()=>({time:window.deliciaGame.sim.elapsed,x:window.deliciaGame.sim.player.x}));
  await button('Opções').click();await shot('settings');
  await page.getByLabel('Mais vida e avisos longos',{exact:true}).check();await page.getByRole('slider').last().focus();await page.keyboard.press('Escape');
  await button('Memórias').click();await button('Voltar').click();
  assert.deepEqual(await page.evaluate(()=>({time:window.deliciaGame.sim.elapsed,x:window.deliciaGame.sim.player.x})),run);
  await button('Continuar').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'playing');
  check('Map keyboard selection respects locks; Space resumes after nested menus preserve the run');
  await page.keyboard.press('Escape');await button('Voltar ao mapa').click();await button('Menu').click();await button('Opções').click();
  await page.getByLabel('Mais vida e avisos longos',{exact:true}).uncheck();
  await page.getByText('Progresso',{exact:true}).click();
  const chooserPromise=page.waitForEvent('filechooser');await button('Importar').click();const chooser=await chooserPromise;
  await chooser.setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await page.locator('.dl-save-message').filter({hasText:'Arquivo inválido. Progresso atual mantido.'}).waitFor();
  check('Import failure is visible and keeps existing progress');
  await page.evaluate(()=>window.deliciaGame.showTitle());
  await page.evaluate(()=>{window.uiPad={mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.uiPad];});
  const pad=async index=>{await page.evaluate(i=>window.uiPad.buttons[i].pressed=true,index);await page.waitForTimeout(80);await page.evaluate(i=>window.uiPad.buttons[i].pressed=false,index);await page.waitForTimeout(80);};
  await pad(13);await pad(13);await pad(0);assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'settings');
  await pad(1);assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'title');await pad(0);assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'map');
  await pad(15);assert.ok(await button('Bloqueada').isDisabled());await pad(14);await pad(0);await pad(1);await pad(1);await pad(1);
  assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'playing');await pad(9);assert.equal(await page.evaluate(()=>window.deliciaGame.screen),'pause');
  check('Virtual controller navigates title, settings, map, dialogue and pause');
  await page.evaluate(()=>{navigator.getGamepads=()=>[];const app=window.deliciaGame;app.resume();app.sim.player.health=1;app.sim.player.invincible=0;app.sim.hurt(app.sim.player.x+20);});
  await page.getByRole('heading',{name:'Fim de jogo',exact:true}).waitFor();await shot('death');await button('Tentar de novo').click();
  await page.evaluate(()=>window.deliciaGame.clearStage());await shot('clear');await button('Voltar ao mapa').click();
  await page.evaluate(()=>window.deliciaGame.showEnding());await button('Pular').click();await shot('ending');
  check('Death, retry, completion and ending actions remain usable');
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   const mobile=await browser.newContext({viewport,isMobile:true,hasTouch:true}),mp=await mobile.newPage();mp.on('pageerror',e=>report.errors.push(e.message));
   await mp.goto(base+'/delicia.html');await mp.getByRole('button',{name:'Jogar',exact:true}).click();await mp.locator('.dl-map-island').evaluate(i=>i.decode());
   for(const id of [1,6,12,11,5,8]){
    const pin=mp.locator(`.dl-pin[data-stage="delicia-${id}"]`);await pin.scrollIntoViewIfNeeded();await pin.tap();
    assert.equal(await pin.getAttribute('aria-pressed'),'true');const b=await pin.boundingBox();assert.ok(b.width>=44&&b.height>=44);
   }
   assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
   assert.ok(await mp.locator('.dl-map-detail').evaluate(el=>{const b=el.getBoundingClientRect();return b.bottom<=innerHeight&&b.top>=0;}));
   await mp.screenshot({path:path.join(out,`map-${viewport.width}x${viewport.height}.png`)});
   await mp.getByRole('button',{name:'Menu',exact:true}).click();await mp.getByRole('button',{name:'Opções',exact:true}).click();
   await mp.screenshot({path:path.join(out,`settings-${viewport.width}x${viewport.height}.png`)});
   await mobile.close();
  }
  check('390px, 320px and landscape: actual pin taps, 44px targets, readable footer, no page overflow');
  await context.close();assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
