const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/fluid-finish-2026-10-17/browser');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3001';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={viewports:[],errors:[],passed:false};
 try{
  const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.goto(base+'/docs/world/guaira/fluid-finish-2026-10-17/index.html',{waitUntil:'networkidle'});
   const variants=[];
   for(const [select,video,ids,dimensions]of [
    ['#scene','#film',['respiros','comporta','canos','alivio'],[1280,408]],
    ['#native-scene','#native-film',['travessia','respiros'],[960,540]]
   ])for(const id of ids){
    await page.selectOption(select,id);
    await page.waitForFunction(selector=>document.querySelector(selector).readyState>=2&&[...document.images].every(i=>i.complete&&i.naturalWidth>0),video);
    const media=await page.evaluate(async selector=>{
     const v=document.querySelector(selector);v.scrollIntoView();v.muted=true;await v.play();await new Promise(r=>v.requestVideoFrameCallback(()=>r()));
     v.currentTime=Math.min(2.1,v.duration/2);await new Promise(r=>v.addEventListener('seeked',r,{once:true}));
     await new Promise(r=>v.requestVideoFrameCallback(()=>r()));v.pause();
     return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,time:v.currentTime,error:v.error?.message??null};
    },video);
    assert.equal(media.width,dimensions[0]);assert.equal(media.height,dimensions[1]);assert.ok(media.duration>8&&media.time>=2&&!media.error);
    variants.push({id,kind:select==='#scene'?'authored-study':'native-gameplay',...media});
   }
   await page.selectOption('#scene','respiros');await page.waitForFunction(()=>document.querySelector('#film').readyState>=2);
   await page.evaluate(()=>scrollTo(0,0));
   const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert.ok(fits);
   await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});report.viewports.push({width,fits,variants});
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:report.passed,viewports:report.viewports.length,videos:report.viewports.reduce((n,v)=>n+v.variants.length,0)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
