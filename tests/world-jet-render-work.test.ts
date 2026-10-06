import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { stageById } from '../src/adventure/campaign';
import { drawBurner } from '../src/adventure/WorldBurnerArt';
import { drawGeyser } from '../src/adventure/WorldGeyserArt';
import { WorldObjects, type MovingBody } from '../src/adventure/WorldPhysics';
import type { PixelFrame, PixelPalette, SpriteAtlas } from '../src/graphics/pixels';

type Fill = [number, number, number, number, string];
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function capture(body: MovingBody, world: number, time: number, cx: number, cy: number, width = 320, height = 180) {
    const visible: Fill[] = [], pixels = new Uint32Array(width * height);
    let fills = 0;
    const plot = (x: number, y: number, w: number, h: number, color: string) => {
        const left = Math.max(0, x), top = Math.max(0, y);
        const right = Math.min(width, x + w), bottom = Math.min(height, y + h);
        if (left >= right || top >= bottom) return;
        visible.push([left, top, right - left, bottom - top, color]);
        const rgba = (parseInt(color.slice(1), 16) << 8 | 255) >>> 0;
        for (let row = top; row < bottom; row++) pixels.fill(rgba, row * width + left, row * width + right);
    };
    const context = { canvas: { width, height }, fillStyle: '',
        fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
            fills++; plot(x, y, w, h, this.fillStyle);
        } } as unknown as CanvasRenderingContext2D;
    const atlas = { draw(_context: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette, x: number, y: number) {
        frame.forEach((row, yy) => [...row].forEach((key, xx) => {
            if (palette[key]) plot(Math.round(x) + xx, Math.round(y) + yy, 1, 1, palette[key]!);
        }));
    } } as unknown as SpriteAtlas;
    (world === 6 ? drawBurner : drawGeyser)(context, body, atlas, cx, cy, time, world);
    return { fills, visible: digest(JSON.stringify(visible)), pixels: digest(new Uint8Array(pixels.buffer)), style: context.fillStyle };
}
function authored(stageId: string) {
    const stage = stageById(stageId)!;
    return { body: new WorldObjects(stage.mechanisms).bodies.find(b => b.kind === 'jet')!, world: stage.world };
}
function sweep(world: number) {
    const { body } = authored(world === 3 ? '3-1' : world === 5 ? '5-2' : '6-2');
    const original = structuredClone(body), samples: string[] = [], rasters: string[] = [];
    let fills = 0, frames = 0;
    for (const [width, height] of [[320, 180], [160, 90], [640, 360]])
        for (const size of [4, 48, 244])
            for (const time of [0, 900, 1500, 1801, 1840, 1920, 2100, 2400, 2499, 2600, 3100])
                for (const [x, y] of [[80, -size], [-5.45, -.45], [80.45, 0], [width - 5.8, height - 4.8], [80, height], [width + 1, 0]]) {
                    const b = { ...body, height: size }, before = structuredClone(b);
                    const result = capture(b, world, time, body.x - x, body.y - y, width, height);
                    samples.push(result.visible + ':' + result.style); rasters.push(result.pixels);
                    fills += result.fills; frames++;
                    assert.deepEqual(b, before);
                }
    assert.deepEqual(body, original);
    return { fills, frames, visible: digest(samples.join(':')), pixels: digest(rasters.join(':')) };
}

// Recorded before clipping, from e2361c0867ed526b6179aa287e0b4ffec8fb69e4.
const baseline = {
    3: { fills: 125352, optimizedFills: 78771, frames: 594, visible: 'ce8acc4c4ec65bfd65eaa533d437808fd6666166512cf9f17b31c265b7a52fd6', pixels: '5bc0efb356aef07f6f42fe94dd124fedc8a12227c67d1b5fb4450284a127fd2b' },
    5: { fills: 125352, optimizedFills: 78771, frames: 594, visible: 'db23583c9dfb2305e963d477d0292cb474b824251f865fd832a0252bdcf24fa1', pixels: '2358bc59477c16896029902b4aa9b6a1357f22f08ee983d53c4f3762803ce7a9' },
    6: { fills: 55008, optimizedFills: 31329, frames: 594, visible: 'ef590e7e4aaa24deeb527b7c55776967e8742cf291afe193d512a0e6a863b3f0', pixels: '88dcc423644989be18603921c0e61955e699553c8ffc666982511d6e945e6a47' },
};

test('native jet viewport clipping retains exact visible paint and pixels across phases and canvas sizes', () => {
    for (const world of [3, 5, 6] as const) {
        const result = sweep(world), before = baseline[world];
        assert.equal(result.frames, before.frames);
        assert.equal(result.visible, before.visible, `World ${world}: exact ordered visible rectangles and final style`);
        assert.equal(result.pixels, before.pixels, `World ${world}: identical native pixels`);
        assert.equal(result.fills, before.optimizedFills);
        assert.ok(result.fills < before.fills, `World ${world}: fewer dynamic fillRect calls`);
    }
});

test('authored edge encounters avoid invisible texture work and retain freeze/reentry state', () => {
    const samples = [
        ['3-1', 324, 135, 'feed442b0e06cf7622c251baa49391c502fb90e248cc23b1ae2f61ee4d1a87f2', '02bb8b8fdd5fa70811a86b615087622c64766be7325c89ed2755ad5d5a39bde6'],
        ['5-2', 324, 288, '794479650b8bdc0aceca5384a6229ff4f6801763f870088379d05ed5a5a1335b', '05431252a5cf74f9c965c6d7dd9ad470e8e4a333b67c0b56d1292b83d4ac31d1'],
        ['6-2', 146, 122, '8c447f2d54dcc8aed338b7ec57651fd038b7fa303cdae0400128be4b2099a635', '8221917521bd2b5f9ec0ead657c2c3642499a0626f82a7a8b062e647155fc97d'],
    ] as const;
    for (const [stageId, beforeFills, afterFills, paintHash, pixelHash] of samples) {
        const { body, world } = authored(stageId), before = structuredClone(body);
        const cx = body.x - 80, time = 2100;
        const edge = capture(body, world, time, cx, 0);
        const visible = capture(body, world, time, cx, body.y - 60);
        assert.deepEqual(capture(body, world, time, cx, 0), edge, 'A paused repaint stays identical.');
        assert.deepEqual(capture(body, world, time, cx, body.y - 60), visible, 'Camera reentry restores the same texture.');
        assert.deepEqual(body, before, 'Draws never advance or change the mechanism.');
        assert.equal(edge.visible, paintHash, 'Authored viewport retains exact ordered visible paint.');
        assert.equal(edge.pixels, pixelHash, 'Authored viewport retains identical native pixels.');
        assert.equal(visible.fills, beforeFills, 'Fully visible columns retain their complete texture.');
        assert.equal(edge.fills, afterFills);
        assert.ok(edge.fills < beforeFills);
    }
});
