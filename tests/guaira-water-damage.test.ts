import test from 'node:test';
import assert from 'node:assert/strict';
import { paintGuairaWaterFrame, guairaScreenPoint, GUAIRA_FEKA_PIXEL_WIDTH } from '../src/adventure/experimental/guaira/GuairaMapArt';

test('partial water damage includes the whole native actor and antialiased shadow, while water stays mask-only', () => {
    const clips: number[][][] = []; let path: number[][] = [];
    const context = new Proxy({}, { get: (_target, key) => {
        if (key === 'beginPath') return () => { path = []; };
        if (key === 'rect') return (...args: number[]) => { path.push(args); };
        if (key === 'clip') return () => { clips.push(path.map(r => [...r])); };
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
    } }) as CanvasRenderingContext2D;
    const camera = { width: 390, height: 500, imageWidth: 906.9767441860465, x: -334.3728488372093, y: -72.16569767441857 };
    const actor = { point: { x: .5836675, y: .6790895 }, moving: false, facingLeft: false, reducedMotion: false };
    const effect = { regions: [{ bounds: [1122, 756, 282, 236] as const }], draw() {} };
    paintGuairaWaterFrame(context, {} as CanvasImageSource, camera, actor, 0, { effect, seconds: 1.25 });
    assert.equal(clips.length, 2); assert.equal(clips[0].length, 2); assert.equal(clips[1].length, 1);
    assert.deepEqual(clips[0][0], clips[1][0], 'The inner water clip never expands into actor-only damage');
    const [x, y, w, h] = clips[0][1], p = guairaScreenPoint(actor.point, camera), pixel = camera.imageWidth * GUAIRA_FEKA_PIXEL_WIDTH;
    assert.ok(x < p.x - 8 * pixel && x + w > p.x + 8 * pixel);
    assert.ok(y < p.y - 26 * pixel && y + h > p.y + 2.6 * pixel);
    assert.ok(w * h < 2500, 'Only a small local actor rectangle is restored');
});
