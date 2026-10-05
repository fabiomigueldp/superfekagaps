import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AIRCRAFT_TRAVEL_DURATION, AIRCRAFT_REDUCED_DURATION, createAircraftRoute, sampleAircraftTravel, validAircraftRoute } from '../src/adventure/WorldAircraftModel';
import { aircraftFrameForHeading, paintAircraftTravel, parseAircraftMetadata } from '../src/adventure/WorldAircraftArt';
const route = createAircraftRoute();
const metadataRaw = JSON.parse(fs.readFileSync(new URL('../public/assets/world/map/journey-aircraft.meta.json', import.meta.url), 'utf8'));
const metadata = parseAircraftMetadata(metadataRaw)!;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test('aircraft exact endpoints, bounded stages, deterministic replay and no route mutation', () => {
    const before = JSON.stringify(route);
    assert.deepEqual(sampleAircraftTravel(route, -1).ground, route.departureStart);
    assert.deepEqual(sampleAircraftTravel(route, Infinity).ground, route.arrivalStop);
    assert.deepEqual(sampleAircraftTravel(route, NaN).ground, route.departureStart);
    const stages = new Set<string>();
    for (let tick = 0; tick <= 444; tick++) {
        const pose = sampleAircraftTravel(route, tick / 60);
        stages.add(pose.stage);
        for (const key of ['heading', 'altitude', 'bank', 'pitch', 'suspension', 'speed', 'propellerSpeed', 'dust', 'airWisps'] as const) assert.ok(Number.isFinite(pose[key]), key);
        assert.ok(pose.altitude >= 0 && pose.altitude <= .2);
        assert.ok(Math.abs(pose.bank) <= .14);
        assert.ok(pose.dust >= 0 && pose.dust <= 1);
        assert.deepEqual(pose, sampleAircraftTravel(route, tick / 60));
        if (pose.altitude > 0) assert.equal(pose.dust, 0);
    }
    assert.deepEqual([...stages], ['boarding', 'takeoff-roll', 'climb', 'cruise', 'approach', 'landing-roll', 'arrived']);
    const done = sampleAircraftTravel(route, AIRCRAFT_TRAVEL_DURATION);
    assert.equal(done.complete, true); assert.equal(done.speed, 0); assert.equal(done.altitude, 0); assert.equal(done.suspension, 0);
    assert.deepEqual(done.position, route.arrivalStop); assert.equal(JSON.stringify(route), before);
});

test('continuous takeoff and landing ground velocity, acceleration and deceleration', () => {
    const eps = .00001;
    for (const boundary of [.55, 2.1, 6.1, 7.4]) {
        const a = sampleAircraftTravel(route, boundary - eps), b = sampleAircraftTravel(route, boundary + eps);
        assert.ok(distance(a.position, b.position) < .00003, `continuous position at ${boundary}`);
        assert.ok(Math.abs(a.speed - b.speed) < .00003, `continuous speed at ${boundary}`);
    }
    assert.ok(sampleAircraftTravel(route, 1.9).speed > sampleAircraftTravel(route, 1).speed * 2);
    assert.ok(sampleAircraftTravel(route, 6.2).speed > sampleAircraftTravel(route, 7.2).speed * 3);
});

test('reversed travel uses real reverse headings; reduced motion excludes animated effects', () => {
    const reverse = createAircraftRoute(route.arrivalStop, route.departureStart);
    assert.ok(Math.cos(sampleAircraftTravel(route, 1).heading - sampleAircraftTravel(reverse, 1).heading) < -.9);
    for (let i = 0; i <= 100; i++) {
        const pose = sampleAircraftTravel(reverse, i / 100 * AIRCRAFT_REDUCED_DURATION, true);
        assert.equal(pose.altitude + pose.bank + pose.pitch + pose.suspension + pose.propellerSpeed + pose.dust + pose.airWisps, 0);
    }
    assert.deepEqual(sampleAircraftTravel(reverse, 10, true).ground, route.departureStart);
});

test('invalid routes fail explicitly without claiming arrival', () => {
    assert.equal(validAircraftRoute({ ...route, departureLift: route.departureStart }), false);
    assert.equal(validAircraftRoute({ ...route, scale: NaN }), false);
    assert.equal(validAircraftRoute({ ...route, altitude: -1 }), false);
    assert.throws(() => sampleAircraftTravel({ ...route, arrivalStop: { x: Infinity, y: 0 } }, 0), RangeError);
});

test('real metadata has 32 intact projected headings and bounded atlas budget', () => {
    assert.ok(metadata);
    assert.equal(metadata.headingCount, 32);
    assert.ok(metadataRaw.atlas.bytes < 400_000);
    for (const frame of metadata.frames) {
        assert.equal(aircraftFrameForHeading(metadata, frame.screenHeading).index, frame.index);
        assert.ok(frame.groundAnchor.x >= 0 && frame.groundAnchor.x <= metadata.frame.width);
        assert.ok(frame.groundAnchor.y >= 0 && frame.groundAnchor.y <= metadata.frame.height);
    }
    assert.equal(parseAircraftMetadata({ ...metadataRaw, headingCount: 8 }), null);
    assert.equal(parseAircraftMetadata({ ...metadataRaw, atlas: { ...metadataRaw.atlas, path: 'https://evil.invalid/image.png' } }), null);
});

test('renderer balances canvas transforms and has bounded drawing at every stage', () => {
    let depth = 0, drawCount = 0;
    const methods = new Set(['translate', 'rotate', 'scale', 'transform', 'beginPath', 'ellipse', 'arc', 'fill', 'stroke', 'fillRect', 'moveTo', 'lineTo', 'closePath', 'quadraticCurveTo']);
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
        get: (_target, key) => {
            if (key === 'save') return () => { depth++; };
            if (key === 'restore') return () => { depth--; assert.ok(depth >= 0); };
            if (key === 'drawImage') return (...values: unknown[]) => { drawCount++; assert.ok(values.slice(1).every(v => typeof v === 'number' && Number.isFinite(v))); };
            if (methods.has(String(key))) return (...values: unknown[]) => assert.ok(values.every(v => typeof v === 'number' && Number.isFinite(v)));
            return undefined;
        }, set: () => true,
    });
    const camera = { center: { x: .5, y: .5 }, zoom: 1, width: 960, height: 600 };
    for (const time of [0, 1, 2.5, 4, 5.9, 6.3, 7.4]) {
        paintAircraftTravel(ctx, camera, sampleAircraftTravel(route, time), { metadata, image: {} as CanvasImageSource }, time);
        assert.equal(depth, 0);
    }
    assert.equal(drawCount, 7);
});

test('corridor parameters are bounded and reject incompatible or malformed controls', () => {
    for (const runwayCorridors of [{ departure: NaN, arrival: 0 }, { departure: -1, arrival: 0 },
        { departure: 1.01, arrival: 0 }, { departure: 0, arrival: 0 },
        { departure: .5, arrival: 0, bendControls: [{ x: 0, y: 0 }, { x: Infinity, y: 0 }] as const }]) {
        assert.equal(validAircraftRoute({ ...route, runwayCorridors }), false);
    }
    assert.equal(validAircraftRoute({ ...route, runwayCorridors: { departure: 1, arrival: 1 } }), true);
    assert.equal(validAircraftRoute({ ...route, runwayCorridors: { departure: 1, arrival: 0 }, cruiseControls: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), false);
    const calmRoute = { ...route, runwayCorridors: { departure: 1, arrival: 1 } };
    for (let i = 0; i <= 69; i++) assert.deepEqual(sampleAircraftTravel(calmRoute, i / 60, true), sampleAircraftTravel(route, i / 60, true));
});


test('untyped malformed flight control containers fail validation without throwing', () => {
    for (const controls of ['ab', { length: 2 }, [null, null]]) {
        const malformed = controls as unknown as NonNullable<ReturnType<typeof createAircraftRoute>['cruiseControls']>;
        assert.equal(validAircraftRoute({ ...route, cruiseControls: malformed }), false);
        assert.equal(validAircraftRoute({ ...route, runwayCorridors: { departure: 1, arrival: 0, bendControls: malformed } }), false);
    }
});

test('opposite-terminal contact snapshots reject missing, nonfinite and degenerate runways', () => {
    const contacts = createAircraftRoute();
    for (const bad of [{}, { ...contacts, arrivalStop: { x: NaN, y: 0 } },
        { ...contacts, departureLift: contacts.departureStart }, { ...contacts, arrivalTouchdown: contacts.arrivalStop }]) {
        const invalid = { ...route, runwayCorridors: { departure: 1, arrival: 0,
            oppositeTerminalContacts: bad as typeof contacts } };
        assert.equal(validAircraftRoute(invalid), false);
        assert.throws(() => sampleAircraftTravel(invalid, 3.5), RangeError);
    }
});


test('opposite-terminal snapshots ignore extra trajectory options', () => {
    for (const extras of [{ cruiseControls: 'ab' },
        { cruiseControls: [{ x: 100, y: 100 }, { x: 200, y: 200 }] },
        { runwayCorridors: { departure: 1, arrival: 1 } }]) {
        const contacts = { ...route, ...extras };
        for (const [departure, arrival, time] of [[1, 0, 5.8], [0, 1, 2.2]]) {
            const preserved = { ...route, runwayCorridors: { departure, arrival, oppositeTerminalContacts: contacts } };
            assert.equal(validAircraftRoute(preserved), true);
            assert.deepEqual(sampleAircraftTravel(preserved, time), sampleAircraftTravel(route, time));
        }
    }
});


test('offshore climb options reject malformed flags', () => {
    for (const flag of [null, 1, 'true', {}]) {
        for (const key of ['departureOffshoreClimb', 'arrivalOffshoreClimb']) {
            const invalid = { ...route, runwayCorridors: { departure: .6, arrival: 1, [key]: flag } };
            assert.equal(validAircraftRoute(invalid), false);
        }
    }
});
