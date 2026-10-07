import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { advanceCampaignCamera } from '../src/adventure/WorldCampaignCamera';
import { WorldGame } from '../src/adventure/WorldGame';
import { ProgressStore } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { stageById, STAGES } from '../src/adventure/campaign';
import { Player } from '../src/entities/Player';
import type { InputState, LevelData, PlayerData } from '../src/types';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, run: false, jump: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
type Camera = { x: number; y: number };
/** Frozen pre-fix algorithm, used only as the before trace of the same native simulation. */
function beforeCamera(camera: Camera, p: PlayerData, level: Pick<LevelData, 'width' | 'height'>) {
    const { x, y } = p.position;
    camera.x += (clamp(x - 125 + p.velocity.x * 12, 0, Math.max(0, level.width * 16 - 320)) - camera.x) * .12;
    const sy = y - camera.y;
    const target = p.isGrounded ? y - 108 : sy < 48 ? y - 48 : sy > 132 ? y - 132 : camera.y;
    camera.y += (clamp(target, 0, level.height * 16 - 180) - camera.y) * .12;
}
function harness(id = '1-1', checkpoint?: number) {
    const game = Object.create(WorldGame.prototype) as any, store = new ProgressStore(null);
    let controls = { ...idle };
    if (checkpoint !== undefined) store.save.checkpoint = { stage: id, index: checkpoint, helmet: false };
    const noop = () => {};
    Object.assign(game, { store, tutorial: new WorldTutorial(store), time: 0, toastTimer: 0,
        state: 'title', camera: { x: 0, y: 0, shakeTimer: 0 }, buttons: [],
        input: { reset() { controls = { ...idle }; }, setMenuMode: noop, update: noop,
            consumeMute: () => false, consumePause: () => false, getState: () => controls },
        audio: new Proxy({}, { get: () => noop }), renderer: { advanceClock: noop, addImpact: noop } });
    game.load(id, checkpoint !== undefined);
    return { game, step(input: Partial<InputState> = {}) { controls = { ...idle, ...input }; game.update(DT); } };
}
function nativeBeachDrop() {
    // Use the actual checkpoint, Player, pickups, comment, collisions and update.
    // A continuous ordinary walk reaches the existing safe beach with no teleports.
    const h = harness('1-1', 0), g = h.game;
    const before: Camera = { x: g.camera.x, y: g.camera.y };
    let oldDY = 0, newDY = 0, wasGrounded = false;
    const rows = [];
    for (let frame = 0; frame < 280; frame++) {
        const oldY = before.y, newY = g.camera.y;
        h.step({ right: g.player.data.position.x < 81 * 16 });
        assert.equal(g.player.data.isDead, false);
        assert.equal(g.state, 'playing');
        beforeCamera(before, g.player.data, g.level.data);
        const dyBefore = before.y - oldY, dyAfter = g.camera.y - newY;
        const feet = g.player.data.position.y + g.player.data.height;
        rows.push({ frame, landing: !wasGrounded && g.player.data.isGrounded && frame > 1,
            feetBefore: feet - before.y, feetAfter: feet - g.camera.y,
            beachBefore: 288 - before.y, beachAfter: 288 - g.camera.y,
            dyBefore, dyAfter, accelerationBefore: dyBefore - oldDY, accelerationAfter: dyAfter - newDY });
        assert.equal(g.camera.x, before.x, 'Horizontal tracking is exactly unchanged, including braking.');
        wasGrounded = g.player.data.isGrounded; oldDY = dyBefore; newDY = dyAfter;
    }
    assert.equal(g.player.data.position.y + g.player.data.height, 288);
    assert.ok(g.store.save.seals.includes('1-1:s2'));
    return rows;
}

test('native 1-1 beach drop reveals the landing before contact and removes the landing camera kick', t => {
    const rows = nativeBeachDrop(), landing = rows.findIndex(r => r.landing);
    assert.ok(landing > 0);
    const maxFeetBefore = Math.max(...rows.map(r => r.feetBefore));
    const maxFeetAfter = Math.max(...rows.map(r => r.feetAfter));
    assert.ok(maxFeetBefore > 180, 'The regression fixture must reproduce feet below the native viewport.');
    assert.ok(maxFeetAfter < 165, 'Feka remains fully visible throughout the recoverable fall.');
    assert.ok(rows[landing - 3].beachBefore > 180, 'The old camera still hides the landing.');
    assert.ok(rows[landing - 3].beachAfter < 180, 'The landing is visible three physics frames earlier.');
    assert.ok(rows[landing].accelerationBefore > 2.9, 'The baseline reproduces the grounded-target jump.');
    assert.ok(rows[landing].accelerationAfter <= 0, 'Contact decelerates toward the same target instead of kicking downward.');
    assert.ok(Math.max(...rows.map(r => r.accelerationAfter)) < 1, 'Catch-up adds less than one pixel/frame of downward acceleration.');
    assert.ok(rows.every(r => r.dyAfter >= -1e-9), 'The drop and its settling never reverse.');
    t.diagnostic(JSON.stringify({ maxFeetBefore, maxFeetAfter, landing: rows[landing],
        beforeLanding: rows.slice(landing - 3, landing) }));
});

test('short native hops retain a still camera; full jumps preserve ascent and total camera travel', () => {
    for (const hold of [0, 9, 24]) {
        const level = new WorldLevel(stageById('1-1')!.level), player = new Player(4, 14);
        player.data.isGrounded = true;
        const before: Camera = { x: 0, y: 92 }, after = { ...before };
        let travelBefore = 0, travelAfter = 0;
        for (let frame = 0; frame < 280; frame++) {
            player.update(DT, { ...idle, jumpPressed: frame === 0, jump: frame < hold, jumpReleased: frame === hold }, level);
            const oldY = before.y, newY = after.y;
            beforeCamera(before, player.data, level.data);
            advanceCampaignCamera(after, player.data, level.data);
            if (player.data.velocity.y <= 0 && !player.data.isGrounded)
                assert.equal(after.y, before.y, 'No anticipatory tracking or extra movement on ascent.');
            travelBefore += Math.abs(before.y - oldY); travelAfter += Math.abs(after.y - newY);
            if (hold === 0) assert.equal(after.y, 92, 'A short hop stays in the unchanged rising dead zone.');
        }
        assert.ok(Math.abs(travelAfter - travelBefore) < 1e-9, 'Earlier essential follow adds no camera excursion.');
        assert.ok(Math.abs(after.y - 92) < 1e-9);
    }
});

test('camera remains bounded across campaign sizes and direction changes without changing player or level', () => {
    for (const stage of STAGES.filter(s => !s.encounter)) {
        const level = stage.level, player = new Player(3, 14), camera = { x: 0, y: 0 };
        const levelBefore = structuredClone(level);
        for (const [x, y, vx, grounded] of [[-100, -100, -3.5, 0], [level.width * 16, level.height * 16, 3.5, 0], [400, 160, -3.5, 1]]) {
            player.data.position = { x, y }; player.data.velocity.x = vx; player.data.isGrounded = !!grounded;
            const playerBefore = structuredClone(player.data);
            for (let frame = 0; frame < 100; frame++) {
                advanceCampaignCamera(camera, player.data, level);
                assert.ok(camera.x >= 0 && camera.x <= Math.max(0, level.width * 16 - 320));
                assert.ok(camera.y >= 0 && camera.y <= Math.max(0, level.height * 16 - 180));
            }
            assert.deepEqual(player.data, playerBefore);
        }
        assert.deepEqual(level, levelBefore);
    }
    const camera = { x: 0, y: 0 };
    advanceCampaignCamera(camera, new Player(3, 3).data, { width: 8, height: 8 });
    assert.deepEqual(camera, { x: 0, y: 0 });
});

test('pause, settings, dialogue, hit stop, death and respawn reveal do not advance camera tracking', () => {
    const h = harness('1-1', 0), g = h.game;
    for (let f = 0; f < 30; f++) h.step({ right: true });
    for (const state of ['paused', 'settings', 'dialogue', 'clear']) {
        g.state = state;
        const camera = structuredClone(g.camera);
        for (let f = 0; f < 20; f++) h.step({ right: true });
        assert.deepEqual(g.camera, camera, state);
    }
    g.state = 'playing'; g.hitStop = 70;
    const frozen = { x: g.camera.x, y: g.camera.y };
    for (let f = 0; f < 4; f++) h.step({ right: true });
    assert.deepEqual({ x: g.camera.x, y: g.camera.y }, frozen);
    g.hitStop = 0; g.player.die('fall'); h.step();
    assert.deepEqual({ x: g.camera.x, y: g.camera.y }, frozen);
    g.restart();
    const reset = { x: g.camera.x, y: g.camera.y };
    for (let f = 0; f < 10; f++) h.step({ right: true });
    assert.deepEqual({ x: g.camera.x, y: g.camera.y }, reset);
    g.player.data.respawnRevealTimer = 0; h.step({ right: true });
    assert.notDeepEqual({ x: g.camera.x, y: g.camera.y }, reset);
});

test('restart snaps to the existing checkpoint framing and bosses retain their fixed arena camera', () => {
    const h = harness('1-1', 0), g = h.game;
    for (let f = 0; f < 90; f++) h.step({ right: true });
    g.restart();
    assert.deepEqual({ x: g.camera.x, y: g.camera.y }, { x: 64 * 16 - 100, y: 14 * 16 - 24 - 112 });
    g.load('1-1');
    assert.deepEqual({ x: g.camera.x, y: g.camera.y }, { x: 0, y: 88 });
    g.load('1-5');
    g.state = 'playing';
    for (let f = 0; f < 60; f++) h.step({ jump: f < 9, jumpPressed: f === 0, jumpReleased: f === 9 });
    assert.deepEqual({ x: g.camera.x, y: g.camera.y }, { x: 0, y: 64 });
});

test('the real FactoryCampaign host retains its post-update annex framing and upward tracking', t => {
    // Ignore only the stylesheet at the Node boundary; execute the real host override.
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    t.after(() => { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; });
    const { FactoryCampaign } = require('../src/adventure/factory/FactoryCampaign.ts') as typeof import('../src/adventure/factory/FactoryCampaign');
    const h = harness('3-3', 1), g = h.game;
    Object.setPrototypeOf(g, FactoryCampaign.prototype);
    g.enterButton = { hidden: true, textContent: '' };
    h.step();
    const before = structuredClone(g.player.data.position);
    let top = Infinity;
    for (let frame = 0; frame < 100; frame++) {
        h.step({ jump: frame < 24, jumpPressed: frame === 0, jumpReleased: frame === 24 });
        assert.equal(g.player.data.isDead, false);
        assert.ok(g.camera.y <= FACTORY_SALON.arrivalCameraMaxY, 'The annex stays below the HUD.');
        top = Math.min(top, g.camera.y);
    }
    assert.ok(top < FACTORY_SALON.arrivalCameraMaxY - 1, 'The host still allows upward follow during a full jump.');
    assert.deepEqual(g.player.data.position, before);
    assert.equal(g.camera.y, FACTORY_SALON.arrivalCameraMaxY);
});
