const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mode=process.env.GUAIRA_BULL_MODE||'all',base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/bull-rhythm-2026-10-16/browser');fs.mkdirSync(out,{recursive:true});
const read=name=>JSON.parse(fs.readFileSync('tests/helpers/'+name+'.json','utf8'));
const review=process.env.GUAIRA_REVIEW_PATH||'/docs/world/guaira/bull-rhythm-2026-10-16/index.html';
const recovery=process.env.GUAIRA_BULL_RECOVERY==='1',reviewMinSeconds=Number(process.env.GUAIRA_REVIEW_MIN_SECONDS||17);
const arcs=process.env.GUAIRA_BULL_ARCS==='1';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={physicalDevice:false,routes:[],pauses:[],review:[],errors:[]};
 try{
  async function fresh(touch,reduced=touch){
   const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/guaira-lab.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.boss?.model);
   await page.locator('#game-canvas').focus();await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.load('guaira-lab');window.__audit={frames:0,health:6,hits:[],damage:[],helmet:true,minHead:Infinity,costs:[]};});
   return {context,page};
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
   for(const [count,codes]of tape.runs){await keys(codes);const n=Math.min(count,until-frame);
    await page.evaluate(n=>{const g=window.worldGame,a=window.__audit;for(let i=0;i<n;i++){
     const start=performance.now();g.update(1000/60);g.render();a.costs.push(performance.now()-start);a.frames++;
     const p=g.player.data;if(p.isDead)throw Error('Native death at '+a.frames);
     if(a.helmet&&!p.hasHelmet)a.damage.push(a.frames);a.helmet=p.hasHelmet;
     if(g.boss.health<a.health)a.hits.push(a.frames);a.health=g.boss.health;
     a.minHead=Math.min(a.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
    }},n);frame+=n;if(frame===until)break;
   }await keys([]);
   return page.evaluate(()=>{const g=window.worldGame,a=window.__audit,costs=a.costs.slice(60).sort((a,b)=>a-b);return {frames:a.frames,hits:a.hits,damage:a.damage,minHead:a.minHead,health:g.boss.health,finished:g.boss.phase==='defeated',reduced:g.reducedMotion,
    renderCpuMs:{samples:costs.length,median:costs[Math.floor(costs.length*.5)],p95:costs[Math.floor(costs.length*.95)]}};});
  }
  if(mode!=='review'){
   for(const route of ['guairaLabReplay','guairaBullPoundReplay',...(recovery?['guairaBullMissReplay']:[]),...(arcs?['guairaBullArcFailureReplay']:[])])for(const touch of [false,true]){
    const {context,page}=await fresh(touch),tape=read(route),state=await play(page,tape,touch);
    assert.equal(state.health,tape.expectedFinalHealth??0);assert.equal(state.finished,state.health===0);assert.deepEqual(state.hits,tape.expectedHits.map(h=>h.frame+1));assert.ok(state.minHead>=23);
    assert.deepEqual(state.damage,tape.expectedDamageFrames??[]);
    await page.screenshot({path:path.join(out,route+'-'+(touch?'touch':'keyboard')+'.png')});
    assert.equal(await page.evaluate(()=>window.worldGame.canAdvanceToAscent),state.finished);
    await page.keyboard.press('Escape');await page.evaluate(()=>window.worldGame.update(1000/60));assert.equal(await page.evaluate(()=>window.worldGame.state),'paused');
    await page.locator('#lab-retry').click();assert.equal(await page.evaluate(()=>window.worldGame.boss.health),6);
    assert.equal(await page.evaluate(()=>window.worldGame.canAdvanceToAscent),false);
    report.routes.push({route,touch,...state});await context.close();
   }
   const markers=read('guairaLabReplay').markers;
   const pauses=[['guairaLabReplay',markers.returnTell+14,'turn',false],['guairaLabReplay',markers.defeat+24,'defeated',false],
    ...(recovery?[['guairaBullMissReplay',251,'idle',true],['guairaLabReplay',markers.firstVolley+36,'bones',false]]:[]),
    ...(arcs?[['guairaLabReplay',markers.firstVolley+10,'bones',false]]:[])];
   for(const reduced of [false,true])for(const [route,target,expected,closing]of pauses){
    const {context,page}=await fresh(false,reduced);await play(page,read(route),false,target);
    assert.equal(await page.evaluate(()=>window.worldGame.boss.model.state),expected);
    assert.equal(await page.evaluate(()=>!!window.worldGame.boss.model.rearming),closing);
    await page.keyboard.press('Escape');await page.evaluate(()=>window.worldGame.update(1000/60));
    const result=await page.evaluate(()=>{const g=window.worldGame,c=document.querySelector('#game-canvas');g.render();
     const pixels=c.toDataURL(),state=JSON.stringify({b:g.boss,p:g.player.data,c:g.camera,t:g.time});
     for(let i=0;i<90;i++){g.update(1000/60);g.render();}
     return {paused:g.state==='paused',pixelsFrozen:pixels===c.toDataURL(),stateFrozen:state===JSON.stringify({b:g.boss,p:g.player.data,c:g.camera,t:g.time})};
    });assert.ok(result.paused&&result.pixelsFrozen&&result.stateFrozen);report.pauses.push({route,target,expected,reduced,...result});await context.close();
   }
  }
  if(mode!=='play'){
   const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+review,{waitUntil:'networkidle'});
    await page.evaluate(()=>{for(const v of document.querySelectorAll('video')){v.preload='metadata';v.load();}});
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)&&[...document.querySelectorAll('video')].every(v=>v.readyState>=1));
    const media=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,videos:[...document.querySelectorAll('video')].map(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message??null}))}));
    assert.equal(media.fits,true);assert.equal(media.videos.length,3);assert.ok(media.videos.every(v=>v.duration>reviewMinSeconds&&v.width===960&&v.height===540&&!v.error));
    media.decoded=await page.evaluate(async()=>{let count=0;for(const v of document.querySelectorAll('video')){const d=v.closest('details');if(d)d.open=true;v.scrollIntoView();v.muted=true;await v.play();await new Promise(r=>v.requestVideoFrameCallback(()=>r()));v.pause();count++;if(d)d.open=false;}scrollTo(0,0);return count;});
    assert.equal(media.decoded,3);await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});report.review.push({width,media});
   }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report-'+mode+'.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
