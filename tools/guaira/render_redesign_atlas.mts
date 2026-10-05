/** Actual WorldMapView/WorldMapHud Canvas surfaces, composited offline.
 * The DOM boundary supplies declared viewport/inset fixtures, not browser layout.
 * node --import tsx tools/guaira/render_redesign_atlas.mts OUTPUT REPOSITORY
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const repo = resolve(process.argv[3] ?? '.'), out = resolve(process.argv[2] ?? '/tmp/guaira-atlas-native');
const { createCanvas, Image } = createRequire(import.meta.url)(process.env.WATER_CANVAS_MODULE ?? '@napi-rs/canvas');
const { LifecycleElement, sceneLifecycleBrowser } = await import(`${repo}/tests/helpers/sceneLifecycleHarness.ts`);
const { WorldMapView } = await import(`${repo}/src/adventure/WorldMapView.ts`);
const { freshSave } = await import(`${repo}/src/adventure/progress.ts`);
const { STAGES } = await import(`${repo}/src/adventure/campaign.ts`);
const { campaignAircraftRoute, campaignAircraftScale } = await import(`${repo}/src/adventure/WorldAircraftTerminalRoute.ts`);
const { sampleAircraftTravel } = await import(`${repo}/src/adventure/WorldAircraftModel.ts`);
const { sampleAircraftCamera } = await import(`${repo}/src/adventure/WorldAircraftCamera.ts`);
const { paintAircraftTravel } = await import(`${repo}/src/adventure/WorldAircraftArt.ts`);
const { paintCampaignRegion, GUAIRA_CAMPAIGN_ART } = await import(`${repo}/src/adventure/GuairaCampaignArt.ts`);
const { localToAtlas } = await import(`${repo}/src/adventure/WorldAtlasModel.ts`);
const { paintFlightLandscape, paintFlightAtmosphere } = await import(`${repo}/src/adventure/WorldFlightScenery.ts`);
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
const readImage = async path => { const image = new LocalImage(); await new Promise((done, fail) => { image.onload = done; image.onerror = fail; image.src = path; }); return image; };
mkdirSync(out, { recursive: true });
const records = [];
for (const [width, height, top, bottom] of [[1280, 800, 100, 132], [390, 640, 104, 152], [640, 360, 64, 84]]) {
    const cleanups = [], h = sceneLifecycleBrowser({ after: f => cleanups.push(f) }); h.media.matches = true;
    globalThis.Image = LocalImage;
    globalThis.fetch = async path => { try { const bytes = readFileSync(`${repo}/public/${String(path).replace(/^\.?\//, '')}`); return { ok: true, json: async () => JSON.parse(bytes.toString()) }; } catch { return { ok: false, json: async () => null }; } };
    LifecycleElement.prototype.getBoundingClientRect = function () {
        const className = this.className;
        let left = 0, y = 0, w = width, hh = height;
        if (className.includes('world-map-header') || className.includes('world-map-tools')) { left = 12; y = 10; w = width - 24; hh = top - 24; }
        if (className.includes('world-map-footer')) { left = 12; y = height - bottom + 12; w = width - 24; hh = bottom - 24; }
        return { x: left, y, left, top: y, width: w, height: hh, right: left + w, bottom: y + hh };
    };
    const view = new WorldMapView(h.canvas, { guaira() {}, select() {}, enter() {}, exit() {}, unlockAudio() {} });
    const save = freshSave(); save.selected = '3-5'; save.completed = STAGES.map(s => s.id); save.legacySerraAccess = true;
    save.guaira.completed = ['guaira-travessia', 'guaira-patio-comportas', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'];
    view.overview = true; view.render(14, save, 0, '');
    const deadline = Date.now() + 15000; let frame = 0;
    while (true) {
        await new Promise(done => setTimeout(done, 10)); view.render(14, save, ++frame * 16, '');
        if (view.activeArt.size === 6 && view.campaignImages.size === 3 && pending.size === 0 && [...view.activeArt.values()].every(a => a.status === 'ready')) break;
        if (Date.now() > deadline) throw Error('Native asset decoding did not settle: ' + JSON.stringify([...view.activeArt].map(([id, a]) => [id, a.status])));
    }
    assert.equal(view.activeArt.size, 6); assert.equal(view.campaignImages.size, 3);
    assert.ok([...view.activeArt.values()].every(a => a.status === 'ready'));
    const output = createCanvas(width, height), c = output.getContext('2d'); c.drawImage(surfaces.get(view.canvas), 0, 0, width, height);
    const labels = [];
    for (const button of [...view.hud.overviewButtons, view.hud.guairaOverview]) {
        if (button.hidden) continue;
        const match = button.style.transform?.match(/translate\((-?\d+)px, (-?\d+)px\)/); assert.ok(match);
        const bitmap = button.children.find(child => child.tagName === 'CANVAS'), native = surfaces.get(bitmap); assert.ok(native);
        const [x, y] = match.slice(1).map(Number), w = view.hud.compactOverview && button !== view.hud.guairaOverview ? 28 : 128, hh = view.hud.compactOverview && button !== view.hud.guairaOverview ? 29 : 44;
        c.drawImage(native, x - w / 2, y - hh, w, hh);
        labels.push({ text: button.getAttribute('aria-label'), x, y, width: w, height: hh });
    }
    writeFileSync(`${out}/atlas-${width}x${height}.png`, output.toBuffer('image/png'));
    records.push({ width, height, declaredInsets: { top, bottom }, camera: view.camera, loadedWorlds: view.activeArt.size, labels, compactSelectorFallback: view.hud.overviewFallback, actualNativePainters: true });
    view.dispose(); for (const restore of cleanups) restore();
}
// Real flight camera/landscape/aircraft painter at the Guaíra departure terminal.
const route = campaignAircraftRoute('guaira', 'serra'), assets = { image: (await readImage('/assets/world/map/journey-aircraft.webp')).native, metadata: JSON.parse(readFileSync(`${repo}/public/assets/world/map/journey-aircraft.meta.json`, 'utf8')) };
const images = new Map(); for (const region of ['guaira', 'serra']) images.set(region, (await readImage(`/assets/world/map/guaira-campaign/${region}.webp`)).native);
for (const elapsed of [0, .9, 1.8]) {
    const width = 960, height = 540, canvas = createCanvas(width, height), c = canvas.getContext('2d');
    const pose = sampleAircraftTravel(route, elapsed, false); pose.scale = campaignAircraftScale('guaira', 'serra', pose.progress);
    const camera = sampleAircraftCamera(route, elapsed, { width, height, reducedMotion: false,
        departureFocus: localToAtlas({ x: .5, y: .5 }, GUAIRA_CAMPAIGN_ART.guaira.placement), arrivalFocus: localToAtlas({ x: .5, y: .5 }, GUAIRA_CAMPAIGN_ART.serra.placement) });
    const sea = c.createLinearGradient(0, 0, 0, height); sea.addColorStop(0, '#477f91'); sea.addColorStop(1, '#75aeb1'); c.fillStyle = sea; c.fillRect(0, 0, width, height);
    paintFlightLandscape(c, camera); for (const region of ['guaira', 'serra']) paintCampaignRegion(c, camera, region, images.get(region), true);
    paintFlightAtmosphere(c, camera, pose); paintAircraftTravel(c, camera, pose, assets, elapsed);
    writeFileSync(`${out}/boarding-${elapsed.toFixed(1)}.png`, canvas.toBuffer('image/png'));
    records.push({ elapsed, pose: pose.stage, camera, actualFlightPainters: true });
}
writeFileSync(`${out}/atlas-report.json`, JSON.stringify({ method: 'Actual WorldMapView atlas assembly/camera and WorldMapHud physical sign canvases with declared viewport/inset fixtures; exact native flight painters. No browser, DOM-layout or device QA.', records }, null, 2));
console.log(JSON.stringify({ out, records: records.length, pendingImages: pending.size }));
