import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { ISLANDS } from '../src/adventure/campaign';
import { TileType as T } from '../src/constants';
import { GroundPoundState } from '../src/types';
import { BLOCK_BREAK_MS } from '../src/world/BlockImpacts';
import { drawGalleryTerrain, GALLERY_MATERIAL_COLORS as P } from '../src/adventure/experimental/guaira/gallery/GuairaGalleryArt';
import { drawReliefTerrain } from '../src/adventure/experimental/guaira/relief/GuairaReliefArt';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { BLOCK_DT, blockBrowser, blockStage } from './helpers/blockImpactHarness';
import gallery from './helpers/guairaGalleryReplay.json';
import relief from './helpers/guairaReliefReplay.json';

type Paint = [string, number, number, number, number, number];
class PaintRecorder {
    fillStyle = '#000000'; globalAlpha = .37; globalCompositeOperation = 'multiply';
    readonly calls: Paint[] = [];
    private bounds = [0, 0, 320, 180]; private pending = this.bounds;
    private stack: Array<{ fillStyle: string; globalAlpha: number; globalCompositeOperation: string; bounds: number[] }> = [];
    save() { this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, bounds: this.bounds }); }
    restore() { Object.assign(this, this.stack.pop()); }
    beginPath() {}
    rect(x: number, y: number, w: number, h: number) { this.pending = [x, y, x + w, y + h]; }
    clip() { this.bounds = [Math.max(this.bounds[0], this.pending[0]), Math.max(this.bounds[1], this.pending[1]), Math.min(this.bounds[2], this.pending[2]), Math.min(this.bounds[3], this.pending[3])]; }
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x, y, w, h].every(Number.isInteger));
        const left = Math.max(x, this.bounds[0]), top = Math.max(y, this.bounds[1]);
        const right = Math.min(x + w, this.bounds[2]), bottom = Math.min(y + h, this.bounds[3]);
        if (right > left && bottom > top && this.globalAlpha > 0)
            this.calls.push([this.fillStyle, left, top, right - left, bottom - top, this.globalAlpha]);
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
    checkState() {
        assert.equal(this.stack.length, 0); assert.equal(this.fillStyle, '#000000');
        assert.equal(this.globalAlpha, .37); assert.equal(this.globalCompositeOperation, 'multiply');
    }
}
function fixture(originX = 0, originY = 0) {
    const data = blockStage(T.BRICK_BREAKABLE, originX, originY).level;
    data.tiles = data.tiles.map(row => row.map(() => T.EMPTY)); data.tiles[6][5] = T.BRICK_BREAKABLE;
    return new WorldLevel(data);
}
function paint(level: WorldLevel, reduced = false, cx = 0, cy = 0) {
    const recorder = new PaintRecorder(); drawGalleryTerrain(recorder.context, level, cx, cy, reduced); recorder.checkState(); return recorder.calls;
}
const positions = (calls: Paint[]) => calls.map(call => call.slice(0, 5));

test('clay fracture leaves sparse material flakes and a real hole; render cannot mutate native state', () => {
    const level = fixture();
    assert.equal(level.breakTile(5, 6, true, 'down').success, true); assert.equal(level.getTile(5, 6), T.EMPTY);
    const before = JSON.stringify(level), calls = paint(level);
    const colors = new Set<string>([P.clay, P.clayShade, P.clayLight, P.fractureLight]);
    assert.ok(calls.length > 0); assert.ok(calls.every(([color]) => colors.has(color)));
    assert.ok(calls.every(([, , , w, h]) => w <= 2 && h === 1), 'No full cover, square brick chunk or invented landing.');
    assert.ok(calls.reduce((sum, [, , , w, h]) => sum + w * h, 0) < 16 * 16 / 2, 'Most of the erased tile is visibly open from the first frame.');
    assert.deepEqual(paint(level), calls); assert.equal(JSON.stringify(level), before);
    assert.equal(level.breakTile(5, 6, true, 'down').success, false); assert.equal(level.blockImpacts.active.length, 1);
    level.blockImpacts.update(100); assert.notDeepEqual(positions(paint(level)), positions(calls));
    level.blockImpacts.update(BLOCK_BREAK_MS); assert.deepEqual(paint(level), []);
    assert.equal(level.getTile(5, 6), T.EMPTY);
});

test('Gallery and Relief share stationary reduced-motion fragments, fading out by 120 ms', () => {
    const level = fixture(); level.breakTile(5, 6);
    const start = paint(level, true); level.blockImpacts.update(60); const later = paint(level, true);
    assert.deepEqual(positions(start), positions(later)); assert.ok(later.every(call => call[5] === .5));
    const reliefPaint = new PaintRecorder(); drawReliefTerrain(reliefPaint.context, level, 0, 0, true);
    assert.deepEqual(reliefPaint.calls, later); reliefPaint.checkState();
    level.blockImpacts.update(60); assert.deepEqual(paint(level, true), []);
    assert.ok(paint(level).length > 0, 'Only reduced-motion rendering stops at 120 ms.');
});

test('clay fragments respect world origins, rounded camera, HUD clipping and offscreen entry', () => {
    const base = fixture(), shifted = fixture(-8, 3);
    for (const level of [base, shifted]) level.breakTile(5, 6, true, 'down');
    assert.deepEqual(paint(shifted, false, -127.8, 48.2), paint(base));
    assert.deepEqual(paint(base, false, 5000, 5000), []);
    base.blockImpacts.update(450);
    const entering = paint(base, false, 0, 160);
    assert.ok(entering.length > 0, 'A downward chip can enter below the HUD with its erased source 64 px above the view.');
    assert.ok(entering.every(([, , y]) => y >= 23));
    base.reset(); assert.equal(base.blockImpacts.active.length, 0);
});

for (const [scene, Game, runs, direction] of [
    ['Gallery pound', GuairaGallery, gallery.runs, 'down'],
    ['Relief pound', GuairaRelief, relief.maintenance, 'down'],
    ['Relief head hit', GuairaRelief, relief.headBump, 'up'],
] as const) for (const reducedMotion of [false, true])
    test(`${scene}: native contact, adapter, pause, expiry, reload and disposal; reduced ${reducedMotion}`, t => {
        const h = blockBrowser(t, { reducedMotion });
        const game = new Game(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
        t.after(() => game.dispose());
        let held = new Set<string>(), found = false;
        const keys = (next: readonly string[]) => {
            const newKeys = new Set(next);
            for (const code of held) if (!newKeys.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of newKeys) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            held = newKeys;
        };
        // Recorded native keyboard routes, with no player/tile/completion writes.
        outer: for (const [frames, codes] of runs as Array<[number, string[]]>) {
            keys(codes);
            for (let frame = 0; frame < frames; frame++) {
                game.update(BLOCK_DT);
                if (game.level.blockImpacts.active.length) { found = true; break outer; }
            }
        }
        keys([]); assert.ok(found, 'The real route must reach native cover contact.');
        const impacts = structuredClone(game.level.blockImpacts.active);
        assert.ok(impacts.every(i => i.kind === 'break' && i.direction === direction && i.age === 0));
        assert.ok(impacts.every(i => game.level.getTile(i.col, i.row) === T.EMPTY));
        if (direction === 'down') assert.equal(game.player.data.groundPoundState, GroundPoundState.RECOVERY);
        const before = JSON.stringify({ player: game.player.data, level: game.level, save: game.store.save, coins: game.coins });
        game.render(); game.render();
        assert.equal(JSON.stringify({ player: game.player.data, level: game.level, save: game.store.save, coins: game.coins }), before);
        const toggle = () => game instanceof GuairaGallery ? game.toggleGalleryPause() : game.toggleReliefPause();
        toggle(); game.update(1000); game.render(); assert.deepEqual(game.level.blockImpacts.active, impacts);
        toggle(); game.update(BLOCK_DT); assert.equal(game.level.blockImpacts.active[0].age, BLOCK_DT);
        for (let frame = 0; frame < 8; frame++) game.update(BLOCK_DT);
        const cx = Math.round(game.camera.x), cy = Math.round(game.camera.y);
        for (const reduced of [false, true]) {
            const actual = new PaintRecorder(), expected = new PaintRecorder();
            game.art.terrain(actual.context, game.level, ISLANDS[0], cx, cy, game.time, reduced);
            drawGalleryTerrain(expected.context, game.level, cx, cy, reduced);
            assert.deepEqual(actual.calls, expected.calls, 'Both adapters forward the current renderer motion preference.');
        }
        for (let frame = 0; frame < 30; frame++) game.update(BLOCK_DT);
        assert.equal(game.level.blockImpacts.active.length, 0);
        game.load(game.stage.id); assert.equal(game.level.blockImpacts.active.length, 0);
        const hit = impacts[0]; assert.equal(game.level.getTile(hit.col, hit.row), T.BRICK_BREAKABLE);
        game.level.breakTile(hit.col, hit.row); game.load(game.stage.id); assert.equal(game.level.blockImpacts.active.length, 0);
        game.level.breakTile(hit.col, hit.row); game.dispose(); assert.equal(game.level.blockImpacts.active.length, 0);
        assert.equal(game.coins, 0); assert.deepEqual(h.storageCalls, []);
    });
