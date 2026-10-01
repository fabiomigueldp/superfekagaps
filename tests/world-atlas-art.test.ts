import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { fallbackMapMetadata, paintWorldMap } from '../src/adventure/WorldMapArt';
import { COAST_PORT_PLACEMENTS, localToAtlas } from '../src/adventure/WorldAtlasModel';
import { atlasActorScale, atlasBoatBounds, paintWorldAtlas, type AtlasPaintState, type BoatAtlasFrame } from '../src/adventure/WorldAtlasArt';
import { mapToScreen } from '../src/adventure/WorldMapModel';

interface Call { name: string; args: unknown[]; color?: unknown }
function recordingContext() {
    const calls: Call[] = [];
    const target: Record<string, unknown> = {};
    const context = new Proxy(target, { get: (object, key: string) => {
        if (key in object) return object[key];
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        return (...args: unknown[]) => { calls.push({ name: key, args,
            color: typeof object.fillStyle === 'object' ? 'gradient' : object.fillStyle }); };
    }, set: (object, key: string, value: unknown) => { object[key] = value; return true; } }) as unknown as CanvasRenderingContext2D;
    return { context, calls };
}
const image = (id: string) => ({ id } as unknown as CanvasImageSource);
const camera = { width: 1181, height: 757, center: { x: 1, y: .5 }, zoom: .8 };
const frame: BoatAtlasFrame = { width: 384, height: 256, widthInMap: 4.15 / 20.6, passengerPixelScale: 3,
    passengerFoot: { x: 192, y: 148 }, rear: { x: 768, y: 0, w: 384, h: 256 }, foreground: { x: 768, y: 256, w: 384, h: 256 } };
const rear = image('rear'), foreground = image('foreground'), phantom = image('distant port');
function scene(aboard = true): AtlasPaintState {
    return { camera, time: 1250, reducedMotion: true,
        islands: [1, 2].map(world => ({ world, metadata: fallbackMapMetadata(world),
            placement: COAST_PORT_PLACEMENTS[world], completed: [], secret: false,
            assets: { island: image(`island${world}`), shadow: image(`shadow${world}`), port: phantom } })),
        actor: { point: { x: .9, y: .8 }, walking: false, facingLeft: false, aboard },
        boat: { foot: { x: .9, y: .8 }, frame, assets: { rear, foreground } } };
}
const actorColors = new Set(Object.values(PLAYER_PALETTE).filter(Boolean));
const actorPixels = (calls: Call[]) => calls.filter(call => call.name === 'fillRect' && actorColors.has(call.color as string));

test('connected painter clears and paints sea once, then both fixed island layers with no phantom distant Porto', () => {
    const { context, calls } = recordingContext(), state = scene();
    paintWorldAtlas(context, state);
    assert.equal(calls.filter(call => call.name === 'clearRect').length, 1);
    const pictures = calls.filter(call => call.name === 'drawImage');
    assert.deepEqual(pictures.map(call => (call.args[0] as unknown as { id: string }).id),
        ['island1', 'island2', 'rear', 'foreground']);
    for (const [index, layer] of state.islands.entries()) {
        const draw = pictures[index];
        const top = mapToScreen(localToAtlas({ x: 0, y: 0 }, layer.placement), camera);
        const bottom = mapToScreen(localToAtlas({ x: 1, y: 1 }, layer.placement), camera);
        assert.deepEqual(draw.args.slice(1), [top.x, top.y, bottom.x - top.x, bottom.y - top.y]);
    }
});

test('connected atlas omits clipped legacy shadows without changing cached assets or the legacy painter', () => {
    const connected = recordingContext(), legacy = recordingContext(), state = scene();
    const shadows = state.islands.map(island => island.assets.shadow);
    paintWorldAtlas(connected.context, state);
    assert.ok(!connected.calls.some(call => call.name === 'drawImage' && shadows.includes(call.args[0] as CanvasImageSource)),
        'The continuous sea must never expose the rectangular legacy shadow canvas.');
    assert.deepEqual(state.islands.map(island => island.assets.shadow), shadows, 'Cached assets remain available to legacy maps.');
    const island = state.islands[0];
    paintWorldMap(legacy.context, { ...island, camera, time: 0, reducedMotion: true,
        marker: { x: .5, y: .5 }, walking: false, facingLeft: false });
    assert.ok(legacy.calls.some(call => call.name === 'drawImage' && call.args[0] === shadows[0]));
});

test('aboard Feka retains every original pixel between cropped rear and foreground layers', () => {
    const { context, calls } = recordingContext(), state = scene();
    paintWorldAtlas(context, state);
    const rearIndex = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === rear);
    const foregroundIndex = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === foreground);
    const pixels = actorPixels(calls);
    assert.equal(pixels.length, PLAYER_SPRITES.idle.flatMap(row => [...row]).filter(pixel => PLAYER_PALETTE[pixel]).length);
    assert.ok(pixels.every(pixel => calls.indexOf(pixel) > rearIndex && calls.indexOf(pixel) < foregroundIndex));
    assert.deepEqual(calls[rearIndex].args.slice(1, 5), [768, 0, 384, 256]);
    assert.deepEqual(calls[foregroundIndex].args.slice(1, 5), [768, 256, 384, 256]);
    assert.deepEqual(calls[rearIndex].args.slice(5), calls[foregroundIndex].args.slice(5));
    const [, , , , , x, y, width, height] = calls[rearIndex].args as number[];
    const foot = mapToScreen(state.boat!.foot, camera);
    assert.ok(Math.abs(x + frame.passengerFoot.x / frame.width * width - foot.x) < 1e-7);
    assert.ok(Math.abs(y + frame.passengerFoot.y / frame.height * height - foot.y) < 1e-7);
});

test('boarding keeps the boat anchored independently; the foreground cannot mask a walking actor', () => {
    const state = scene(false), snapshots: { boat: unknown[]; actor: Call[] }[] = [];
    for (const x of [.68, .80, .90]) {
        const { context, calls } = recordingContext();
        state.actor.point = { x, y: .8 };
        paintWorldAtlas(context, state);
        const foregroundIndex = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === foreground);
        const pixels = actorPixels(calls);
        assert.ok(pixels.every(pixel => calls.indexOf(pixel) > foregroundIndex));
        snapshots.push({ boat: calls.find(call => call.name === 'drawImage' && call.args[0] === rear)!.args, actor: pixels });
    }
    assert.deepEqual(snapshots[0].boat, snapshots[1].boat);
    assert.deepEqual(snapshots[1].boat, snapshots[2].boat);
    assert.notDeepEqual(snapshots[0].actor, snapshots[2].actor);
    assert.equal(atlasActorScale(camera, frame), atlasActorScale(camera), 'Walking and deck scales agree before changing aboard.');
});

test('dock overlays use stable island-local rectangles and render before the passenger', () => {
    const { context, calls } = recordingContext(), state = scene();
    const dock = image('dock');
    state.islands[1].overlay = { image: dock, left: .05, top: .6, widthInMap: .2, heightInMap: .1 };
    paintWorldAtlas(context, state);
    const draw = calls.find(call => call.name === 'drawImage' && call.args[0] === dock)!;
    const top = mapToScreen(localToAtlas({ x: .05, y: .6 }, COAST_PORT_PLACEMENTS[2]), camera);
    const bottom = mapToScreen(localToAtlas({ x: .25, y: .7 }, COAST_PORT_PLACEMENTS[2]), camera);
    assert.deepEqual(draw.args.slice(1), [top.x, top.y, bottom.x - top.x, bottom.y - top.y]);
    assert.ok(calls.indexOf(draw) < calls.indexOf(actorPixels(calls)[0]));
});

test('cargo bridge art stays in atlas coordinates and below the walking actor for both gate states', () => {
    for (const gate of ['open', 'closed']) {
        const { context, calls } = recordingContext(), state = scene(false), bridge = image(`bridge-${gate}`);
        state.connections = [{ image: bridge, left: 1.7, top: .35, widthInMap: .42, heightInMap: .26 }];
        state.actor.point = { x: 1.9, y: .5 };
        paintWorldAtlas(context, state);
        const draw = calls.find(call => call.name === 'drawImage' && call.args[0] === bridge)!;
        const top = mapToScreen({ x: 1.7, y: .35 }, camera), bottom = mapToScreen({ x: 2.12, y: .61 }, camera);
        assert.deepEqual(draw.args.slice(1), [top.x, top.y, bottom.x - top.x, bottom.y - top.y]);
        const islandDraws = calls.filter(call => call.name === 'drawImage' && state.islands.some(island => island.assets.island === call.args[0]));
        assert.ok(islandDraws.every(island => calls.indexOf(island) < calls.indexOf(draw)));
        assert.ok(calls.indexOf(draw) < calls.indexOf(actorPixels(calls)[0]));
        assert.equal(calls.filter(call => call.name === 'drawImage' && call.args[0] === rear).length, 1, 'The bridge cannot duplicate the ferry.');
    }
});

test('missing or malformed connection layers leave the normal sea, islands and actor intact', () => {
    const baseline = recordingContext(), invalid = recordingContext(), state = scene(false);
    paintWorldAtlas(baseline.context, state);
    state.connections = [
        { image: null, left: 1, top: .2, widthInMap: .4, heightInMap: .2 },
        { image: image('invalid'), left: NaN, top: .2, widthInMap: .4, heightInMap: .2 },
        { image: image('invalid'), left: 1, top: .2, widthInMap: -.4, heightInMap: .2 },
    ];
    paintWorldAtlas(invalid.context, state);
    assert.deepEqual(invalid.calls, baseline.calls);
});

test('unavailable or invalid boat art is omitted safely while original Feka and legacy island fallback remain', () => {
    for (const fail of ['missing', 'invalid'] as const) {
        const { context, calls } = recordingContext(), state = scene();
        if (fail === 'missing') state.boat!.assets.rear = null;
        else state.boat!.frame = { ...frame, width: NaN };
        state.islands[0].assets.island = null;
        assert.doesNotThrow(() => paintWorldAtlas(context, state));
        assert.ok(actorPixels(calls).length > 100);
        assert.equal(calls.filter(call => call.name === 'drawImage' && [rear, foreground].includes(call.args[0] as CanvasImageSource)).length, 0);
    }
    const foot = { x: .9, y: .8 };
    assert.deepEqual(atlasBoatBounds(foot, { ...frame, width: NaN }), { left: .9, top: .8, right: .9, bottom: .8 });
});

test('reduced motion has identical paint output across timestamps and retains the legacy distant decoration', () => {
    const a = recordingContext(), b = recordingContext(), state = scene();
    paintWorldAtlas(a.context, state); paintWorldAtlas(b.context, { ...state, time: 90000 });
    assert.deepEqual(a.calls, b.calls);
    const legacy = recordingContext(), island = state.islands[0];
    paintWorldMap(legacy.context, { ...island, camera, time: 0, reducedMotion: true,
        marker: { x: .5, y: .5 }, walking: false, facingLeft: false });
    assert.ok(legacy.calls.some(call => call.name === 'drawImage' && call.args[0] === phantom));
});
