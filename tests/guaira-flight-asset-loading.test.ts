import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import metadata from '../public/assets/world/map/journey-aircraft.meta.json';
import { runGuairaFlight, type GuairaAirTerminal } from '../src/adventure/WorldGuairaFlight';
import { campaignMapAsset } from '../src/adventure/GuairaCampaignArt';

function flight(t: TestContext) {
    const requested: string[] = [], drawn: string[] = [], failures = new Set<string>(), held = new Set<string>();
    const images: MockImage[] = [];
    const cleanups: (() => void)[] = [], restorations: (() => void)[] = [];
    t.after(() => { for (const cleanup of cleanups) cleanup(); for (const restore of restorations) restore(); });
    const context = new Proxy({} as CanvasRenderingContext2D, {
        get: (target, key: keyof CanvasRenderingContext2D) => {
            if (key in target) return target[key];
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            if (key === 'drawImage') return (image: MockImage) => { if (image.path) drawn.push(image.path); };
            return () => {};
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
    class MockImage {
        onload: (() => void) | null = null; onerror: (() => void) | null = null;
        naturalWidth = metadata.atlas.width; naturalHeight = metadata.atlas.height; path = '';
        constructor() { images.push(this); }
        set src(path: string) {
            this.path = path; if (!path) return;
            requested.push(path);
            if (!held.has(path)) queueMicrotask(() => failures.has(path) ? this.onerror?.() : this.onload?.());
        }
    }
    const document = Object.assign(new EventTarget(), { body: new Element(), hidden: false, activeElement: null,
        createElement: () => new Element() });
    const window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }), setTimeout, clearTimeout });
    let serial = 0, time = 0;
    const frames = new Map<number, FrameRequestCallback>();
    for (const [key, value] of Object.entries({ document, window, Image: MockImage, HTMLElement: Element,
        performance: { now: () => time }, fetch: async () => ({ ok: true, json: async () => metadata }),
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); } })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        restorations.push(() => { if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key); });
    }
    return { requested, drawn, failures, held, images, frames,
        disposeWith: (cleanup: () => void) => { cleanups.push(cleanup); },
        ready: async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); },
        step() {
            assert.equal(frames.size, 1);
            const [id, callback] = [...frames][0]; frames.delete(id); drawn.length = 0; time += 50; callback(time);
        },
        get dialog() { return document.body.children.at(-1)!; },
        get skip() { return this.dialog.children[2].children[0]; },
        get retry() { return this.dialog.children[2].children[2]; },
    };
}

for (const [from, to] of [
    ['factory', 'guaira'], ['guaira', 'factory'], ['guaira', 'serra'], ['serra', 'guaira'],
] as [GuairaAirTerminal, GuairaAirTerminal][]) test(`${from} to ${to} loads only the terrain painted by its ready flight`, async t => {
    const h = flight(t), cancel = runGuairaFlight({ from, to, onArrive: () => assert.fail('no automatic arrival') });
    h.disposeWith(cancel); await h.ready();
    assert.equal(h.dialog.attributes.get('data-ready'), 'true');
    const region = from === 'factory' || to === 'factory' ? 'fabrica' : 'serra';
    const expected = ['journey-aircraft.webp', 'guaira-campaign/guaira.webp', `guaira-campaign/${region}.webp`];
    if (region === 'fabrica') expected.push('fabrica-diorama.webp');
    assert.deepEqual([...h.requested].sort(), expected.map(file => campaignMapAsset(file)).sort());
    h.step();
    assert.ok(h.drawn.includes(campaignMapAsset(`guaira-campaign/${from === 'factory' ? 'fabrica' : from}.webp`)));
    assert.equal(h.drawn.includes(campaignMapAsset('serra-diorama.webp')), false);
    if (from === 'factory') assert.ok(h.drawn.includes(campaignMapAsset('fabrica-diorama.webp')));
});

for (const [to, missing] of [
    ['factory', 'fabrica-diorama.webp'], ['serra', 'guaira-campaign/serra.webp'],
] as const) test(`${missing} remains required; a retry can arrive exactly once`, async t => {
    const h = flight(t); h.failures.add(campaignMapAsset(missing)); let arrivals = 0;
    const cancel = runGuairaFlight({ from: 'guaira', to, onArrive: () => { arrivals++; } }); h.disposeWith(cancel);
    await h.ready();
    assert.equal(h.dialog.attributes.get('data-ready'), undefined);
    assert.equal(h.skip.disabled, true); assert.equal(h.retry.hidden, false); assert.equal(h.frames.size, 0);
    h.skip.click(); assert.equal(arrivals, 0);
    h.failures.clear(); h.retry.click(); await h.ready();
    assert.equal(h.dialog.attributes.get('data-ready'), 'true'); assert.equal(h.skip.disabled, false);
    h.skip.click(); h.skip.click();
    assert.equal(arrivals, 1); assert.equal(h.frames.size, 0); assert.equal(h.dialog.removed, true);
});

test('canceling a pending Serra overlay rejects late completion without requesting a hidden base', async t => {
    const h = flight(t), path = campaignMapAsset('guaira-campaign/serra.webp'); h.held.add(path); let cancels = 0;
    const cancel = runGuairaFlight({ from: 'guaira', to: 'serra', onArrive: () => assert.fail('canceled flight arrived'), onCancel: () => { cancels++; } });
    h.disposeWith(cancel); await h.ready();
    assert.equal(h.skip.disabled, true); cancel(); cancel();
    h.images.find(image => image.path === path)!.onload?.(); await h.ready();
    assert.equal(h.dialog.attributes.get('data-ready'), undefined); assert.equal(h.dialog.removed, true);
    assert.equal(cancels, 1); assert.equal(h.frames.size, 0);
    assert.equal(h.requested.includes(campaignMapAsset('serra-diorama.webp')), false);
});
