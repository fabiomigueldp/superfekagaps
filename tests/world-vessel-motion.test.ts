import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COAST_PORT_FERRY, createFerry, sampleFerry, type FerryGeometry, type FerryPose } from '../src/adventure/WorldFerryModel';
import { parseJourneyBoat } from '../src/adventure/WorldJourneyNetwork';
import { DOMINIO_FERRY } from '../src/adventure/WorldDominioJourney';
import type { JourneyLeg } from '../src/adventure/WorldJourneyModel';
import { advanceVesselWake, dampedMotion, VESSEL_WAKE_LIFETIME, VESSEL_WAKE_LIMIT, type VesselWakeState } from '../src/adventure/WorldVesselMotion';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
const art = parseJourneyBoat(read('journey-boat'))!, route = read('coast-port-journey').sailRoute;
const geometry: FerryGeometry = { berths: { 1: { foot: route.points[0], headingFrame: 0 },
    2: { foot: route.points.at(-1), headingFrame: 2 } }, segmentHeadings: route.segmentHeadings,
    reverseSegmentHeadings: route.reverseSegmentHeadings, art };
const leg: JourneyLeg = { id: COAST_PORT_FERRY.sailEdge, from: '1-berth', to: '2-berth', mode: 'sail',
    duration: route.durationSeconds, points: route.points, progress: 0, direction: 1 };

test('damped mass loses energy and gives the same response at 30, 60 and 120 Hz', () => {
    for (const damping of [.78, .82, .92, 1]) {
        const runs = [30, 60, 120].map(rate => {
            let state = { value: 1, velocity: 0 }, energy = 25;
            for (let tick = 0; tick < rate * 3; tick++) {
                state = dampedMotion(state, 0, 1 / rate, 5, damping);
                const next = state.velocity ** 2 + 25 * state.value ** 2;
                assert.ok(next <= energy + 1e-12, 'The hull must dissipate energy instead of growing a wobble.');
                energy = next;
            }
            assert.ok(Math.abs(state.value) < .0001 && Math.abs(state.velocity) < .0001);
            return state;
        });
        for (const state of runs.slice(1)) {
            assert.ok(Math.abs(state.value - runs[0].value) < 1e-12);
            assert.ok(Math.abs(state.velocity - runs[0].velocity) < 1e-12);
        }
    }
});

function crossing(rate: number) {
    let state = createFerry(COAST_PORT_FERRY, 1), pose: FerryPose | undefined;
    const poses: FerryPose[] = [];
    for (let tick = 0; tick <= rate * 5; tick++) {
        pose = sampleFerry(state, COAST_PORT_FERRY, geometry, {
            active: { ...leg, progress: tick / rate / leg.duration }, time: tick * 1000 / rate,
        });
        state = pose.state;
        if (tick % (rate / 2) === 0) poses.push(pose);
        assert.ok(Math.abs(pose.motion!.rotation!) <= .045);
        assert.ok(Math.abs(state.dynamics!.heave.value) < .004);
        assert.ok(Math.abs(state.yawVelocity!) <= 2.4);
        assert.ok((state.wake?.samples.length ?? 0) <= VESSEL_WAKE_LIMIT);
    }
    return { poses, pose: pose! };
}

test('real crossing remains bounded and visually consistent across refresh rates', () => {
    const runs = [30, 60, 120].map(crossing);
    for (const run of runs.slice(1)) run.poses.forEach((pose, index) => {
        const reference = runs[0].poses[index];
        assert.ok(Math.abs(pose.state.headingRadians! - reference.state.headingRadians!) < .035);
        assert.ok(Math.abs(pose.state.dynamics!.heave.value - reference.state.dynamics!.heave.value) < .00015);
        assert.ok(Math.abs(pose.motion!.rotation! - reference.motion!.rotation!) < .003);
        assert.deepEqual(pose.motion!.waterline, reference.motion!.waterline);
    });
    const { pose } = runs[1], previous = structuredClone(pose.state);
    const repeated = sampleFerry(pose.state, COAST_PORT_FERRY, geometry, { active: { ...leg, progress: 5 / leg.duration }, time: 5000 });
    assert.deepEqual(repeated, pose); assert.deepEqual(pose.state, previous);
});

function emitted(rate: number, seconds = 4) {
    let state: VesselWakeState | undefined;
    for (let tick = 0; tick <= seconds * rate; tick++) state = advanceVesselWake(state, {
        point: { x: tick / rate * .04, y: .6 }, heading: 0, speed: 1, time: tick / rate * 1000,
    });
    return state!;
}

test('wake density follows time rather than frames, with a strict lifetime and memory bound', () => {
    const runs = [30, 60, 120].map(rate => emitted(rate));
    for (const run of runs) {
        assert.ok(run.samples.length > 30 && run.samples.length <= VESSEL_WAKE_LIMIT);
        assert.ok(run.samples.every(sample => run.emitter.time - sample.time < VESSEL_WAKE_LIFETIME));
        assert.deepEqual(run.samples.map(sample => sample.time), runs[0].samples.map(sample => sample.time));
        run.samples.forEach((sample, index) => assert.ok(Math.abs(sample.point.x - runs[0].samples[index].point.x) < 1e-12));
    }
});

test('old foam stays fixed when the boat turns/stops, decays at rest and clears on seek or resume', () => {
    const previous = emitted(60), before = structuredClone(previous);
    let wake = advanceVesselWake(previous, { point: { x: .16, y: .6 }, heading: 1, speed: 0, time: 4010 });
    for (const sample of previous.samples) assert.deepEqual(wake.samples.find(p => p.time === sample.time), sample);
    assert.deepEqual(previous, before);
    for (let time = 4030; time <= 6410; time += 20) wake = advanceVesselWake(wake, { ...wake.emitter, time });
    assert.equal(wake.samples.length, 0);
    for (const time of [1000, 8000]) assert.equal(advanceVesselWake(previous, { ...previous.emitter, time }).samples.length, 0);
    assert.equal(advanceVesselWake(previous, { ...previous.emitter, point: { x: 4, y: 4 }, time: 4020 }).samples.length, 0);
});

test('reduced motion clears stored hull forces and foam; landing retains the exact berth', () => {
    const { pose } = crossing(60);
    const reduced = sampleFerry(pose.state, COAST_PORT_FERRY, geometry, {
        active: { ...leg, progress: 5 / leg.duration }, time: 5016, reducedMotion: true,
    });
    assert.equal(reduced.state.dynamics, undefined); assert.equal(reduced.state.wake, undefined);
    assert.equal(reduced.motion!.speed, 0); assert.equal(reduced.motion!.rotation, 0);
    const parked = sampleFerry({ ...pose.state, mooredWorld: 2 }, COAST_PORT_FERRY, geometry, { time: 5016 });
    assert.deepEqual(parked.foot, geometry.berths[2].foot);
    assert.ok(Math.abs(parked.motion!.rotation!) > 0); assert.equal(parked.motion!.speed, 0);
    assert.ok(Math.abs(parked.motion!.heave!) > 0, 'Mooring must preserve the hull response instead of flattening the deck.');
    assert.ok(parked.motion!.wake!.length > 0, 'Arrival must not erase foam that is still in the channel.');
});

test('both ferries float gently at either berth, without changing anchors, heading or producing wash', () => {
    for (const [definition, name, headings] of [[COAST_PORT_FERRY, 'coast-port-journey', [0, 2]],
        [DOMINIO_FERRY, 'reserva-dominio-journey', [6, 6]]] as const) {
        const route = read(name).sailRoute;
        const geometry: FerryGeometry = { art, segmentHeadings: route.segmentHeadings,
            reverseSegmentHeadings: route.reverseSegmentHeadings,
            berths: Object.fromEntries(definition.worlds.map((world, i) => [world,
                { foot: i ? route.points.at(-1) : route.points[0], headingFrame: headings[i] }])) };
        for (const world of definition.worlds) {
            const runs = [30, 60, 120].map(rate => {
                let state = createFerry(definition, world);
                const samples: FerryPose[] = [];
                for (let tick = 0; tick <= rate * 8; tick++) {
                    const pose = sampleFerry(state, definition, geometry, { time: tick * 1000 / rate });
                    assert.deepEqual(pose.foot, geometry.berths[world].foot);
                    assert.equal(pose.motion!.speed, 0); assert.equal(pose.motion!.wake, undefined);
                    assert.ok(Math.abs(pose.motion!.heave!) < .002);
                    assert.ok(Math.abs(pose.motion!.rotation!) < .012);
                    assert.equal(pose.frameIndex, art.frames.length * headings[definition.worlds.indexOf(world)] / 8);
                    state = pose.state;
                    if (tick % (rate / 2) === 0) samples.push(pose);
                }
                const heave = samples.map(pose => pose.motion!.heave!), roll = samples.map(pose => pose.motion!.rotation!);
                assert.ok(Math.max(...heave) - Math.min(...heave) > .0006, 'The moored hull must visibly float.');
                assert.ok(Math.max(...roll) - Math.min(...roll) > .001, 'Swells must also rock the hull.');
                return samples;
            });
            for (const samples of runs.slice(1)) samples.forEach((pose, i) => {
                assert.ok(Math.abs(pose.motion!.heave! - runs[0][i].motion!.heave!) < .00008);
                assert.ok(Math.abs(pose.motion!.rotation! - runs[0][i].motion!.rotation!) < .0005);
            });
        }
    }
});

test('arrival preserves displacement and velocity, then dissipates residual load into the moored swell', () => {
    let state = createFerry(COAST_PORT_FERRY, 1), arrived: FerryPose | undefined;
    for (let tick = 0; tick <= leg.duration * 60; tick++) {
        arrived = sampleFerry(state, COAST_PORT_FERRY, geometry, {
            active: { ...leg, progress: tick / 60 / leg.duration }, time: tick * 1000 / 60,
        }); state = arrived.state;
    }
    const time = leg.duration * 1000;
    const parked = sampleFerry({ ...state, mooredWorld: 2 }, COAST_PORT_FERRY, geometry, { time });
    assert.deepEqual(parked.state.dynamics, arrived!.state.dynamics, 'Stopping cannot discard spring velocities.');
    assert.equal(parked.motion!.heave, arrived!.motion!.heave);
    assert.deepEqual(parked.foot, geometry.berths[2].foot);
    const repeated = sampleFerry(parked.state, COAST_PORT_FERRY, geometry, { time });
    assert.deepEqual(repeated, parked, 'Layout reads at the same timestamp cannot advance the floating hull.');

    let loaded = { ...parked.state, dynamics: { ...parked.state.dynamics!,
        heave: { value: parked.motion!.heave! + .002, velocity: .001 },
        roll: { value: .018, velocity: -.003 }, pitch: { value: -.014, velocity: .002 } } };
    let calm = parked.state;
    for (let tick = 1; tick <= 180; tick++) {
        const a = sampleFerry(loaded, COAST_PORT_FERRY, geometry, { time: time + tick * 1000 / 60 });
        const b = sampleFerry(calm, COAST_PORT_FERRY, geometry, { time: time + tick * 1000 / 60 });
        if (tick === 1) assert.ok(a.motion!.heave! - b.motion!.heave! > .0019, 'Mass must settle over time, not snap.');
        if (tick === 180) for (const axis of ['heave', 'roll', 'pitch'] as const) {
            assert.ok(Math.abs(a.state.dynamics![axis].value - b.state.dynamics![axis].value) < .00001);
            assert.ok(Math.abs(a.state.dynamics![axis].velocity - b.state.dynamics![axis].velocity) < .00001);
        }
        loaded = a.state as typeof loaded; calm = b.state;
    }
    const reduced = sampleFerry(loaded, COAST_PORT_FERRY, geometry, { time: time + 3100, reducedMotion: true });
    assert.equal(reduced.motion, undefined); assert.equal(reduced.state.dynamics, undefined);
    assert.deepEqual(reduced.foot, geometry.berths[2].foot);
    const resumed = sampleFerry(loaded, COAST_PORT_FERRY, geometry, { time: time + 60000 });
    assert.equal(resumed.motion!.heave, 0); assert.equal(resumed.motion!.rotation, 0);
    assert.equal(resumed.motion!.wake, undefined);
});
