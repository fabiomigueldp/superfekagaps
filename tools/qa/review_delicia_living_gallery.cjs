const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://localhost:3000';
const relative='/docs/world/delicia/living-world-2026-10-08/';
const out=path.resolve('docs/world/delicia/living-world-2026-10-08');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(base+relative);await page.waitForFunction(()=>document.querySelector('#stage').options.length===14&&document.querySelector('#status').textContent.includes('Cais'));
  const canvas=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
  await page.locator('#play').click();const paused=await canvas();await page.waitForTimeout(250);assert.equal(await canvas(),paused);
  await page.locator('#step').click();assert.notEqual(await canvas(),paused);
  await page.locator('#play').click();const running=await canvas();await page.waitForTimeout(450);assert.notEqual(await canvas(),running);
  await page.locator('#play').click();
  let comparisons=0;
  for(const stage of await page.locator('#stage option').evaluateAll(options=>options.map(o=>o.value))){
   await page.locator('#stage').selectOption(stage);
   for(const zone of await page.locator('#zone option').evaluateAll(options=>options.map(o=>o.value))){
    await page.locator('#zone').selectOption(zone);
    await page.waitForFunction(()=>['before','after'].every(id=>{const img=document.getElementById(id);return img.complete&&img.naturalWidth===960;}));comparisons++;
   }
  }
  await page.locator('#stage').selectOption('delicia-3');await page.locator('#zone').selectOption('1');
  await page.locator('#layers').selectOption('backdrop');const closed=await canvas();await page.locator('#flow').check();assert.notEqual(await canvas(),closed);
  const beforeScroll=await canvas();await page.locator('#camera').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.notEqual(await canvas(),beforeScroll);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.getElementById('play').disabled);
  const reduced=await canvas();await page.waitForTimeout(300);assert.equal(await canvas(),reduced);
  await page.locator('#compare').click();assert.equal(await page.locator('.before').isVisible(),false);await page.locator('#compare').click();
  await page.locator('#stage').selectOption('delicia-1');await page.locator('#layers').selectOption('all');
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(out,'gallery-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'gallery-mobile.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(Math.round((await page.locator('#scene').boundingBox()).width),320);
  // A contact sheet of native game captures, always at integer 2× scale.
  await page.setViewportSize({width:1352,height:970});
  const frames=[['delicia-1-1.png','CAIS · VELAS, TOLDOS E MATERIAIS'],['delicia-9-1.png','POMARES · FOLHAS, FLORES E CAMADAS'],['delicia-10-motion.png','REFINARIA · CORREIAS, RODAS E VAPOR'],['delicia-12-0.png','GUINA · ROSÁCEA E VIDRO FACETADO']];
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#191f35;color:#f5efd3;font-family:system-ui,sans-serif}main{padding:24px;width:1352px}h1{font-size:32px;margin:0 0 5px}p{margin:0 0 22px;font-size:17px;color:#bdcfd0}.grid{display:grid;grid-template-columns:640px 640px;gap:22px 24px}figure{margin:0}figcaption{font-size:14px;letter-spacing:.07em;padding:8px 0;color:#9ce3cf}img{display:block;width:640px;height:360px;image-rendering:pixelated}footer{font-size:14px;color:#adc4ca;margin-top:18px}</style><main><h1>Império da Delícia · Cenários em movimento</h1><p>Novos detalhes e animações na mesma grade de pixels do World.</p><div class="grid">${frames.map(([file,title])=>`<figure><img src="${base+relative}depois/${file}"><figcaption>${title}</figcaption></figure>`).join('')}</div><footer>Capturas do renderizador real em estados preparados para revisão visual.</footer></main>`);
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  await page.locator('main').screenshot({path:path.join(out,'preview.png')});
  const report={comparisons,animationPlayPause:true,manualFrame:true,valveResponse:true,cameraScroll:true,reducedMotion:true,mobileOverflow:false,nativeMobileWidth:320,errors};
  fs.writeFileSync(path.join(out,'gallery-report.json'),JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
