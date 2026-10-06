import assert from 'node:assert/strict';
import test from 'node:test';
import { Player } from '../src/entities/Player';
import { STAGES, stageById } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { CARGO_CARRIER_PROFILE, SERRA_CARRIER_PROFILE, carrierRoute, carrierTrolley, carrierDistance,
    carrierMotionErrors, minimumCarrierPeriod, sampleCarrierMotion } from '../src/adventure/WorldCarrierMotion';
import { editorCarrierDefaults, translateEditorMechanism } from '../src/adventure/WorldMechanismDefaults';
import { validateStage } from '../src/adventure/progress';
import { guairaAscentStage } from '../src/adventure/experimental/guaira/GuairaAscent';
import type { MechanismSpec } from '../src/adventure/types';
import type { InputState } from '../src/types';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, run: false, jump: false, down: false, start: false,
    pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const cargo = (): MechanismSpec => ({ id: 'carrier', kind: 'platform', x: 1216, y: 208, width: 64, height: 8,
    to: { x: 1472, y: 176 }, period: 7400, motion: { ...CARGO_CARRIER_PROFILE } });
const cabin = (): MechanismSpec => ({ id: 'carrier', kind: 'platform', x: 80, y: 208, width: 64, height: 8,
    to: { x: 368, y: 144 }, period: 9000, motion: { ...SERRA_CARRIER_PROFILE } });
function emptyLevel() {
    const data = structuredClone(STAGES[0].level);
    data.tiles = data.tiles.map(row => row.map(() => 0));
    return new WorldLevel(data);
}
const close = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test('fixed route, trolley and wheel distance share immutable deck geometry', () => {
    const spec = cargo(), body = { ...spec, home: { x: spec.x, y: spec.y } }, route = carrierRoute(body)!;
    assert.deepEqual(route.rail, { from: { x: 1248, y: 168 }, to: { x: 1504, y: 136 } });
    close(Math.hypot(route.tangent.x, route.tangent.y), 1);
    close(route.tangent.x * route.normal.x + route.tangent.y * route.normal.y, 0);
    for (const p of [0, .25, .5, 1, .5, 0]) {
        body.x = spec.x + (spec.to!.x - spec.x) * p; body.y = spec.y + (spec.to!.y - spec.y) * p;
        assert.deepEqual(carrierRoute(body), route, 'rail and support terminals never follow the deck');
        close(carrierDistance(body), route.length * p);
        const trolley = carrierTrolley(body);
        close((trolley.x - route.rail.from.x) * route.normal.x + (trolley.y - route.rail.from.y) * route.normal.y, 0);
    }
    assert.equal(carrierRoute({ ...spec, to: { x: spec.x, y: spec.y } }), null);
});

for (const make of [cargo, cabin]) test(`${make.name}: every dock is reached and held, reversal stops, speed is bounded`, () => {
    const spec = make(), period = spec.period!, profile = spec.motion!, original = structuredClone(spec);
    assert.deepEqual(carrierMotionErrors(spec), []);
    assert.ok(period >= minimumCarrierPeriod(carrierRoute(spec)!.length, profile));
    for (let t = 0; t < profile.dwellMs; t += 10) {
        const home = sampleCarrierMotion(spec, t)!, end = sampleCarrierMotion(spec, period / 2 + t)!;
        assert.deepEqual(home.position, { x: spec.x, y: spec.y }); assert.equal(home.velocity, 0);
        assert.deepEqual(end.position, spec.to); assert.equal(end.velocity, 0);
    }
    let before = sampleCarrierMotion(spec, 0)!;
    for (let t = 1; t <= period * 3; t++) {
        const now = sampleCarrierMotion(spec, t)!;
        assert.ok(now.progress >= 0 && now.progress <= 1);
        assert.ok(Math.abs(now.velocity) <= profile.maxSpeed + 1e-7);
        assert.ok(Math.hypot(now.position.x - before.position.x, now.position.y - before.position.y) <= profile.maxSpeed / 1000 + 1e-7);
        const route = carrierRoute(spec)!;
        close((now.position.x - spec.x) * route.normal.x + (now.position.y - spec.y) * route.normal.y, 0);
        before = now;
    }
    for (const t of [0, profile.dwellMs, period / 2, period / 2 + profile.dwellMs, period]) {
        close(sampleCarrierMotion(spec, t)!.velocity, 0);
        close(sampleCarrierMotion(spec, t - .001)!.velocity, 0, 1e-8);
        close(sampleCarrierMotion(spec, t + .001)!.velocity, 0, 1e-8);
    }
    assert.deepEqual(spec, original, 'sampling cannot modify level authoring');
});

test('native WorldObjects carries a passenger through three complete inclined routes with no drift', () => {
    const spec = cabin(), objects = new WorldObjects([spec]), level = emptyLevel(), body = objects.get(spec.id)!;
    level.bodies = objects.bodies;
    const player = new Player((body.x + 25) / 16, body.y / 16); player.data.isGrounded = true;
    for (let frame = 0; frame < Math.ceil(spec.period! * 3 / DT); frame++) {
        const before = player.getRect(); objects.update(DT, level, before.x);
        assert.ok(Math.hypot(body.x - body.px, body.y - body.py) <= spec.motion!.maxSpeed * DT / 1000 + 1e-7);
        player.data.position = level.transport(before); player.update(DT, idle, level);
        close(player.data.position.x, body.x + 25); close(player.data.position.y + player.data.height, body.y);
        assert.equal(player.data.isGrounded, true); assert.equal(player.data.isDead, false);
    }
});

for (const departure of [2000, 4650, 6900]) test(`jump at ${departure} ms detaches once during outbound, dock or return`, () => {
    const spec = cabin(), objects = new WorldObjects([spec]), level = emptyLevel(), body = objects.get(spec.id)!;
    level.bodies = objects.bodies;
    const player = new Player((body.x + 25) / 16, body.y / 16); player.data.isGrounded = true;
    while (objects.time < departure) {
        const before = player.getRect(); objects.update(DT, level, before.x);
        if (player.data.isGrounded) player.data.position = level.transport(before);
        player.update(DT, idle, level);
    }
    const before = player.getRect(); objects.update(DT, level, before.x); player.data.position = level.transport(before);
    player.update(DT, { ...idle, jump: true, jumpPressed: true }, level);
    assert.equal(player.data.isGrounded, false); assert.ok(player.data.velocity.y < 0);
    const takeoffX = player.data.position.x;
    for (let frame = 0; frame < 10; frame++) {
        objects.update(DT, level, player.data.position.x);
        player.update(DT, { ...idle, jump: true }, level);
        assert.equal(player.data.position.x, takeoffX, 'airborne passenger never receives a second carry');
    }
});

test('phased shuttles initialize px/py in the actual pose and reset without first-frame teleport', () => {
    const spec = { ...cargo(), phase: 2200 }, snapshot = structuredClone(spec), level = emptyLevel();
    const first = new WorldObjects([spec]), body = first.bodies[0], expected = sampleCarrierMotion({ ...spec, home: { x: spec.x, y: spec.y } }, 0)!;
    assert.deepEqual({ x: body.x, y: body.y }, expected.position);
    assert.equal(body.px, body.x); assert.equal(body.py, body.y);
    first.update(DT, level, body.x);
    assert.ok(Math.hypot(body.x - body.px, body.y - body.py) < 1.5);
    for (let i = 0; i < 500; i++) first.update(DT, level, body.x);
    const rebuilt = new WorldObjects([spec]);
    assert.deepEqual({ x: rebuilt.bodies[0].x, y: rebuilt.bodies[0].y }, expected.position);
    assert.deepEqual(rebuilt.bodies[0].home, { x: spec.x, y: spec.y }); assert.deepEqual(spec, snapshot);
});

test('all three real Guaíra autonomous routes retain exact legacy poses, deltas and reset state', () => {
    const stage = guairaAscentStage(), originals = structuredClone(stage.mechanisms), objects = new WorldObjects(stage.mechanisms), level = new WorldLevel(stage.level);
    const legacy = stage.mechanisms.map(spec => ({ x: spec.x, y: spec.y, px: spec.x, py: spec.y }));
    let time = 0;
    for (let frame = 0; frame < 1800; frame++) {
        time += DT; objects.update(DT, level, 0);
        for (let i = 0; i < stage.mechanisms.length; i++) {
            const spec = stage.mechanisms[i], expected = legacy[i], body = objects.bodies[i];
            expected.px = expected.x; expected.py = expected.y;
            const p = (1 - Math.cos(time / (spec.period ?? 5000) * Math.PI * 2)) / 2;
            const x = spec.x + (spec.to!.x - spec.x) * p, y = spec.y + (spec.to!.y - spec.y) * p, max = DT * .055;
            expected.x += Math.max(-max, Math.min(max, x - expected.x)); expected.y += Math.max(-max, Math.min(max, y - expected.y));
            assert.deepEqual({ x: body.x, y: body.y, px: body.px, py: body.py }, expected, `${spec.id}: frame ${frame}`);
        }
    }
    const restarted = new WorldObjects(stage.mechanisms), fresh = new WorldObjects(originals);
    assert.deepEqual(restarted.bodies, fresh.bodies); assert.deepEqual(stage.mechanisms, originals);
});

test('all fourteen campaign hoists and three supports retain exact controlled 55px/s trajectories', () => {
    let checked = 0;
    for (const stage of STAGES) for (const spec of stage.mechanisms.filter(m => m.to && ['lift', 'support'].includes(m.kind))) {
        const objects = new WorldObjects(stage.mechanisms), level = new WorldLevel(stage.level), body = objects.get(spec.id)!;
        let x = spec.x, y = spec.y;
        for (let frame = 0; frame < 500; frame++) {
            body.active = frame < 220;
            const oldX = x, oldY = y, target = body.active ? spec.to! : spec, max = DT * .055;
            x += Math.max(-max, Math.min(max, target.x - x)); y += Math.max(-max, Math.min(max, target.y - y));
            objects.update(DT, level, 0);
            assert.deepEqual([body.x, body.y, body.px, body.py], [x, y, oldX, oldY], `${stage.id}:${spec.id}:${frame}`);
        }
        checked++;
    }
    assert.equal(checked, 17);
});

test('legacy diagonal imports and unused swing alias use one line, without inventing a pendulum', () => {
    const base = cargo(); delete base.motion; base.period = 5400;
    for (const kind of ['platform', 'swing'] as const) {
        const spec = { ...base, kind }, objects = new WorldObjects([spec]), level = emptyLevel();
        for (let frame = 0; frame < 324; frame++) {
            objects.update(DT, level, 0); const b = objects.bodies[0], p = (1 - Math.cos(objects.time / 5400 * Math.PI * 2)) / 2;
            assert.equal(b.x, spec.x + (spec.to!.x - spec.x) * p); assert.equal(b.y, spec.y + (spec.to!.y - spec.y) * p);
        }
        assert.ok(carrierMotionErrors(spec).some(e => e.includes('legado rápido demais')), 'editor surfaces the intentional legacy peak-speed change');
    }
});

test('new editor carriers choose compatible equipment and invalid imports receive actionable errors', () => {
    assert.deepEqual(editorCarrierDefaults('lift', 64, 128, 2), { to: { x: 64, y: 96 }, period: 4000 });
    assert.deepEqual(editorCarrierDefaults('support', 64, 128, 2), { to: { x: 64, y: 160 } });
    for (const world of [2, 4]) {
        const spec = { ...cargo(), x: 64, y: 128, ...editorCarrierDefaults('platform', 64, 128, world) };
        assert.deepEqual(carrierMotionErrors(spec), []); assert.equal(spec.motion!.maxSpeed, world === 4 ? 80 : 90);
    }
    const stage = structuredClone(stageById('1-1')!);
    const invalid = { ...cargo(), period: 2000 }; stage.mechanisms = [invalid];
    assert.ok(validateStage(stage).some(e => e.includes('Período insuficiente') && e.includes('7334')));
    assert.equal(sampleCarrierMotion(invalid, 2500), null, 'runtime does not silently stretch an invalid authored cycle');
    stage.mechanisms = [{ ...cargo(), kind: 'lift', gated: true }];
    assert.ok(validateStage(stage).some(e => e.includes('Guia vertical')));
    stage.mechanisms = [{ ...cargo(), to: { x: Infinity, y: 12 } }];
    assert.ok(validateStage(stage).some(e => e.includes('coordenadas finitas')));
    stage.mechanisms = [{ ...cargo(), mounts: [{ x: 0, y: NaN, kind: 'ground' }, { x: 1, y: 2, kind: 'wall' }] }];
    assert.ok(validateStage(stage).some(e => e.includes('dois pontos fixos')));
});

test('editor translation moves full equipment while nontransport fields retain their old behavior', () => {
    const originalLift: MechanismSpec = { id: 'lift', kind: 'lift', x: 64, y: 160, width: 64, height: 8,
        to: { x: 64, y: 80 }, mounts: [{ x: 52, y: 224, kind: 'ground' }, { x: 140, y: 224, kind: 'wall' }] };
    const snapshot = structuredClone(originalLift), lift = translateEditorMechanism(originalLift, 96, 176);
    assert.deepEqual(originalLift, snapshot, 'translation cannot mutate shared authoring or a reset template');
    assert.notEqual(lift.to, originalLift.to); assert.notEqual(lift.mounts, originalLift.mounts);
    for (const index of [0, 1]) assert.notEqual(lift.mounts![index], originalLift.mounts![index]);
    assert.deepEqual(lift.to, { x: 96, y: 96 });
    assert.deepEqual(lift.mounts, [{ x: 84, y: 240, kind: 'ground' }, { x: 172, y: 240, kind: 'wall' }]);
    Object.assign(lift, translateEditorMechanism(lift, 112, 176)); Object.assign(lift, translateEditorMechanism(lift, 112, 160));
    assert.equal(lift.to!.x, lift.x); assert.equal(lift.to!.y - lift.y, -80);
    assert.equal(lift.mounts![0].x - lift.x, -12); assert.equal(lift.mounts![0].y - lift.y, 64);
    const jet: MechanismSpec = { id: 'jet', kind: 'jet', x: 32, y: 96, width: 12, height: 48,
        to: { x: 32, y: 0 }, phase: 800, direction: -1 };
    const original = structuredClone(jet), movedJet = translateEditorMechanism(jet, 48, 112);
    assert.deepEqual(movedJet, { ...original, x: 48, y: 112 }); assert.deepEqual(jet, original);
});

test('translated or imported mounts require real full-width feet and wall plates at the new position', () => {
    const stage = structuredClone(stageById('1-1')!);
    stage.level.tiles = stage.level.tiles.map((row, y) => row.map(() => y >= 10 ? 1 : 0));
    const spec: MechanismSpec = { ...cargo(), x: 64, y: 96, to: { x: 128, y: 96 }, period: 4000,
        mounts: [{ x: 80, y: 160, kind: 'ground' }, { x: 160, y: 176, kind: 'wall' }] };
    stage.mechanisms = [spec]; assert.deepEqual(validateStage(stage), []);
    Object.assign(spec, translateEditorMechanism(spec, 80, 96));
    assert.deepEqual(validateStage(stage), [], 'a supported horizontal drag remains playable');
    Object.assign(spec, translateEditorMechanism(spec, 80, 80));
    assert.ok(validateStage(stage).some(e => e.includes('Apoio 1 sem base sólida')));
    Object.assign(spec, translateEditorMechanism(spec, 64, 96)); assert.deepEqual(validateStage(stage), []);
    spec.mounts![0].x = 3;
    assert.ok(validateStage(stage).some(e => e.includes('Apoio 1 sem base sólida')), 'a foot partly outside the bank is not grounded');
    spec.mounts![1].y = 162;
    assert.ok(validateStage(stage).some(e => e.includes('Apoio 2 sem base sólida')), 'every wall-plate corner must contact solid terrain');
});
