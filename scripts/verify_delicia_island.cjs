/* Focused asset integration and native input checks, always in isolated saves.
 * Uses existing Playwright/Chromium installations through the same environment
 * variables as verify_delicia.cjs. Mobile coverage is browser emulation.
 */
const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://127.0.0.1:3031';
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/island-v4/browser');
fs.mkdirSync(out,{recursive:true});
const report={url:base,checks:[],errors:[],screenshots:[],arrangedCases:[]};

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
  try {
    for(const [name,options] of [
      ['desktop',{viewport:{width:1440,height:1000}}],
      ['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],
    ]) {
      const context=await browser.newContext(options);
      const page=await context.newPage();
      page.on('pageerror',error=>report.errors.push(name+': '+error.message));
      page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))report.errors.push(response.status()+' '+response.url());});
      await page.goto(base+'/delicia.html');
      await page.getByRole('button',{name:'Jogar',exact:true}).click();
      await page.locator('.dl-pin').first().waitFor();
      const island=page.locator('.dl-map-island');await island.evaluate(img=>img.decode());
      const asset=await island.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,url:img.currentSrc}));
      const metadata=await (await page.request.get(base+'/assets/delicia/island-map.json?v=4')).json();
      assert.equal(metadata.revision,4);assert.equal(asset.width,metadata.image.width);assert.equal(asset.height,metadata.image.height);
      assert.ok(asset.url.endsWith('island.webp?v=4'));assert.equal(await page.locator('.dl-pin').count(),12);
      assert.equal(Object.keys(metadata.nodes).length,12);
      for(const point of Object.values(metadata.nodes))assert.ok(point.x>0&&point.x<1&&point.y>0&&point.y<1);
      const positions=await page.locator('.dl-pin').evaluateAll(pins=>pins.map(pin=>({x:parseFloat(pin.style.left)/100,y:parseFloat(pin.style.top)/100})));
      Object.values(metadata.nodes).forEach((point,i)=>{assert.ok(Math.abs(point.x-positions[i].x)<.0001);assert.ok(Math.abs(point.y-positions[i].y)<.0001);});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(out,name+'-map.png'),fullPage:true});
      report.screenshots.push(name+'-map.png');
      report.checks.push({name:name+' loads revision 4 and all twelve camera-projected pins',asset});
      if(name==='desktop') {
        await page.keyboard.press('ArrowRight');
        await page.getByRole('heading',{name:'Pomares da Partilha',exact:true}).waitFor();
        await page.keyboard.press('ArrowLeft');
        await page.getByRole('heading',{name:'Cais do Primeiro Gole',exact:true}).waitFor();
        await page.getByRole('button',{name:'Jogar',exact:true}).click();
        await page.getByRole('button',{name:'Pular',exact:true}).click();
        await page.locator('canvas.dl-canvas').focus();
        await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
        await page.waitForTimeout(180);await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Voltar ao mapa',exact:true}).click();
        await page.locator('.dl-map-island').waitFor();
        report.checks.push({name:'Keyboard selection, native stage entry, pause and return to map remain functional'});
        await page.goto(base+'/');
        await page.locator('#game-canvas').waitFor();
        await page.locator('#game-canvas').focus();
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Ver panorama',exact:true}).click();
        const worldLink=page.locator('.world-map-delicia-island');await worldLink.waitFor({state:'visible'});
        await page.waitForTimeout(900);
        assert.ok(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/assets/delicia/island.webp?v=4'))));
        await page.screenshot({path:path.join(out,'world-panorama.png'),fullPage:true});
        report.screenshots.push('world-panorama.png');
        await worldLink.click();await page.getByRole('button',{name:/^(Jogar|Continuar)$/}).waitFor();
        report.checks.push({name:'World panorama loads the same revision 4 asset and its island link opens the campaign'});
      } else {
        const second=page.getByRole('button',{name:/^2\. Pomares da Partilha/});
        await second.tap();await page.getByRole('heading',{name:'Pomares da Partilha',exact:true}).waitFor();
        await page.getByRole('button',{name:/^1\. Cais do Primeiro Gole/}).tap();
        await page.getByRole('heading',{name:'Cais do Primeiro Gole',exact:true}).waitFor();
        report.checks.push({name:'Mobile emulation: map pins respond to actual taps without page overflow'});
      }
      await context.close();
    }
    assert.deepEqual(report.errors,[]);report.passed=true;
  } finally {
    await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
