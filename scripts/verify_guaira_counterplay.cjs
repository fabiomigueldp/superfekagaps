const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.GUAIRA_OUTPUT||'output/guaira/enemy-counterplay-2026-10-17/browser'),base=process.env.FEKA_UI_URL||'http://127.0.0.1:3001';
const tapes=JSON.parse(fs.readFileSync('tests/helpers/guairaCounterplayReplays.json','utf8')),mode=process.env.GUAIRA_COUNTERPLAY_MODE||'play';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={physicalDevice:false,setup:'isolated prerequisite save, native chapter mounting and ordinary checkpoint load',routes:[],pauses:[],review:[],errors:[]};
 try{
  async function fresh(tape,pad){
   const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:pad?'reduce':'no-preference'}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.addInitScript(({tape,pad})=>{
    const route=['guaira-travessia','guaira-respiros','guaira-lab','guaira-subida','guaira-prefeito'],relief=tape.course==='alivio',resume=relief?'relief':tape.stage;
    localStorage.setItem('super_feka_gaps_world_v1',JSON.stringify({version:1,completed:Array.from({length:15},(_,i)=>`${Math.floor(i/5)+1}-${i%5+1}`),selected:'3-5',seals:[],secrets:[],seen:[],times:{},checkpoint:null,
     preferences:{music:0,effects:0,voice:0,shake:false},guaira:{version:1,opening:'guaira-travessia',completed:relief?route:route.slice(0,route.indexOf(tape.stage)),selectedScene:relief?'guaira-prefeito':tape.stage,resumeScene:resume,optional:{gallery:relief,relief:false},audioEnabled:false}}));
    if(pad){window.__pad={index:0,id:'counterplay-standard-pad',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__pad]});}
   },{tape,pad});
   await page.goto(base+'/guaira-capitulo.html',{waitUntil:'networkidle'});
   await page.waitForFunction(id=>window.worldGame?.stage?.id===id,tape.stage);await page.bringToFront();await page.locator('#game-canvas').focus();
   await page.evaluate(tape=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(tape.foeId)),a=window.__audit={frame:0,contacts:[],minHead:Infinity,maxFeet:0},contact=e.contact.bind(e);
    e.contact=(p,previous,falling,pound)=>{const phase=e.phase,result=contact(p,previous,falling,pound);if(result==='bounce'||result==='kill')a.contacts.push({frame:a.frame+1,result,phase,pound});return result;};
   },tape);return{context,page};
  }
  async function play(page,tape,pad,until=tape.frames){
   let held=new Set(),frame=0;
   async function input(keys){if(pad)await page.evaluate(keys=>{const map={ArrowLeft:14,ArrowRight:15,ArrowDown:13,ShiftLeft:2,Space:0},ids=keys.map(k=>map[k]);window.__pad.buttons.forEach((b,i)=>{b.pressed=ids.includes(i);b.value=b.pressed?1:0;});},keys);
    else{const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}}
   for(const[count,keys]of tape.runs){await input(keys);const n=Math.min(count,until-frame);
    await page.evaluate(n=>{const g=window.worldGame,a=window.__audit;for(let i=0;i<n;i++){g.update(1000/60);a.frame++;const p=g.player.data;if(p.isDead||!p.hasHelmet)throw Error('damage at '+a.frame);a.minHead=Math.min(a.minHead,p.position.y-4-g.camera.y);a.maxFeet=Math.max(a.maxFeet,p.position.y+p.height-g.camera.y);}g.render();},n);
    frame+=n;if(frame===until)break;
   }await input([]);return page.evaluate(()=>({...window.__audit,reduced:window.worldGame.reducedMotion}));
  }
  if(mode==='play'){
   for(const[name,tape]of Object.entries(tapes))for(const pad of [false,true]){
    const{context,page}=await fresh(tape,pad),result=await play(page,tape,pad);assert.equal(result.frame,tape.frames);assert.equal(result.reduced,pad);
    assert.deepEqual(result.contacts,tape.contacts.map(({frame,result,phase,pound})=>({frame,result,phase,pound})),JSON.stringify({name,pad,world:await page.evaluate(()=>({state:window.worldGame.state,position:window.worldGame.player.data.position,active:document.activeElement?.id,focused:document.hasFocus()}))}));assert.ok(result.minHead>=23&&result.maxFeet<=172.01);
    await page.screenshot({path:path.join(out,name+'-'+(pad?'gamepad':'keyboard')+'.png')});report.routes.push({name,input:pad?'simulated-gamepad':'keyboard',...result});await context.close();
   }
   for(const[name,until]of [['charger-counter',118],['rail-window',146]])for(const pad of [false,true]){
    const{context,page}=await fresh(tapes[name],pad);await play(page,tapes[name],pad,until);
    if(pad)await page.evaluate(()=>{window.__pad.buttons[9].pressed=true;window.__pad.buttons[9].value=1;window.worldGame.update(1000/60);window.__pad.buttons[9].pressed=false;window.__pad.buttons[9].value=0;});
    else{await page.keyboard.press('Escape');await page.evaluate(()=>window.worldGame.update(1000/60));}
    const result=await page.evaluate(()=>{const g=window.worldGame,c=document.querySelector('#game-canvas');g.render();const snapshot=()=>JSON.stringify({p:g.player.data,e:g.foes,o:g.objects,t:g.time,c:g.camera}),before=snapshot(),pixels=c.toDataURL();for(let n=0;n<90;n++){g.update(1000/60);g.render();}return{paused:g.state==='paused',state:before===snapshot(),pixels:pixels===c.toDataURL()};});
    assert.ok(result.paused&&result.state&&result.pixels);await page.locator('#chapter-primary').click();assert.equal(await page.evaluate(()=>window.worldGame.state),'playing');
    report.pauses.push({name,input:pad?'simulated-gamepad':'keyboard',until,...result,resumed:true});await context.close();
   }
  }else{
   const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'/docs/world/guaira/enemy-counterplay-2026-10-17/index.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)&&[...document.querySelectorAll('video')].every(v=>v.readyState>=1));
    const media=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.message??null}))}));
    assert.ok(media.fits);assert.equal(media.videos.length,5);assert.ok(media.videos.every(v=>v.width===960&&v.height===540&&v.duration>2&&!v.error));
    media.decoded=await page.evaluate(async()=>{let n=0;for(const v of document.querySelectorAll('video')){v.scrollIntoView();v.muted=true;await v.play();await new Promise(r=>v.requestVideoFrameCallback(()=>r()));v.pause();n++;}scrollTo(0,0);return n;});assert.equal(media.decoded,5);
    await page.screenshot({path:path.join(out,'review-'+width+'.png'),fullPage:true});report.review.push({width,media});
   }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
