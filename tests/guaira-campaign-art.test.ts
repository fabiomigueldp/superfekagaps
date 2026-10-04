import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { campaignMapAsset, GUAIRA_CAMPAIGN_ART, GUAIRA_CAMPAIGN_NODES, campaignAirportTerminal, campaignArtBounds, campaignTerrainBounds,
    campaignArtOverlay, paintCampaignRegion, type GuairaCampaignRegion } from '../src/adventure/GuairaCampaignArt';
import { WORLD_ATLAS_PLACEMENTS } from '../src/adventure/WorldAtlasModel';

const regions: GuairaCampaignRegion[] = ['fabrica', 'guaira', 'serra'];
const raw = (region: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/guaira-campaign/${region}.meta.json`, import.meta.url), 'utf8'));
test('airport assets are grounded, dry, supported and within incremental transfer budget', () => {
    let bytes = 0;
    for (const region of regions) {
        const data = raw(region), { terminal, supportFootprint: support } = data;
        assert.equal(data.validation.allSupported, true);
        assert.equal(data.validation.walkSupportSamples, 42);
        assert.equal(data.validation.numericCampaignIdsChanged, false);
        assert.equal(terminal.surface, 'dry-compacted-earth');
        assert.ok(terminal.clearSpanMeters >= 3.3);
        assert.ok(terminal.usableLengthMeters >= 4.3);
        assert.ok(support.bottomZ < support.topZ);
        for (const p of [terminal.groundAnchorWorld, terminal.runwayStartWorld, terminal.runwayEndWorld]) {
            assert.ok(Math.abs(p[0] - support.center[0]) <= support.width / 2);
            assert.ok(Math.abs(p[1] - support.center[1]) <= support.depth / 2);
            assert.equal(p[2], support.topZ);
        }
        const file = new URL(`../public${GUAIRA_CAMPAIGN_ART[region].path}`, import.meta.url);
        bytes += statSync(file).size;
        assert.equal(readFileSync(file).subarray(8, 12).toString(), 'WEBP');
        assert.ok(data.image.width <= 1920 && data.image.height <= 1200);
    }
    assert.ok(bytes < 500_000, `Only ${bytes} optional/lazy bytes allowed under 500KB including the complete Serra replacement.`);
});
test('canonical island cameras and existing numeric world placements do not change', () => {
    assert.deepEqual(GUAIRA_CAMPAIGN_ART.fabrica.placement, WORLD_ATLAS_PLACEMENTS[3]);
    assert.deepEqual(GUAIRA_CAMPAIGN_ART.serra.placement, WORLD_ATLAS_PLACEMENTS[4]);
    assert.deepEqual(GUAIRA_CAMPAIGN_ART.guaira.placement, { origin: { x: 3.65, y: .05 }, scale: 1.1 });
    assert.equal(GUAIRA_CAMPAIGN_ART.guaira.aircraftScale, .65 * 20.6 / raw('guaira').camera.orthoScale);
    const terminal = campaignAirportTerminal('guaira');
    const first = GUAIRA_CAMPAIGN_NODES['guaira-1'];
    assert.deepEqual(terminal.boardingPath[0], { x: first.x, y: first.y });
    for (const region of regions) {
        const local = campaignAirportTerminal(region), atlas = campaignAirportTerminal(region, true), placement = GUAIRA_CAMPAIGN_ART[region].placement;
        assert.equal(atlas.groundAnchor.x, placement.origin.x + local.groundAnchor.x * placement.scale);
        assert.equal(atlas.groundAnchor.y, placement.origin.y + local.groundAnchor.y * placement.scale);
        assert.notEqual(local.boardingPath, GUAIRA_CAMPAIGN_ART[region].terminal.boardingPath);
    }
});
test('pure renderer and overlay share exact bounds at desktop and compact sizes', () => {
    for (const width of [1280, 390]) {
        const height = width === 390 ? 640 : 800;
        const camera = { width, height, center: { x: .5, y: .5 }, zoom: .9 };
        const calls: unknown[][] = [];
        const context = { save() {}, restore() {}, drawImage(...args: unknown[]) { calls.push(args); } } as unknown as CanvasRenderingContext2D;
        const image = {} as CanvasImageSource;
        paintCampaignRegion(context, camera, 'guaira', image);
        assert.equal(calls.length, 1);
        const bounds = campaignArtBounds('guaira', false), overlay = campaignArtOverlay('guaira', image, false);
        assert.equal(overlay.left, bounds.left);
        assert.equal(overlay.widthInMap, bounds.right - bounds.left);
        paintCampaignRegion(context, camera, 'guaira', null);
        assert.equal(calls.length, 1, 'Missing optional art must be harmless.');
    }
});

test('campaign assets remain under the immutable preview base', () => {
    for (const file of ['journey-aircraft.webp', 'journey-aircraft.meta.json', 'guaira-campaign/guaira.webp', 'guaira-campaign/fabrica.webp', 'guaira-campaign/serra.webp', 'fabrica-diorama.webp', 'serra-diorama.webp']) {
        assert.equal(campaignMapAsset(file, './'), `./assets/world/map/${file}`);
        assert.equal(campaignMapAsset(file, '/world/releases/candidate/'), `/world/releases/candidate/assets/world/map/${file}`);
    }
});


test('Guaíra atlas identity uses measured terrain instead of its transparent frame', () => {
    const box = campaignTerrainBounds('guaira'), frame = campaignArtBounds('guaira');
    const metadata = raw('guaira'), art = GUAIRA_CAMPAIGN_ART.guaira;
    assert.equal(box.left, art.placement.origin.x + metadata.artBounds.left * art.placement.scale);
    assert.equal(box.bottom, art.placement.origin.y + metadata.artBounds.bottom * art.placement.scale);
    assert.ok(box.left > frame.left && box.right < frame.right && box.top > frame.top && box.bottom < frame.bottom);
});
