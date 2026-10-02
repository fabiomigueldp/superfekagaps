import assert from 'node:assert/strict';
import test from 'node:test';
import { BULL_RULES as R, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { GuairaBullEncounter } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { bullChargeWarningRange } from '../src/adventure/experimental/guaira/GuairaLabArt';
import { guairaBrowser } from './helpers/guairaLabHarness';
import recording from './helpers/guairaLabReplay.json';

const player = (x: number) => ({ x, y: 200, width: 14, height: 24 });

for (const side of ['left', 'right'] as const) test(`${side} corner selects an inward charge before its full tell and preserves the painted envelope`, () => {
    for (const runway of [0, 8, 47, 48]) {
        const b = new SkeletonBullModel();
        const left = b.arena.left + 12, right = b.arena.right - b.width - 12;
        b.x = side === 'left' ? left + runway : right - runway;
        b.state = 'idle'; b.stateTick = 23;
        const p = player(side === 'left' ? 0 : 306);
        b.update(R.tickMs, p);
        const outward = side === 'left' ? -1 : 1;
        const direction = runway < b.width ? -outward : outward;
        assert.equal(b.facing, direction); assert.equal(b.state, 'tell'); assert.equal(b.stateTick, 0);
        const range = bullChargeWarningRange(b), start = b.x;
        // Crossing sides after the warning begins must never retarget the attack.
        for (let i = 1; i < R.tell; i++) {
            b.update(R.tickMs, player(side === 'left' ? 306 : 0));
            assert.equal(b.state, 'tell'); assert.equal(b.facing, direction); assert.equal(b.x, start);
            assert.deepEqual(b.hazards, []);
        }
        b.update(R.tickMs, p); assert.equal(b.state, 'charge');
        const chargeTick = b.tick;
        do {
            b.update(R.tickMs, p);
            assert.equal(b.facing, direction);
            assert.ok(b.x >= range.left && b.x + b.width <= range.right);
            for (const hazard of b.hazards)
                assert.ok(hazard.x >= range.left && hazard.x + hazard.width <= range.right);
        } while (b.state === 'charge');
        assert.equal(b.state, 'brake');
        assert.ok(Math.abs(b.x - start) >= b.width, 'every selected charge has at least one body length of runway');
        assert.equal(b.tick - chargeTick, Math.ceil(Math.abs(b.x - start) / R.speed));
        for (let i = 0; i < R.brake + R.recover; i++) {
            assert.equal(b.vulnerable, true, 'the full 72-tick punish window is retained');
            b.update(R.tickMs, p);
        }
        assert.equal(b.state, 'idle');
    }
});

test('low bones keep targeting Feka at either corner instead of inheriting charge runway rules', () => {
    for (const side of ['left', 'right'] as const) {
        const b = new SkeletonBullModel(); b.x = side === 'left' ? 16 : 256;
        b.state = 'idle'; b.stateTick = 23; b.cycle = 2;
        const p = player(side === 'left' ? 0 : 306), outward = side === 'left' ? -1 : 1;
        b.update(R.tickMs, p); assert.equal(b.state, 'rattle'); assert.equal(b.facing, outward);
        for (let i = 0; i < R.rattle; i++) b.update(R.tickMs, p);
        assert.equal(b.state, 'bones'); assert.equal(b.bones.length, 2);
        assert.ok(b.bones.every(bone => bone.vx === outward * 3));
    }
});

test('both bones reach the announced edge and recovery starts only when the trailing bone leaves', () => {
    for (const [x, facing, duration] of [[16, -1, 20], [16, 1, 96], [256, -1, 100], [256, 1, 16]] as const) {
        const b = new SkeletonBullModel(); b.x = x; b.state = 'idle'; b.stateTick = 23; b.cycle = 2;
        const p = player(facing < 0 ? 0 : 306);
        b.update(R.tickMs, p); assert.equal(b.state, 'rattle'); assert.equal(b.facing, facing);
        for (let i = 1; i <= R.rattle; i++) {
            // The player crossing the arena during the tell does not change its locked direction or flight.
            b.update(R.tickMs, player(facing < 0 ? 306 : 0));
            assert.equal(b.facing, facing);
            if (i < R.rattle) { assert.equal(b.state, 'rattle'); assert.deepEqual(b.hazards, []); }
        }
        assert.equal(b.state, 'bones'); assert.equal(b.bones.length, 2);
        assert.ok(b.bones.every(bone => bone.life === duration));
        let reachedEdge = false;
        for (let tick = 1; tick <= duration; tick++) {
            b.update(R.tickMs, p);
            reachedEdge ||= b.touches(p);
            assert.ok(b.bones.length <= R.maxBones);
            if (tick < duration) assert.equal(b.state, 'bones', 'the trailing projectile retains its full passage');
        }
        assert.equal(reachedEdge, true); assert.equal(b.state, 'recover');
        assert.deepEqual(b.bones, []); assert.deepEqual(b.hazards, []);
        for (let tick = 0; tick < R.recover; tick++) {
            assert.equal(b.vulnerable, true); assert.equal(b.touches(p), false); b.update(R.tickMs, p);
        }
        assert.equal(b.state, 'idle');
    }
});

function controls(h: ReturnType<typeof guairaBrowser>, touch = false) {
    let held = new Set<string>();
    return (codes: string[]) => {
        if (touch) {
            const x: Record<string, number> = { ArrowLeft: .07, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .76, Space: .93 };
            h.canvas.dispatch('touchstart', { touches: codes.map(code => ({ identifier: Object.keys(x).indexOf(code) + 1,
                clientX: x[code] * 640, clientY: 330, target: h.canvas })) });
            return;
        }
        const next = new Set(codes);
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = next;
    };
}

/** Ordinary entrance, then an unchanging 24-on/24-off jump loop with no horizontal input. */
function stationaryPolicy(frame: number) {
    return [...(frame < 100 ? ['ArrowRight'] : []),
        ...((frame < 100 ? frame >= 76 && frame < 96 : (frame - 100 + 24) % 48 < 24) ? ['Space'] : [])];
}

for (const side of ['left', 'right'] as const) test(`native jump can evade the full-range volley at the ${side} edge`, t => {
    const h = guairaBrowser(t), g = h.create(), keys = controls(h), b = (g.boss as GuairaBullEncounter).model;
    // Seed the two opposing positions; all movement and collision from here use the real Player.
    b.x = side === 'left' ? 256 : 16; b.state = 'idle'; b.stateTick = 23; b.cycle = 2;
    g.player.data.position.x = side === 'left' ? 0 : 306;
    let recoveryFrame = 0;
    for (let frame = 0; frame < 160; frame++) {
        keys(frame >= 120 && frame < 129 ? ['Space'] : []); g.update(R.tickMs);
        assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
        if (frame < R.rattle) { assert.equal(b.state, 'rattle'); assert.deepEqual(b.hazards, []); }
        if (b.vulnerable) { recoveryFrame = frame; break; }
    }
    assert.equal(recoveryFrame, side === 'left' ? 148 : 144);
    assert.deepEqual(b.hazards, []); assert.equal(b.vulnerable, true);
    keys([]);
    for (let tick = 0; tick < R.recover; tick++) {
        g.update(R.tickMs); assert.equal(g.player.data.hasHelmet, true); assert.deepEqual(b.hazards, []);
    }
});

test('the former stationary jump-loop win no longer receives free wall-charge openings', t => {
    const h = guairaBrowser(t), g = h.create(), keys = controls(h), b = (g.boss as GuairaBullEncounter).model;
    const hits: number[] = [], charges: number[] = []; let chargeStart = 0, lastFrame = 0;
    for (let frame = 0; frame < 1900; frame++) {
        keys(stationaryPolicy(frame)); const health = b.health; g.update(R.tickMs); lastFrame = frame;
        if (b.health < health) hits.push(frame);
        for (const e of b.events) {
            if (e.kind === 'charge') chargeStart = e.tick;
            if (e.kind === 'brake') charges.push(e.tick - chargeStart);
        }
        if (g.player.data.isDead || b.health === 0) break;
    }
    // Before the fix this exact input won at 1123 with three zero-distance,
    // one-tick charges. It now fails without reading or responding to the tells.
    assert.deepEqual(hits, [382, 527, 882, 1006, 1362]); assert.deepEqual(charges, [47, 48, 48, 48, 48, 48]);
    assert.equal(lastFrame, 1397); assert.equal(b.health, 1); assert.equal(g.player.data.isDead, true);
});

for (const touch of [false, true]) test(`${touch ? 'touch' : 'keyboard'} can follow the newly inward tell and punish it safely after pause`, t => {
    const h = guairaBrowser(t, { touch, reducedMotion: touch }), g = h.create(), keys = controls(h, touch);
    const b = (g.boss as GuairaBullEncounter).model;
    for (let frame = 0; frame < 587; frame++) { keys(stationaryPolicy(frame)); g.update(R.tickMs); }
    assert.equal(b.state, 'tell'); assert.equal(b.facing, -1); assert.equal(b.health, 4);
    assert.equal(g.player.data.hasHelmet, true);
    g.toggleLabPause(); const paused = structuredClone({ boss: b, player: g.player.data });
    for (let frame = 0; frame < 100; frame++) g.update(R.tickMs);
    assert.deepEqual(structuredClone({ boss: b, player: g.player.data }), paused); g.toggleLabPause();
    let hitFrame = 0;
    for (let frame = 0; frame < 130; frame++) {
        keys([...(frame < 64 ? ['ArrowLeft', 'ShiftLeft'] : []), ...(frame >= 54 && frame < 62 ? ['Space'] : [])]);
        g.update(R.tickMs);
        assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
        if (b.health < 4) { hitFrame = frame + 587; break; }
    }
    assert.equal(hitFrame, 695); assert.equal(b.health, 3); assert.equal(b.x, 16);
    keys([]); g.load('guaira-lab');
    assert.equal((g.boss as GuairaBullEncounter).model.health, 6);
    assert.equal((g.boss as GuairaBullEncounter).model.state, 'intro');
    assert.equal(g.player.data.hasHelmet, true);
});

for (const reducedMotion of [false, true]) test(`the updated complete winning route also works through native touch (reduced motion ${reducedMotion})`, t => {
    const h = guairaBrowser(t, { touch: true, reducedMotion }), g = h.create(), keys = controls(h, true);
    const b = (g.boss as GuairaBullEncounter).model, hits: Array<{ frame: number; health: number }> = []; let frame = 0;
    for (const [count, codes] of recording.runs as Array<[number, string[]]>) {
        keys(codes);
        for (let i = 0; i < count; i++, frame++) {
            const health = b.health; g.update(recording.stepMs);
            if (b.health < health) hits.push({ frame, health: b.health });
            assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
        }
    }
    assert.equal(frame, recording.frames); assert.deepEqual(hits, recording.expectedHits);
    assert.equal(b.state, 'defeated'); assert.deepEqual(g.store.save.completed, []);
});
