import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUAIRA_DESTINATIONS, GuairaMapModel, guairaArrivalFromSearch, guairaReturnHref, parseGuairaMetadata } from '../src/adventure/experimental/guaira/GuairaMapModel';
import { GUAIRA_FEKA_PIXEL_WIDTH, guairaCamera, guairaScreenPoint } from '../src/adventure/experimental/guaira/GuairaMapArt';
import { loadGuairaScene } from '../src/adventure/experimental/guaira/GuairaMapLoader';
const raw = JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8'));
const metadata = parseGuairaMetadata(raw)!;
const finish = (model: GuairaMapModel) => { for (let i = 0; i < 2000 && model.moving; i++) model.tick(1 / 60); assert.equal(model.moving, false); };

test('Guaíra accepts the exact independent scene contract and rejects wrong assets or disconnected roads', () => {
    assert.ok(metadata); assert.equal(metadata.size.width, 1920);
    const mutations = [
        (v: typeof raw) => { v.worldId = '7'; },
        (v: typeof raw) => { v.campaignIntegrated = true; },
        (v: typeof raw) => { v.size.width = 960; },
        (v: typeof raw) => { v.routes['1:2'][0].x += .02; },
        (v: typeof raw) => { v.nodes['guaira-3'].x = NaN; },
        (v: typeof raw) => { v.artBounds.left = v.artBounds.right; },
    ];
    for (const mutate of mutations) { const copy = structuredClone(raw); mutate(copy); assert.equal(parseGuairaMetadata(copy), null); }
    const copy = structuredClone(raw); copy.routes['0:4'] = 'not a path'; copy.nodes['fake-stage'] = {};
    assert.deepEqual(parseGuairaMetadata(copy), metadata, 'unknown data cannot become a playable destination');
});
test('only two explicit destinations enter; neutral rice return must select and arrive first', () => {
    assert.deepEqual(Object.keys(GUAIRA_DESTINATIONS), ['town', 'curral']);
    const model = new GuairaMapModel(metadata, 'rice');
    assert.deepEqual(model.point, metadata.nodes['guaira-3']);
    assert.equal(model.selected, null); assert.equal(model.moving, false); assert.equal(model.enterHref(), null);
    model.select('curral'); assert.equal(model.enterHref(), null);
    assert.ok(model.distance > model.length / 2);
    finish(model); assert.deepEqual(model.point, metadata.nodes['guaira-4']);
    assert.equal(model.enterHref(), './guaira-lab.html');
    model.select('town'); assert.equal(model.enterHref(), null); finish(model);
    assert.equal(model.enterHref(), './guaira-travessia.html');
});
test('the concatenated road uses only authored points through town, dry district, rice and curral', () => {
    const model = new GuairaMapModel(metadata);
    const expected = ['0:1', '1:2', '2:3'].flatMap((key, i) => metadata.routes[key].slice(i ? 1 : 0));
    assert.deepEqual(model.path, expected);
    assert.equal(model.path.some(p => p.x === metadata.nodes['guaira-5'].x && p.y === metadata.nodes['guaira-5'].y), false);
    model.path.forEach((point, i) => assert.deepEqual(model.pointAt(model.distances[i]), point));
});
test('repeated taps and rapid reversal preserve the current foot position on the same road', () => {
    const model = new GuairaMapModel(metadata); model.select('curral');
    for (let i = 0; i < 130; i++) model.tick(1 / 60);
    const distance = model.distance, point = model.point;
    for (let i = 0; i < 50; i++) model.select(i % 2 ? 'town' : 'curral');
    assert.equal(model.distance, distance); assert.deepEqual(model.point, point);
    model.tick(1 / 60); assert.ok(model.distance < distance); assert.equal(model.facingLeft, true);
    model.select('curral'); finish(model); assert.equal(model.enterHref(), './guaira-lab.html');
});
test('skip, dynamic reduced motion and hidden-tab deltas do not create overshoot or stale entry', () => {
    const model = new GuairaMapModel(metadata); model.select('curral'); model.tick(10);
    assert.equal(model.distance, 8.5, 'return from suspension is capped to 50 ms');
    model.tick(NaN); model.tick(-1); assert.equal(model.distance, 8.5);
    model.skip(); assert.equal(model.distance, model.length); assert.equal(model.canEnter, true);
    model.select('town'); model.setReducedMotion(true); assert.equal(model.distance, 0);
    model.select('curral'); assert.equal(model.distance, model.length); assert.equal(model.moving, false);
    model.setReducedMotion(false); model.select('town'); assert.equal(model.moving, true);
});
test('leaving while moving prevents subsequent animation, skip, selection or entry', () => {
    const model = new GuairaMapModel(metadata); model.select('curral'); model.tick(.03);
    const point = model.point; model.close(); model.tick(1); model.skip(); model.select('town');
    assert.deepEqual(model.point, point); assert.equal(model.enterHref(), null); assert.equal(model.moving, false);
});
test('return URLs are limited to town/rice/corral and never treated as arbitrary destinations', () => {
    for (const at of ['town', 'rice', 'corral'] as const) {
        assert.equal(guairaArrivalFromSearch(`?at=${at}`), at); assert.equal(guairaReturnHref(at), `./guaira.html?at=${at}`);
    }
    for (const search of ['', '?at=7', '?at=house', '?at=https://example.com', '?at=curral']) assert.equal(guairaArrivalFromSearch(search), 'town');
    assert.deepEqual(new GuairaMapModel(metadata, 'corral').point, metadata.nodes['guaira-4']);
});
test('all walking-frame bounds stay inside the directed viewport for sampled phone and desktop routes', () => {
    // Every original walk frame lives inside the same authored 16×26 grid.
    for (const [width, height] of [[472, 141], [320, 200], [390, 420], [472, 150], [760, 250], [1180, 550], [1920, 850]]) {
        const model = new GuairaMapModel(metadata);
        for (let n = 0; n <= 200; n++) {
            model.distance = model.length * n / 200;
            const camera = guairaCamera(metadata, width, height, model.point, false), p = guairaScreenPoint(model.point, camera);
            const scale = camera.imageWidth * GUAIRA_FEKA_PIXEL_WIDTH;
            assert.ok(p.x - 8 * scale >= 0 && p.x + 8 * scale <= width, `${width}×${height}, sample ${n}: horizontal sprite clearance`);
            assert.ok(p.y - 26 * scale >= 0 && p.y <= height, `${width}×${height}, sample ${n}: vertical sprite clearance`);
        }
    }
});
test('asset error/invalid metadata settles immediately; late image resolution cannot revive it', async () => {
    const signal = new AbortController().signal;
    let finishImage!: (value: string) => void;
    const pendingImage = new Promise<string>(resolve => { finishImage = resolve; });
    const loading = loadGuairaScene(async () => { throw new Error('HTTP 404'); }, () => pendingImage, signal);
    await assert.rejects(loading, /HTTP 404/); finishImage('late image');
    await assert.rejects(loadGuairaScene(async () => ({}), async () => 'image', signal), /Invalid/);
});
test('leaving during loading aborts requests; late completion has no successful scene result', async () => {
    const parent = new AbortController(); let child: AbortSignal | null = null; let complete!: (v: unknown) => void;
    const pending = new Promise(resolve => { complete = resolve; });
    const loading = loadGuairaScene(signal => { child = signal; return pending; }, async () => 'image', parent.signal);
    parent.abort(); await assert.rejects(loading, /closed/); assert.equal((child as AbortSignal | null)?.aborted, true);
    complete(raw);
});
test('invalid metadata rejects even while image decode hangs, and a healthy scene resolves both parts', async () => {
    const signal = new AbortController().signal;
    await assert.rejects(loadGuairaScene(async () => ({}), () => new Promise(() => {}), signal), /Invalid/);
    assert.deepEqual(await loadGuairaScene(async () => raw, async () => 'image', signal), { metadata, image: 'image' });
});
test('slow successful loading remains pending until completion without an arbitrary failure cutoff', async () => {
    const signal = new AbortController().signal;
    let complete!: (value: string) => void, settled = false;
    const loading = loadGuairaScene(async () => raw, () => new Promise<string>(resolve => { complete = resolve; }), signal);
    void loading.then(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 25)); assert.equal(settled, false);
    complete('late but valid image'); assert.equal((await loading).image, 'late but valid image');
});
