import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel, type JuiceDrop, type JuiceDropImpact } from '../src/adventure/experimental/JuiceMinibossModel';
import { JuiceCombatEffects } from '../src/adventure/experimental/JuiceCombatEffects';
import { drawFluidImpact, drawFluidWallImpact, liquidChamberFlight } from '../src/adventure/experimental/JuiceFluid';
import { juicePose } from '../src/adventure/experimental/JuiceAnimation';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import { juiceEpilogueBrowser } from './helpers/juiceEpilogueHarness';

const player = { x: 70, y: 198, width: 14, height: 26 };
const step = 1000 / 60;

function recorder() {
    const calls: unknown[][] = [], properties = new Map<PropertyKey, unknown>([['globalAlpha', 1]]);
    const c = new Proxy({}, {
        get: (_, key) => properties.has(key) ? properties.get(key) : (...args: unknown[]) => calls.push([key, ...args]),
        set: (_, key, value) => { properties.set(key, value); calls.push(['set', key, value]); return true; },
    }) as CanvasRenderingContext2D;
    return { c, calls };
}

test('expiration removes projectile damage while its visible mass keeps falling to one impact', () => {
    const b = new JuiceMinibossModel(); b.phase = 'rest';
    const drop: JuiceDrop = { x: 150, y: 182, width: 8, height: 8, vx: .01, vy: -.06, life: 1 };
    b.drops = [drop]; b.update(step, player);
    assert.equal(b.drops[0], drop);
    assert.ok(drop.y < 182 && drop.life < 0);
    assert.deepEqual(b.hazards, [], 'Expired liquid cannot extend the damage window.');
    const impacts: JuiceDropImpact[] = [];
    for (let i = 0; i < 120; i++) {
        b.update(step, player);
        impacts.push(...b.events.filter((e): e is JuiceDropImpact => e.kind === 'drop-impact'));
    }
    assert.equal(b.drops.includes(drop), false);
    assert.equal(impacts.length, 1);
    assert.equal(impacts[0].side, 0); assert.equal(impacts[0].y, b.arena.floor);
    assert.equal(drop.y + drop.height, b.arena.floor, 'The head never sinks through the contact plane.');
});

for (const health of [6, 2]) for (const target of [player, { ...player, x: 0 }, { ...player, x: 306 }, { ...player, x: 153, y: 64 }]) {
    test(`every fan glob reaches a surface, including upward aim and corners: ${health}, ${target.x}/${target.y}`, () => {
        const b = new JuiceMinibossModel(); b.health = health; b.phase = 'rest'; b.cycle = health === 6 ? 1 : 0;
        for (let i = 0; !b.drops.length && i < 150; i++) b.update(step, target);
        const launched = b.drops.slice(); assert.equal(launched.length, health === 6 ? 7 : 9);
        const impacts: JuiceDropImpact[] = [];
        for (let i = 0; b.drops.some(d => launched.includes(d)) && i < 240; i++) {
            const remaining = b.drops.filter(d => launched.includes(d)).length;
            b.update(step, target);
            const contacts = b.events.filter((e): e is JuiceDropImpact => e.kind === 'drop-impact');
            assert.equal(b.drops.filter(d => launched.includes(d)).length + contacts.length, remaining,
                'Every removed glob hands its mass to a surface event, even inside a delayed render.');
            impacts.push(...contacts);
        }
        assert.equal(b.drops.some(d => launched.includes(d)), false);
        assert.equal(impacts.length, launched.length);
        for (const impact of impacts) {
            assert.ok(Number.isFinite(impact.at) && Number.isFinite(impact.vy));
            if (impact.side) assert.equal(impact.x, impact.side < 0 ? b.fluidBounds.left : b.fluidBounds.right);
            else assert.equal(impact.y, b.arena.floor);
        }
    });
}

test('one delayed frame delivers all floor impacts with their actual contact times and momentum', () => {
    const b = new JuiceMinibossModel(); b.phase = 'rest';
    b.drops = Array.from({ length: 7 }, (_, i) => ({ x: 80 + i * 15, y: 215 - i,
        width: 8, height: 8, vx: .08, vy: .2, life: 1000 }));
    b.update(100, player);
    const impacts = b.events.filter((e): e is JuiceDropImpact => e.kind === 'drop-impact');
    assert.equal(impacts.length, 7); assert.equal(b.drops.length, 0);
    assert.ok(impacts[0].at > 0 && impacts[0].at < step);
    assert.ok(impacts.every(e => e.at < b.time && e.vx === 80 && e.vy >= 200));
});

test('a harmless chamber flight lands at the first surface and never moves beyond it', () => {
    const bounds = { left: 0, right: 320, floor: 224 };
    for (const vx of [-140, 0, 140]) {
        const start = liquidChamberFlight(160, 135, vx, -80, 4, bounds, 0);
        const end = liquidChamberFlight(160, 135, vx, -80, 4, bounds, 5);
        const later = liquidChamberFlight(160, 135, vx, -80, 4, bounds, 10);
        assert.equal(start.landed, false); assert.equal(end.landed, true);
        assert.deepEqual([later.x, later.y], [end.x, end.y]);
        assert.equal(end.side, Math.sign(vx));
        if (vx) assert.equal(end.x, vx < 0 ? 4 : 316); else assert.equal(end.y, 220);
    }
});

test('a real stomp clears damage but hands airborne drops to a frozen, deterministic cosmetic flight', t => {
    let game: JuiceMinibossLab;
    t.after(() => game?.dispose());
    const h = juiceEpilogueBrowser(t);
    game = new JuiceMinibossLab(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    game.skipIntro();
    const boss = game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel; effects: JuiceCombatEffects };
    const b = boss.model;
    b.phase = 'recover';
    const drop: JuiceDrop = { x: 153, y: 100, width: 8, height: 8, vx: .025, vy: -.06, life: 400 };
    b.drops = [drop];
    const p = { ...player, x: b.x + 8, y: b.y - 16 };
    assert.equal(boss.contact(p, { ...p, y: b.y - 27 }, true), 'hit');
    assert.deepEqual(b.drops, []); assert.deepEqual(b.hazards, []);
    assert.equal(boss.effects.size, 2, 'One flight and the stomp accent survive.');
    const state = JSON.stringify(b), fx = JSON.stringify(boss.effects);
    const draw = (reduce = false) => { const r = recorder(); boss.effects.draw(r.c, b, 0, 64, reduce); return r.calls; };
    assert.deepEqual(draw(), draw());
    assert.ok(draw(true).some(c => c[0] === 'fillRect'), 'Reduced motion keeps the falling mass without detached spray.');
    assert.equal(JSON.stringify(b), state); assert.equal(JSON.stringify(boss.effects), fx);
    b.time += 1800; boss.effects.advance(b.time);
    assert.equal(boss.effects.size, 1, 'A long airborne tail survives past ordinary burst expiry.');
    assert.ok(draw().some(c => c[0] === 'fillRect'));
    b.time += 3200; boss.effects.advance(b.time); assert.equal(boss.effects.size, 0);
});

test('landing compresses after contact, rebounds and settles while keeping positive body dimensions', () => {
    const b = new JuiceMinibossModel(); b.attack = 'pounce'; b.phase = 'recover';
    const contact = juicePose(b, true);
    b.phaseTime = 70; const squash = juicePose(b, true);
    assert.ok(squash.sx > contact.sx + .2 && squash.sy < contact.sy - .3);
    for (let ms = 0; ms <= 700; ms += 10) {
        b.phaseTime = ms; const p = juicePose(b, true);
        assert.ok(p.sx > 0 && p.sy > 0 && p.sx * p.sy > .85 && p.sx * p.sy < 1.2);
    }
    b.phaseTime = 700; const settled = juicePose(b, true);
    assert.ok(Math.abs(settled.sx - 1) < .01 && Math.abs(settled.sy - 1) < .01);
});

test('floor and wall splashes retain crisp, finite, deterministic pixels through draining and settling', () => {
    for (const ms of [0, 70, 150, 300, 700, 1300, 2200]) {
        const draw = () => {
            const r = recorder();
            drawFluidWallImpact(r.c, 320, 74, 160, ms, 1, 42);
            drawFluidImpact(r.c, 160, 160, ms, 'landing', 42);
            return r.calls;
        };
        const calls = draw(); assert.deepEqual(draw(), calls);
        assert.ok(calls.every(call => call.every(n => typeof n !== 'number' || Number.isFinite(n))));
        assert.ok(calls.filter(c => c[0] === 'fillRect').every(c => c.slice(1).every(Number.isInteger)));
        assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
    }
});
