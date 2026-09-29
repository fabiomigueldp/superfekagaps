// Deterministic browser QA using the real game loops and renderer. Optional Playwright dependency,
// configured like verify_graphics.cjs. Captures stay in .tmp and never modify campaign progress.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.GAME_URL || 'http://127.0.0.1:3000';
const out = path.resolve(__dirname, '../.tmp/death-qa');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const mode of ['classic', 'world']) {
      const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      // Concurrent local edits must not reload a staged capture halfway through a death.
      await page.route('**/@vite/client', route => route.fulfill({ contentType:'application/javascript', body:
        'export const createHotContext=()=>({accept(){},dispose(){},on(){}});export function updateStyle(){};export function removeStyle(){};' }));
      await page.route('**/src/main.ts*', route => route.fulfill({ contentType: 'application/javascript', body: `
        import { Game } from '/src/game/Game.ts';
        import { WorldGame } from '/src/adventure/WorldGame.ts';
        window.deathQa = new ${mode === 'classic' ? 'Game' : 'WorldGame'}(document.getElementById('game-canvas')${mode === 'world' ? ',true' : ''});
      ` }));
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.deathQa);
      for (const kind of ['ground', 'air', 'fall']) {
        const info = await page.evaluate(({ mode, kind }) => {
          const g = window.deathQa;
          const neutral = { left:false,right:false,jump:false,run:false,down:false,start:false,pause:false,mute:false,jumpPressed:false,jumpReleased:false,downPressed:false };
          if (mode === 'classic') { g.loadLevel(0); g.state = 'PLAYING'; g.minions = []; g.lives=3; }
          else { g.load('1-1'); g.foes = []; }
          g.input.update = () => {};
          g.input.getState = () => neutral;
          for (let i=0;i<120 && !g.player.data.isGrounded;i++) g.player.update(1000/60,neutral,g.level);
          if (!g.player.data.isGrounded) throw Error('QA spawn must settle on solid ground');
          const p = g.player.data;
          if (kind === 'air') { p.position.y -= 35; p.isGrounded = false; }
          if (kind === 'fall') p.position.y = g.level.getBounds().maxY + 1;
          // Hold the actual level view. A fall stays offscreen, as it does during real play.
          const y = kind === 'fall' ? g.level.getBounds().maxY - 180 : p.position.y - 118;
          Object.assign(g.camera, { x: Math.max(0,p.position.x-110), y: Math.max(0,y), zoom:1, shakeTimer:0 });
          if (kind === 'fall') p.isGrounded = false;
          if (kind === 'fall') g.player.die('fall');
          if (mode === 'classic') g.playerDie('other',g.player.getCenter().x+20);
          else if (kind !== 'fall') g.hurt(g.player.getCenter().x+20);
          const duration = p.deathTimerMax;
          g.render();
          return { duration, origin: p.deathOrigin, grounded:p.deathWasGrounded, direction:p.deathDirection };
        }, { mode, kind });
        assert.equal(info.grounded, kind === 'ground');
        const capture = async (name) => page.locator('#game-canvas').screenshot({ path:path.join(out,name+'.png') });
        if (kind === 'ground') await capture(`${mode}-frame-000`);
        // Keep each tick at 60 Hz. Frames sample at 30 Hz; no wall-clock animation or live RAF.
        let finishedAt = 0;
        for (let frame=1;frame<=Math.ceil((info.duration+450)/(1000/30));frame++) {
          const state = await page.evaluate(() => {
            const g = window.deathQa;
            g.update(1000/60); g.update(1000/60); g.render();
            return { dead:g.player.data.isDead, timer:g.player.data.deathTimer, revealing:g.player.data.respawnRevealTimer??0,
              origin:g.player.data.deathOrigin, protection:g.player.data.invincibleTimer };
          });
          const time=frame*1000/30;
          if (kind === 'ground') await capture(`${mode}-frame-${String(frame).padStart(3,'0')}`);
          if (time < info.duration-1) {
            assert.equal(state.dead,true,`${mode}/${kind}: no early respawn`);
            assert.deepEqual(state.origin,info.origin);
          } else if (!state.dead && !finishedAt) finishedAt=time;
          if (time > info.duration+30 && time < info.duration+380) {
            assert.ok(state.revealing>0,`${mode}/${kind} at ${time}ms: checkpoint must still be opening`);
            assert.equal(state.protection,mode==='classic'?2000:1500);
          }
        }
        assert.ok(finishedAt>0 && finishedAt<=info.duration+34);
        results.push({ mode,kind,...info,respawnAt:finishedAt });
      }
      if (mode === 'classic') {
        const finalLife = await page.evaluate(() => {
          const g=window.deathQa;
          g.lives=1;g.playerDie();g.update(1500);g.render();
          return {lives:g.lives,state:g.state};
        });
        assert.deepEqual(finalLife,{lives:0,state:'GAME_OVER'});
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({results},null,2));
    console.log('Verified ground, airborne and gap deaths in both modes; captured real renderer sequences in .tmp/death-qa.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
