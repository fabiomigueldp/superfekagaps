/* Arranged visual audit, not a campaign completion. Draws the real renderer at
 * fixed positions so every section and both arenas can be compared reliably. */
const {chromium}=require(process.env.PLAYWRIGHT_LIB||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve(process.env.DELICIA_OUTPUT||'output/delicia/scenery-v5/before');
const base=process.env.DELICIA_URL||'http://127.0.0.1:3030';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/delicia.html');
  const frames=await page.evaluate(async()=>{
   const {ALL_DELICIA_STAGES}=await import('/src/adventure/delicia/DeliciaContent.ts');
   const {DeliciaArt}=await import('/src/adventure/delicia/DeliciaArt.ts');
   const {DeliciaSimulation,noDeliciaInput}=await import('/src/adventure/delicia/DeliciaSimulation.ts');
   const art=new DeliciaArt();await art.load();
   if(art.images.size!==13)throw Error('A scenery asset did not load');
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
   const ctx=canvas.getContext('2d');const frames=[];
   for(const stage of ALL_DELICIA_STAGES){
    const sim=new DeliciaSimulation(stage);sim.time=1.6;
    const clamp=x=>Math.max(0,Math.min(stage.width-960,x));
    const cameras=stage.boss?[0,380]:stage.zones.flatMap((z,i)=>[clamp(z.x-60),clamp((stage.zones[i+1]?.x??stage.width)-900)]);
    for(let i=0;i<cameras.length;i++){
     sim.cameraX=cameras[i];sim.cameraY=0;
     const floor=stage.floors.find(f=>f.h>50&&f.x+f.w>sim.cameraX+134&&f.x<=sim.cameraX+100)??stage.floors.find(f=>f.h>50&&f.x>sim.cameraX+100);
     sim.player.x=Math.max(floor.x+10,sim.cameraX+100);sim.player.y=floor.y-sim.player.h;
     sim.update(0,noDeliciaInput());sim.cameraX=cameras[i];sim.cameraY=0;
     const start=performance.now();art.draw(ctx,sim);const renderMs=performance.now()-start;
     frames.push({stage:stage.id,section:i+1,camera:sim.cameraX,name:stage.name,renderMs,image:canvas.toDataURL('image/png')});
    }
    if(sim.boss){
     const b=sim.boss;sim.cameraX=380;
     const states=[['idle','cup'],['tell','cup'],['attack',b.character==='guina'?'press':'cup'],['attack','charge'],['attack',b.character==='guina'?'court':'wave'],['recover','cup'],['transition','cup'],['defeated','cup']];
     for(let pose=0;pose<states.length;pose++){
      [b.beat,b.attack]=states[pose];b.beatTime=.4;b.time+=1;art.draw(ctx,sim);b.time+=.2;art.draw(ctx,sim);
      frames.push({stage:stage.id,section:`pose-${pose}`,camera:sim.cameraX,name:stage.name,image:canvas.toDataURL('image/png')});
     }
    }
   }
   art.dispose();return frames;
  });
  for(const f of frames){fs.writeFileSync(path.join(out,`${f.stage}-${f.section}.png`),Buffer.from(f.image.split(',')[1],'base64'));delete f.image;}
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({frames,errors,arranged:true},null,2));
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({frames:frames.length,errors,output:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
