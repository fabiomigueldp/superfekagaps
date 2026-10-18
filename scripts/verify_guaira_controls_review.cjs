const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/interactables-2026-10-17/browser');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3001';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={viewports:[],errors:[],passed:false};
 try{
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.goto(base+'/docs/world/guaira/interactables-2026-10-18/index.html',{waitUntil:'networkidle'});
   const videos=[];
   for(const id of ['travessia','patio','respiros'])for(const era of ['before','after']){
    await page.selectOption('#scene',id);await page.selectOption('#era',era);
    await page.locator('#film').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('#film').readyState>=2);
    const media=await page.evaluate(async()=>{
     const v=document.querySelector('#film');v.muted=true;await v.play();
     await new Promise(r=>v.requestVideoFrameCallback(r));v.currentTime=1.066667;
     await new Promise(r=>v.addEventListener('seeked',r,{once:true}));
     await new Promise(r=>v.requestVideoFrameCallback(r));v.pause();
     return{width:v.videoWidth,height:v.videoHeight,duration:v.duration,time:v.currentTime,error:v.error?.message??null};
    });
    assert.equal(media.width,1280);assert.equal(media.height,600);assert.equal(media.duration,8);assert.equal(media.error,null);videos.push({id,era,...media});
   }
   const sheets=[];
   for(const id of ['travessia','patio','respiros','subida','galeria','alivio','prefeito']){
    await page.selectOption('#survey-scene',id);await page.locator('#survey').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const i=document.querySelector('#survey');return i.complete&&i.naturalWidth>0;});
    const size=await page.locator('#survey').evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight}));assert.equal(size.width,960);sheets.push({id,...size});
   }
   const responses=[];
   const responseReport=JSON.parse(fs.readFileSync('docs/world/guaira/interactables-2026-10-18/response/native-verification.json','utf8'));
   assert.equal(responseReport.controls.length,11);
   for(const control of responseReport.controls)for(const phase of ['approach','operation','response']){
    await page.selectOption('#response-control',control.id);await page.selectOption('#response-phase',phase);
    await page.locator('#response-view').scrollIntoViewIfNeeded();
    const shot=await page.locator('#response-view').evaluate(async i=>{await i.decode();return{width:i.naturalWidth,height:i.naturalHeight,src:i.getAttribute('src'),alt:i.alt};});
    assert.equal(shot.width,320);assert.equal(shot.height,180);assert.equal(shot.src,'response/'+control[phase].file);
    assert.equal(await page.locator('#response-detail').textContent(),control[phase].detail);
    assert.ok(shot.alt.length>20);responses.push({id:control.id,phase,...shot});
   }
   await page.selectOption('#response-control','guaira-subida:course:bridge:800:valve');await page.selectOption('#response-phase','response');
   await page.locator('#response-view').evaluate(i=>i.decode());await page.locator('#resposta').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,'response-'+width+'.png'),fullPage:false});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.selectOption('#scene','travessia');await page.selectOption('#era','after');
   await page.waitForFunction(()=>document.querySelector('#film').readyState>=2);await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:false});
   report.viewports.push({width,fits:true,videos,sheets,responses});
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:report.passed,viewports:report.viewports.length,videos:report.viewports.reduce((n,v)=>n+v.videos.length,0)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
