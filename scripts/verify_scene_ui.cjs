const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 fs.mkdirSync('output',{recursive:true});
 const browser=await chromium.launch({headless:true}), results=[];
 for(const viewport of [{width:1440,height:900},{width:320,height:700},{width:812,height:375},{width:640,height:360}]) {
  const context=await browser.newContext({viewport,hasTouch:viewport.width<1000,reducedMotion:'reduce'});
  const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.FEKA_UI_URL || 'http://127.0.0.1:3000/') + '?chapter=guaira',{waitUntil:'networkidle',timeout:120000});
  await page.evaluate(async()=>{
 fs.mkdirSync('output',{recursive:true});window.auditCampaign=window.worldGame;await window.worldGame.mountChapter('guaira','guaira-respiros')});
  await page.waitForSelector('[data-state="playing"]');
  const canvas=page.locator('#game-canvas'), box=await canvas.boundingBox();
  if(viewport.width<1000) {
   const jump=page.locator('.guaira-touch-button[data-action="jump"]');
   assert.ok(await jump.evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}), 'Touch controls must receive actual pointer hits above the chapter host');
  }
  assert.equal(await page.locator('.chapter-game-toolbar button:visible').count(),1);
  await page.screenshot({path:`output/ui-${viewport.width}-playing.png`});
  await page.locator('#chapter-primary').click();
  await page.waitForSelector('[data-state="paused"]');
  assert.deepEqual(await canvas.boundingBox(),box);
  assert.equal(await page.locator('.chapter-game-toolbar button:visible').count(),3);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'chapter-primary');
  for(const id of ['chapter-primary','chapter-options','chapter-map-return']) {
   const b=await page.locator('#'+id).boundingBox(); assert.ok(b.width>=44 && b.height>=44 && b.y>=0 && b.y+b.height<=viewport.height, id);
  }
  await page.screenshot({path:`output/ui-${viewport.width}-paused.png`});
  await page.keyboard.press('ArrowDown'); assert.equal(await page.evaluate(()=>document.activeElement.id),'chapter-options');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#chapter-pause-options').isVisible(),true);
  await page.locator('#chapter-sound').click();
  assert.equal(await page.evaluate(()=>window.worldGame.state),'paused');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'chapter-sound');
  await page.locator('#chapter-controls').click();
  assert.equal(await page.locator('#chapter-controls-help').isVisible(),true);
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(()=>window.worldGame.state),'paused');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#chapter-pause-options').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'chapter-options');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-state="playing"]'); assert.deepEqual(await canvas.boundingBox(),box);
  // Inject a native result to verify UI transitions, not to claim a gameplay victory.
  await page.evaluate(()=>{window.worldGame.finished=true;});
  await page.waitForSelector('[data-state="complete"]');
  assert.deepEqual(await canvas.boundingBox(),box);
  assert.equal(await page.locator('.chapter-game-toolbar button:visible').count(),1);
  await page.screenshot({path:`output/ui-${viewport.width}-complete.png`});
  await page.locator('#chapter-primary').click();
  await page.waitForSelector('.world-map:not([hidden])');
  assert.equal(await page.locator('.chapter-game-toolbar').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  results.push({viewport,canvas:box,checks:['play','pause','keyboard','options','sound','help','resume','injected completion','return to map','stable canvas','no errors']});
  await context.close();
 }
 fs.writeFileSync('output/ui-verification.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results)); await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
