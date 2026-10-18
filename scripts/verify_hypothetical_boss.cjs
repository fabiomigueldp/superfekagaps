/* Actual browser keyboard replay. Only the RAF scheduler is held for reproducible 60 Hz input. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.FEKA_UI_URL||'http://127.0.0.1:3000';
const out=path.resolve(process.env.HYPOTHETICAL_OUTPUT||'output/hipotetico/browser');
const tape=JSON.parse(fs.readFileSync('tests/helpers/hypotheticalReplay.json','utf8'));
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report={errors:[],captures:[],passed:false};
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.worldGame?.state==='title');
  await page.getByRole('button',{name:'MEGA BOSS',exact:true}).waitFor();
  await page.locator('#game-canvas').screenshot({path:path.join(out,'menu.png')});
  await page.getByRole('button',{name:'MEGA BOSS',exact:true}).click();
  await page.waitForFunction(()=>window.worldGame?.fight);
  assert.ok(page.url().includes('encounter=hipotetico'));
  await page.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;});
  await page.locator('#game-canvas').focus();await page.keyboard.press('r');
  const snapshot=()=>page.evaluate(()=>{const g=window.worldGame;return JSON.stringify({f:g.fight,p:g.player.data,o:g.objects.time});});
  await page.keyboard.down('Escape');await page.evaluate(()=>{window.worldGame.update(1000/60);window.worldGame.render();});await page.keyboard.up('Escape');
  assert.equal(await page.evaluate(()=>window.worldGame.state),'paused');
  const frozen=await snapshot();await page.evaluate(()=>{for(let i=0;i<90;i++)window.worldGame.update(1000/60);});assert.equal(await snapshot(),frozen);
  await page.locator('#game-canvas').screenshot({path:path.join(out,'pause.png')});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.worldGame.state),'playing');
  let held=new Set(),frames=0;const captured=new Set();
  for(const [count,keys]of tape.runs){
   const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;
   const result=await page.evaluate(count=>{
    const g=window.worldGame;let reset=false;for(let i=0;i<count;i++){const player=g.player;g.update(1000/60);reset||=player!==g.player;}
    const before=JSON.stringify({f:g.fight,p:g.player.data,o:g.objects.time});g.render();
    if(JSON.stringify({f:g.fight,p:g.player.data,o:g.objects.time})!==before)throw Error('Render mutated combat');
    return{reset,act:g.act,state:g.fight.state,attack:g.fight.attack,chainStep:g.fight.chainStep,chainLength:g.fight.chainLength,followup:g.fight.followup,pivot:g.fight.pivot,phase:g.fight.phaseNumber,health:g.fight.health,dead:g.player.data.isDead,tick:g.fight.tick,receipt:g.receipt};
   },count);frames+=count;
   const name=result.act==='duel'?`${result.act}-${result.phase}-${result.attack}-${result.state}`:result.act==='siege'?`${result.act}-${Math.floor(result.tick/350)}`:`chase-${Math.floor(result.tick/150)}`;
   if(!captured.has(name)&&!result.dead&&result.state!=='hurt'){
    captured.add(name);const file=name+'.png';await page.locator('#game-canvas').screenshot({path:path.join(out,file)});report.captures.push({file,frames,...result});
   }
   if(result.reset){for(const k of held)await page.keyboard.up(k);held=new Set();}
  }
  report.receipt=await page.evaluate(()=>window.worldGame.receipt);assert.equal(report.receipt.won,true);assert.equal(report.receipt.deaths,tape.receipt.deaths);
  assert.equal(await page.evaluate(()=>window.worldGame.resultReady),false);
  await page.evaluate(()=>{const g=window.worldGame;for(let i=0;i<28;i++)g.update(1000/60);g.render();});
  await page.locator('#game-canvas').screenshot({path:path.join(out,'defeat-reaction.png')});
  await page.evaluate(()=>{const g=window.worldGame;for(let i=0;i<90;i++)g.update(1000/60);g.render();});
  assert.equal(await page.evaluate(()=>window.worldGame.resultReady),true);
  assert.deepEqual(await page.evaluate(()=>window.worldGame.receipt),report.receipt);
  report.renderMs=await page.evaluate(()=>{const samples=[];for(let i=0;i<90;i++){const at=performance.now();window.worldGame.render();samples.push(performance.now()-at);}samples.sort((a,b)=>a-b);return{median:samples[45],p95:samples[85]};});
  await page.locator('#game-canvas').screenshot({path:path.join(out,'victory.png')});
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.worldGame.act),'chase');
  report.campaignSave=await page.evaluate(()=>localStorage.getItem('super_feka_gaps_world_v1')); // the bonus never writes a receipt here
  await ctx.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),mp=await mobile.newPage();
  mp.on('pageerror',e=>report.errors.push(e.message));
  await mp.goto(base+'/?encounter=hipotetico',{waitUntil:'networkidle'});await mp.waitForFunction(()=>window.worldGame?.fight);
  await mp.evaluate(()=>{const g=window.worldGame;g.cancelFrame();g.running=false;g.render();});
  report.mobile=await mp.evaluate(()=>{const c=document.querySelector('#game-canvas'),r=c.getBoundingClientRect();return{width:r.width,height:r.height,viewport:innerWidth,reduced:window.worldGame.renderer.reducedMotion};});
  assert.ok(report.mobile.width<=390);assert.equal(report.mobile.reduced,true);
  await mp.locator('#game-canvas').screenshot({path:path.join(out,'mobile-reduced.png')});
  const rect=await mp.locator('#game-canvas').boundingBox();await mp.touchscreen.tap(rect.x+rect.width*.94,rect.y+rect.height*.035);
  await mp.evaluate(()=>window.worldGame.render());assert.equal(await mp.evaluate(()=>window.worldGame.state),'paused');
  await mobile.close();assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({passed:report.passed,captures:report.captures.length,receipt:report.receipt,renderMs:report.renderMs,mobile:report.mobile,errors:report.errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
