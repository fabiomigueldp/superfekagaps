import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/adventure/campaign';
import { finishStage, freshSave, isUnlocked } from '../src/adventure/progress';
import { buildTravelPath, clampMapSelection, easeMapMotion, getMapCamera, mapStageState, mapToScreen,
    moveMapSelection, sampleCubic, samplePath, screenToMap, stableMapDelta, stageIndexForWorld } from '../src/adventure/WorldMapModel';
import type { MapPoint } from '../src/adventure/WorldMapModel';

test('map navigation clamps invalid values and preserves all 30 campaign selections', () => {
    for (const [input, expected] of [[-1, 0], [30, 29], [4.9, 4], [NaN, 0], [Infinity, 29], [-Infinity, 0]])
        assert.equal(clampMapSelection(input), expected);
    for (let index = 0; index < 30; index++) assert.equal(clampMapSelection(index), index);
    for (const key of ['ArrowRight', 'd', 'D']) assert.equal(moveMapSelection(4, key), 5);
    for (const key of ['ArrowLeft', 'a', 'A']) assert.equal(moveMapSelection(5, key), 4);
    for (const key of ['ArrowDown', 's', 'S']) assert.equal(moveMapSelection(4, key), 9);
    for (const key of ['ArrowUp', 'w', 'W']) assert.equal(moveMapSelection(9, key), 4);
    assert.equal(moveMapSelection(0, 'ArrowUp'), 0);
    assert.equal(moveMapSelection(29, 'ArrowDown'), 29);
    assert.equal(moveMapSelection(12, 'Enter'), 12);
    assert.equal(moveMapSelection(12, '__proto__'), 12);
    assert.equal(moveMapSelection(NaN, 'ArrowRight'), 1);
});

test('world navigation uses one-based worlds and retains only that world’s remembered stage', () => {
    for (let world = 1; world <= 6; world++) {
        assert.equal(stageIndexForWorld(world), (world - 1) * 5);
        assert.equal(stageIndexForWorld(world, world * 5 - 1), world * 5 - 1);
        assert.equal(stageIndexForWorld(world, world * 5), (world - 1) * 5);
    }
    assert.equal(stageIndexForWorld(NaN), 0);
    assert.equal(stageIndexForWorld(100), 25);
    assert.equal(stageIndexForWorld(6, Infinity), 25);
});

test('map state delegates progression and counts exactly the existing 72 unique seals', () => {
    const save = freshSave();
    assert.equal(STAGES.length, 30);
    for (const stage of STAGES) {
        assert.equal(mapStageState(stage.id, save).unlocked, isUnlocked(stage.id, save));
        assert.equal(mapStageState(stage.id, save).completed, false);
        finishStage(save, stage.id, 'normal', 30);
        save.seals.push(...stage.pickups.filter(pickup => pickup.kind === 'seal').map(pickup => pickup.id));
        assert.equal(mapStageState(stage.id, save).completed, true);
    }
    assert.equal(STAGES.reduce((sum, stage) => sum + mapStageState(stage.id, save).seals, 0), 72);
    save.seals.push('1-1:s1', '1-1:s99', '1-5:s1');
    assert.equal(mapStageState('1-1', save).seals, 3);
    assert.equal(mapStageState('1-5', save).seals, 0);
    assert.deepEqual(mapStageState('7-1', save), { unlocked: false, completed: false, seals: 0, secret: false });
});

test('secret exit opens the boss while retaining the skipped normal stage and next-island gate', () => {
    const save = freshSave();
    finishStage(save, '1-1', 'normal', 10);
    finishStage(save, '1-2', 'normal', 10);
    assert.equal(mapStageState('1-5', save).unlocked, false);
    finishStage(save, '1-3', 'secret', 10);
    assert.equal(mapStageState('1-3', save).secret, true);
    assert.equal(mapStageState('1-4', save).unlocked, true);
    assert.equal(mapStageState('1-4', save).completed, false);
    assert.equal(mapStageState('1-5', save).unlocked, true);
    assert.equal(mapStageState('2-1', save).unlocked, false);
    finishStage(save, '1-5', 'normal', 10);
    assert.equal(mapStageState('2-1', save).unlocked, true);
});

const nodes: Record<number, MapPoint> = { 0: { x: .1, y: .6 }, 1: { x: .3, y: .4 },
    2: { x: .5, y: .5 }, 3: { x: .7, y: .3 }, 4: { x: .9, y: .5 }, 5: { x: .2, y: .8 } };
const routes: Record<string, MapPoint[]> = {
    '0:1': [nodes[0], { x: .15, y: .45 }, nodes[1]],
    '1:2': [nodes[1], { x: .4, y: .35 }, nodes[2]],
    '2:3': [nodes[2], { x: .55, y: .3 }, nodes[3]],
    '3:4': [nodes[3], { x: .8, y: .35 }, nodes[4]],
};
const secret = [nodes[2], { x: .6, y: .7 }, { x: .8, y: .7 }, nodes[4]];

test('travel follows each authored adjacent route in either direction without mutating geometry', () => {
    const snapshot = JSON.stringify({ nodes, routes });
    const expected = [...routes['0:1'], ...routes['1:2'].slice(1), ...routes['2:3'].slice(1), ...routes['3:4'].slice(1)];
    assert.deepEqual(buildTravelPath(0, 4, nodes, routes), expected);
    assert.deepEqual(buildTravelPath(4, 0, nodes, routes), [...expected].reverse());
    assert.deepEqual(buildTravelPath(0, 1, nodes, { '1:0': [...routes['0:1']].reverse() }), routes['0:1']);
    const result = buildTravelPath(0, 4, nodes, routes);
    result[0].x = -999;
    assert.equal(JSON.stringify({ nodes, routes }), snapshot);
});

test('secret travel is opt-in, reversible, and joins the stage-three entrance route', () => {
    const normal = [...routes['2:3'], ...routes['3:4'].slice(1)];
    assert.deepEqual(buildTravelPath(2, 4, nodes, routes, false, secret), normal);
    assert.deepEqual(buildTravelPath(2, 4, nodes, routes, true), normal);
    assert.deepEqual(buildTravelPath(2, 4, nodes, routes, true, secret), secret);
    assert.deepEqual(buildTravelPath(4, 2, nodes, routes, true, secret), [...secret].reverse());
    assert.deepEqual(buildTravelPath(1, 4, nodes, routes, true, secret), [...routes['1:2'], ...secret.slice(1)]);
});

test('island changes and missing authored links relocate rather than inventing a path over the sea', () => {
    assert.deepEqual(buildTravelPath(4, 5, nodes, routes, true, secret), [nodes[5]]);
    assert.deepEqual(buildTravelPath(5, 4, nodes, routes), [nodes[4]]);
    assert.deepEqual(buildTravelPath(0, 4, nodes), [nodes[4]]);
    assert.deepEqual(buildTravelPath(1, 1, nodes, routes), [nodes[1]]);
    assert.deepEqual(buildTravelPath(0, 29, nodes, routes), []);
});

test('camera transform preserves the authored 8:5 aspect and is invertible at every viewport size', () => {
    for (const [width, height] of [[1920, 1200], [390, 844], [1200, 400], [0, -1], [NaN, Infinity]]) {
        for (const overview of [false, true]) {
            const camera = getMapCamera(2, { overview }, width, height);
            assert.ok(camera.width >= 1 && camera.width <= 16384);
            assert.ok(camera.height >= 1 && camera.height <= 16384);
            for (const point of [nodes[0], nodes[4], camera.center]) {
                const screen = mapToScreen(point, camera), roundtrip = screenToMap(screen, camera);
                assert.ok(Number.isFinite(screen.x) && Number.isFinite(screen.y));
                assert.ok(Math.abs(point.x - roundtrip.x) < 1e-10);
                assert.ok(Math.abs(point.y - roundtrip.y) < 1e-10);
            }
        }
    }
    const camera = getMapCamera(0, { overview: false }, 1000, 1000);
    const origin = mapToScreen({ x: 0, y: 0 }, camera), corner = mapToScreen({ x: 1, y: 1 }, camera);
    assert.ok(Math.abs((corner.x - origin.x) / (corner.y - origin.y) - 1.6) < 1e-10);
    assert.ok(getMapCamera(0, { overview: true }, 1000, 600).zoom < camera.zoom);
    assert.equal(getMapCamera(29, { overview: false }, 1000, 600).zoom, .82);
});

test('curve and path sampling are bounded, distance based, and tolerate stationary paths', () => {
    const a = { x: 0, y: 0 }, b = { x: 1, y: 0 }, c = { x: 1, y: 1 }, d = { x: 2, y: 1 };
    assert.deepEqual(sampleCubic(a, b, c, d, -1), a);
    assert.deepEqual(sampleCubic(a, b, c, d, 2), d);
    assert.deepEqual(sampleCubic(a, b, c, d, .5), { x: 1, y: .5 });
    assert.deepEqual(samplePath([a, b, { x: 4, y: 0 }], .5), { x: 2, y: 0 });
    assert.deepEqual(samplePath([a, b, { x: 1, y: 1.6 }], .5), b);
    assert.deepEqual(samplePath([a, a, b], .5), { x: .5, y: 0 });
    assert.deepEqual(samplePath([a, a], .5), a);
    assert.deepEqual(samplePath([d], .2), d);
    assert.deepEqual(samplePath([], .5), { x: .5, y: .5 });
});

test('motion eases without overshoot, reduced motion snaps, and suspended frame delta stays stable', () => {
    assert.equal(easeMapMotion(0), 0);
    assert.equal(easeMapMotion(.5), .5);
    assert.equal(easeMapMotion(1), 1);
    assert.equal(easeMapMotion(NaN), 0);
    for (const progress of [-1, 0, .1, .5, 1, 2]) {
        assert.ok(easeMapMotion(progress) >= 0 && easeMapMotion(progress) <= 1);
        assert.equal(easeMapMotion(progress, true), 1);
        assert.deepEqual(samplePath(secret, easeMapMotion(progress, true)), nodes[4]);
    }
    assert.equal(stableMapDelta(1 / 60), 1 / 60);
    assert.equal(stableMapDelta(60), .05);
    assert.equal(stableMapDelta(-1), 0);
    assert.equal(stableMapDelta(NaN), 0);
    assert.equal(stableMapDelta(Infinity), .05);
});


test('retargeting a moving marker stays on authored corridors instead of cutting across terrain', async () => {
    const { retargetMapTravel } = await import('../src/adventure/WorldMapModel');
    const a = { x: .1, y: .8 }, bend = { x: .1, y: .3 }, b = { x: .5, y: .3 }, nextBend = { x: .8, y: .3 }, c = { x: .8, y: .8 };
    const active = [a, bend, b], next = [b, nextBend, c];
    const current = samplePath(active, .25);
    const forward = retargetMapTravel(active, .25, next);
    assert.deepEqual(forward, [current, bend, b, nextBend, c]);
    assert.deepEqual(retargetMapTravel(active, .25, [b, bend, a]), [current, a]);
    assert.deepEqual(retargetMapTravel(active, .9, [b, bend, a]), [samplePath(active, .9), bend, a]);
    assert.deepEqual(retargetMapTravel(active, .25, [c]), [c], 'Island relocation remains immediate.');
    assert.deepEqual(retargetMapTravel(active, 1, next), next);
    assert.deepEqual(active, [a, bend, b]);
});

test('repeated retargets remember the traversed edge and reverse without visiting abandoned destinations', async () => {
    const { retargetMapTravel, recordMapTravel } = await import('../src/adventure/WorldMapModel');
    const a = { x: .1, y: .8 }, bend = { x: .1, y: .3 }, b = { x: .5, y: .3 }, c = { x: .8, y: .8 };
    const active = [a, bend, b], current = samplePath(active, .25);
    const history = recordMapTravel([], active, .25);
    const towardC = retargetMapTravel(active, .25, [b, c]);
    const towardA = retargetMapTravel(towardC, 0, [c, b, bend, a], history);
    assert.deepEqual(towardA, [current, a]);
    assert.ok(!towardA.some(p => p.x === b.x && p.y === b.y));
    assert.ok(!towardA.some(p => p.x === c.x && p.y === c.y));
});

test('alternating destinations rejoins the same authored edge rather than finishing a stale reversal', async () => {
    const { retargetMapTravel, recordMapTravel } = await import('../src/adventure/WorldMapModel');
    const a = { x: .1, y: .8 }, bend = { x: .1, y: .3 }, b = { x: .5, y: .3 };
    const route = [a, bend, b];
    const history = recordMapTravel([], route, .25);
    const back = retargetMapTravel(route, .25, [b, bend, a]);
    const history2 = recordMapTravel(history, back, .25);
    const feet = samplePath(back, .25);
    const forward = retargetMapTravel(back, .25, route, history2);
    assert.deepEqual(forward, [feet, bend, b]);
    assert.notDeepEqual(forward[1], a);
});
