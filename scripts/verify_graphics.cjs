// Optional browser QA. Requires Playwright and a running development server.
// PLAYWRIGHT_PATH and CHROME_PATH may point to an existing local installation.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.GAME_URL || 'http://localhost:3000';
const out = path.resolve(__dirname, '../docs/graphics-v2');
const checks = [], errors = [], requests = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', req => requests.push(req.url()));
    await page.route('**/src/main.ts*', route => route.fulfill({ contentType: 'application/javascript', body:
      `import { Game } from '/src/game/Game.ts'; window.qaGame = new Game(document.getElementById('game-canvas')); window.qaGame.start();` }));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.qaGame?.state === 'MENU');
    const shot = name => page.locator('#game-canvas').screenshot({ path: path.join(out, name + '.png') });
    await shot('01-title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    check('Enter starts the real game and hides the editor link', await page.evaluate(() => window.qaGame.state === 'PLAYING' && document.getElementById('open-editor').hidden));
    await shot('02-gameplay');
    const beforeX = await page.evaluate(() => window.qaGame.player.data.position.x);
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
    check('Keyboard movement reaches the player', await page.evaluate(x => window.qaGame.player.data.position.x > x, beforeX));
    await page.keyboard.press('Escape');await page.waitForFunction(() => window.qaGame.state === 'PAUSED');
    await shot('03-pause');
    const paused = await page.evaluate(() => document.getElementById('game-canvas').toDataURL());
    await page.waitForTimeout(250);
    check('Paused scene remains pixel-identical while RAF continues', paused === await page.evaluate(() => document.getElementById('game-canvas').toDataURL()));
    await page.keyboard.press('Escape');await page.waitForFunction(() => window.qaGame.state === 'PLAYING');

    // Staged scenes use real level data and renderer, without a concurrent game loop.
    await page.unroute('**/src/main.ts*');
    await page.route('**/src/main.ts*', route => route.fulfill({ contentType: 'application/javascript', body:
      `import { Game } from '/src/game/Game.ts'; window.qaGame = new Game(document.getElementById('game-canvas'));` }));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.qaGame);
    const scenes = [
      { name: '04-surface', level: 0, x: 400, y: 0, px: 468, py: 120 },
      { name: '05-cave', level: 0, x: 384, y: 172, px: 512, py: 264 },
      { name: '06-world-two', level: 1, x: 320, y: 30, px: 440, py: 152 },
      { name: '07-boss', level: 2, x: 320, y: 12, px: 376, py: 120 },
    ];
    for (const scene of scenes) {
      await page.evaluate(s => {
        const g = window.qaGame;g.loadLevel(s.level);g.state = 'PLAYING';
        g.renderer.clock.time = 1200;
        Object.assign(g.camera, { x: s.x, y: s.y, targetX: s.x, targetY: s.y, zoom: 1 });
        Object.assign(g.player.data, { position: { x: s.px, y: s.py }, isGrounded: true });
        for (const m of g.minions) {
          // Settle vertically so authored enemy spawn anchors do not leave floating actors in a still image.
          for (let i=0;i<80;i++) {
            const hit=g.level.resolveCollision(m.getRect(),{x:0,y:2},m.getRect());
            m.data.position=hit.position;if(hit.grounded)break;
          }
        }
        if (g.boss) g.boss.data.position.y = 104;
        g.render();
      }, scene);
      await shot(scene.name);
    }
    await page.evaluate(() => { const g=window.qaGame;g.state='ENDING';g.score=12450;g.highScore=12450;g.newRecord=true;g.totalRunTime=186.4;g.render(); });
    await shot('08-ending');

    await page.evaluate(async () => {
      const g=window.qaGame,r=g.renderer,{pixelText}=await import('/src/graphics/BitmapFont.ts');
      r.prepareLevelBackground();r.startScene();const c=r.getContext();c.fillStyle='#191f35';c.fillRect(0,0,320,180);
      const p=g.player.data,cam={x:0,y:0};
      pixelText(c,'PERSONAGENS / MATERIAIS / OBJETOS',160,5,'#9ce3cf',1,'center');
      ['idle','walk','jump','pound'].forEach((pose,i)=>{
        Object.assign(p,{position:{x:14+i*34,y:26},velocity:{x:pose==='walk'?2:0,y:-2},isGrounded:pose==='idle'||pose==='walk',groundPoundState:pose==='pound'?'FALL':'NONE',animationTimer:100});
        r.drawPlayer(p,cam);
      });
      r.drawEnemy({position:{x:174,y:30},velocity:{x:0,y:0},active:true,type:'MINION',facingRight:true,isDead:false,animationTimer:0},cam);
      r.drawEnemy({...g.boss.data,position:{x:235,y:19},facingRight:true},cam);
      const ids=[1,2,3,4,10,11,12,13,14,15,16,17,18,20,21,22];
      ids.forEach((id,i)=>{const x=13+(i%8)*38,y=70+Math.floor(i/8)*33;r.drawTile(id,x,y,[[0],[id]],1,0);pixelText(c,String(id),x,y+20,'#a7b4bb');});
      r.drawCoin(13,145,0);r.drawFanta(51,145);r.drawHelmet(89,145);r.drawYasmin(125,138);r.drawProjectile(174,151);r.present();
    });
    await shot('09-assets');
    await page.evaluate(() => {const r=window.qaGame.renderer;r.startScene();r.drawHUD(9999999,99,9,'BOSS: JOÃOZÃO',false,true,5700,99,2);r.present();});
    await shot('10-hud-items');
    for (const [state,name] of [['GAME_OVER','11-game-over'],['LEVEL_CLEAR','12-level-clear']]) {
      await page.evaluate(state=>{const g=window.qaGame;g.loadLevel(0);g.state=state;g.render();},state);await shot(name);
    }
    await page.evaluate(() => {
      const g=window.qaGame;g.loadLevel(2);g.state='PLAYING';Object.assign(g.camera,{x:320,y:12,zoom:1});
      Object.assign(g.player.data,{position:{x:376,y:120},isGrounded:true});g.boss.data.position.y=104;
      Object.assign(g.boss,{currentAction:'create_gap',actionTimer:2000});g.boss.update(200,g.level,376,120);g.render();
    });
    await shot('13-boss-warning');
    await page.evaluate(() => {const g=window.qaGame;g.boss.update(400,g.level,430,120);const p=g.boss.consumeImpact();g.renderer.addImpact(p.x,p.y,'boss');g.render();});
    await shot('14-boss-smash');
    await page.evaluate(()=>{const g=window.qaGame;g.state='BOSS_INTRO';g.render();});
    await shot('17-boss-intro');
    await page.evaluate(()=>{window.qaGame.state='PLAYING';});

    check('Repeated rendering is pure, including the rain effect', await page.evaluate(()=>{
      const g=window.qaGame;g.deliciaMode=true;g.render();const first=g.renderer.offscreenCanvas.toDataURL();
      g.render();return first===g.renderer.offscreenCanvas.toDataURL();
    }));
    const zoomResult = await page.evaluate(async()=>{
      const g=window.qaGame,r=g.renderer,{PLAYER_PALETTE}=await import('/src/assets/playerSpriteSpec.ts');
      const colors=new Set(Object.values(PLAYER_PALETTE).filter(Boolean).map(v=>v.toLowerCase()));colors.add('#191f35');
      const p=g.player.data;Object.assign(p,{position:{x:32,y:32},velocity:{x:0,y:-1},isGrounded:false,groundPoundState:'NONE',hasHelmet:false,miniFantaTimer:0,invincibleTimer:0});
      let unexpected=0;
      for(const zoom of [.75,1,1.37,2]){
        r.startScene(zoom);r.drawPlayer(p,{x:0,y:0});r.present();
        const pixels=r.compositeCtx.getImageData(0,0,320,180).data;
        for(let i=0;i<pixels.length;i+=4){const color='#'+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');if(!colors.has(color))unexpected++;}
      }
      return {unexpected};
    });
    check('Fractional camera zoom introduces no blended colours into pixel sprites', zoomResult.unexpected===0);

    const atlas=await page.evaluate(async()=>{
      const {PLAYER_SPRITES,PLAYER_PALETTE}=await import('/src/assets/playerSpriteSpec.ts');
      const s=await import('/src/graphics/sprites.ts'),{SpriteAtlas}=await import('/src/graphics/pixels.ts');
      const items=[];
      const add=(id,frame,palette,anchor)=>items.push({id,frame,palette,anchor});
      Object.entries(PLAYER_SPRITES).forEach(([name,frame])=>add('feka/'+name,frame,PLAYER_PALETTE,[8,name==='helmet'?8:26]));
      s.MINION_FRAMES.forEach((frame,i)=>add('minion/walk'+i,frame,s.SPRITE_PALETTE,[9,20]));add('minion/squash',s.MINION_SQUASH,s.SPRITE_PALETTE,[9,20]);
      Object.entries(s.BOSS_FRAMES).forEach(([name,frame])=>name==='walk'?frame.forEach((f,i)=>add('joaozao/walk'+i,f,s.SPRITE_PALETTE,[20,47])):add('joaozao/'+name,frame,s.SPRITE_PALETTE,[20,47]));
      s.YASMIN_FRAMES.forEach((frame,i)=>add('yasmin/idle'+i,frame,s.SPRITE_PALETTE,[10,30]));
      s.COIN_FRAMES.forEach((frame,i)=>add('coin/spin'+i,frame,s.SPRITE_PALETTE,[8,8]));add('fanta/idle',s.FANTA_SPRITE,s.SPRITE_PALETTE,[8,16]);
      s.PROJECTILE_FRAMES.forEach((frame,i)=>add('projectile/spin'+i,frame,s.SPRITE_PALETTE,[5,5]));
      const canvas=document.createElement('canvas');canvas.width=384;canvas.height=Math.ceil(items.length/8)*56;
      const c=canvas.getContext('2d'),a=new SpriteAtlas(),frames={};
      items.forEach((item,i)=>{const x=i%8*48+4,y=Math.floor(i/8)*56+4;a.draw(c,item.frame,item.palette,x,y);frames[item.id]={x,y,width:item.frame[0].length,height:item.frame.length,anchor:item.anchor};});
      return {image:canvas.toDataURL(),manifest:{image:'sprites-native.png',width:canvas.width,height:canvas.height,frames}};
    });
    fs.writeFileSync(path.join(out,'sprites-native.png'),Buffer.from(atlas.image.split(',')[1],'base64'));
    fs.writeFileSync(path.join(out,'sprites-native.json'),JSON.stringify(atlas.manifest,null,2)+'\n');

    await page.goto(base+'/?editor=true',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!window.qaGame?.editorController?.levelData);
    await page.locator('[data-tab="tab-theme"]').click();
    await page.locator('#theme-biome').selectOption('citadel');
    check('Editor materials and renderer update together',await page.evaluate(()=>window.qaGame.editorController.levelData.theme.biome==='citadel'&&window.qaGame.renderer.background.theme.biome==='citadel'));
    await page.locator('#btn-undo').click();
    check('Changing materials participates in editor undo',await page.evaluate(()=>window.qaGame.editorController.levelData.theme.biome==='meadow'));
    await page.evaluate(()=>window.qaGame.render());
    await page.screenshot({path:path.join(out,'15-editor.png')});

    const mobile=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    mobile.on('pageerror',e=>errors.push(String(e)));
    await mobile.route('**/src/main.ts*',route=>route.fulfill({contentType:'application/javascript',body:`import { Game } from '/src/game/Game.ts'; window.qaGame = new Game(document.getElementById('game-canvas')); window.qaGame.start();`}));
    await mobile.goto(base,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.qaGame?.state==='MENU');
    let box=await mobile.locator('#game-canvas').boundingBox();
    await mobile.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.5);
    await mobile.waitForFunction(()=>window.qaGame.state==='PLAYING');
    check('Touching the visible menu button starts play',true);
    box=await mobile.locator('#game-canvas').boundingBox();
    await mobile.touchscreen.tap(box.x+box.width*.95,box.y+box.height*.85);
    await mobile.waitForTimeout(80);
    await mobile.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.85);
    await mobile.waitForFunction(()=>window.qaGame.player.data.groundPoundState!=='NONE');
    check('Visible mobile controls can jump and start a ground pound',true);
    await mobile.locator('#game-canvas').screenshot({path:path.join(out,'16-touch.png')});
    await mobile.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.05);
    await mobile.waitForFunction(()=>window.qaGame.state==='PAUSED');
    await mobile.touchscreen.tap(box.x+box.width*.4,box.y+box.height*.45);
    await mobile.waitForFunction(()=>window.qaGame.state==='PLAYING');
    check('Mobile pause and resume work from the displayed controls',true);
    check('The obsolete large Yasmin bitmap is not requested',!requests.some(url=>url.endsWith('/yasmin.png')));
    check('Browser run has no uncaught JavaScript errors',errors.length===0);
    const report={browser:await browser.version(),checks,errors,scenes,zoomResult,atlasFrames:Object.keys(atlas.manifest.frames).length};
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
