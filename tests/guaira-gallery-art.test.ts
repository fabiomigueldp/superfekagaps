import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { TileType } from '../src/constants';
import { drawGalleryBackground, drawGalleryTerrain, drawGalleryObjects, GALLERY_MATERIAL_COLORS as P } from '../src/adventure/experimental/guaira/gallery/GuairaGalleryArt';

class Raster {
    fillStyle = '#000000'; globalAlpha = .37; globalCompositeOperation = 'multiply';
    readonly pixels = Array<string>(320 * 180).fill('');
    readonly calls: Array<[string, number, number, number, number]> = [];
    private bounds = [0, 0, 320, 180]; private pending = this.bounds;
    private stack: Array<{ fillStyle: string; globalAlpha: number; globalCompositeOperation: string; bounds: number[] }> = [];
    get depth() { return this.stack.length; }
    save() { this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, bounds: this.bounds }); }
    restore() { Object.assign(this, this.stack.pop()); }
    beginPath() {}
    rect(x: number, y: number, w: number, h: number) { this.pending = [x, y, x + w, y + h]; }
    clip() { this.bounds = [Math.max(this.bounds[0], this.pending[0]), Math.max(this.bounds[1], this.pending[1]), Math.min(this.bounds[2], this.pending[2]), Math.min(this.bounds[3], this.pending[3])]; }
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x,y,w,h].every(Number.isInteger));
        this.calls.push([this.fillStyle, x, y, w, h]);
        const left = Math.max(x, this.bounds[0]), right = Math.min(x + w, this.bounds[2]);
        if (right <= left) return;
        for (let yy = Math.max(y, this.bounds[1]); yy < Math.min(y + h, this.bounds[3]); yy++)
            this.pixels.fill(this.fillStyle, yy * 320 + left, yy * 320 + right);
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
    at(x: number, y: number) { return this.pixels[y * 320 + x]; }
}

function sampleLevel() {
    const data = structuredClone(STAGES[0].level);
    Object.assign(data, { width: 20, height: 12, originX: 0, originY: 0,
        tiles: Array.from({ length: 12 }, () => Array(20).fill(TileType.EMPTY)) });
    // Material fixture, not an invented or validated gameplay route.
    for (let x = 2; x <= 4; x++) data.tiles[4][x] = TileType.BRICK_BREAKABLE;
    for (let x = 5; x <= 8; x++) for (let y = 4; y <= 9; y++) data.tiles[y][x] = TileType.GROUND;
    data.tiles[7][2] = data.tiles[7][3] = TileType.PLATFORM;
    return new WorldLevel(data);
}
function paint(level: WorldLevel, cx = 0, cy = 0) {
    const c = new Raster(); drawGalleryTerrain(c.context, level, cx, cy); return c;
}

test('every native supporting tile owns its pixels and empty shafts stay empty', () => {
    const level = sampleLevel();
    for (const [cx, cy] of [[0,0],[9.25,18.75],[-12.5,-8.1],[61.75,46.25]]) {
        const c = paint(level,cx,cy), ox = Math.round(cx), oy = Math.round(cy);
        for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
            const wx = x + ox, wy = y + oy;
            const tile = level.data.tiles[Math.floor(wy / 16)]?.[Math.floor(wx / 16)] ?? TileType.EMPTY;
            const withinBoard = wy % 16 < 8;
            const expected = y >= 23 && (tile === TileType.GROUND || tile === TileType.BRICK_BREAKABLE || tile === TileType.PLATFORM && withinBoard);
            assert.equal(c.at(x,y) !== '', expected, `support paint mismatch ${x},${y} at camera ${cx},${cy}`);
        }
    }
});

test('partial destruction removes only the actual broken cover with no scenic replacement', () => {
    const level = sampleLevel(), before = paint(level);
    level.data.tiles[4][3] = TileType.EMPTY;
    const after = paint(level);
    for (let y = 64; y < 80; y++) for (let x = 32; x < 80; x++) {
        assert.ok(before.at(x,y));
        assert.equal(after.at(x,y), x >= 48 && x < 64 ? '' : before.at(x,y));
    }
    for (const col of [2,4]) level.data.tiles[4][col] = TileType.EMPTY;
    const opened = paint(level);
    for (let y = 64; y < 80; y++) for (let x = 32; x < 80; x++) assert.equal(opened.at(x,y), '');
});

test('safe caps remain continuous and fractured clay never borrows their visual signal', () => {
    const c = paint(sampleLevel());
    for (let y = 64; y < 66; y++) for (let x = 80; x < 144; x++) assert.equal(c.at(x,y), P.cap);
    for (let y = 112; y < 114; y++) for (let x = 32; x < 64; x++) assert.equal(c.at(x,y), P.cap);
    for (let y = 64; y < 80; y++) for (let x = 32; x < 80; x++) assert.notEqual(c.at(x,y), P.cap);
    for (const col of [2,3,4]) for (let y = 64; y < 80; y++) {
        assert.ok(Array.from({length:16},(_,x) => c.at(col * 16 + x,y)).includes(P.fracture), 'visible top-to-bottom fissure');
    }
});

test('top-anchored service partitions stay inside real barriers and leave the underpass open', () => {
    const level = sampleLevel();
    for (let row = 0; row < 7; row++) level.data.tiles[row][12] = TileType.GROUND;
    level.data.tiles[10][12] = TileType.GROUND;
    const c = paint(level);
    for (let y = 23; y < 112; y++) {
        for (let x = 192; x < 208; x++) { assert.ok(c.at(x,y)); assert.notEqual(c.at(x,y),P.cap); }
        assert.equal(c.at(191,y),''); assert.equal(c.at(208,y),'');
    }
    for (let y = 112; y < 160; y++) for (let x = 192; x < 208; x++) assert.equal(c.at(x,y),'');
    for (let x = 192; x < 208; x++) assert.equal(c.at(x,160),P.cap,'disconnected lower floor retains safe cap');
    assert.equal(c.at(193,46),P.iron,'vertical iron strap reads as top suspension');
});

test('painters preserve input and Canvas state and do not animate static route signals', () => {
    const level = sampleLevel(), objects = new WorldObjects([]), before = JSON.stringify({level,objects});
    const render = (time: number, reduced: boolean) => {
        const c = new Raster();
        drawGalleryBackground(c.context,19.25,37.75,time,reduced);
        drawGalleryTerrain(c.context,level,19.25,37.75);
        drawGalleryObjects(c.context,objects,19.25,37.75,time,reduced);
        assert.equal(c.depth,0); assert.equal(c.fillStyle,'#000000'); assert.equal(c.globalAlpha,.37);
        assert.equal(c.globalCompositeOperation,'multiply'); return c.calls;
    };
    assert.deepEqual(render(0,false),render(99999,true));
    assert.deepEqual(render(2300,false),render(2300,false));
    assert.equal(JSON.stringify({level,objects}),before);
});
