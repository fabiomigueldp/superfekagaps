/* Real game painters; arranged camera positions review artwork, not campaign completion. */
const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://localhost:3000';
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/scenery-review');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.CHROMIUM_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(base+'/?chapter=delicia');await page.waitForFunction(()=>window.worldGame?.mapView);
  const report=await page.evaluate(async()=>{
   const {ALL_DELICIA_STAGES}=await import('/src/adventure/delicia/DeliciaContent.ts');
   const {DeliciaSimulation}=await import('/src/adventure/delicia/DeliciaSimulation.ts');
   const {drawDeliciaBackdrop}=await import('/src/adventure/delicia/DeliciaPixelBackdrop.ts');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d',{willReadFrequently:true});
   // Readback forces a software surface. Time ordinary drawing on a separate game-like context.
   const timingCanvas=document.createElement('canvas');timingCanvas.width=320;timingCanvas.height=180;const timingContext=timingCanvas.getContext('2d');
   const stages=[],scroll=[],timings=[];let frames=0,transparentPixels=0,stateMutations=0;
   const render=(sim,time)=>{c.clearRect(0,0,320,180);drawDeliciaBackdrop(c,sim,time);return c.getImageData(0,0,320,180).data;};
   for(const stage of ALL_DELICIA_STAGES){
    const sim=new DeliciaSimulation(stage),end=Math.max(0,stage.width-960);
    stages.push({id:stage.id,name:stage.name,biome:stage.biome,zones:(stage.zones||[]).map(z=>z.name)});
    let worst=0;
    for(let step=0;step<=24;step++){
     sim.cameraX=Math.round(end*step/24);sim.cameraY=step%3===0?-90:step%3===1?45:0;sim.time=2.5;
     const state=JSON.stringify(sim),pixels=render(sim,2.5);frames++;
     for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)transparentPixels++;
     if(JSON.stringify(sim)!==state)stateMutations++;
     sim.cameraX+=3;const next=render(sim,2.5);frames++;let changed=0;
     for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==next[i]||pixels[i+1]!==next[i+1]||pixels[i+2]!==next[i+2])changed++;
     worst=Math.max(worst,changed/(320*180));
    }
    scroll.push({stage:stage.id,maxChangedFractionPerNativeCameraPixel:worst});
    sim.cameraX=0;sim.cameraY=0;
    for(let i=-2;i<20;i++){const start=performance.now();drawDeliciaBackdrop(timingContext,sim,i*.2);if(i>=0)timings.push(performance.now()-start);}
   }
   timings.sort((a,b)=>a-b);
   return {stages,frames,transparentPixels,stateMutations,scroll,backdropRenderMs:{median:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)]},arranged:true};
  });
  report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  assert.equal(report.transparentPixels,0,'Every camera height retains a complete backdrop');
  assert.equal(report.stateMutations,0,'Artwork must not alter gameplay state');
  assert.deepEqual(errors,[]);
  assert.ok(report.scroll.every(s=>s.maxChangedFractionPerNativeCameraPixel<.2),'A parallax layer popped instead of scrolling');
  console.log(JSON.stringify({frames:report.frames,stages:report.stages.length,transparentPixels:report.transparentPixels,stateMutations:report.stateMutations,backdropRenderMs:report.backdropRenderMs,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
