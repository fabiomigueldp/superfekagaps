import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { transformAtlasMetadata } from '../src/adventure/WorldAtlasModel';
import { buildJourneyNetwork } from '../src/adventure/WorldJourneyNetwork';

function authored(world: number) {
    const metadata = fallbackMapMetadata(world);
    for (let n = 0; n < 4; n++) metadata.routes[`${n}:${n + 1}`] = [metadata.nodes[`${world}-${n + 1}`], metadata.nodes[`${world}-${n + 2}`]];
    metadata.secretRoute = [metadata.nodes[`${world}-3`], metadata.nodes[`${world}-5`]];
    return metadata;
}

test('Serra explicitly distinguishes its cabin shortcut from supported walking routes', () => {
    const raw = { ...authored(4), secretTransport: 'maintenance-cable', secretRoute: [] };
    const metadata = parseMapMetadata(raw, 4);
    assert.ok(metadata); assert.equal(metadata.secretTransport, 'maintenance-cable'); assert.deepEqual(metadata.secretRoute, []);
    assert.equal(Object.keys(metadata.routes).length, 4);
    const transformed = transformAtlasMetadata(metadata, { origin: { x: 2.8, y: -.6 }, scale: 1 });
    assert.equal(transformed.secretTransport, 'maintenance-cable'); assert.deepEqual(transformed.secretRoute, []);
    const graph = buildJourneyNetwork({ islands: [{ world: 4, metadata, placement: { origin: { x: 0, y: 0 }, scale: 1 }, ready: true }],
        secrets: ['4-3'], connection: null, connectionReady: false });
    assert.equal(graph.edges.length, 4); assert.ok(!graph.edges.some(edge => edge.id === '4-secret'), 'An absent cabin contract must not create an airborne walking edge.');
});

test('an empty secret route is accepted only with the exact world4 maintenance discriminator', () => {
    for (const world of [1, 2, 3, 4, 5, 6]) {
        assert.equal(parseMapMetadata({ ...authored(world), secretRoute: [] }, world), null);
        for (const marker of [null, '', 'cable', true, 4, {}])
            assert.equal(parseMapMetadata({ ...authored(world), secretTransport: marker, secretRoute: [] }, world), null);
        if (world !== 4) assert.equal(parseMapMetadata({ ...authored(world), secretTransport: 'maintenance-cable', secretRoute: [] }, world), null);
    }
});

test('a cabin declaration cannot smuggle in a walking shortcut or relax the five phase paths', () => {
    const raw = { ...authored(4), secretTransport: 'maintenance-cable', secretRoute: [] };
    assert.equal(parseMapMetadata({ ...raw, secretRoute: authored(4).secretRoute }, 4), null);
    assert.equal(parseMapMetadata({ ...raw, routes: { ...raw.routes, '1:2': [] } }, 4), null);
    assert.equal(parseMapMetadata({ ...raw, nodes: { ...raw.nodes, '4-5': { x: Infinity, y: .5 } } }, 4), null);
});

test('ordinary authored metadata keeps its existing secret walk geometry in all six worlds', () => {
    for (const world of [1, 2, 3, 4, 5, 6]) {
        const raw = authored(world), parsed = parseMapMetadata(raw, world);
        assert.ok(parsed); assert.deepEqual(parsed.secretRoute, raw.secretRoute); assert.equal(parsed.secretTransport, undefined);
    }
});

test('Serra walking cadence follows its own validated paths without changing other regions or routing weights', () => {
    const timings = { '0:1': 2.1, '1:2': 2.7, '2:3': 2.4, '3:4': 3.0 };
    const parsed = parseMapMetadata({ ...authored(4), routeDurationsSeconds: timings }, 4)!;
    assert.ok(parsed); assert.deepEqual(parsed.routeDurationsSeconds, timings);
    const moved = transformAtlasMetadata(parsed, { origin: { x: 2.8, y: -.6 }, scale: 1 });
    assert.deepEqual(moved.routeDurationsSeconds, timings); assert.notEqual(moved.routeDurationsSeconds, parsed.routeDurationsSeconds);
    const graph = buildJourneyNetwork({ islands: [1, 2, 3, 4].map(world => ({ world,
        metadata: world === 4 ? parsed : { ...authored(world), routeDurationsSeconds: timings },
        placement: { origin: { x: world, y: 0 }, scale: 1 }, ready: true })), secrets: [], connection: null, connectionReady: false });
    assert.deepEqual(graph.edges.filter(edge => edge.from.startsWith('4-')).map(edge => edge.duration), Object.values(timings));
    assert.ok(graph.edges.filter(edge => !edge.from.startsWith('4-')).every(edge => edge.duration === .78));
    assert.ok(graph.edges.every(edge => !('routeCost' in edge)));
});

test('malformed or cross-world cadence exports are rejected instead of producing broken travel', () => {
    const timings = { '0:1': 2.1, '1:2': 2.7, '2:3': 2.4, '3:4': 3.0 };
    for (const value of [null, [], {}, { ...timings, extra: 1 }, { ...timings, '3:4': undefined },
        ...[NaN, Infinity, 0, -1, 121, '2'].map(value => ({ ...timings, '2:3': value }))])
        assert.equal(parseMapMetadata({ ...authored(4), routeDurationsSeconds: value }, 4), null);
    for (const world of [1, 2, 3, 5, 6]) assert.equal(parseMapMetadata({ ...authored(world), routeDurationsSeconds: timings }, world), null);
});
