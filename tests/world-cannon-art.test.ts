import test from 'node:test';
import assert from 'node:assert/strict';
import { cannonPresentation, drawCannon } from '../src/adventure/WorldCannonArt';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { SpriteAtlas, type PixelFrame, type PixelPalette } from '../src/graphics/pixels';

const model = (direction = -1) => new WorldObjects([{ id: 'c', kind: 'launcher', x: 160, y: 208, width: 16, height: 16, direction, period: 3200 }]).bodies[0];
class Capture {
    fillStyle = '';
    pixels: [number, number, number, number, string][] = [];
    fillRect(x: number, y: number, w: number, h: number) { this.pixels.push([x, y, w, h, this.fillStyle]); }
}
class CapturedAtlas extends SpriteAtlas {
    images: { frame: PixelFrame; x: number; y: number; flip: boolean }[] = [];
    override draw(_c: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette, x: number, y: number, flip = false) {
        this.images.push({ frame, x, y, flip });
        assert.equal(frame.length, 40);
        for (const row of frame) {
            assert.equal(row.length, 48);
            for (const color of row) assert.ok(color in palette, `Missing palette symbol ${color}`);
        }
    }
}
test('cannon pressure and three-light countdown rise continuously over the existing 650 ms warning', () => {
    const b = model(); let last = -1;
    for (const timer of [650, 500, 300, 100, 0]) {
        b.timer = timer;
        const s = cannonPresentation(b, 1000);
        assert.equal(s.pose, 'charge'); assert.ok(s.pressure > last);
        assert.equal(s.charge, 1 - timer / 650); last = s.pressure;
    }
    assert.equal(last, 1);
    b.timer = 651;
    assert.equal(cannonPresentation(b, 1000).pose, 'idle');
});
test('cannon kick starts at the true muzzle, returns against damping and cannot move the chassis', () => {
    const b = model(); b.firedAt = 1000;
    assert.equal(cannonPresentation(b, 1000).recoil, 0);
    assert.equal(cannonPresentation(b, 1085).recoil, 5);
    const retreat = [85, 130, 200, 280, 360, 650].map(t => cannonPresentation(b, 1000 + t).recoil);
    assert.ok(retreat.every((n, i) => i === 0 || n <= retreat[i - 1]));
    assert.equal(retreat.at(-1), 0);
    for (const dir of [-1, 1]) {
        b.direction = dir;
        const a = new CapturedAtlas(), c = new Capture();
        drawCannon(c as unknown as CanvasRenderingContext2D, b, a, 0, 0, 1000, 3);
        drawCannon(c as unknown as CanvasRenderingContext2D, b, a, 0, 0, 1085, 3);
        assert.equal(a.images[0].x, a.images[2].x, 'Fixed chassis must not recoil');
        assert.equal(a.images[3].x - a.images[1].x, -dir * 5, 'Tube retreats away from shot');
        assert.ok(a.images.every(image => image.flip === (dir > 0)));
    }
});
test('refill follows pressure release instead of loading a keg during the shot', () => {
    const b = model(); b.firedAt = 0;
    assert.equal(cannonPresentation(b, 100).feed, 0);
    assert.equal(cannonPresentation(b, 260).feed, 0);
    assert.ok(cannonPresentation(b, 450).feed > 0 && cannonPresentation(b, 450).feed < 1);
    assert.equal(cannonPresentation(b, 610).feed, 1);
    assert.equal(cannonPresentation(b, 850).pressure, .3);
});
test('cannon rendering is deterministic, grid-aligned and does not mutate simulation while paused', () => {
    for (const world of [3, 5]) for (const direction of [-1, 1]) for (const elapsed of [0, 50, 120, 450, 800, 1500, 2800, 3150]) {
        const b = model(direction); b.firedAt = 0; b.timer = 3200 - elapsed;
        const frozen = structuredClone(b), c1 = new Capture(), c2 = new Capture(), a = new CapturedAtlas();
        drawCannon(c1 as unknown as CanvasRenderingContext2D, b, a, 20.2, 150.6, elapsed, world);
        drawCannon(c2 as unknown as CanvasRenderingContext2D, b, a, 20.2, 150.6, elapsed, world);
        assert.deepEqual(c1.pixels, c2.pixels);
        assert.deepEqual(b, frozen);
        assert.ok(c1.pixels.every(p => p.slice(0, 4).every(Number.isInteger)));
        assert.ok(c1.pixels.every(p => p[2] > 0 && p[3] > 0));
    }
});
