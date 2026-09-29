// Staged encounters, driven with ordinary movement/jump/pound inputs at fixed simulation steps.
// No teleports, damage overrides, invincibility or boss health edits are used during combat.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:960,height:540}});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.worldGame);const results=await page.evaluate(()=>{
 const g=window.worldGame,result=[];const idle=()=>({left:false,right:false,jump:false,run:true,down:false,start:false,pause:false,mute:false,jumpPressed:false,jumpReleased:false,downPressed:false});let input=idle();g.input.update=()=>{};g.input.getState=()=>input;
 for(let w=1;w<=6;w++){
  g.store.save.seen.push(`intro:${w}-5`);g.load(`${w}-5`);g.stage={...g.stage,pickups:[]};let deaths=0,lastDead=false,minHp=g.boss.health,launchReady=false;const traces=[];
  for(let i=0;i<24000&&g.state==='playing';i++){
   input=idle();const p=g.player.data,b=g.boss,x=p.position.x,feet=p.position.y+p.height;let target=x,goingToButton=false;
   if(p.isDead&&!lastDead)deaths++;lastDead=p.isDead;minHp=Math.min(minHp,b.health);
   const go=t=>{target=t;input.left=x>t+3;input.right=x<t-3;};const jump=()=>{input.jump=true;input.jumpPressed=p.isGrounded;};
   if(b.phase==='open'){
    if(b.character==='biel'&&!launchReady){go(b.id==='B2'?263:110);if(p.isGrounded&&feet<=170)launchReady=true;else jump();}
    else{go(b.x+9);if(p.isGrounded&&Math.abs(x-b.x)<(b.character==='biel'?110:b.id==='J1'?135:65))jump();else input.jump=true;}
   }else if(b.character==='calabrezzo'){
    const belt=g.objects.get('bossBelt'),wanted=b.id==='C1'||b.cycle%2===1;
    if(belt.active!==wanted){go(64);if(Math.abs(x-64)<9){jump();if(!p.isGrounded&&p.velocity.y<0){input.down=true;input.downPressed=true;}}}else go(64);
   }else if(b.character==='biel'){
    const left=g.objects.get('left'),right=g.objects.get('right');const btn=!left.active?48:b.id==='B2'&&!right.active?288:null;
    if(btn!==null){goingToButton=true;const avoid=b.phase==='warning'||b.phase==='attack'&&b.timer<(b.pattern==='doubleCargo'?1950:950);if(avoid){go(b.id==='B2'?(b.targetX>130?24:285):(b.targetX>150?32:285));}else go(btn);if(!avoid&&Math.abs(x-btn)<8){jump();if(!p.isGrounded&&p.velocity.y<0){input.down=true;input.downPressed=true;}}}
    else if(b.phase==='warning'||b.phase==='attack'&&b.timer<(b.pattern==='doubleCargo'?1950:950)){const choices=[32,100,165,285].filter(t=>Math.abs(t-b.targetX)>45&&(b.pattern!=='doubleCargo'||Math.abs(t-b.secondTarget)>45));go(b.id==='B2'?(b.targetX>130?24:285):choices.sort((a,c)=>Math.abs(a-x)-Math.abs(c-x))[0]??32);}
    else{go(b.id==='B2'?263:110);if(feet>177)jump();if(p.isGrounded&&feet<=170)launchReady=true;}
   }else{
    if(b.id==='J1'){
     if(b.phase==='warning'||b.phase==='attack')go(Math.max(24,b.targetX-78));
     else go(b.x>190?b.x-65:b.x+65);
     if(!p.isGrounded&&p.velocity.y<0)input.jump=true;
    }else{
     if(b.phase==='rest')go(239);else if(b.phase==='warning')go(b.targetX>200?166:232);else if(b.phase==='attack')go(200);else go(220);
     if(g.boss.danger||(!p.isGrounded&&p.velocity.y<0))jump();
    }
   }
   if(b.character==='calabrezzo'&&g.objects.barrels.some(q=>Math.abs(q.x-x)<65)&&Math.abs(x-64)>14)jump();
   if(b.id==='B2'&&p.isGrounded&&feet<=177&&((x>b.x+b.width&&target<b.x)||(x+p.width<b.x&&target>b.x)))jump();
   if(b.id==='B2'&&!goingToButton&&b.phase==='rest'&&p.isGrounded&&feet<=177&&Math.abs(target-x)>24)jump();
   if(b.phase==='hurt'||p.isDead)launchReady=false;
   g.update(1000/60);
   if(i%2000===0)traces.push({i,x:Math.round(x),y:Math.round(feet),hp:b.health,phase:b.phase,target:Math.round(target),objs:g.objects.bodies.filter(x=>x.kind==='switch').map(x=>x.active)});
  }
  result.push({w,state:g.state,hp:g.boss.health,minHp,deaths,traces});
 }
 return result;
});await browser.close();if(results.some(r=>r.state!=='clear'||r.deaths>0))console.log(JSON.stringify(results,null,2));for(const result of results){assert.equal(result.state,'clear',`Encounter ${result.w} must be beatable without items`);assert.equal(result.hp,0);assert.equal(result.deaths,0);}const out=path.resolve(__dirname,'../docs/world/capturas/combate.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({method:'Six staged encounters, fixed-step ordinary controls, no pickups or invincibility, no teleports after spawn.',results},null,2));console.log('Seis confrontos vencidos por controles simulados, sem itens e sem mortes.');})().catch(e=>{console.error(e);process.exitCode=1;});
