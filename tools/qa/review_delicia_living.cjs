/* Real painters in arranged states: animation/readability evidence, not a playthrough. */
const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DELICIA_URL||'http://localhost:3000';
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/living-world-final');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.CHROMIUM_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(base+'/delicia.html');await page.waitForFunction(()=>window.worldGame?.mapView);
  const result=await page.evaluate(async()=>{
   const {ALL_DELICIA_STAGES}=await import('/src/adventure/delicia/DeliciaContent.ts');
   const {DeliciaSimulation}=await import('/src/adventure/delicia/DeliciaSimulation.ts');
   const {DeliciaArt}=await import('/src/adventure/delicia/DeliciaArt.ts');
   const {drawDeliciaBackdrop,drawDeliciaProps}=await import('/src/adventure/delicia/DeliciaPixelScenery.ts');
   const {drawDeliciaLandmarks}=await import('/src/adventure/delicia/DeliciaSceneryLandmarks.ts');
   const details=await import('/src/adventure/delicia/DeliciaSceneDetails.ts');
   const {drawDeliciaProp}=await import('/src/adventure/delicia/DeliciaPropArt.ts');
   const native=document.createElement('canvas');native.width=320;native.height=180;
   const c=native.getContext('2d',{willReadFrequently:true});
   const scaled=document.createElement('canvas');scaled.width=960;scaled.height=540;
   const cc=scaled.getContext('2d',{willReadFrequently:true}),art=new DeliciaArt();await art.load();
   const pixels=()=>new Uint8ClampedArray(c.getImageData(0,0,320,180).data);
   const difference=(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])count++;return count;};
   const scenery=(sim,time)=>{c.clearRect(0,0,320,180);drawDeliciaBackdrop(c,sim,time);drawDeliciaProps(c,sim,time);return pixels();};
   const cases=[],captures=[],offGrid=[];let stateMutations=0,brokenPixels=0,animatedFrames=0;
   for(const stage of ALL_DELICIA_STAGES){
    const sim=new DeliciaSimulation(stage);sim.cameraX=stage.boss?400:stage.zones[1].x;sim.cameraY=0;
    stage.valves.forEach(v=>sim.valves.add(v.id));
    const floor=stage.floors.find(f=>f.h>50&&f.x<=sim.cameraX+110&&f.x+f.w>sim.cameraX+130);
    sim.player.x=sim.cameraX+100;sim.player.y=(floor?.y??450)-sim.player.h;sim.player.grounded=true;
    if(sim.boss){sim.boss.start();sim.boss.beat='tell';sim.boss.beatTime=.3;}
    sim.time=0;const before=JSON.stringify(sim),first=scenery(sim,0);if(JSON.stringify(sim)!==before)stateMutations++;
    const moving=Math.max(...[.5,1.4,2.8].map(time=>difference(first,scenery(sim,time))));sim.time=35;const frozen=difference(first,scenery(sim,0));
    cases.push({stage:stage.id,movingPixels:moving,reducedMotionChangedPixels:frozen});
    for(const time of [0,.5,1.4,2.8]){
     sim.time=time;const state=JSON.stringify(sim);art.draw(cc,sim,false);animatedFrames++;
     if(JSON.stringify(sim)!==state)stateMutations++;
     const p=cc.getImageData(0,0,960,540).data;
     for(let y=0;y<540;y++)for(let x=0;x<960;x++){
      const i=(y*960+x)*4,j=(Math.floor(y/3)*3*960+Math.floor(x/3)*3)*4;
      if(p[i]!==p[j]||p[i+1]!==p[j+1]||p[i+2]!==p[j+2]){brokenPixels++;if(offGrid.length<20)offGrid.push({stage:stage.id,time,x,y});}
     }
     if(time===1.4)captures.push({file:stage.id+'-motion.png',data:scaled.toDataURL()});
    }
   }
   const aqueduct=ALL_DELICIA_STAGES.find(s=>s.id==='delicia-3'),valves=[];
   // The decorative flow must follow the same source as that zone's playable bridge.
   for(const index of [1,2]){
    const sim=new DeliciaSimulation(aqueduct);sim.cameraX=aqueduct.zones[index].x;
    const paint=time=>{c.clearRect(0,0,320,180);drawDeliciaLandmarks(c,sim,time);return pixels();};
    const closed=paint(0),still=difference(closed,paint(2));sim.valves.add('v11');
    const wrongSource=difference(closed,paint(2));sim.valves.clear();sim.valves.add('v5');
    const open=paint(0),flow=difference(closed,open),moving=difference(open,paint(2));
    valves.push({zone:index,closedWheelChangedPixels:still,unrelatedSourceChangedPixels:wrongSource,restoredFlowPixels:flow,restoredWheelMovingPixels:moving});
   }
   // Isolated details at four times make motion inspectable without pausing a whole campaign.
   const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=1310;const sc=sheet.getContext('2d');sc.imageSmoothingEnabled=false;
   sc.fillStyle='#191f35';sc.fillRect(0,0,1280,1310);sc.fillStyle='#f5efd3';sc.font='bold 20px system-ui';sc.fillText('IMPÉRIO DA DELÍCIA · ESTUDOS DE MOVIMENTO',24,32);
   const samples=[
    {name:'Tecidos do cais',paint:(ctx,t)=>details.cloth(ctx,20,29,38,35,t)},
    {name:'Rodas e biela',paint:(ctx,t)=>details.drive(ctx,40,56,t)},
    {name:'Fornalha e vapor',paint:(ctx,t)=>{details.flame(ctx,32,44,t);details.chimneyVapor(ctx,65,57,t);}},
    {name:'Água e espuma',paint:(ctx,t)=>details.waterRibbons(ctx,42,18,13,51,t)},
    {name:'Folhas e flores',paint:(ctx,t)=>{drawDeliciaProp(ctx,'orchard',22,65,2,t);drawDeliciaProp(ctx,'aqueduct',62,65,3,t);}},
   ];
   samples.forEach((sample,row)=>{
    const y=78+row*245;sc.fillStyle='#9ce3cf';sc.font='16px system-ui';sc.fillText(sample.name,24,y-12);
    [0,.5,1.4,2.8].forEach((time,col)=>{
     c.fillStyle='#203547';c.fillRect(0,0,320,180);sample.paint(c,time);
     sc.drawImage(native,0,0,110,90,24+col*312,y,220,180);
     sc.fillStyle='#bdcfd0';sc.font='14px system-ui';sc.fillText(time.toFixed(1)+' s',24+col*312,y+201);
    });
   });
   captures.push({file:'animation-studies.png',data:sheet.toDataURL()});art.dispose();
   return {report:{cases,valves,animatedFrames,brokenPixels,offGrid,stateMutations,arranged:true},captures};
  });
  const {report,captures}=result;report.errors=errors;
  for(const capture of captures)fs.writeFileSync(path.join(out,capture.file),Buffer.from(capture.data.split(',')[1],'base64'));
  fs.writeFileSync(path.join(out,'animation-report.json'),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);assert.equal(report.brokenPixels,0);assert.equal(report.stateMutations,0);
  assert.ok(report.cases.every(c=>c.movingPixels>0&&c.reducedMotionChangedPixels===0));
  assert.ok(report.valves.every(v=>v.closedWheelChangedPixels===0&&v.unrelatedSourceChangedPixels===0&&v.restoredFlowPixels>0&&v.restoredWheelMovingPixels>0));
  console.log(JSON.stringify({stages:report.cases.length,animatedFrames:report.animatedFrames,brokenPixels:report.brokenPixels,stateMutations:report.stateMutations,valves:report.valves,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
