/** Native production map and HUD bitmaps; declared CSS-layout fixtures only.
 * Exercises the real map HUD key handlers, not a mock navigation model.
 * No browser, real DOM-layout or device QA. Optional CANVAS_MODULE overrides native Canvas.
 * node --import tsx tools/prove_compact_atlas_navigation.mts OUTPUT REPOSITORY
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const repo = resolve(process.argv[3] ?? '.'), out = resolve(process.argv[2] ?? '/tmp/compact-atlas-native');
const { createCanvas, Image } = createRequire(import.meta.url)(process.env.CANVAS_MODULE ?? '@napi-rs/canvas');
const { LifecycleElement, sceneLifecycleBrowser } = await import(`${repo}/tests/helpers/sceneLifecycleHarness.ts`);
const { WorldMapView } = await import(`${repo}/src/adventure/WorldMapView.ts`);
const { freshSave } = await import(`${repo}/src/adventure/progress.ts`);
const { STAGES } = await import(`${repo}/src/adventure/campaign.ts`);
const surfaces = new WeakMap(), contexts = new WeakMap();
LifecycleElement.prototype.getContext = function () {
    if (contexts.has(this)) return contexts.get(this);
    const native = createCanvas(Math.max(1, this.width), Math.max(1, this.height)); surfaces.set(this, native);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, { configurable: true, get: () => native[key], set: value => { native[key] = value; } });
    const c = native.getContext('2d'), proxy = new Proxy(c, {
        get: (target, key) => key === 'drawImage' ? (image, ...args) => target.drawImage(image.native ?? surfaces.get(image) ?? image, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
    }); contexts.set(this, proxy); return proxy;
};
const pending = new Set();
class LocalImage {
    native = new Image(); onload = null; onerror = null; decoding = ''; path = '';
    get naturalWidth() { return this.native.width; } get naturalHeight() { return this.native.height; }
    get width() { return this.native.width; } get height() { return this.native.height; }
    set src(path) {
        this.path = path; if (!path) return;
        const token = {}; pending.add(token);
        this.native.onload = () => { pending.delete(token); this.onload?.(); };
        this.native.onerror = error => { pending.delete(token); this.onerror?.(error); };
        try { this.native.src = readFileSync(`${repo}/public/${path.replace(/^\.?\//, '')}`); }
        catch (error) { pending.delete(token); queueMicrotask(() => this.onerror?.(error)); }
    }
    get src() { return this.path; }
}
mkdirSync(out, { recursive: true });
const records = [];
for (const [width, height, top, bottom] of [[390, 640, 104, 152], [640, 360, 64, 84]]) {
    const cleanups = [], h = sceneLifecycleBrowser({ after: f => cleanups.push(f) }); h.media.matches = true;
    LifecycleElement.prototype.focus = function () { document.activeElement = this; };
    LifecycleElement.prototype.scrollIntoView = function () {};
    globalThis.Image = LocalImage;
    globalThis.fetch = async path => { try { const bytes = readFileSync(`${repo}/public/${String(path).replace(/^\.?\//, '')}`); return { ok: true, json: async () => JSON.parse(bytes.toString()) }; } catch { return { ok: false, json: async () => null }; } };
    LifecycleElement.prototype.getBoundingClientRect = function () {
        const className = this.className;
        let left = 0, y = 0, w = width, hh = height;
        if (className.includes('world-map-header') || className.includes('world-map-tools')) { left = 12; y = 10; w = width - 24; hh = top - 24; }
        if (className.includes('world-map-footer')) { left = 12; y = height - bottom + 12; w = width - 24; hh = bottom - 24; }
        return { x: left, y, left, top: y, width: w, height: hh, right: left + w, bottom: y + hh };
    };
    const calls = [];
    const view = new WorldMapView(h.canvas, { guaira() { calls.push('guaira'); }, select(index) { calls.push(index); }, enter() { calls.push('enter'); }, exit() { calls.push('exit'); }, unlockAudio() {} });
    const save = freshSave(); save.selected = '3-5'; save.completed = STAGES.map(s => s.id); save.legacySerraAccess = true;
    save.guaira.completed = ['guaira-travessia', 'guaira-patio-comportas', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'];
    view.render(14, save, 0, '');
    const defaultOverview = view.overview;
    const toggle = view.hud.tools.children.find(button => button.className.includes('world-map-overview'));
    toggle.click(); view.render(14, save, 16, '');
    const deadline = Date.now() + 15000; let frame = 0;
    while (true) {
        await new Promise(done => setTimeout(done, 10)); view.render(14, save, ++frame * 16, '');
        if (view.activeArt.size === 6 && view.campaignImages.size === 3 && pending.size === 0 && [...view.activeArt.values()].every(a => a.status === 'ready')) break;
        if (Date.now() > deadline) throw Error('Native asset decoding did not settle: ' + JSON.stringify([...view.activeArt].map(([id, a]) => [id, a.status])));
    }
    assert.equal(view.activeArt.size, 6); assert.equal(view.campaignImages.size, 3);
    assert.ok([...view.activeArt.values()].every(a => a.status === 'ready'));
    const cameraBeforeKey = structuredClone(view.camera);
    view.root.focus();
    const event = view.root.dispatch('keydown', { key: 'ArrowRight', target: view.root, repeat: false });
    view.render(14, save, ++frame * 16, '');
    assert.deepEqual(view.camera, cameraBeforeKey, 'Opening choices cannot move the camera.');
    assert.equal(calls.length, 0, 'Keyboard focus must never select or enter a region.');
    const output = createCanvas(width, height), c = output.getContext('2d');
    c.drawImage(surfaces.get(view.canvas), 0, 0, width, height);
    const descendants = element => [element, ...element.children.flatMap(descendants)];
    const find = name => descendants(view.root).find(element => element.className.split(' ').includes(name));
    const textAt = (text, x, y, size = 12, color = '#f5efd3') => { c.font = `${size}px sans-serif`; c.fillStyle = color; c.fillText(text, x, y); };
    const bitmapAt = (element, x, y, maxWidth = Infinity) => {
        const bitmap = descendants(element).find(child => child.tagName === 'CANVAS'), native = bitmap && surfaces.get(bitmap);
        if (!native) return;
        const scale = Math.min(.5, maxWidth / native.width); c.drawImage(native, x, y, native.width * scale, native.height * scale);
    };
    // Declared fixed DOM layout: the bitmaps/text/visibility/focus are production outputs.
    // This compositing is evidence of the input state, not a CSS rendering claim.
    c.fillStyle = '#191f35ed'; c.fillRect(12, 10, width - 24, top - 24);
    bitmapAt(find('world-map-title'), 22, 16, width - 44);
    let x = 12; const toolY = height < 480 ? 36 : 42;
    for (const button of view.hud.tools.children) {
        const w = button === view.hud.regionButton ? 146 : button === toggle ? 66 : 44;
        c.fillStyle = '#191f35'; c.fillRect(x, toolY, w, 44); c.strokeStyle = '#e9ad4c'; c.strokeRect(x, toolY, w, 44);
        bitmapAt(button, x + 10, toolY + 14, w - 20); x += w + 6;
    }
    c.fillStyle = '#191f35f2'; c.fillRect(12, height - bottom + 12, Math.min(470, width - 24), bottom - 24);
    bitmapAt(find('world-map-stage-title'), 24, height - bottom + 23, width - 50);
    for (const [index, name] of ['world-map-status', 'world-map-location', 'world-map-hint'].entries()) {
        const text = find(name).textContent;
        const words = text.split(' '); let line = '', y = height - bottom + 61 + index * 20;
        for (const word of words) {
            if (c.measureText(line + word).width > width - 56 && line) { textAt(line, 24, y); line = ''; y += 15; }
            line += word + ' ';
        }
        textAt(line, 24, y);
    }
    const rows = view.hud.regionMenu.children.filter(element => element.className.split(' ').includes('world-map-region'));
    if (!view.hud.regionMenu.hidden) {
        const menuW = Math.min(300, width - 24), left = width - 12 - menuW, menuTop = height < 480 ? 56 : 104;
        const panelH = Math.min(height - menuTop - 14, 72 + rows.length * 48), bodyH = panelH - 72;
        const focusedIndex = rows.indexOf(document.activeElement);
        const offset = Math.max(0, (focusedIndex + 1) * 48 - bodyH);
        c.fillStyle = '#191f35'; c.fillRect(left, menuTop, menuW, panelH); c.strokeStyle = '#e9ad4c'; c.strokeRect(left, menuTop, menuW, panelH);
        bitmapAt(find('world-map-region-title'), left + 14, menuTop + 18, menuW - 70);
        bitmapAt(find('world-map-region-close'), left + menuW - 34, menuTop + 18, 20);
        textAt(find('world-map-region-progress').textContent, left + 12, menuTop + 57, 11, '#a7b4bb');
        c.save(); c.beginPath(); c.rect(left + 3, menuTop + 65, menuW - 6, bodyH + 4); c.clip();
        rows.forEach((button, index) => {
            const y = menuTop + 68 + index * 48 - offset;
            c.fillStyle = button === document.activeElement ? '#303650' : '#191f35'; c.fillRect(left + 8, y, menuW - 16, 48);
            c.strokeStyle = '#36566a'; c.beginPath(); c.moveTo(left + 8, y); c.lineTo(left + menuW - 8, y); c.stroke();
            bitmapAt(button, left + 14, y + 10, menuW - 32);
            textAt(button.children[1].textContent, left + 14, y + 37, 11, '#a7b4bb');
            if (button === document.activeElement) { c.strokeStyle = '#fff9e6'; c.lineWidth = 3; c.strokeRect(left + 7, y + 2, menuW - 14, 44); }
        }); c.restore();
    }
    writeFileSync(`${out}/arrow-${width}x${height}.png`, output.toBuffer('image/png'));
    records.push({ width, height, declaredInsets: { top, bottom }, defaultOverview, camera: view.camera,
        canvas: { width: view.canvas.width, height: view.canvas.height }, loadedWorlds: view.activeArt.size,
        physicalLabelsVisible: view.hud.overviewButtons.filter(button => !button.hidden).length,
        compactSelectorFallback: view.hud.overviewFallback, keyPrevented: event.defaultPrevented,
        drawerVisible: !view.hud.regionMenu.hidden, focus: document.activeElement?.getAttribute('data-region-key') ?? document.activeElement?.getAttribute('aria-label'),
        calls, actualNativePainters: true });
    view.dispose(); for (const restore of cleanups) restore();
}
writeFileSync(`${out}/report.json`, JSON.stringify({ method: 'Actual WorldMapView render/measure and WorldMapHud key handlers/bitmap surfaces; declared CSS bounds and offline DOM compositing. No browser, real DOM-layout or device QA.', records }, null, 2));
console.log(JSON.stringify({ out, records, pendingImages: pending.size }));
