import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleAircraftCamera } from '../src/adventure/WorldAircraftCamera';
import { createAircraftRoute, sampleAircraftTravel, AIRCRAFT_TRAVEL_DURATION } from '../src/adventure/WorldAircraftModel';
import { mapToScreen } from '../src/adventure/WorldMapModel';
const route = createAircraftRoute({ x: -1.5, y: .7 }, { x: 3.5, y: .3 });
const options = { width: 960, height: 540 };

test('one constant world scale, seekable and immutable framing throughout all phases', () => {
    const before = JSON.stringify(route);
    for (let i = 0; i <= 444; i++) {
        const time = i / 60, camera = sampleAircraftCamera(route, time, options);
        assert.equal(camera.zoom, .9);
        assert.ok(Number.isFinite(camera.center.x + camera.center.y));
        assert.deepEqual(camera, sampleAircraftCamera(route, time, options));
        const plane = mapToScreen(sampleAircraftTravel(route, time).position, camera);
        assert.ok(plane.x > 960 * .2 && plane.x < 960 * .8, `horizontal safe frame at ${time}`);
        assert.ok(plane.y > 540 * .2 && plane.y < 540 * .7, `vertical safe frame at ${time}`);
    }
    assert.equal(JSON.stringify(route), before);
    assert.deepEqual(sampleAircraftCamera(route, Infinity, options), sampleAircraftCamera(route, AIRCRAFT_TRAVEL_DURATION, options));
    assert.deepEqual(sampleAircraftCamera(route, NaN, options), sampleAircraftCamera(route, 0, options));
});

test('camera remains continuous across boarding, lift, approach and landing boundaries', () => {
    for (const t of [.55, 2.1, 4.65, 5.4, 6.1, 7.1, 7.4]) {
        const a = sampleAircraftCamera(route, t - .00001, options), b = sampleAircraftCamera(route, t + .00001, options);
        assert.ok(Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) < .0001);
    }
});

test('framing follows supplied terminal coordinates with no hardcoded airport positions', () => {
    const shift = { x: -7.5, y: -4.7 };
    const translated = Object.fromEntries(Object.entries(route).map(([key, p]) => [key, typeof p === 'object' ? { x: p.x + shift.x, y: p.y + shift.y } : p])) as typeof route;
    for (const t of [0, 1.5, 3.8, 5.5, 7.4]) {
        const a = sampleAircraftCamera(route, t, options), b = sampleAircraftCamera(translated, t, options);
        assert.ok(Math.abs(b.center.x - a.center.x - shift.x) < 1e-12);
        assert.ok(Math.abs(b.center.y - a.center.y - shift.y) < 1e-12);
    }
});

test('reduced motion is a static route-wide composition with endpoints inside safe frame', () => {
    const reduced = { ...options, reducedMotion: true }, camera = sampleAircraftCamera(route, 0, reduced);
    for (const t of [0, .2, .6, 1.15, 7.4]) assert.deepEqual(sampleAircraftCamera(route, t, reduced), camera);
    for (const p of [route.departureStart, route.arrivalStop]) {
        const screen = mapToScreen(p, camera);
        assert.ok(screen.x > options.width * .12 && screen.x < options.width * .88);
        assert.ok(screen.y > options.height * .17 && screen.y < options.height * .83);
    }
});

test('landmark composition reveals context without losing small aircraft or controls', () => {
    const focused = { ...options, departureFocus: { x: route.departureStart.x - .5, y: route.departureStart.y - .3 }, arrivalFocus: { x: route.arrivalStop.x + .5, y: route.arrivalStop.y - .3 } };
    for (let i = 0; i <= 444; i++) {
        const t = i / 60, camera = sampleAircraftCamera(route, t, focused);
        const screen = mapToScreen(sampleAircraftTravel(route, t).position, camera);
        assert.ok(screen.x > 960 * .15 && screen.x < 960 * .85);
        assert.ok(screen.y > 540 * .18 && screen.y < 540 * .75);
    }
});
