// Native browser background studies are labelled separately from input-only
// campaign runs. Camera/time are authored here only to compare paused pixels.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/backgrounds-2026-10-17/browser'),base=process.env.FEKA_UI_URL||'http://127.0.0.1:3001';
const mode=process.env.GUAIRA_BACKGROUND_MODE||'scenes';
const scenes=[['travessia','GuairaTraversal','GuairaTraversal',3000,55],['patio','junction/GuairaJunction','GuairaJunction',2900,50],
 ['respiros','respiros/GuairaRespiros','GuairaRespiros',3500,130],['subida','GuairaAscent','GuairaAscent',3860,-100],
 ['galeria','gallery/GuairaGallery','GuairaGallery',1920,35],['alivio','relief/GuairaRelief','GuairaRelief',900,190]];
if(process.env.GUAIRA_BACKGROUND_PROFILE==='joins'){
 const positions={travessia:[1730,50],patio:[1510,64],respiros:[1100,156],subida:[1330,-15],galeria:[980,100],alivio:[1540,195]};
 for(const scene of scenes)[scene[3],scene[4]]=positions[scene[0]];
}
const reviewPath=process.env.GUAIRA_BACKGROUND_REVIEW_PATH||'/docs/world/guaira/backgrounds-2026-10-17/index.html';
const chapter=process.env.GUAIRA_BACKGROUND_PROFILE==='chapter';
if(chapter)scenes.push(['lab','GuairaBullLab','GuairaBullLab',0,64],['prefeito','GuairaMayorLab','GuairaMayorLab',0,64]);
const entrances={travessia:[0,60],patio:[0,162],respiros:[0,144],subida:[0,162],galeria:[0,80],alivio:[0,176],lab:[0,64],prefeito:[0,64]};
const joins={travessia:[1376,52],patio:[800,68],respiros:[992,164],subida:[1184,4],galeria:[544,52],alivio:[576,196]};
const studies=chapter?[
 ...scenes.map(([id,file,name])=>[id,file,name,...entrances[id],id==='lab'||id==='prefeito'?'arena':'entrada']),
 ...scenes.filter(([id])=>joins[id]).map(([id,file,name])=>[id,file,name,...joins[id],'transicao']),
 ...scenes.filter(([id])=>joins[id]).map(scene=>[...scene,'extensao'])
]:scenes;
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'}),report={kind:'browser-background-studies',mode,profile:process.env.GUAIRA_BACKGROUND_PROFILE||'extended',studies:[],review:[],errors:[]};
 try{
  if(mode==='scenes')for(const reduced of [false,true]){
   const context=await browser.newContext({reducedMotion:reduced?'reduce':'no-preference',viewport:{width:1280,height:800}}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('super_feka_gaps_world_v1',JSON.stringify({version:1,
    completed:Array.from({length:15},(_,i)=>`${Math.floor(i/5)+1}-${i%5+1}`),selected:'3-5',seals:[],secrets:[],seen:[],times:{},checkpoint:null,
    preferences:{music:0,effects:0,voice:0,shake:false},guaira:{version:1,opening:'guaira-travessia',completed:[],selectedScene:'guaira-travessia',resumeScene:null,optional:{gallery:false,relief:false},audioEnabled:false}})));
   await page.goto(base+'/?chapter=guaira',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>window.worldGame);
   await page.evaluate(()=>{window.worldGame.dispose();});
   for(const[id,file,name,cx,cy,zone]of studies){
    const result=await page.evaluate(async({file,name,cx,cy})=>{
     const Scene=(await import('/src/adventure/experimental/guaira/'+file+'.ts'))[name];
     const canvas=document.createElement('canvas'),status=document.createElement('span');canvas.width=640;canvas.height=360;
     const g=new Scene(canvas,status);g.cancelFrame();g.running=false;
     const paint=document.createElement('canvas');paint.width=320;paint.height=180;const c=paint.getContext('2d');c.imageSmoothingEnabled=false;
     const state=()=>JSON.stringify({p:g.player.data,o:g.objects,b:g.boss,m:g.mayor,c:g.camera,tiles:g.level.data.tiles,save:g.store.save});
     const render=()=>{const before=state();c.clearRect(0,0,320,180);g.art.background(c,{id:1},cx,cy,g.time);if(state()!==before)throw Error('Painting mutated game state');return paint.toDataURL();};
     g.time=g.objects.time=6400;const first=render();g.time=g.objects.time=23700;const later=render();
     g.time=g.objects.time=6400;const repeat=render();
     g.pause();const frozenState=state();for(let i=0;i<90;i++)g.update(1000/60);
     const paused=render(),sameState=state()===frozenState;
     // This samples the background painter, not full-game FPS or physical devices.
     const durations=[];for(let i=0;i<60;i++){const start=performance.now();g.art.background(c,{id:1},cx,cy,g.time);durations.push(performance.now()-start);}
     durations.sort((a,b)=>a-b);
     const result={reduced:g.reducedMotion,readOnly:true,repeatable:first===repeat,moving:first!==later,paused:g.state==='paused',pausePixels:first===paused,pauseState:sameState,
      painterMedianMs:durations[30],painterP95Ms:durations[57],png:first};g.dispose();return result;
    },{file,name,cx,cy});
    assert.equal(result.reduced,reduced);assert.ok(result.readOnly&&result.repeatable&&result.paused&&result.pausePixels&&result.pauseState);
    if(reduced)assert.equal(result.moving,false);else if(id!=='galeria')assert.equal(result.moving,true);
    fs.writeFileSync(path.join(out,id+(zone?'-'+zone:'')+(reduced?'-reduced':'')+'.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
    report.studies.push({id,zone,authoredCamera:{cx,cy},...result});
   }await context.close();
  }else{
   const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+reviewPath,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    const assets=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,images:document.images.length}));assert.ok(assets.fits);
    const variants=[];
    for(const[id]of scenes){
     await page.selectOption('#scene',id);
     await page.waitForFunction(()=>document.querySelector('video').readyState>=1&&[...document.querySelectorAll('#comparison img')].every(i=>i.complete&&i.naturalWidth>0));
     const media=await page.evaluate(async()=>{const v=document.querySelector('video');v.scrollIntoView();v.muted=true;await v.play();await new Promise(r=>v.requestVideoFrameCallback(()=>r()));v.pause();return{width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.message??null};});
     assert.ok(media.width===960&&media.height===540&&media.duration>10&&!media.error);variants.push({id,...media});
    }
    await page.selectOption('#scene','subida');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});
    report.review.push({width,...assets,variants});
   }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
