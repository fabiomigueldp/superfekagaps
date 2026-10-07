/** Native Canvas local traversal proof with the real WorldGame update/painter.
 * node --import tsx tools/qa/render_campaign_camera.mts BASELINE_ROOT OUTPUT
 * CAMERA_CANVAS_MODULE may point to an existing @napi-rs/canvas install.
 * The local authored launch starts with nearby foes already defeated; this is
 * camera QA, not a whole-stage playthrough, browser or device verification.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Canvas } from '../../tests/helpers/guairaLabHarness';
import { WorldGame } from '../../src/adventure/WorldGame';
import { Player } from '../../src/entities/Player';
import { advanceCampaignCamera } from '../../src/adventure/WorldCampaignCamera';
import { CAMPAIGN_JUMP_PLANS } from '../../scripts/lib/campaignJumpPlans';
import { BLOCK_DT, blockBrowser, blockIdle } from '../../tests/helpers/blockImpactHarness';
const baseline = resolve(process.argv[2]), out = resolve(process.argv[3]);
const { WorldGame: BeforeGame } = await import(pathToFileURL(`${baseline}/src/adventure/WorldGame.ts`).href);
const { advanceCampaignCamera: beforeCamera } = await import(pathToFileURL(`${baseline}/src/adventure/WorldCampaignCamera.ts`).href);
const { createCanvas, GlobalFonts } = createRequire(import.meta.url)(process.env.CAMERA_CANVAS_MODULE ?? '@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'ProofSans');
const surfaces = new WeakMap(), contexts = new WeakMap();
Canvas.prototype.getContext = function() {
    if (contexts.has(this)) return contexts.get(this);
    const native = createCanvas(this.width, this.height); surfaces.set(this, native);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, { configurable: true,
        get: () => native[key], set: value => { native[key] = value; } });
    const context = native.getContext('2d'), proxy = new Proxy(context, {
        get: (target, key) => key === 'drawImage' ? (image, ...args) => target.drawImage(surfaces.get(image) ?? image, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
    });
    contexts.set(this, proxy); return proxy;
};
mkdirSync(out, { recursive: true });
const records = [], snapshots = new Map();
for (const reducedMotion of [false, true]) for (const version of ['before', 'after']) {
    const cleanup = [], h = blockBrowser({ after: callback => cleanup.push(callback) }, { reducedMotion });
    const Game = version === 'before' ? BeforeGame : WorldGame;
    const follow = version === 'before' ? beforeCamera : advanceCampaignCamera;
    const game = new Game(h.canvas, true);
    let controls = { ...blockIdle };
    game.input.getState = () => controls;
    const plan = CAMPAIGN_JUMP_PLANS.find(p => p.name === 'Final high descent')!, witness = plan.witness;
    assert.ok(!('carrier' in witness));
    game.load(plan.stage);
    for (const foe of game.foes) foe.dead = true;
    game.player = new Player(witness.x / 16, witness.feetY / 16);
    game.player.update(BLOCK_DT, blockIdle, game.level);
    for (let i = 0; i < 300; i++) follow(game.camera, game.player.data, game.level.data);
    controls = { ...blockIdle, right: true, run: true };
    for (let i = 0; i < witness.approachFrames; i++) game.update(BLOCK_DT);
    for (let frame = 0; frame <= 70; frame++) {
        if (frame) {
            controls = { ...blockIdle, right: frame <= 52, run: frame <= 52, jump: frame <= 52, jumpPressed: frame === 1, jumpReleased: frame === 53 };
            game.update(BLOCK_DT);
        }
        assert.equal(game.state, 'playing'); assert.equal(game.player.data.isDead, false);
        const state = JSON.stringify({ player: game.player.data, level: game.level.data, save: game.store.save, coins: game.coins });
        const cy = Math.round(game.camera.y);
        records.push({ reducedMotion, version, frame, camera: { ...game.camera }, model: state,
            feet: game.player.data.position.y + game.player.data.height - cy, floor: 224 - cy });
        if (![0, 24, 40, 44, 48, 50, 51, 52, 58, 70].includes(frame)) continue;
        game.render();
        assert.equal(JSON.stringify({ player: game.player.data, level: game.level.data, save: game.store.save, coins: game.coins }), state);
        const native = createCanvas(320, 180), c = native.getContext('2d'); c.imageSmoothingEnabled = false;
        c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180);
        const key = `${reducedMotion ? 'reduced' : 'normal'}-${version}-${frame}`;
        snapshots.set(key, native); writeFileSync(`${out}/${key}.png`, native.toBuffer('image/png'));
    }
    game.dispose(); for (const run of cleanup) run();
}
for (let frame = 0; frame <= 70; frame++) {
    const same = records.filter(row => row.frame === frame);
    for (const row of same.slice(1)) assert.equal(row.model, same[0].model, 'Only camera framing changes, including reduced motion.');
}
const sheet = createCanvas(1280, 862), c = sheet.getContext('2d');
c.fillStyle = '#202736'; c.fillRect(0, 0, 1280, 862); c.fillStyle = '#f3d7a4'; c.font = '19px ProofSans';
c.fillText('World 6-4 high descent: production WorldGame update + native Canvas painter', 16, 29);
c.font = '16px ProofSans'; c.fillText('Local authored launch, foes already defeated. No browser/device or full-stage claim.', 16, 55);
c.imageSmoothingEnabled = false;
for (const [i, frame] of [51, 52].entries()) {
    const x = i * 640, label = frame === 52 ? 'landing' : '1 frame before landing';
    c.fillText(`BEFORE: ${label}`, x + 12, 86);
    c.drawImage(snapshots.get(`normal-before-${frame}`), x, 98, 640, 360);
    c.fillText(`AFTER: ${label}`, x + 12, 486);
    c.drawImage(snapshots.get(`normal-after-${frame}`), x, 498, 640, 360);
}
writeFileSync(`${out}/deep-drop-before-after.png`, sheet.toBuffer('image/png'));
writeFileSync(`${out}/report.json`, JSON.stringify({ baseline, method: 'Native Canvas local traversal witness; real WorldGame update/painter. Authored launch after foes are defeated, not full-stage gameplay, browser or device verification.',
    records: records.map(({ model, ...row }) => row) }, null, 2));
console.log(JSON.stringify({ out, nativeImages: snapshots.size, identicalGameplayFrames: 71, modes: 4 }));
