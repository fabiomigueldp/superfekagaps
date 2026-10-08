import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { ALL_DELICIA_STAGES, DELICIA_STAGES, type DeliciaStage } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';
import { DeliciaStore } from '../src/adventure/delicia/DeliciaProgress';
import { DELICIA_CAMERA_TOP } from '../src/adventure/delicia/DeliciaNative';

const DT = 1 / 60;
function visible(sim: DeliciaSimulation) {
    const p = sim.player;
    assert.ok(p.x - sim.cameraX >= 0 && p.x + p.w - sim.cameraX <= 960, `${sim.stage.id}: horizontal body bounds`);
    assert.ok(p.y - sim.cameraY >= 0 && p.y + p.h - sim.cameraY <= 540, `${sim.stage.id}: vertical body bounds`);
    assert.ok(sim.cameraX >= 0 && sim.cameraX <= Math.max(0, sim.stage.width - 960));
    assert.ok(sim.cameraY >= 0 && sim.cameraY <= Math.max(0, sim.stage.height - 540));
}
const modelBytes = (sim: DeliciaSimulation) => JSON.stringify(sim, (key, value) => key === 'cameraX' || key === 'cameraY' ? undefined : value);

test('boss introductions show the complete sprite and shield in the shared viewport', () => {
    for (const stage of ALL_DELICIA_STAGES.filter(stage => stage.boss)) {
        const sim = new DeliciaSimulation(stage), boss = sim.boss!;
        assert.ok(boss.x + boss.w / 2 - 96 >= sim.cameraX);
        assert.ok(boss.x + boss.w / 2 + 96 <= sim.cameraX + 960);
        visible(sim);
        for (const [playerX, bossX] of [[950,1110],[150,260],[1160,780],[12,780]]) {
            Object.assign(sim.player,{x:playerX,y:378,vx:0,vy:0});boss.x=bossX;
            sim.update(DT,noDeliciaInput());
            assert.ok(boss.x + boss.w / 2 - 96 >= sim.cameraX, `${stage.id}: left shield`);
            assert.ok(boss.x + boss.w / 2 + 96 <= sim.cameraX + 960, `${stage.id}: right shield`);
            visible(sim);
        }
    }
});

test('all authored checkpoint resumes frame Feka and the local floor before the first update', t => {
    let checkpoints = 0, formerlyHidden = 0, worstBlindFrames = 0;
    for (const stage of ALL_DELICIA_STAGES) for (let index = 0; index < stage.checkpoints.length; index++) {
        const stageBytes = JSON.stringify(stage), sim = new DeliciaSimulation(stage, false, index);
        assert.deepEqual({ x: sim.player.x, y: sim.player.y }, stage.checkpoints[index]);
        assert.equal(sim.time, 0); assert.equal(sim.elapsed, 0); assert.equal(sim.recordEligible, false);
        visible(sim); checkpoints++;
        const before = new DeliciaSimulation(stage, false, index);
        // Reproduce only the old camera initialization; gameplay is untouched.
        before.cameraX = 0; before.cameraY = 0;
        if (before.player.x >= 960) formerlyHidden++;
        let frames = 0;
        while (before.player.x + before.player.w - before.cameraX > 960 && frames < 120) {
            before.update(DT, noDeliciaInput()); frames++;
        }
        worstBlindFrames = Math.max(worstBlindFrames, frames);
        const localFloor = stage.floors.find(f => sim.floorAvailable(f) && f.x <= sim.player.x && f.x + f.w >= sim.player.x + sim.player.w && Math.abs(f.y - (sim.player.y + sim.player.h)) <= 8);
        assert.ok(localFloor, `${stage.id}:${index}: checkpoint's authored supporting floor`);
        assert.ok(localFloor.y - sim.cameraY <= 540 && localFloor.y - sim.cameraY >= 0);
        assert.equal(JSON.stringify(stage), stageBytes, 'The authored stage is unchanged.');
    }
    assert.equal(formerlyHidden, 36); assert.ok(worstBlindFrames > 0 && worstBlindFrames < 120);
    t.diagnostic(JSON.stringify({ checkpoints, formerlyHidden, worstBlindFrames, afterBlindFrames: 0 }));
});

test('ordinary starts and invalid checkpoints retain their original frame and gameplay state', () => {
    for (const stage of ALL_DELICIA_STAGES) for (const checkpoint of [-1, stage.checkpoints.length]) {
        const sim = new DeliciaSimulation(stage, false, checkpoint);
        assert.equal(sim.cameraX, 0); assert.equal(sim.cameraY, 0); visible(sim);
        assert.deepEqual({ x: sim.player.x, y: sim.player.y }, stage.spawn);
        assert.equal(sim.checkpoint, -1); assert.equal(sim.time, 0);
    }
});

test('checkpoint framing clamps at each stage edge, including a viewport larger than the stage', () => {
    for (const [width, height, x, y, cameraX, cameraY] of [
        [2000, 900, 5, 10, 0, 0], [2000, 900, 1958, 828, 1040, 360], [600, 400, 250, 300, 0, 0],
    ]) {
        const stage: DeliciaStage = { ...DELICIA_STAGES[0], width, height, checkpoints: [{ x, y }] };
        const sim = new DeliciaSimulation(stage, false, 0); visible(sim);
        assert.deepEqual({ x: sim.cameraX, y: sim.cameraY }, { x: cameraX, y: cameraY });
    }
});

test('checkpoint movement, reversals, jumps, falls and retry leave all non-camera model bytes unchanged', () => {
    for (const stage of ALL_DELICIA_STAGES) for (let checkpoint = 0; checkpoint < stage.checkpoints.length; checkpoint++) {
        const after = new DeliciaSimulation(stage, false, checkpoint), before = new DeliciaSimulation(stage, false, checkpoint);
        before.cameraX = 0; before.cameraY = 0;
        assert.equal(modelBytes(after), modelBytes(before));
        for (let frame = 0; frame < 180; frame++) {
            const input = { ...noDeliciaInput(), right: frame < 60, left: frame >= 60 && frame < 120,
                jumpPressed: frame === 15 || frame === 75, jump: frame >= 15 && frame < 30 || frame >= 75 && frame < 90,
                jumpReleased: frame === 30 || frame === 90, pound: frame === 100 };
            before.update(DT, input); after.update(DT, input);
            assert.equal(modelBytes(after), modelBytes(before), `${stage.id}:${checkpoint}:${frame}`);
            assert.ok(after.cameraX >= 0 && after.cameraX <= stage.width - 960);
            assert.ok(after.cameraY >= DELICIA_CAMERA_TOP && after.cameraY <= stage.height - 540);
        }
        const retry = new DeliciaSimulation(stage, false, checkpoint); visible(retry);
        const still = modelBytes(retry), camera = { x: retry.cameraX, y: retry.cameraY };
        retry.update(0, noDeliciaInput());
        assert.deepEqual({ x: retry.cameraX, y: retry.cameraY }, camera);
        // The zero-time update may initialize floor/zone state, so compare fresh
        // retry construction rather than treating it as a paused host update.
        assert.equal(modelBytes(new DeliciaSimulation(stage, false, checkpoint)), still);
    }
});

test('real app retry and saved resume construct the visible frame without changing saved progress', t => {
    const url = new URL('../src/adventure/delicia/DeliciaApp.ts', import.meta.url), require = createRequire(url);
    const css = require.extensions['.css']; require.extensions['.css'] = () => {};
    t.after(() => { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; });
    const source = readFileSync(url, 'utf8').replace('import.meta', '({env:{DEV:false}})');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} as typeof import('../src/adventure/delicia/DeliciaApp') };
    runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: url.pathname })(require, module, module.exports);
    // Browser/UI/audio boundaries only. The production loadStage method creates
    // the simulation and restores the real saved valves/collectibles unchanged.
    const app = Object.create(module.exports.DeliciaApp.prototype), store = new DeliciaStore(null), noop = () => {};
    Object.assign(app, { store, screen: 'title', panel: { hidden: false }, canvas: { focus: noop }, audio: new Proxy({}, { get: () => noop }),
        setScreen(screen: string) { this.screen = screen; }, updateHud: noop, announce: noop,
        showDialogue() { this.screen = 'dialogue'; } });
    for (const reducedMotion of [false, true]) for (const retry of [false, true]) {
        const stage = DELICIA_STAGES[0];
        store.save.reducedMotion = reducedMotion;
        store.save.checkpoint = { stage: stage.id, index: 2, valves: stage.valves.slice(0, 1).map(v => v.id) };
        store.save.collected = stage.pickups.slice(0, 3).map(p => p.id);
        const bytes = JSON.stringify(store.save);
        assert.equal(app.loadStage(stage.id, retry), true); visible(app.sim);
        assert.equal(app.sim.time, 0); assert.equal(app.screen, retry ? 'playing' : 'dialogue');
        assert.deepEqual([...app.sim.valves], store.save.checkpoint.valves);
        assert.deepEqual([...app.sim.collected], store.save.collected);
        assert.equal(JSON.stringify(store.save), bytes);
    }
});
