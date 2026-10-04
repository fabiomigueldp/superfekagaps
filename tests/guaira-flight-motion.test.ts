import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import metadata from '../public/assets/world/map/journey-aircraft.meta.json';
import { runGuairaFlight } from '../src/adventure/WorldGuairaFlight';
import { WorldAircraftAudio } from '../src/adventure/WorldAircraftAudio';
import { AIRCRAFT_REDUCED_DURATION, AIRCRAFT_TRAVEL_DURATION, type AircraftPose } from '../src/adventure/WorldAircraftModel';

function flightBrowser(t: TestContext, reduced = false) {
    const calls: { name: string; args: unknown[] }[] = [];
    const context = new Proxy({} as CanvasRenderingContext2D, {
        get: (target, key: keyof CanvasRenderingContext2D) => {
            if (key in target) return target[key];
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            return (...args: unknown[]) => { calls.push({ name: key, args }); };
        },
    });
    class Element extends EventTarget {
        attributes = new Map<string, string>();
        children: Element[] = []; textContent = ''; disabled = false; hidden = false; removed = false;
        append(...children: Element[]) { this.children.push(...children); }
        setAttribute(name: string, value: string) { this.attributes.set(name, value); }
        showModal() {} close() {} remove() { this.removed = true; }
        getContext() { return context; }
        click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
    }
    const document = Object.assign(new EventTarget(), { body: new Element(), hidden: false, activeElement: null,
        createElement: () => new Element() });
    const motion = { matches: reduced };
    const window = Object.assign(new EventTarget(), { matchMedia: () => motion, setTimeout, clearTimeout });
    class Image {
        onload: (() => void) | null = null; onerror: (() => void) | null = null;
        naturalWidth = metadata.atlas.width; naturalHeight = metadata.atlas.height; path = '';
        set src(path: string) { this.path = path; queueMicrotask(() => this.onload?.()); }
    }
    let time = 0, serial = 0;
    const frames = new Map<number, FrameRequestCallback>(), poses: AircraftPose[] = [];
    for (const [key, value] of Object.entries({ document, window, Image, HTMLElement: Element, performance: { now: () => time },
        fetch: async () => ({ ok: true, json: async () => metadata }),
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); } })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
    }
    t.mock.method(WorldAircraftAudio.prototype, 'sync', (pose: AircraftPose) => { poses.push(pose); });
    return { document, window, motion, frames, poses, calls,
        ready: async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); },
        step(milliseconds = 50) {
            assert.equal(frames.size, 1, 'one pending animation frame');
            time += milliseconds;
            const [id, callback] = [...frames][0]; frames.delete(id); calls.length = 0; callback(time);
            return poses.at(-1)!;
        },
        get dialog() { return document.body.children.at(-1)!; },
        scenery() { return calls.filter(call => call.name === 'drawImage' && !(call.args[0] as Image).path.endsWith('journey-aircraft.webp')); },
    };
}
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);

test('flight uses the latest motion preference after assets finish loading', async t => {
    const h = flightBrowser(t);
    const cancel = runGuairaFlight({ from: 'factory', to: 'guaira', onArrive: () => assert.fail('no early arrival') });
    h.motion.matches = true; await h.ready();
    const pose = h.step();
    assert.equal(pose.reducedMotion, true); near(pose.progress, .05 / AIRCRAFT_REDUCED_DURATION);
    assert.equal(h.dialog.children[0].attributes.get('style'), 'opacity: 1'); cancel();
});

test('enabling reduced motion in flight immediately calms the rendered scene and preserves progress', async t => {
    const h = flightBrowser(t); let arrived = 0;
    const cancel = runGuairaFlight({ from: 'factory', to: 'guaira', onArrive: () => { arrived++; } });
    await h.ready(); for (let i = 0; i < 65; i++) h.step();
    const before = h.poses.at(-1)!; assert.ok(before.altitude > 0);
    h.motion.matches = true;
    const reduced = h.step(0);
    assert.equal(reduced.reducedMotion, true); near(reduced.progress, before.progress);
    assert.equal(reduced.altitude + reduced.bank + reduced.pitch + reduced.suspension + reduced.propellerSpeed + reduced.dust + reduced.airWisps, 0);
    assert.equal(arrived, 0, 'shorter mode must not turn the existing elapsed time into an arrival');
    const background = h.scenery(); assert.ok(background.length > 0);
    assert.ok(h.calls.some(call => call.name === 'rotate' && call.args[0] === .45), 'stationary reduced-motion propeller');
    h.step(); assert.deepEqual(h.scenery(), background, 'landmark coordinates remain fixed instead of panning');
    cancel(); assert.equal(h.frames.size, 0);
});

test('switching motion modes repeatedly does not reset or rewind flight progress', async t => {
    const h = flightBrowser(t, true);
    const cancel = runGuairaFlight({ from: 'guaira', to: 'serra', onArrive: () => assert.fail('no early arrival') });
    await h.ready(); for (let i = 0; i < 10; i++) h.step();
    const progress = h.poses.at(-1)!.progress;
    for (const reduced of [false, true, false, true]) {
        h.motion.matches = reduced; const pose = h.step(0);
        assert.equal(pose.reducedMotion, reduced); near(pose.progress, progress);
    }
    h.motion.matches = false;
    const pose = h.step(); near(pose.progress, progress + .05 / AIRCRAFT_TRAVEL_DURATION);
    assert.ok(pose.altitude > 0, 'ordinary presentation can resume at the same trip position'); cancel();
});

test('changing to reduced motion during the arrival dissolve restores full opacity', async t => {
    const h = flightBrowser(t); let arrived = 0;
    runGuairaFlight({ from: 'guaira', to: 'factory', onArrive: () => { arrived++; } });
    await h.ready(); for (let i = 0; i < 145; i++) h.step();
    assert.notEqual(h.dialog.children[0].attributes.get('style'), 'opacity: 1');
    h.motion.matches = true; h.step(0);
    assert.equal(h.dialog.children[0].attributes.get('style'), 'opacity: 1'); assert.equal(arrived, 0);
    h.step(); assert.equal(arrived, 1); assert.equal(h.dialog.removed, true); assert.equal(h.frames.size, 0);
});

test('preference changes while hidden or blurred do not advance the trip or defeat cancellation', async t => {
    const h = flightBrowser(t); let canceled = 0;
    const cancel = runGuairaFlight({ from: 'serra', to: 'guaira', onArrive: () => assert.fail('no early arrival'), onCancel: () => { canceled++; } });
    await h.ready(); for (let i = 0; i < 30; i++) h.step();
    const progress = h.poses.at(-1)!.progress;
    h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')); h.motion.matches = true;
    near(h.step(5000).progress, progress);
    h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange'));
    h.window.dispatchEvent(new Event('blur')); h.motion.matches = false; near(h.step(5000).progress, progress);
    h.window.dispatchEvent(new Event('focus')); near(h.step(0).progress, progress);
    cancel(); h.motion.matches = true; cancel();
    assert.equal(canceled, 1); assert.equal(h.frames.size, 0); assert.equal(h.dialog.removed, true);
});

for (const reduced of [false, true]) test(`unchanged ${reduced ? 'reduced' : 'ordinary'} flight retains its duration and one arrival`, async t => {
    const h = flightBrowser(t, reduced); let arrived = 0;
    runGuairaFlight({ from: 'factory', to: 'guaira', onArrive: () => { arrived++; } }); await h.ready();
    const duration = reduced ? AIRCRAFT_REDUCED_DURATION : AIRCRAFT_TRAVEL_DURATION;
    for (let i = 0; i < Math.round(duration * 20) - 1; i++) h.step();
    assert.equal(arrived, 0); h.step(50); if (!arrived) h.step(.001);
    assert.equal(arrived, 1); assert.equal(h.frames.size, 0);
});
