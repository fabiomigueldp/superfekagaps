import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUAIRA_WATER_CONTRACT, GuairaWaterMotion, VisibleWaterClock } from '../src/adventure/experimental/guaira/GuairaWaterMotion';

test('authored water atlas stays in four small regions and matches its PNG dimensions', () => {
    const data = GUAIRA_WATER_CONTRACT;
    const png = readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-water-mask.png', import.meta.url));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], data.atlasSize);
    assert.deepEqual(data.sourceSize, [1920, 1200]); assert.equal(data.regions.length, 4);
    for (const { bounds: [x, y, width, height], atlas: [ax, ay] } of data.regions) {
        assert.ok([x,y,width,height,ax,ay].every(Number.isFinite));
        assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1920 && y + height <= 1200);
        assert.ok(ax >= 0 && ay >= 0 && ax + width <= data.atlasSize[0] && ay + height <= data.atlasSize[1]);
    }
    assert.ok(data.channels.every(c => [...c.a, ...c.b, ...c.edge, c.velocity].every(Number.isFinite) && c.velocity > 0));
    assert.ok(data.channels.every(c => Math.hypot(...c.a.map((n, i) => n - c.b[i])) > 0));
    const bytes = (data.atlasSize[0] * data.atlasSize[1] + Math.max(...data.regions.map(r => r.bounds[2])) * Math.max(...data.regions.map(r => r.bounds[3]))) * 4;
    assert.ok(bytes < 1024 * 1024, 'atlas decode plus reusable scratch remain below one MiB');
});

test('visible water clock excludes long suspension and reduced-motion intervals', () => {
    const clock = new VisibleWaterClock();
    assert.equal(clock.tick(500, true), 0); assert.equal(clock.tick(540, true), .04);
    clock.suspend(); assert.equal(clock.tick(60000, true), .04);
    assert.equal(clock.tick(60020, true), .06);
    assert.equal(clock.tick(65000, false), .06); assert.equal(clock.tick(90000, true), .06);
    assert.equal(clock.tick(NaN, true), .06); assert.equal(clock.tick(Infinity, true), .06);
    assert.equal(clock.tick(120000, true), .06); assert.ok(Math.abs(clock.tick(120010, true) - .07) < 1e-10);
    assert.ok(Math.abs(clock.tick(130000, true) - .12) < 1e-10, 'stalled visible frames advance at most50ms');
});

test('water painting is finite, deterministic in reduced motion, and leaves main canvas state balanced', () => {
    const commands: unknown[][] = [];
    const context = new Proxy({}, { get: (_target, key) => (...args: unknown[]) => { commands.push([key, ...args]); } });
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const effect = new GuairaWaterMotion({} as CanvasImageSource, GUAIRA_WATER_CONTRACT, canvas);
    assert.equal(canvas.width, Math.max(...GUAIRA_WATER_CONTRACT.regions.map(r => r.bounds[2])));
    assert.equal(canvas.height, Math.max(...GUAIRA_WATER_CONTRACT.regions.map(r => r.bounds[3])));
    const paint = (seconds: number, reduced: boolean) => {
        commands.length = 0;
        effect.draw(context as CanvasRenderingContext2D, { x: 0, y: 0, imageWidth: 1920 }, seconds, reduced);
        return commands.map(command => [...command]);
    };
    const zero = paint(0, true); assert.deepEqual(paint(99, true), zero);
    assert.deepEqual(paint(NaN, false), paint(0, false));
    assert.notDeepEqual(paint(1, false), paint(2, false), 'enabled water actually evolves');
    assert.equal(commands.filter(c => c[0] === 'save').length, commands.filter(c => c[0] === 'restore').length);
    assert.ok(commands.flat().filter(v => typeof v === 'number').every(Number.isFinite));
    assert.throws(() => new GuairaWaterMotion({} as CanvasImageSource, GUAIRA_WATER_CONTRACT,
        { getContext: () => null } as unknown as HTMLCanvasElement), /unavailable/);
});
