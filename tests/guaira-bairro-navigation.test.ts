import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUAIRA_DESTINATIONS, GUAIRA_SELECTIONS, GuairaMapModel, guairaArrivalFromSearch,
    guairaReturnContextFromSearch, guairaReturnHref, parseGuairaMetadata,
    type GuairaArrival, type GuairaReturnContext, type GuairaSelection } from '../src/adventure/experimental/guaira/GuairaMapModel';
import { guairaMapPresentation } from '../src/adventure/experimental/guaira/GuairaMapPresentation';

const metadata = parseGuairaMetadata(JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8')))!;
const completeWalk = (model: GuairaMapModel) => {
    const target = model.targetDistance;
    for (let i = 0; i < 4000 && model.moving; i++) {
        const before = model.distance;
        assert.equal(model.enterHref(), null, 'walking never offers an entry');
        model.tick(1 / 60);
        assert.ok(Math.abs(model.distance - before) <= 170 / 60 + 1e-6, 'one continuous road step');
        assert.ok(model.distance >= Math.min(before, target) && model.distance <= Math.max(before, target), 'no overshoot');
    }
    assert.equal(model.moving, false);
    assert.equal(model.distance, target);
};

test('Bairro uses the exact authored guaira-2 road distance without a fourth persistent destination', () => {
    assert.deepEqual(Object.keys(GUAIRA_DESTINATIONS), ['town', 'curral', 'subida']);
    assert.deepEqual(Object.keys(GUAIRA_SELECTIONS), ['town', 'curral', 'subida', 'bairro']);
    const model = new GuairaMapModel(metadata);
    const firstRoad = metadata.routes['0:1'];
    const districtDistance = firstRoad.slice(1).reduce((distance, p, i) => distance +
        Math.hypot((p.x - firstRoad[i].x) * 1920, (p.y - firstRoad[i].y) * 1200), 0);
    assert.deepEqual(Object.keys(model.destinationDistances), ['town', 'curral', 'subida']);
    assert.equal(model.arrivalDistances.bairro, districtDistance);
    assert.equal(model.selectionDistances.bairro, districtDistance);
    assert.equal(model.landmarkDistances['guaira-2'], districtDistance);
    assert.deepEqual(model.pointAt(districtDistance), metadata.nodes['guaira-2']);
    assert.ok(districtDistance > model.arrivalDistances.town && districtDistance < model.arrivalDistances.rice);
    for (const [destination, descriptor] of Object.entries(GUAIRA_DESTINATIONS)) {
        assert.equal(model.selectionDistances[destination as keyof typeof GUAIRA_DESTINATIONS], model.landmarkDistances[descriptor.node]);
    }
});

test('walking to Bairro from either direction preserves every physical step and ends at guaira-2', () => {
    for (const from of ['town', 'rice', 'corral', 'vazao'] as const) {
        const model = new GuairaMapModel(metadata, from), point = model.point, before = model.distance;
        model.select('bairro');
        assert.deepEqual(model.point, point, 'selection never teleports');
        assert.equal(model.distance, before);
        assert.equal(model.canEnterGallery, false);
        assert.match(guairaMapPresentation(model).status, /a caminho do Bairro/);
        const revision = model.revision;
        completeWalk(model);
        assert.equal(model.revision, revision + 1, 'completion invalidates the walking action snapshot');
        assert.equal(model.arrival, 'bairro'); assert.equal(model.selected, 'bairro');
        assert.deepEqual(model.point, metadata.nodes['guaira-2']);
        assert.equal(model.canEnterGallery, true); assert.equal(model.enterHref(), './guaira-galeria.html');
        assert.equal(model.returnContext, null);
        assert.equal(guairaMapPresentation(model).action, 'GALERIA');
        assert.doesNotMatch(guairaMapPresentation(model).status, /conclu[ií]|vit[oó]ria|liberad/i);
    }
});

test('rapid reversals around Bairro retain the feet and disable stale Gallery entry before animation', () => {
    for (const from of ['town', 'corral'] as const) {
        const model = new GuairaMapModel(metadata, from);
        model.select('bairro');
        for (let i = 0; i < 15; i++) model.tick(1 / 60);
        const point = model.point, distance = model.distance;
        const reverse = from === 'town' ? 'town' : 'curral';
        for (let i = 0; i < 30; i++) model.select(i % 2 ? reverse : 'bairro');
        assert.deepEqual(model.point, point); assert.equal(model.distance, distance);
        model.tick(1 / 60);
        assert.ok(from === 'town' ? model.distance < distance : model.distance > distance);
        model.select('bairro'); completeWalk(model);
        const readyRevision = model.revision;
        model.select('bairro'); assert.ok(model.revision > readyRevision, 'same-state reselection invalidates old callbacks');
        model.select(reverse);
        assert.equal(model.arrival, 'bairro', 'departure selection precedes movement');
        assert.equal(model.canEnterGallery, false); assert.equal(model.enterHref(), null);
        model.select('bairro'); assert.equal(model.canEnterGallery, true, 'explicit reselection while still there is valid');
        model.select(reverse); model.tick(.05); model.select('bairro');
        assert.equal(model.canEnterGallery, false); completeWalk(model); assert.equal(model.canEnterGallery, true);
    }
});

test('passing through Bairro for an ordinary destination never enables Gallery, including the exact landmark', () => {
    for (const destination of ['town', 'curral', 'subida'] as const) {
        const model = new GuairaMapModel(metadata, destination === 'town' ? 'corral' : 'town');
        model.select(destination);
        model.distance = model.arrivalDistances.bairro;
        assert.equal(model.arrival, 'bairro'); assert.equal(model.moving, true);
        assert.equal(model.canEnterGallery, false); assert.equal(model.enterHref(), null);
        assert.notEqual(guairaMapPresentation(model).action, 'GALERIA');
        completeWalk(model);
        assert.equal(model.enterHref(), GUAIRA_DESTINATIONS[destination].href);
        assert.equal(model.canEnterGallery, false);
    }
});

test('CHEGAR and reduced motion only place Feka at Bairro; closed models reject every subsequent action', () => {
    for (const method of ['skip', 'reduced-before', 'reduced-during'] as const) {
        const model = new GuairaMapModel(metadata, 'vazao', 'mayor-clear');
        if (method === 'reduced-before') model.setReducedMotion(true);
        model.select('bairro');
        if (method === 'skip') model.skip();
        if (method === 'reduced-during') model.setReducedMotion(true);
        assert.equal(model.arrival, 'bairro'); assert.equal(model.returnContext, null);
        assert.equal(model.canEnterGallery, true); assert.equal(model.closed, false, 'arrival never enters or closes the map');
        const beforeRead = model.revision;
        assert.equal(model.enterHref(), './guaira-galeria.html');
        assert.equal(model.revision, beforeRead, 'reading a permitted href is not entry');
        model.close(); const point = model.point, revision = model.revision, reduced = model.reducedMotion;
        model.select('town'); model.select('bairro'); model.skip(); model.tick(5); model.setReducedMotion(!reduced); model.close();
        assert.deepEqual(model.point, point); assert.equal(model.revision, revision); assert.equal(model.reducedMotion, reduced);
        assert.equal(model.canEnterGallery, false); assert.equal(model.canEnter, false); assert.equal(model.enterHref(), null);
        assert.equal(model.junctionHref(), null); assert.equal(model.respirosHref(), null);
    }
    const model = new GuairaMapModel(metadata); model.select('bairro'); model.tick(.03); model.close();
    const point = model.point; model.skip(); model.setReducedMotion(true); model.select('bairro');
    assert.deepEqual(model.point, point); assert.equal(model.enterHref(), null);
});

test('Bairro query and reload restore geography only, rejecting all completion claims and external return input', () => {
    const claims = ['traversal-clear', 'junction-clear', 'respiros-clear', 'bull-clear', 'ascent-clear', 'mayor-clear', 'gallery-clear', 'galeria-clear', '__proto__'];
    for (const claim of claims) {
        const search = `?at=bairro&visit=${claim}&return=https://example.invalid/next`;
        for (let reload = 0; reload < 2; reload++) {
            assert.equal(guairaArrivalFromSearch(search), 'bairro');
            assert.equal(guairaReturnContextFromSearch(search), null);
            const model = new GuairaMapModel(metadata, guairaArrivalFromSearch(search), guairaReturnContextFromSearch(search));
            assert.deepEqual(model.point, metadata.nodes['guaira-2']); assert.equal(model.selected, 'bairro');
            assert.equal(model.moving, false); assert.equal(model.returnContext, null);
            assert.equal(model.enterHref(), './guaira-galeria.html');
            assert.equal(guairaReturnHref('bairro', claim as GuairaReturnContext), './guaira.html?at=bairro');
            assert.equal(new GuairaMapModel(metadata, 'bairro', claim as GuairaReturnContext).returnContext, null);
        }
    }
    for (const [search, at] of [
        ['?at=bairro&at=corral&visit=bull-clear', 'bairro'],
        ['?at=corral&at=bairro&visit=bull-clear', 'corral'],
        ['?at=bairro&at=bairro&visit=gallery-clear', 'bairro'],
        ['?at=unknown&at=bairro', 'town'],
        ['?at=bairro&visit=bull-clear&visit=mayor-clear', 'bairro'],
        ['?at=https://example.invalid/bairro', 'town'],
        ['?at=__proto__', 'town'],
    ] as const) {
        assert.equal(guairaArrivalFromSearch(search), at, 'geographical duplicates keep the existing first-value behavior');
        assert.equal(guairaReturnContextFromSearch(search), null);
        const href = guairaReturnHref(at, guairaReturnContextFromSearch(search));
        assert.equal(guairaReturnContextFromSearch(href.split('?')[1]), null, 'canonical reload cannot revive a rejected visit');
    }
    for (const invalid of ['__proto__', 'https://example.invalid', 'bairro&visit=mayor-clear', '']) {
        assert.equal(guairaReturnHref(invalid as GuairaArrival), './guaira.html?at=town');
        const model = new GuairaMapModel(metadata, invalid as GuairaArrival);
        assert.equal(model.arrival, 'town');
        const before = model.revision; model.select(invalid as GuairaSelection);
        assert.equal(model.selected, 'town'); assert.equal(model.revision, before);
    }
});
