const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/mayor-rework-2026-10-16/review-browser');fs.mkdirSync(out,{recursive:true});
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
const routes=['tests/helpers/guairaMayorGroundReplay.json'];
if(process.env.GUAIRA_MAYOR_EXTRA_ROUTE)routes.push(...process.env.GUAIRA_MAYOR_EXTRA_ROUTE.split(',').map(file=>file.trim()).filter(Boolean));
const review=process.env.GUAIRA_MAYOR_REVIEW_PATH||'/docs/world/guaira/mayor-rework-2026-10-16/index.html';
const offensive=process.env.GUAIRA_MAYOR_OFFENSIVE==='1';
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'}),report={physicalDevice:false,checks:[],errors:[]};
 try{
  for(const file of routes)for(const touch of [false,true]){
   const tape=JSON.parse(fs.readFileSync(file,'utf8')),route=path.basename(file,'.json');
   const context=await browser.newContext({viewport:offensive&&touch?{width:844,height:390}:{width:1280,height:800},hasTouch:touch,reducedMotion:touch?'reduce':'no-preference'}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/guaira-prefeito.html',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>window.worldGame?.mayor);await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load(g.stage.id);window.__proof={frames:0,minHead:Infinity};});
   let held=new Set();
   for(const [count,keys]of tape.runs){
    if(touch)await page.evaluate(keys=>{
     // Modern pages own their DOM touch buttons and suspend the canvas fallback.
     const actions={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',Space:'jump'},order=Object.keys(actions);
     const previous=window.__pointerHeld??[];
     for(const key of previous)if(!keys.includes(key))window.dispatchEvent(new PointerEvent('pointerup',{pointerId:order.indexOf(key)+10,pointerType:'touch',button:0,buttons:0,bubbles:true}));
     for(const key of keys)if(!previous.includes(key))document.querySelector('#guaira-touch-controls [data-action="'+actions[key]+'"]').dispatchEvent(new PointerEvent('pointerdown',{pointerId:order.indexOf(key)+10,pointerType:'touch',button:0,buttons:1,bubbles:true,cancelable:true}));
     window.__pointerHeld=keys;
    },keys);
    else{const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}
    await page.evaluate(({count,offensive})=>{const g=window.worldGame,p=window.__proof;for(let i=0;i<count;i++){const start=performance.now();g.update(1000/60);p.frames++;
     if(g.player.data.isDead||!g.player.data.hasHelmet)throw Error(JSON.stringify({at:p.frames,x:g.player.data.position.x,y:g.player.data.position.y,target:g.mayor.stampTarget,phase:g.mayor.state,input:g.input.getState(),touch:navigator.maxTouchPoints,focused:document.activeElement?.id}));
     p.minHead=Math.min(p.minHead,Math.round(g.player.data.position.y)-Math.round(g.camera.y)-4);
     if(offensive){g.render();if(g.mayor.rush)(p.frameWork??=[]).push(performance.now()-start);}
    }g.render();},{count,offensive});
    if(offensive&&keys.length===0&&await page.evaluate(()=>!!window.worldGame.mayor.rush&&!window.__proof.pausedDuringPursuit)){
     await page.locator('#lab-pause').click();
     await page.evaluate(()=>{const g=window.worldGame;
      if(g.state!=='paused')throw Error('toolbar did not pause');
      const snap=()=>JSON.stringify({m:g.mayor,p:g.player.data,o:g.objects,c:g.camera});
      const before=snap();for(let n=0;n<90;n++)g.update(1000/60);g.render();
      if(snap()!==before)throw Error('pursuit advanced while paused');
      window.__proof.pausedDuringPursuit=g.mayor.state;
     });
     await page.locator('#lab-pause').click();await page.locator('#game-canvas').focus();
    }
   }
   if(!touch)for(const k of held)await page.keyboard.up(k);
   const state=await page.evaluate(()=>{const p=window.__proof,samples=[...(p.frameWork??[])].sort((a,b)=>a-b);return{touch:navigator.maxTouchPoints>0,reduced:window.worldGame.reducedMotion,finished:window.worldGame.mayor.publicWaterOpen,...p,
    frameWork:samples.length?{samples:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),scope:'fixed-step update and draw during pursuit; excludes presentation and frame scheduling'}:null};});
   assert.equal(state.finished,true);assert.equal(state.frames,tape.frames);assert.ok(state.minHead>=26);
   if(offensive)assert.ok(state.pausedDuringPursuit);
   await page.screenshot({path:path.join(out,route+'-'+(touch?'touch':'keyboard')+'-complete.png')});
   await page.keyboard.press('Escape');await page.evaluate(()=>window.worldGame.update(1000/60));
   assert.equal(await page.evaluate(()=>window.worldGame.state),'paused');
   await page.locator('#lab-retry').click();assert.equal(await page.evaluate(()=>window.worldGame.mayor.sealsRemaining),3);
   report.checks.push({route,...state});await context.close();
  }
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.goto(base+review,{waitUntil:'networkidle'});
   await page.evaluate(()=>{for(const v of document.querySelectorAll('video')){v.preload='metadata';v.load();}});
   await page.waitForFunction(()=>[...document.images].every(x=>x.complete&&x.naturalWidth>0)&&[...document.querySelectorAll('video')].every(v=>v.readyState>=1));
   const media=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message??null}))}));
   assert.equal(media.fits,true);assert.equal(media.videos.length,Number(process.env.GUAIRA_MAYOR_VIDEO_COUNT||4));assert.ok(media.videos.every(v=>v.duration>18&&v.width===960&&v.height===540&&!v.error));
   media.decoded=await page.evaluate(async()=>{
    let decoded=0;
    for(const video of document.querySelectorAll('video')){
     const details=video.closest('details');if(details)details.open=true;
     video.scrollIntoView();video.muted=true;await video.play();
     await new Promise(resolve=>video.requestVideoFrameCallback(()=>resolve()));video.pause();decoded++;
     if(details)details.open=false;
    }
    scrollTo(0,0);return decoded;
   });
   assert.equal(media.decoded,media.videos.length);
   await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});report.checks.push({width,media});
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
