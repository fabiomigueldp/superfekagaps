const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/enemies-2026-10-17/browser');fs.mkdirSync(out,{recursive:true});
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3001',mode=process.env.GUAIRA_FOES_MODE||'play';
const tapes=JSON.parse(fs.readFileSync('tests/helpers/guairaFoeEncounters.json','utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={physicalDevice:false,routes:[],pauses:[],review:[],errors:[]};
 try{
  async function fresh(tape,touch){
   const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:touch,reducedMotion:touch?'reduce':'no-preference'}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/guaira-travessia.html',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>window.worldGame?.foes?.length);await page.locator('#game-canvas').focus();
   await page.evaluate(tape=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    window.__foeAudit={frame:0,damage:[],minHead:Infinity,maxFeet:0,hints:[],helmet:true,foeId:tape.foeId};},tape);
   return {page,context};
  }
  async function play(page,tape,touch,until=tape.frames){
   let held=new Set(),frame=0;
   async function keys(codes){
    if(touch)await page.evaluate(codes=>{
     const actions={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ShiftLeft:'run',Space:'jump'},order=Object.keys(actions),previous=window.__held??[];
     for(const code of previous)if(!codes.includes(code))window.dispatchEvent(new PointerEvent('pointerup',{pointerId:order.indexOf(code)+10,pointerType:'touch',button:0,buttons:0,bubbles:true}));
     for(const code of codes)if(!previous.includes(code))document.querySelector('#guaira-touch-controls [data-action="'+actions[code]+'"]').dispatchEvent(new PointerEvent('pointerdown',{pointerId:order.indexOf(code)+10,pointerType:'touch',button:0,buttons:1,bubbles:true,cancelable:true}));
     window.__held=codes;
    },codes);
    else{const next=new Set(codes);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}
   }
   for(const[count,codes]of tape.runs){await keys(codes);const n=Math.min(count,until-frame);
    await page.evaluate(n=>{const g=window.worldGame,a=window.__foeAudit;for(let i=0;i<n;i++){
     g.update(1000/60);g.render();a.frame++;const p=g.player.data;if(p.isDead)throw Error('Death at '+a.frame);
     if(a.helmet&&!p.hasHelmet)a.damage.push(a.frame);a.helmet=p.hasHelmet;
     a.minHead=Math.min(a.minHead,p.position.y-4-g.camera.y);a.maxFeet=Math.max(a.maxFeet,p.position.y+p.height-g.camera.y);
    }},n);frame+=n;if(frame===until)break;
   }await keys([]);
   return page.evaluate(()=>{const g=window.worldGame,a=window.__foeAudit,e=g.foes.find(e=>e.spec.id.endsWith(a.foeId));return {frame:a.frame,damage:a.damage,minHead:a.minHead,maxFeet:a.maxFeet,killed:e.dead,phase:e.phase,high:e.highThrow,reduced:g.reducedMotion};});
  }
  if(mode!=='review'){
   for(const[name,tape]of Object.entries(tapes))for(const touch of [false,true]){
    const {page,context}=await fresh(tape,touch),result=await play(page,tape,touch);
    assert.equal(result.frame,tape.frames);assert.deepEqual(result.damage,tape.damage);assert.equal(result.killed,tape.killed);
    assert.ok(result.minHead>=23&&result.maxFeet<=172.01);assert.equal(result.reduced,touch);
    await page.screenshot({path:path.join(out,name+'-'+(touch?'touch':'keyboard')+'.png')});report.routes.push({name,touch,...result});await context.close();
   }
   for(const[name,until]of [['pincer-counter',60],['loader-counter',280]])for(const touch of [false,true]){
    const tape=tapes[name],{page,context}=await fresh(tape,touch),result=await play(page,tape,touch,until);assert.equal(result.phase,'warning');
    await page.keyboard.press('Escape');await page.evaluate(()=>window.worldGame.update(1000/60));
    const frozen=await page.evaluate(()=>{const g=window.worldGame,c=document.querySelector('#game-canvas');g.render();
     const state=()=>JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,c:g.camera,t:g.time}),before=state(),pixels=c.toDataURL();
     for(let n=0;n<90;n++){g.update(1000/60);g.render();}
     return {paused:g.state==='paused',state:state()===before,pixels:c.toDataURL()===pixels};
    });assert.ok(frozen.paused&&frozen.state&&frozen.pixels);report.pauses.push({name,touch,until,...frozen});await context.close();
   }
  }else{
   const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'/docs/world/guaira/enemies-2026-10-17/index.html',{waitUntil:'networkidle'});
    await page.evaluate(()=>{for(const v of document.querySelectorAll('video')){v.preload='metadata';v.load();}});
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)&&[...document.querySelectorAll('video')].every(v=>v.readyState>=1));
    const media=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,videos:[...document.querySelectorAll('video')].map(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message??null}))}));
    assert.ok(media.fits);assert.equal(media.videos.length,5);assert.ok(media.videos.every(v=>v.duration>1&&v.width===960&&v.height===540&&!v.error));
    media.decoded=await page.evaluate(async()=>{let count=0;for(const v of document.querySelectorAll('video')){const d=v.closest('details');if(d)d.open=true;v.scrollIntoView();v.muted=true;await v.play();await new Promise(r=>v.requestVideoFrameCallback(()=>r()));v.pause();count++;if(d)d.open=false;}scrollTo(0,0);return count;});
    assert.equal(media.decoded,5);await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});report.review.push({width,media});
   }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report-'+mode+'.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
