/* Actual renderer captures. Arranged poses are visual evidence, not playthroughs. */
const { chromium } = require(process.env.PLAYWRIGHT_LIB || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.env.DELICIA_OUTPUT || 'output/delicia/native');
const base = process.env.DELICIA_URL || 'http://localhost:3000';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CHROMIUM_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/delicia.html');
    await page.waitForFunction(() => window.worldGame?.mapView);
    const frames = await page.evaluate(async () => {
      const { ALL_DELICIA_STAGES } = await import('/src/adventure/delicia/DeliciaContent.ts');
      const { DeliciaArt } = await import('/src/adventure/delicia/DeliciaArt.ts');
      const { DeliciaSimulation } = await import('/src/adventure/delicia/DeliciaSimulation.ts');
      const art = new DeliciaArt(); await art.load();
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
      const ctx = canvas.getContext('2d');
      const frames = [];
      for (const stage of ALL_DELICIA_STAGES) {
        const sim = new DeliciaSimulation(stage); sim.time = 1.6;
        const positions = stage.boss ? [400] : stage.zones.map(z => z.x);
        for (let i = 0; i < positions.length; i++) {
          sim.cameraX = positions[i]; sim.cameraY = sim.viewHeight ? 450 - sim.viewHeight + 60 : 0;
          const floor = stage.floors.find(f => f.h > 50 && f.x + f.w > positions[i] + 130 && f.x <= positions[i] + 110);
          sim.player.x = positions[i] + 100; sim.player.y = (floor?.y ?? 450) - sim.player.h;
          sim.player.grounded = true;
          if (sim.boss) { sim.boss.start(); sim.boss.beat = 'tell'; sim.boss.beatTime = .3; }
          art.draw(ctx, sim, true);
          const pixels=ctx.getImageData(0,0,960,540).data;let brokenPixels=0;
          for(let y=0;y<540;y++)for(let x=0;x<960;x++){
            const a=(y*960+x)*4,b=(Math.floor(y/3)*3*960+Math.floor(x/3)*3)*4;
            if(pixels[a]!==pixels[b]||pixels[a+1]!==pixels[b+1]||pixels[a+2]!==pixels[b+2])brokenPixels++;
          }
          const start=performance.now();for(let draw=0;draw<12;draw++)art.draw(ctx,sim,true);
          frames.push({ stage: stage.id, zone: i, brokenPixels, renderMs:(performance.now()-start)/12, image: canvas.toDataURL('image/png') });
        }
      }
      art.dispose(); return frames;
    });
    for (const frame of frames) {
      fs.writeFileSync(path.join(out, `${frame.stage}-${frame.zone}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
      delete frame.image;
    }
    const spriteSheet = await page.evaluate(async () => {
      const { SpriteAtlas } = await import('/src/graphics/pixels.ts');
      const { pixelText } = await import('/src/graphics/BitmapFont.ts');
      const { ART } = await import('/src/graphics/palette.ts');
      const { deliciaFoeFrame, deliciaBossFrame, DELICIA_ICONS, DELICIA_PIXEL_PALETTE: palette } = await import('/src/adventure/delicia/DeliciaPixelSprites.ts');
      const c=document.createElement('canvas');c.width=1536;c.height=1080;const ctx=c.getContext('2d');ctx.scale(3,3);ctx.fillStyle=ART.ink;ctx.fillRect(0,0,512,360);
      const atlas=new SpriteAtlas(),kinds=['pulp','beetle','wasp','roller','sentinel','bottler','mimic','bloom'],names=['POLPA','BESOURO','VESPA','ROLO','GUARDA','GARRAFA','BARRIL','FLOR'];
      for(let group=0;group<2;group++)['ANDAR','AVISO','ATAQUE','TONTO'].forEach((label,i)=>pixelText(ctx,label,group*256+72+i*44,7,ART.goldLight,1));
      kinds.forEach((kind,index)=>{
        const x=(index%2)*256,y=22+Math.floor(index/2)*38;pixelText(ctx,names[index],x+5,y+10,ART.paper,1);
        ['walk','tell','attack','stun'].forEach((pose,i)=>atlas.draw(ctx,deliciaFoeFrame(kind,pose,0),palette,x+72+i*44,y));
      });
      pixelText(ctx,'COLETAS',5,181,ART.paper,1);Object.values(DELICIA_ICONS).forEach((frame,i)=>atlas.draw(ctx,frame,palette,72+i*28,177));
      ['jaja','guina'].forEach((kind,row)=>{
        const y=209+row*76;pixelText(ctx,kind.toUpperCase(),5,y+25,ART.paper,1);
        ['idle','tell','attack','recover','stagger','transition','defeated'].forEach((pose,i)=>{
          const x=65+i*63;pixelText(ctx,['PARADO','AVISO','GOLPE','PAUSA','TONTO','FASE','VENCIDO'][i],x,y-12,ART.goldLight,1);atlas.draw(ctx,deliciaBossFrame(kind,pose,0),palette,x,y);
        });
      });
      return c.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(out,'sprites.png'),Buffer.from(spriteSheet.split(',')[1],'base64'));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ frames, errors, arranged: true }, null, 2));
    if (errors.length) throw Error(errors.join('\n'));
    if(frames.some(f=>f.brokenPixels))throw Error('A frame contains pixels outside the native 320 × 180 grid.');
    console.log(JSON.stringify({ frames: frames.length, errors, out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
