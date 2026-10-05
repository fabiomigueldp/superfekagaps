/* Production browser smoke/visual coverage. Unlocks are arranged in an isolated
 * save; movement, scene progression, pause and attacks use the shipped controls. */
const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://127.0.0.1:3031';
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/v2/production');fs.mkdirSync(out,{recursive:true});
const report={url:base,checks:[],errors:[],arrangedCases:['All twelve main stages are unlocked through a synthetic save in an isolated browser profile. This is visual and input validation, not an earned campaign completion.']};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>localStorage.setItem('super_feka_delicia_v1',JSON.stringify({version:1,completed:Array.from({length:12},(_,i)=>'delicia-'+(i+1)),collected:[],lore:['carta'],selected:'delicia-1',times:{},medals:{},checkpoint:null,music:.3,effects:.5,reducedMotion:false,assists:false})));
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))report.errors.push(r.status()+' '+r.url());});
  console.log('Checking production at '+base);
  await page.goto(base+'/delicia.html');await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>typeof window.deliciaGame),'undefined');report.checks.push('Developer global is absent in production');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  const island=page.locator('.dl-map-island');await island.evaluate(img=>img.decode());
  const dimensions=await island.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,url:img.currentSrc}));
  const metadata=await(await page.request.get(base+'/assets/delicia/island-map.json')).json();
  assert.equal(dimensions.width,metadata.image.width);assert.equal(dimensions.height,metadata.image.height);
  report.checks.push('Island render dimensions match the camera metadata');report.island={...dimensions,revision:metadata.revision,pins:await page.locator('.dl-pin').count()};
  await page.screenshot({path:path.join(out,'map.png'),fullPage:true});
  await page.locator('.dl-map-geography').screenshot({path:path.join(out,'island-in-game.png')});
  for(const [id,label,file] of [[1,'Cais do Primeiro Gole','harbor'],[2,'Pomares da Partilha','orchard'],[5,'Arquivo Fermentado','archive'],[6,'Jajá, Guardião da Nascente','jaja'],[8,'Engrenagens da Polpa','refinery'],[12,'Paulo Guina, Barão da Delícia','guina']]){
   console.log('Checking '+label);
   if(id!==1)await page.locator(`.dl-pin[data-stage="delicia-${id}"]`).click();
   await page.getByRole('button',{name:'Jogar de novo',exact:true}).click();
   await page.waitForTimeout(id===6||id===12?1150:350);
   const canvas=page.locator('canvas.dl-canvas');assert.ok(await canvas.isVisible());await canvas.focus();
   if(id===1){await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');await page.waitForTimeout(180);await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');}
   if(id===6||id===12){assert.equal(await page.locator('.dl-boss-health').count(),1);assert.ok((await page.locator('.dl-boss-cue').textContent()).length>10);}
   await page.keyboard.press('Escape');await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();
   await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.screenshot({path:path.join(out,file+'.png'),fullPage:true});
   await page.keyboard.press('Escape');await page.getByRole('button',{name:'Voltar ao mapa',exact:true}).click();report.checks.push(label+' renders, runs and pauses through native controls');
  }
  await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Memórias',exact:true}).click();assert.equal(await page.locator('.dl-lore-entry').count(),1);report.checks.push('Journal shows the collected memory without nineteen locked placeholders');
  const requests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/delicia/')).map(e=>({url:e.name.split('/assets/delicia/')[1],bytes:e.transferSize})));
  report.resources=requests;assert.ok(requests.some(r=>r.url==='terrain-v2.webp'));assert.ok(requests.some(r=>r.url==='jaja-motion-v2.webp'));
  const assetPrefix=base+'/assets/delicia/';
  assert.ok(await page.evaluate(prefix=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/delicia/')).every(e=>e.name.startsWith(prefix)),assetPrefix));
  report.checks.push('Expansion image, map and audio requests stay inside the served release');
  await page.goto(base+'/?delicia=true');
  await page.getByRole('heading',{name:'Império da Delícia',exact:true}).waitFor();
  assert.equal(await page.locator('#game-canvas:visible').count(),0);
  report.checks.push('Query entry loads the production expansion and hides the World canvas');
  await page.getByRole('link',{name:'Voltar ao World',exact:true}).click();
  await page.getByRole('button',{name:'COMEÇAR AVENTURA',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,new URL(base+'/').pathname);
  report.checks.push('The native return link reaches World inside the same release');
  assert.deepEqual(report.errors,[]);report.passed=true;await context.close();
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
