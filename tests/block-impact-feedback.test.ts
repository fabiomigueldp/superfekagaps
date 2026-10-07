import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK_BREAK_SCORE, TileType as T } from '../src/constants';
import { BlockImpacts, BLOCK_BUMP_MS, BLOCK_BREAK_MS, MAX_BLOCK_IMPACTS } from '../src/world/BlockImpacts';
import { Level } from '../src/world/Level';
import { blockFragmentPose, drawBlockImpacts } from '../src/graphics/blockImpactArt';
import { WorldGame } from '../src/adventure/WorldGame';
import { GroundPoundState } from '../src/types';
import { BLOCK_DT, blockStage, classicBlockHarness, blockBrowser } from './helpers/blockImpactHarness';

test('intact brick gives one short weighted recoil without moving the collider', () => {
    const level = new Level(blockStage(T.BRICK).level), before = structuredClone(level.data);
    level.bumpTile(5, 6);
    const offsets = [level.blockImpacts.offset(5, 6)];
    for (const dt of [35, 80, 65]) { level.updateDynamicTiles(dt); offsets.push(level.blockImpacts.offset(5, 6)); }
    assert.deepEqual(offsets, [-1, -3, 1, 0]);
    assert.equal(level.blockImpacts.active.length, 0);
    assert.deepEqual(level.data, before);
    level.bumpTile(5, 6); level.updateDynamicTiles(40); level.bumpTile(5, 6);
    assert.equal(level.blockImpacts.active.length, 1, 'A new legitimate hit replaces the prior response.');
    assert.equal(level.blockImpacts.active[0].age, 0);
    assert.equal(level.blockImpacts.offset(5, 6, true), 0);
    assert.equal(level.blockImpacts.offset(4, 6), 0);
});

test('breakable/helmet gating, exact removal and duplicate prevention stay synchronous', () => {
    const level = new Level(blockStage(T.BRICK).level);
    assert.deepEqual(level.breakTile(5, 6), { success: false, type: T.BRICK });
    assert.equal(level.blockImpacts.active.length, 0);
    level.bumpTile(5, 6);
    assert.deepEqual(level.breakTile(5, 6, true), { success: true, type: T.BRICK });
    assert.equal(level.getTile(5, 6), T.EMPTY);
    assert.equal(level.blockImpacts.active.length, 1);
    assert.equal(level.blockImpacts.active[0].kind, 'break');
    assert.equal(level.breakTile(5, 6, true).success, false);
    assert.equal(level.blockImpacts.active.length, 1);
    for (const col of [-1, 100]) assert.equal(level.breakTile(col, 6).success, false);
    level.reset(); assert.equal(level.blockImpacts.active.length, 0);
});

test('four fragments separate, turn, fall under gravity and fade instead of floating upward', () => {
    const event = { col: 0, row: 0, kind: 'break' as const, direction: 'up' as const, age: 0 };
    for (let index = 0; index < 4; index++) {
        const start = blockFragmentPose(event, index), early = blockFragmentPose({ ...event, age: 100 }, index);
        const late = blockFragmentPose({ ...event, age: 450 }, index);
        assert.ok(early.y < start.y);
        assert.ok(late.y > early.y, 'Gravity reverses the upward burst.');
        assert.ok(index % 2 ? early.x > start.x : early.x < start.x);
        assert.notEqual(early.turn, start.turn);
        assert.ok(late.alpha > 0 && late.alpha < 1);
        assert.equal(blockFragmentPose({ ...event, age: BLOCK_BREAK_MS }, index).alpha, 0);
        const reduced = blockFragmentPose({ ...event, age: 60 }, index, true);
        assert.equal(reduced.x, start.x); assert.equal(reduced.y, start.y); assert.equal(reduced.turn, 0);
        assert.equal(blockFragmentPose({ ...event, age: 120 }, index, true).alpha, 0);
    }
    assert.ok(blockFragmentPose({ ...event, direction: 'down', age: 50 }, 2).y > 9,
        'Pounded bottom fragments are driven downward immediately.');
});

test('effect storage stays bounded, expires in place and idle/invalid ticks allocate nothing', () => {
    const impacts = new BlockImpacts(), list = impacts.active;
    for (let i = 0; i < 200; i++) impacts.add(i, 0, i % 2 ? 'break' : 'bump');
    assert.equal(impacts.active.length, MAX_BLOCK_IMPACTS);
    impacts.update(NaN); impacts.update(-1); assert.equal(impacts.active[0].age, 0);
    impacts.update(BLOCK_BUMP_MS); assert.ok(impacts.active.every(i => i.kind === 'break'));
    impacts.update(BLOCK_BREAK_MS); assert.equal(impacts.active.length, 0);
    impacts.update(1000); assert.equal(impacts.active, list);
});

for (const [tile, helmet, breaks] of [[T.BRICK_BREAKABLE, false, true], [T.BRICK, false, false], [T.BRICK, true, true]] as const)
    test(`classic real head collision: type ${tile}, helmet ${helmet}, one reward and no generic block particles`, () => {
        const h = classicBlockHarness(tile, helmet, -8, 3);
        for (let frame = 0; frame < 8 && !h.level.blockImpacts.active.length; frame++) h.step({ jump: true, jumpPressed: frame === 0 });
        assert.equal(h.level.blockImpacts.active.length, 1);
        assert.equal(h.level.blockImpacts.active[0].kind, breaks ? 'break' : 'bump');
        assert.deepEqual([h.level.blockImpacts.active[0].col, h.level.blockImpacts.active[0].row], [5, 6]);
        assert.equal(h.level.getTile(5, 6), breaks ? T.EMPTY : T.BRICK);
        assert.equal(h.game.score, breaks ? BLOCK_BREAK_SCORE : 0);
        assert.equal(h.game.particles.length, 0, 'The old generic block particle path is replaced.');
        for (let i = 0; i < 3; i++) h.step();
        assert.equal(h.game.score, breaks ? BLOCK_BREAK_SCORE : 0);
    });

test('classic pound fractures each eligible tile once, preserves reward and separate impact dust', () => {
    const h = classicBlockHarness();
    h.level.setTile(4, 6, T.BRICK_BREAKABLE); h.level.setTile(6, 6, T.BRICK);
    h.game.handleGroundPoundImpact({ x: 88, y: 96, col: 5, row: 6 });
    assert.equal(h.game.score, BLOCK_BREAK_SCORE * 2);
    assert.equal(h.level.getTile(6, 6), T.BRICK);
    assert.equal(h.level.blockImpacts.active.length, 2);
    assert.ok(h.level.blockImpacts.active.every(p => p.direction === 'down'));
    assert.equal(h.game.particles.length, 10, 'Only the independent ground-pound dust remains.');
    h.game.handleGroundPoundImpact({ x: 88, y: 96, col: 5, row: 6 });
    assert.equal(h.game.score, BLOCK_BREAK_SCORE * 2);
});

test('World keyboard collision, pause, render, restart, load and disposal preserve simulation/progress', t => {
    const h = blockBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    t.after(() => game.dispose());
    const stage = blockStage(); game.load(stage.id, false, stage);
    const beforeSave = JSON.stringify(game.store.save), coins = game.coins;
    h.window.dispatch('keydown', { code: 'Space', key: ' ', target: h.canvas });
    for (let i = 0; i < 10 && !game.level.blockImpacts.active.length; i++) game.update(BLOCK_DT);
    h.window.dispatch('keyup', { code: 'Space', key: ' ', target: h.canvas });
    assert.equal(game.level.getTile(5, 6), T.EMPTY);
    assert.equal(game.level.blockImpacts.active.length, 1);
    assert.equal(game.level.blockImpacts.active[0].age, 0);
    const before = JSON.stringify(game.level.blockImpacts.active); game.render(); game.render();
    assert.equal(JSON.stringify(game.level.blockImpacts.active), before, 'Painting cannot advance the effect.');
    game.state = 'paused'; game.update(1000); assert.equal(JSON.stringify(game.level.blockImpacts.active), before);
    game.state = 'playing'; game.update(BLOCK_DT); assert.equal(game.level.blockImpacts.active[0].age, BLOCK_DT);
    assert.equal(game.coins, coins); assert.equal(JSON.stringify(game.store.save), beforeSave);
    (game as any).restart(); assert.equal(game.level.blockImpacts.active.length, 0); assert.equal(game.level.getTile(5, 6), T.BRICK_BREAKABLE);
    game.level.breakTile(5, 6); game.load(stage.id, false, stage); assert.equal(game.level.blockImpacts.active.length, 0);
    game.level.breakTile(5, 6); game.dispose(); assert.equal(game.level.blockImpacts.active.length, 0);
});

test('World pound uses downward fracture without adding rewards or changing support timing', t => {
    const h = blockBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    const stage = blockStage(); game.load(stage.id, false, stage);
    game.player.data.position.y = 65; game.player.data.velocity.y = 12;
    game.player.data.groundPoundState = GroundPoundState.FALL;
    game.update(BLOCK_DT);
    assert.equal(game.level.getTile(5, 6), T.EMPTY);
    assert.equal(game.level.blockImpacts.active[0].direction, 'down');
    assert.equal(game.coins, 0); assert.equal(game.player.data.isGrounded, true);
    game.dispose();
});

test('painter uses world origin, four cached pieces, local reduced cue and offscreen culling', t => {
    blockBrowser(t);
    const impacts = new BlockImpacts(); impacts.add(5, 6, 'break');
    const draws: number[][] = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, fillRect() {}, drawImage(_image: unknown, ...args: number[]) { draws.push(args); } } as unknown as CanvasRenderingContext2D;
    drawBlockImpacts(ctx, impacts, -48, 96, 'meadow', false, -8, 3);
    assert.equal(draws.length, 4); assert.deepEqual(draws[0].slice(0, 2), [1, 49]);
    draws.length = 0; impacts.update(60);
    drawBlockImpacts(ctx, impacts, -48, 96, 'meadow', true, -8, 3);
    assert.equal(draws.length, 4); assert.deepEqual(draws[0].slice(0, 2), [1, 49]);
    draws.length = 0; impacts.update(60);
    drawBlockImpacts(ctx, impacts, -48, 96, 'meadow', true, -8, 3); assert.equal(draws.length, 0);
    drawBlockImpacts(ctx, impacts, 5000, 5000, 'meadow'); assert.equal(draws.length, 0);
});


test('death advances cosmetic fragments after hit-stop without advancing solid terrain, and classic retry clears them', () => {
    const h = classicBlockHarness(); h.level.breakTile(5, 6);
    let dynamicTicks = 0; h.level.updateDynamicTiles = () => { dynamicTicks++; };
    h.game.playerDie();
    for (let i = 0; i < 60; i++) h.step();
    assert.equal(h.level.blockImpacts.active.length, 0);
    assert.equal(dynamicTicks, 0);
    h.level.blockImpacts.add(5, 6, 'break'); h.game.handlePlayerDeath();
    assert.equal(h.level.blockImpacts.active.length, 0);
    assert.equal(h.level.getTile(5, 6), T.EMPTY, 'Classic retry retains its existing modified terrain.');
});

test('reduced-motion intact hit keeps its collider still and paints only a fading stationary contact cue', t => {
    blockBrowser(t, { reducedMotion: true });
    const impacts = new BlockImpacts(); impacts.add(5, 6, 'bump');
    const grains: number[][] = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, fillRect(...args: number[]) { grains.push(args); },
        drawImage() { assert.fail('An intact reduced-motion bump never emits flying chunks.'); } } as unknown as CanvasRenderingContext2D;
    drawBlockImpacts(ctx, impacts, 0, 0, 'meadow', true);
    assert.equal(grains.length, 3); const start = structuredClone(grains); grains.length = 0;
    impacts.update(60); drawBlockImpacts(ctx, impacts, 0, 0, 'meadow', true); assert.deepEqual(grains, start);
    grains.length = 0; impacts.update(60); drawBlockImpacts(ctx, impacts, 0, 0, 'meadow', true); assert.equal(grains.length, 0);
    assert.equal(impacts.offset(5, 6, true), 0);
});


test('a downward fragment can enter the viewport from a block above the coarse culling margin', t => {
    blockBrowser(t);
    const impacts = new BlockImpacts(); impacts.add(0, 0, 'break', 'down'); impacts.update(450);
    const draws: number[][] = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, fillRect() {},
        drawImage(_image: unknown, ...args: number[]) { draws.push(args); } } as unknown as CanvasRenderingContext2D;
    drawBlockImpacts(ctx, impacts, -80, 88, 'meadow');
    assert.equal(draws.length, 4);
    assert.ok(draws.some(([x, y]) => x >= 0 && x < 320 && y >= 0 && y < 180),
        'Lower chunks reach the visible top edge while their original block is 88 px above it.');
});
