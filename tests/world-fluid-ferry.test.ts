import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COAST_PORT_FERRY, createFerry, sampleFerry, type FerryGeometry } from '../src/adventure/WorldFerryModel';
import { advanceJourney, createJourney, journeyLegPoint, sailClockVelocity, sailDistanceProgress, sailPathPoints,
    selectJourney, skipJourney, type JourneyLeg } from '../src/adventure/WorldJourneyModel';
import { parseJourneyBoat } from '../src/adventure/WorldJourneyNetwork';
import { samplePath } from '../src/adventure/WorldMapModel';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const art = parseJourneyBoat(read('journey-boat'))!;
const route = read('coast-port-journey').sailRoute;
const leg: JourneyLeg = { id: COAST_PORT_FERRY.sailEdge, from: '1-berth', to: '2-berth', mode: 'sail',
    duration: route.durationSeconds, points: route.points, progress: 0, direction: 1 };
const geometry: FerryGeometry = { berths: { 1: { foot: route.points[0], headingFrame: 0 },
    2: { foot: route.points.at(-1), headingFrame: 2 } }, segmentHeadings: route.segmentHeadings,
    reverseSegmentHeadings: route.reverseSegmentHeadings, art };
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * 1.6, a.y - b.y);

test('sail timing eases both endpoints symmetrically without changing duration or reversal position', () => {
    assert.equal(sailDistanceProgress(0), 0); assert.equal(sailDistanceProgress(1), 1);
    assert.equal(sailDistanceProgress(.5), .5);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
        const p = i / 100, value = sailDistanceProgress(p);
        assert.ok(value >= previous); assert.ok(Math.abs(value + sailDistanceProgress(1 - p) - 1) < 1e-12); previous = value;
        assert.deepEqual(journeyLegPoint({ ...leg, progress: p, direction: 1 }), journeyLegPoint({ ...leg, progress: p, direction: -1 }));
    }
    assert.ok(sailDistanceProgress(.01) < .001);
    assert.ok(sailDistanceProgress(.51) - .5 > .01);
});

test('rounded sail paths retain both terminals, cache the result, and stay within the bounded corner corridor', () => {
    for (const name of ['coast-port-journey', 'reserva-dominio-journey']) {
        const points = read(name).sailRoute.points, copy = structuredClone(points), rounded = sailPathPoints(points);
        assert.deepEqual(rounded[0], points[0]); assert.deepEqual(rounded.at(-1), points.at(-1));
        assert.equal(sailPathPoints(points), rounded); assert.deepEqual(points, copy);
        for (const p of rounded) {
            let nearest = Infinity;
            for (let i = 1; i < points.length; i++) {
                const a = points[i - 1], b = points[i], dx = (b.x - a.x) * 1.6, dy = b.y - a.y;
                const t = Math.max(0, Math.min(1, (((p.x - a.x) * 1.6) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
                nearest = Math.min(nearest, distance(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
            }
            assert.ok(nearest <= .015, `${name} left the maximum local corner envelope: ${nearest}`);
        }
    }
});

test('waterline stays fixed while genuine view selection carries Feka through the matching deck anchor', () => {
    const active = { ...leg, progress: .5 }, point = journeyLegPoint(active);
    const poses = [0, Math.PI / 2, Math.PI].map(headingRadians => sampleFerry({ ...createFerry(COAST_PORT_FERRY, 1), headingRadians, poseAt: 1000 },
        COAST_PORT_FERRY, geometry, { active, point, time: 1000 }));
    assert.ok(new Set(poses.map(pose => pose.frameIndex)).size > 1);
    for (const pose of poses) {
        assert.deepEqual(pose.motion!.waterline, poses[0].motion!.waterline);
        const frame = art.frames[pose.frameIndex], unit = frame.widthInMap / frame.width;
        assert.ok(Math.abs(pose.foot.x + (frame.waterlineAnchor!.x - frame.passengerFoot.x) * unit - pose.motion!.waterline.x) < 1e-12);
        const heave = Math.sin(1000 / 430) * .0012;
        assert.ok(Math.abs(pose.foot.y + (frame.waterlineAnchor!.y - frame.passengerFoot.y) * unit * 1.6 - pose.motion!.waterline.y - heave) < 1e-12);
    }
});

test('a changed heading target preserves the immediate pose and turns progressively without repeated-sample drift', () => {
    let state = createFerry(COAST_PORT_FERRY, 1), pose;
    for (let i = 0; i <= 150; i++) {
        const active = { ...leg, progress: i / 360 };
        pose = sampleFerry(state, COAST_PORT_FERRY, geometry, { active, point: journeyLegPoint(active), time: i * 1000 / 60 }); state = pose.state;
    }
    const active = { ...leg, progress: 150 / 360, direction: -1 as const };
    const reversed = sampleFerry(state, COAST_PORT_FERRY, geometry, { active, point: journeyLegPoint(active), time: 2500 });
    assert.deepEqual(reversed.foot, pose!.foot); assert.equal(reversed.frameIndex, pose!.frameIndex);
    assert.deepEqual(sampleFerry(reversed.state, COAST_PORT_FERRY, geometry, { active, point: journeyLegPoint(active), time: 2500 }), reversed);
    let previous = reversed.state.headingRadians!;
    for (let i = 1; i <= 60; i++) {
        const returning = { ...active, progress: (150 - i) / 360 };
        pose = sampleFerry(state, COAST_PORT_FERRY, geometry, { active: returning, point: journeyLegPoint(returning), time: 2500 + i * 1000 / 60 });
        const delta = Math.atan2(Math.sin(pose.state.headingRadians! - previous), Math.cos(pose.state.headingRadians! - previous));
        assert.ok(Math.abs(delta) <= Math.PI * 1.25 / 60 + 1e-10);
        state = pose.state; previous = state.headingRadians!;
    }
    assert.ok(Math.abs(Math.atan2(Math.sin(previous - reversed.state.headingRadians!), Math.cos(previous - reversed.state.headingRadians!))) > .5);
});

test('docking and reduced motion leave exact terminal feet with no wake or heave', () => {
    for (const direction of [1, -1] as const) {
        const world = direction === 1 ? 2 : 1, active = { ...leg, direction, progress: direction === 1 ? 1 : 0 };
        const pose = sampleFerry(createFerry(COAST_PORT_FERRY, world), COAST_PORT_FERRY, geometry,
            { active, point: journeyLegPoint(active), time: 9000, reducedMotion: true });
        assert.ok(distance(pose.foot, geometry.berths[world].foot) < 1e-12); assert.equal(pose.motion!.speed, 0);
        const parked = sampleFerry(pose.state, COAST_PORT_FERRY, geometry, { time: 9016 });
        assert.deepEqual(parked.foot, geometry.berths[world].foot); assert.equal(parked.motion, undefined);
        assert.equal(parked.frameIndex, pose.frameIndex);
    }
    const walking = { ...leg, mode: 'walk' as const, progress: .3 };
    assert.deepEqual(journeyLegPoint(walking), samplePath(walking.points, .3));
});

const capabilities = { availableStages: ['1-1', '2-1'] };
const network = { nodes: { '1-1': leg.points[0], '2-1': leg.points.at(-1)! },
    edges: [{ ...leg, from: '1-1', to: '2-1', points: leg.points.slice(1, -1) }] };
const midSail = () => advanceJourney(selectJourney(createJourney('1-1', network, capabilities), '2-1', network, capabilities), leg.duration * .45);

test('a real sail retarget brakes to rest, pauses, and accelerates astern without moving on selection', () => {
    const sailing = midSail();
    let reversed = selectJourney(sailing, '1-1', network, capabilities);
    assert.deepEqual(reversed.point, sailing.point);
    assert.equal(reversed.legs[0].sailHeadingDirection, 1);
    assert.equal(sailClockVelocity(reversed.legs[0]), 1);
    reversed = advanceJourney(reversed, .11);
    assert.ok(reversed.legs[0].progress > sailing.legs[0].progress);
    assert.ok(Math.abs(sailClockVelocity(reversed.legs[0]) - .5) < 1e-12);
    reversed = advanceJourney(reversed, .11);
    assert.equal(sailClockVelocity(reversed.legs[0]), 0);
    const stopped = reversed.point;
    reversed = advanceJourney(reversed, .1);
    assert.deepEqual(reversed.point, stopped);
    reversed = advanceJourney(reversed, .15);
    assert.ok(Math.abs(sailClockVelocity(reversed.legs[0]) + .5) < 1e-12);
    reversed = advanceJourney(reversed, .15);
    assert.equal(reversed.legs[0].sailManeuver, undefined);
    assert.equal(sailClockVelocity(reversed.legs[0]), -1);
    const arrived = advanceJourney(reversed, 99);
    assert.equal(arrived.arrived, '1-1'); assert.equal(arrived.destination, null);
    assert.deepEqual(arrived.point, network.nodes['1-1']);
});

test('repeated selection keeps the maneuver clock; rapid retarget preserves velocity and Skip/reduced motion finish', () => {
    let reversed = advanceJourney(selectJourney(midSail(), '1-1', network, capabilities), .11);
    for (let i = 0; i < 10; i++) {
        const same = selectJourney(reversed, '1-1', network, capabilities);
        assert.deepEqual(same.legs[0].sailManeuver, reversed.legs[0].sailManeuver);
        reversed = advanceJourney(same, .01);
    }
    const velocity = sailClockVelocity(reversed.legs[0]);
    const forward = selectJourney(reversed, '2-1', network, capabilities);
    assert.deepEqual(forward.point, reversed.point);
    assert.equal(sailClockVelocity(forward.legs[0]), velocity);
    assert.equal(forward.legs[0].sailHeadingDirection, 1);
    assert.equal(skipJourney(forward).arrived, '2-1');
    assert.equal(advanceJourney(forward, 0, true).arrived, '2-1');
    assert.equal(selectJourney(reversed, '2-1', network, capabilities, { reducedMotion: true }).arrived, '2-1');
    const all = advanceJourney(forward, .62);
    let chunks = forward;
    for (let i = 0; i < 62; i++) chunks = advanceJourney(chunks, .01);
    assert.ok(distance(all.point, chunks.point) < 1e-12);
    const nearTerminal = { ...midSail(), legs: [{ ...midSail().legs[0], direction: -1 as const, progress: .001 }] };
    nearTerminal.point = journeyLegPoint(nearTerminal.legs[0]);
    const turnAtTerminal = selectJourney(nearTerminal, '2-1', network, capabilities);
    const largeStep = advanceJourney(turnAtTerminal, .62);
    let smallSteps = turnAtTerminal;
    for (let i = 0; i < 62; i++) smallSteps = advanceJourney(smallSteps, .01);
    assert.ok(distance(largeStep.point, smallSteps.point) < 1e-12);
});

test('Reserva reversal keeps the hull aligned with its channel, suppresses its wake, and docks in the exact pose', () => {
    const route = read('reserva-dominio-journey').sailRoute;
    const definition = { ...COAST_PORT_FERRY, worlds: [5, 6] as const, berths: { 5: '5-1', 6: '6-1' } };
    const geometry: FerryGeometry = { berths: { 5: { foot: route.points[0], headingFrame: 6 },
        6: { foot: route.points.at(-1), headingFrame: 6 } }, segmentHeadings: route.segmentHeadings,
        reverseSegmentHeadings: route.reverseSegmentHeadings, art };
    const network = { nodes: { '5-1': route.points[0], '6-1': route.points.at(-1) }, edges: [{ ...leg,
        from: '5-1', to: '6-1', points: route.points.slice(1, -1), duration: route.durationSeconds }] };
    const capabilities = { availableStages: ['5-1', '6-1'] };
    let journey = selectJourney(createJourney('5-1', network, capabilities), '6-1', network, capabilities);
    let ferry = createFerry(definition, 5), time = 0, reversed = false, checked = 0, previous;
    for (let i = 0; i < 600 && journey.destination; i++) {
        if (!reversed && journey.legs[0].progress >= .45) {
            journey = selectJourney(journey, '5-1', network, capabilities); reversed = true;
        }
        journey = advanceJourney(journey, 1 / 60); time += 1000 / 60;
        const pose = sampleFerry(ferry, definition, geometry, { active: journey.legs[0], point: journey.point, time });
        if (reversed && pose.motion) {
            assert.equal(pose.motion.speed, 0);
            if (previous?.motion && journey.legs[0].progress > .38 && !journey.legs[0].sailManeuver) {
                const velocity = { x: (pose.motion.waterline.x - previous.motion.waterline.x) * 1.6,
                    y: pose.motion.waterline.y - previous.motion.waterline.y };
                const alignment = Math.cos(Math.atan2(velocity.y, velocity.x) - pose.motion.screenHeading);
                assert.ok(alignment < -.98, `return must travel astern, not sideways: ${alignment}`); checked++;
            }
        }
        ferry = pose.state; previous = pose;
    }
    assert.ok(checked > 10); assert.equal(journey.arrived, '5-1');
    assert.deepEqual(previous!.foot, route.points[0]);
    assert.equal(previous!.frameIndex, art.frames.length * 6 / 8);
});

test('stern-first Porto departure omits a wake ahead of the actual displacement', () => {
    let ferry = createFerry(COAST_PORT_FERRY, 2), suppressed = 0;
    for (let i = 0; i <= 48; i++) {
        const active = { ...leg, direction: -1 as const, progress: 1 - i / 360 };
        const pose = sampleFerry(ferry, COAST_PORT_FERRY, geometry, { active, time: i * 1000 / 60 });
        if (i >= 12 && i <= 36) { assert.equal(pose.motion!.speed, 0); suppressed++; }
        ferry = pose.state;
    }
    assert.equal(suppressed, 25);
});
