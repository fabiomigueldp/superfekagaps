import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { Renderer } from '../src/engine/Renderer';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

async function fixture(t: TestContext) {
    const renderers: Renderer[] = [];
    // Dispose while the fixture's globals still own the browser boundaries.
    t.after(() => { for (const renderer of renderers) renderer.dispose(); });
    const h = sceneLifecycleBrowser(t);
    const { Renderer } = await import('../src/engine/Renderer');
    const listeners = h.listenerCount();
    return { ...h, listeners, mount() {
        const renderer = new Renderer(h.canvas as unknown as HTMLCanvasElement);
        renderers.push(renderer); return renderer;
    } };
}

function dimensions(h: Awaited<ReturnType<typeof fixture>>) {
    return [h.canvas.style.width, h.canvas.style.height, h.canvas.width, h.canvas.height];
}

test('normal renderer mounts and resizes at integer scale, high DPI and below native size', async t => {
    const h = await fixture(t); h.mount();
    assert.deepEqual(dimensions(h), ['640px', '360px', 640, 360]);
    Object.assign(h.window, { innerWidth: 1000, innerHeight: 700, devicePixelRatio: 2 });
    h.window.dispatch('resize');
    assert.deepEqual(dimensions(h), ['960px', '540px', 1920, 1080]);
    Object.assign(h.window, { innerWidth: 160, innerHeight: 200, devicePixelRatio: 1 });
    h.window.dispatch('resize');
    assert.deepEqual(dimensions(h), ['160px', '90px', 320, 180]);
    assert.equal(h.canvas.context.imageSmoothingEnabled, false);
});

for (const mode of ['native', 'embedded'] as const)
test(`${mode} fullscreen fills fractional space and returns to normal scaling`, async t => {
    const h = await fixture(t);
    Object.assign(h.window, { innerWidth: 1000, innerHeight: 700 });
    if (mode === 'native') h.document.fullscreenElement = h.canvas;
    else h.document.documentElement.dataset.embeddedFullscreen = 'true';
    h.mount();
    assert.deepEqual(dimensions(h), ['1000px', '562.5px', 960, 540]);
    Object.assign(h.window, { innerWidth: 1200, innerHeight: 720 });
    h.window.dispatch('resize');
    assert.deepEqual(dimensions(h), ['1200px', '675px', 1280, 720]);
    if (mode === 'native') h.document.fullscreenElement = null;
    else h.document.documentElement.dataset.embeddedFullscreen = 'false';
    h.window.dispatch('resize');
    assert.deepEqual(dimensions(h), ['960px', '540px', 960, 540]);
});

test('renderer disposal removes its resize listener and ignores a previously captured callback', async t => {
    const h = await fixture(t), renderer = h.mount(), before = dimensions(h);
    assert.equal(h.listenerCount(), h.listeners + 1);
    const listener = h.window.listeners.find(entry => entry.type === 'resize')!;
    renderer.dispose(); renderer.dispose();
    assert.equal(h.listenerCount(), h.listeners);
    assert.equal(h.window.renderer, undefined);
    assert.equal(h.canvas.parent, h.body, 'the host retains its visible canvas');
    Object.assign(h.window, { innerWidth: 160, innerHeight: 200 });
    h.window.dispatch('resize');
    if (typeof listener.callback === 'function') listener.callback(new Event('resize'));
    else listener.callback.handleEvent(new Event('resize'));
    assert.deepEqual(dimensions(h), before);
    assert.equal(h.frames.size, 0);
});
