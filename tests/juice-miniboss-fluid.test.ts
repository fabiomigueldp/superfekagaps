import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel, type JuiceGeyser } from '../src/adventure/experimental/JuiceMinibossModel';
import { geyserHeight, liquidFlight, drawFluidGeyser, drawFluidImpact } from '../src/adventure/experimental/JuiceFluid';
import { pixelateJuice } from '../src/adventure/experimental/JuicePixelSurface';
import { overlaps } from '../src/adventure/types';
import { JuiceCombatEffects } from '../src/adventure/experimental/JuiceCombatEffects';

const vent = (): JuiceGeyser => ({ x: 37, y: 160, width: 22, height: 64, phase: 'active', phaseTime: 0, progress: 0 });

test('a rising geyser cannot hurt above its front; the core remains dangerous until shutoff', () => {
    const b = new JuiceMinibossModel(); b.phase = 'attack'; b.attack = 'pounce';
    const g = vent(); b.geysers = [g];
    assert.equal(b.hazards.length, 0);
    let previous = 0;
    for (let ms = 16; ms <= 512; ms += 16) {
        g.phaseTime = ms;
        const height = Math.round(geyserHeight(g));
        assert.ok(height >= previous && height <= 64); previous = height;
        assert.ok(b.hazards.some(r => overlaps(r, { x: 47, y: 218, width: 2, height: 3 })));
        assert.ok(b.hazards.every(r => !overlaps(r, { x: 16, y: 150, width: 288, height: 224 - height - 150 })));
        assert.ok(b.hazards.every(r => r.y >= 224 - height && r.y + r.height <= 224));
    }
    g.phase = 'recede'; g.phaseTime = 0; g.releaseTime = 512;
    assert.equal(geyserHeight(g), 64); assert.equal(b.hazards.length, 0);
    g.phaseTime = 150; const halfway = geyserHeight(g);
    g.phaseTime = 300; assert.ok(geyserHeight(g) < halfway); assert.equal(geyserHeight(g), 0);
});

test('fluid follows a ballistic arc, lands once and never teleports or falls through the floor', () => {
    const args = [48, 164, 32, -58, 620, 224] as const;
    const start = liquidFlight(...args, 0), apex = liquidFlight(...args, 58 / 620);
    assert.deepEqual([start.x, start.y, start.vy], [48, 164, -58]);
    assert.ok(Math.abs(apex.vy) < 1e-9 && apex.y < start.y);
    const landed = liquidFlight(...args, 1), later = liquidFlight(...args, 2);
    assert.equal(landed.landed, true); assert.equal(landed.y, 224);
    assert.equal(later.x, landed.x); assert.equal(later.y, landed.y);
    assert.ok(later.sinceHit > landed.sinceHit);
});

test('a projectile impacts as its bottom touches the floor instead of sinking through it', () => {
    const b = new JuiceMinibossModel(); b.phase = 'rest';
    b.drops = [{ x: 100, y: 215, width: 8, height: 8, vx: 0, vy: .10, life: 1000 }];
    b.update(5, { x: 30, y: 198, width: 14, height: 26 }); assert.equal(b.drops.length, 1);
    b.update(6, { x: 30, y: 198, width: 14, height: 26 }); assert.equal(b.drops.length, 0);
});

test('a stomp clears geyser collision while its cosmetic tail keeps the previous falling age', () => {
    const b = new JuiceMinibossModel(); b.phase = 'recover';
    const g = { ...vent(), phase: 'recede' as const, phaseTime: 80, releaseTime: 520 };
    b.geysers = [g]; const old = b.geysers, fx = new JuiceCombatEffects();
    const player = { x: b.x + 8, y: b.y - 16, width: 14, height: 26 };
    assert.equal(b.contact(player, { ...player, y: b.y - 27 }, true), 'hit');
    fx.releaseGeysers(old, b.time);
    assert.equal(b.geysers.length, 0); assert.equal(b.hazards.length, 0);
    assert.equal(fx.size, 1); assert.equal(g.phaseTime, 80, 'The model snapshot stays untouched.');
    fx.advance(b.time + 379); assert.equal(fx.size, 1);
    fx.advance(b.time + 380); assert.equal(fx.size, 0, 'The old 80ms are retained, not restarted.');
});

test('the pixel material has opaque clusters, clean cutouts and deterministic palette colors', () => {
    const source = new Uint8ClampedArray([150, 38, 185, 255, 174, 52, 205, 190, 200, 80, 230, 80, 255, 240, 255, 255]);
    const a = source.slice(), b = source.slice(); pixelateJuice(a); pixelateJuice(b);
    assert.deepEqual(a, b);
    assert.deepEqual([a[3], a[7], a[11], a[15]], [255, 255, 0, 255]);
    assert.deepEqual([...a.slice(12, 16)], [255, 240, 255, 255]);
    const again = a.slice(); pixelateJuice(again); assert.deepEqual(again, a);
});

test('liquid renderers draw integer pixel spans without advancing their clocks or retaining particles', () => {
    const g = vent();
    const render = (reduced: boolean) => {
        const calls: unknown[][] = [], properties = new Map<PropertyKey, unknown>([['globalAlpha', 1]]);
        const c = new Proxy({}, { get: (_o, key) => properties.has(key) ? properties.get(key) : (...args: unknown[]) => calls.push([key, ...args]),
            set: (_o, key, value) => { properties.set(key, value); calls.push(['set', key, value]); return true; } }) as CanvasRenderingContext2D;
        drawFluidGeyser(c, g, 0, 64, reduced);
        drawFluidImpact(c, 160, 160, 130, 'landing', 42);
        return calls;
    };
    for (const phase of ['active', 'recede'] as const) for (const ms of [0, 40, 160, 300, 450]) {
        Object.assign(g, { phase, phaseTime: ms, releaseTime: 520 });
        const state = JSON.stringify(g), calls = render(false);
        assert.deepEqual(render(false), calls); assert.equal(JSON.stringify(g), state);
        assert.ok(calls.every(call => call.every(n => typeof n !== 'number' || Number.isFinite(n))));
        assert.ok(calls.filter(call => call[0] === 'fillRect').every(call => call.slice(1).every(Number.isInteger)));
        assert.equal(calls.filter(call => call[0] === 'save').length, calls.filter(call => call[0] === 'restore').length);
    }
    g.phase = 'active'; g.phaseTime = 220;
    assert.ok(render(true).length < render(false).length, 'Reduced motion removes the detached spray; the moving danger boundary remains visible.');
});
