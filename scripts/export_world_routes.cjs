// Full native panoramas for inspecting the authored geometry and scenery together.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.worldGame);
 const exports=await page.evaluate(async()=>{
  const {STAGES,ISLANDS}=await import('/src/adventure/campaign.ts'),{drawLandmarks}=await import('/src/adventure/WorldScenery.ts'),g=window.worldGame,output=[];
  for(const stage of STAGES.filter(s=>!s.encounter)){
   g.load(stage.id);const canvas=document.createElement('canvas');canvas.width=stage.level.width*16;canvas.height=368;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#192d42';c.fillRect(0,0,canvas.width,368);
   for(let cx=0;cx<canvas.width;cx+=320){c.save();c.beginPath();c.rect(cx,0,320,368);c.clip();c.translate(cx,0);g.art.background(c,ISLANDS[stage.world-1],cx,0,0);c.restore();for(const cy of [0,180,360]){
    c.save();c.beginPath();c.rect(cx,cy,320,180);c.clip();c.translate(cx,cy);drawLandmarks(c,stage,cx,cy,0);g.art.terrain(c,g.level,ISLANDS[stage.world-1],cx,cy,0);drawLandmarks(c,stage,cx,cy,0,true);g.art.objects(c,g.objects,cx,cy,0);
    for(const foe of g.foes)g.art.foe(c,foe,cx,cy,0);
    for(const p of stage.pickups)if(p.kind==='seal')g.art.seal(c,p.x-cx,p.y-cy,0);else if(p.kind==='coin')g.renderer.drawCoin(p.x-cx,p.y-cy,0,c);
    for(const cp of stage.checkpoints){c.fillStyle='#f0dbc0';c.fillRect(cp.x*16-cx,cp.y*16-cy-30,2,30);c.fillStyle='#85cbbb';c.fillRect(cp.x*16-cx+2,cp.y*16-cy-30,13,8);}
    for(const e of stage.exits){c.fillStyle=e.id==='secret'?'#c49ee6':'#ecb88a';c.fillRect(e.x-cx,e.y-cy,2,e.height);c.fillRect(e.x-cx+2,e.y-cy,12,8);}
    c.restore();
   }}
   output.push({id:stage.id,name:stage.name,world:ISLANDS[stage.world-1].name,png:canvas.toDataURL().split(',')[1],width:canvas.width,height:canvas.height});
  }
  return output;
 });
 const out=path.resolve(__dirname,'../docs/world/capturas/percursos');fs.mkdirSync(out,{recursive:true});
 for(const item of exports)fs.writeFileSync(path.join(out,item.id+'.png'),Buffer.from(item.png,'base64'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(exports.map(({png,...rest})=>rest),null,2));
 console.log(`${exports.length} panoramas nativos exportados.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
