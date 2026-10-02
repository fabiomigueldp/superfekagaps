import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUAIRA_DESTINATIONS, GuairaMapModel, guairaArrivalFromSearch, guairaReturnContextFromSearch, guairaReturnHref, parseGuairaMetadata } from '../src/adventure/experimental/guaira/GuairaMapModel';
import { guairaMapPresentation } from '../src/adventure/experimental/guaira/GuairaMapPresentation';
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
        (v: typeof raw) => { v.nodes = []; },
        (v: typeof raw) => { v.routes = []; },
        (v: typeof raw) => { v.artBounds = []; },
        (v: typeof raw) => { v.routes['3:4'] = { length: 2 }; },
        (v: typeof raw) => { v.routes['3:4'][1].x = Infinity; },
        (v: typeof raw) => { v.routes['3:4'].at(-1).x += .01; },
    ];
    for (const mutate of mutations) { const copy = structuredClone(raw); mutate(copy); assert.equal(parseGuairaMetadata(copy), null); }
    const copy = structuredClone(raw); copy.routes['0:4'] = 'not a path'; copy.nodes['fake-stage'] = {};
    assert.deepEqual(parseGuairaMetadata(copy), metadata, 'unknown data cannot become a playable destination');
});
test('three explicit experiences enter; neutral rice return must select and arrive first', () => {
    assert.deepEqual(Object.keys(GUAIRA_DESTINATIONS), ['town', 'curral', 'subida']);
    const model = new GuairaMapModel(metadata, 'rice');
    assert.deepEqual(model.point, metadata.nodes['guaira-3']);
    assert.equal(model.selected, null); assert.equal(model.moving, false); assert.equal(model.enterHref(), null);
    model.select('curral'); assert.equal(model.enterHref(), null);
    assert.ok(model.distance > model.arrivalDistances.town && model.distance < model.arrivalDistances.corral);
    finish(model); assert.deepEqual(model.point, metadata.nodes['guaira-4']);
    assert.equal(model.enterHref(), './guaira-lab.html');
    model.select('town'); assert.equal(model.enterHref(), null); finish(model);
    assert.equal(model.enterHref(), './guaira-travessia.html');
});
test('the concatenated road uses every authored point through town, district, rice, curral and house', () => {
    const model = new GuairaMapModel(metadata);
    const expected = ['0:1', '1:2', '2:3', '3:4'].flatMap((key, i) => metadata.routes[key].slice(i ? 1 : 0));
    assert.deepEqual(model.path, expected);
    assert.equal(model.path.some(p => p.x === metadata.nodes['guaira-5'].x && p.y === metadata.nodes['guaira-5'].y), true);
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
    model.skip(); assert.equal(model.distance, model.destinationDistances.curral); assert.equal(model.canEnter, true);
    model.select('town'); model.setReducedMotion(true); assert.equal(model.distance, 0);
    model.select('curral'); assert.equal(model.distance, model.destinationDistances.curral); assert.equal(model.moving, false);
    model.setReducedMotion(false); model.select('town'); assert.equal(model.moving, true);
});
test('leaving while moving prevents subsequent animation, skip, selection or entry', () => {
    const model = new GuairaMapModel(metadata); model.select('curral'); model.tick(.03);
    const point = model.point; model.close(); model.tick(1); model.skip(); model.select('town');
    assert.deepEqual(model.point, point); assert.equal(model.enterHref(), null); assert.equal(model.moving, false);
});
test('return URLs include contextual vazao and never accept arbitrary destinations', () => {
    for (const at of ['town', 'rice', 'corral', 'vazao'] as const) {
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

test('arena and ascent share the curral distance while retaining distinct actions and links', () => {
    const model = new GuairaMapModel(metadata, 'corral');
    assert.ok(model.arrivalDistances.corral < model.length, 'appending house never moves curral');
    assert.equal(model.destinationDistances.curral, model.destinationDistances.subida);
    assert.equal(model.arrival, 'corral');
    const point = model.point, distance = model.distance;
    assert.equal(model.enterHref(), './guaira-lab.html');
    model.select('subida');
    assert.equal(model.selected, 'subida'); assert.equal(model.moving, false);
    assert.deepEqual(model.point, point); assert.equal(model.distance, distance);
    assert.equal(model.enterHref(), './guaira-subida.html');
    assert.notEqual(GUAIRA_DESTINATIONS.curral.action, GUAIRA_DESTINATIONS.subida.action);
    model.select('curral'); assert.equal(model.enterHref(), './guaira-lab.html');
});
test('house arrival offers an explicit optional encounter and returns over the exact final canonical segment in reverse', () => {
    const model = new GuairaMapModel(metadata, 'vazao');
    assert.equal(model.selected, null); assert.equal(model.arrival, 'vazao');
    assert.deepEqual(model.point, metadata.nodes['guaira-5']);
    assert.equal(model.canEnterMayor, true); assert.equal(model.enterHref(), './guaira-prefeito.html'); assert.equal(model.moving, false);
    model.returnToCorral(); assert.equal(model.canEnterMayor, false); assert.equal(model.enterHref(), null);
    assert.equal(model.targetDistance, model.arrivalDistances.corral);
    const finalRoute = metadata.routes['3:4'];
    assert.deepEqual(model.path.slice(-finalRoute.length), finalRoute);
    model.tick(.05); assert.ok(model.distance < model.arrivalDistances.vazao);
    const before = model.point, distance = model.distance;
    model.select('subida'); assert.deepEqual(model.point, before); assert.equal(model.distance, distance);
    finish(model); assert.deepEqual(model.point, metadata.nodes['guaira-4']);
    assert.equal(model.arrival, 'corral'); assert.equal(model.enterHref(), './guaira-subida.html');
    model.select('town'); finish(model); assert.deepEqual(model.point, metadata.nodes['guaira-1']);
});

test('Casa action cannot survive a departure selection, reversal, skip, reduced motion or closing', () => {
    for (const selected of ['town', 'curral', 'subida'] as const) {
        const model = new GuairaMapModel(metadata, 'vazao');
        model.select(selected);
        assert.equal(model.arrival, 'vazao', 'selection precedes the first animation frame');
        assert.equal(model.canEnterMayor, false); assert.equal(model.enterHref(), null);
        model.returnToCorral(); assert.equal(model.selected, selected, 'stale contextual return cannot override the chosen departure');
        model.tick(.05); const distance = model.distance;
        model.select('town'); model.select('subida');
        assert.equal(model.distance, distance, 'changes do not teleport');
        model.skip(); assert.equal(model.enterHref(), './guaira-subida.html');
        model.select('town'); model.tick(.05); model.select('curral');
        const reversal = model.distance; model.tick(.05); assert.ok(model.distance > reversal);
        model.setReducedMotion(true); assert.equal(model.enterHref(), './guaira-lab.html');
        assert.equal(model.canEnterMayor, false);
    }
    const reduced = new GuairaMapModel(metadata, 'vazao'); reduced.setReducedMotion(true);
    assert.equal(reduced.enterHref(), './guaira-prefeito.html'); reduced.returnToCorral();
    assert.equal(reduced.moving, false); assert.equal(reduced.arrival, 'corral'); assert.equal(reduced.enterHref(), './guaira-lab.html');
    const closed = new GuairaMapModel(metadata, 'vazao'); closed.close(); closed.returnToCorral();
    assert.equal(closed.canEnterMayor, false); assert.equal(closed.canEnter, false); assert.equal(closed.enterHref(), null);
    assert.equal(closed.selected, null);
    for (const arrival of ['town', 'rice', 'corral'] as const) {
        const model = new GuairaMapModel(metadata, arrival); const before = model.selected;
        model.returnToCorral(); assert.equal(model.selected, before); assert.equal(model.canEnterMayor, false);
        assert.notEqual(model.enterHref(), './guaira-prefeito.html');
    }
});

test('visit summaries accept only exact outcome/arrival pairs and never become gameplay state', () => {
    const pairs = [['rice', 'traversal-clear'], ['corral', 'bull-clear'], ['vazao', 'ascent-clear'], ['vazao', 'mayor-clear']] as const;
    for (const [at, visit] of pairs) {
        const href = guairaReturnHref(at, visit);
        assert.equal(href, `./guaira.html?at=${at}&visit=${visit}`);
        assert.equal(guairaReturnContextFromSearch(href.slice(href.indexOf('?'))), visit);
        for (const other of ['town', 'rice', 'corral', 'vazao'] as const) if (other !== at) {
            assert.equal(guairaReturnHref(other, visit), guairaReturnHref(other));
            assert.equal(guairaReturnContextFromSearch(`?at=${other}&visit=${visit}`), null);
            assert.equal(new GuairaMapModel(metadata, other, visit).returnContext, null);
        }
    }
    for (const search of ['', '?visit=bull-clear', '?at=rice&visit=checkpoint', '?at=rice&visit=__proto__',
        '?at=rice&visit=traversal-clear&visit=mayor-clear', '?at=rice&at=vazao&visit=traversal-clear'])
        assert.equal(guairaReturnContextFromSearch(search), null);
    const won = new GuairaMapModel(metadata, 'corral', 'bull-clear');
    assert.equal(won.selected, 'subida'); assert.equal(won.moving, false);
    assert.deepEqual(won.point, metadata.nodes['guaira-4']); assert.equal(won.enterHref(), './guaira-subida.html');
    assert.match(guairaMapPresentation(won).status, /Ossabravo descansou/);
    won.select('curral'); assert.equal(won.returnContext, null); assert.equal(won.enterHref(), './guaira-lab.html');
    assert.doesNotMatch(guairaMapPresentation(won).status, /descansou/);
    const released = new GuairaMapModel(metadata, 'vazao', 'mayor-clear');
    assert.equal(guairaMapPresentation(released).action, 'REPETIR');
    assert.equal(released.enterHref(), './guaira-prefeito.html', 'repeat always starts the ordinary fresh experiment');
    released.returnToCorral(); assert.equal(released.returnContext, null);
    assert.equal(released.enterHref(), null, 'visit context grants no entry during departure');
});

test('rice continuation follows the authored road and is distinct from entering the arena', () => {
    for (const reduced of [false, true]) for (const context of [null, 'traversal-clear'] as const) {
        const model = new GuairaMapModel(metadata, 'rice', context); model.setReducedMotion(reduced);
        assert.equal(model.canWalkToCorral, true); assert.equal(model.canEnter, false); assert.equal(model.enterHref(), null);
        const text = guairaMapPresentation(model);
        assert.equal(text.action, 'CURRAL'); assert.match(text.actionName, /Caminhar/);
        assert.equal(text.status.includes('concluída'), context !== null, 'a checkpoint/neutral return is never a completion');
        model.walkToCorral(); assert.equal(model.canWalkToCorral, false); assert.equal(model.returnContext, null);
        assert.equal(model.selected, 'curral'); assert.equal(model.moving, !reduced);
        const selected = model.selected; model.walkToCorral(); assert.equal(model.selected, selected);
        finish(model); assert.deepEqual(model.point, metadata.nodes['guaira-4']); assert.equal(model.enterHref(), './guaira-lab.html');
    }
    const stale = new GuairaMapModel(metadata, 'rice', 'traversal-clear');
    stale.select('town'); stale.walkToCorral(); assert.equal(stale.selected, 'town');
    const closed = new GuairaMapModel(metadata, 'rice'); closed.close(); closed.walkToCorral();
    assert.equal(closed.canWalkToCorral, false); assert.equal(closed.selected, null);
    assert.doesNotMatch(GUAIRA_DESTINATIONS.town.description, /leve água ao bairro/);
});
