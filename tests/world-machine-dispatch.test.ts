import test from 'node:test';
import assert from 'node:assert/strict';
import { drawJet } from '../src/adventure/WorldMachineArt';
import { drawBurner } from '../src/adventure/WorldBurnerArt';
import { drawGeyser } from '../src/adventure/WorldGeyserArt';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { SpriteAtlas, type PixelFrame, type PixelPalette } from '../src/graphics/pixels';

/** Capture both native art and procedural pixels without a browser or GPU. */
function capture(draw: typeof drawJet, world: number, time: number) {
    const pixels: unknown[] = [];
    const context = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) {
        pixels.push([x, y, w, h, this.fillStyle]);
    } } as CanvasRenderingContext2D;
    const atlas = { draw(_c: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette, x: number, y: number) {
        pixels.push([frame, palette, x, y]);
    } } as SpriteAtlas;
    const body = new WorldObjects([{ id: 'jet', kind: 'jet', x: 80, y: 48, width: 13, height: 48, period: 4200 }]).bodies[0];
    draw(context, body, atlas, 12, 4, time, world);
    return pixels;
}

test('campaign machine dispatch preserves the material-specific warning and danger art', () => {
    for (const world of [1, 2, 3, 4, 5, 6]) for (const time of [0, 1700, 2100, 2600]) {
        assert.deepEqual(capture(drawJet, world, time), capture(world === 6 ? drawBurner : drawGeyser, world, time));
    }
    assert.notDeepEqual(capture(drawJet, 3, 2100), capture(drawJet, 5, 2100), 'Cold and factory jets keep distinct skins');
    assert.notDeepEqual(capture(drawJet, 5, 2100), capture(drawJet, 6, 2100), 'Oven flames must never fall through to juice');
});
