import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { fallbackMapMetadata, paintWorldMap } from '../src/adventure/WorldMapArt';
import { COAST_PORT_PLACEMENTS, localToAtlas } from '../src/adventure/WorldAtlasModel';
import { atlasActorScale, atlasBoatBounds, paintWorldAtlas, type AtlasPaintState, type BoatAtlasFrame } from '../src/adventure/WorldAtlasArt';
import { mapToScreen } from '../src/adventure/WorldMapModel';
import { atlasCableBounds, paintCableLines, validCableFrame, type AtlasCableCar, type CableAtlasFrame } from '../src/adventure/WorldCableArt';

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
        actor: { point: { x: .9, y: .8 }, walking: false, facingLeft: false, aboard, boatId: 'coast-port-sail' },
        boats: [{ id: 'coast-port-sail', foot: { x: .9, y: .8 }, frame, assets: { rear, foreground } }] };
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
    const foot = mapToScreen(state.boats![0].foot, camera);
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

test('independent ferries render one passenger inside only the occupied hull', () => {
    for (const occupied of ['coast-port-sail', 'reserva-dominio-sail']) {
        const state = scene(true), { context, calls } = recordingContext();
        state.boats = [state.boats![0], { id: 'reserva-dominio-sail', foot: { x: 2.5, y: -1.1 }, frame,
            assets: { rear: image('heated-ferry-rear'), foreground: image('heated-ferry-front') } }];
        state.actor.boatId = occupied;
        state.actor.point = state.boats.find(boat => boat.id === occupied)!.foot;
        paintWorldAtlas(context, state);
        const pixels = actorPixels(calls);
        assert.equal(pixels.length, PLAYER_SPRITES.idle.flatMap(row => [...row]).filter(pixel => PLAYER_PALETTE[pixel]).length);
        for (const boat of state.boats) {
            const behind = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === boat.assets.rear);
            const front = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === boat.assets.foreground);
            assert.ok(behind < front);
            assert.equal(pixels.every(pixel => calls.indexOf(pixel) > behind && calls.indexOf(pixel) < front), boat.id === occupied);
        }
    }
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
        if (fail === 'missing') state.boats![0].assets.rear = null;
        else state.boats![0].frame = { ...frame, width: NaN };
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

const cableFrame: CableAtlasFrame = { width: 144, height: 260, widthInMap: .075, passengerPixelScale: (4.15 / 20.6 * 3 / 384) * 144 / .075,
    passengerFoot: { x: 72, y: 225 }, rear: { x: 0, y: 0, w: 144, h: 260 }, foreground: { x: 144, y: 0, w: 144, h: 260 } };
const cable = (id: string, x: number, y: number): AtlasCableCar => ({ id, foot: { x, y }, frame: cableFrame,
    assets: { rear: image(`${id}-rear`), foreground: image(`${id}-front`) } });

test('cabin bounds preserve the measured passenger foot, full hanger and original Feka scale', () => {
    const car = cable('a', 3.3, -.4), bounds = atlasCableBounds(car);
    assert.ok(validCableFrame(car.frame));
    const top = mapToScreen({ x: bounds.left, y: bounds.top }, camera), bottom = mapToScreen({ x: bounds.right, y: bounds.bottom }, camera);
    const foot = mapToScreen(car.foot, camera);
    assert.ok(Math.abs(top.x + (bottom.x - top.x) * 72 / 144 - foot.x) < 1e-8);
    assert.ok(Math.abs(top.y + (bottom.y - top.y) * 225 / 260 - foot.y) < 1e-8);
    assert.ok(bounds.top < car.foot.y && bounds.bottom > car.foot.y);
    assert.ok(Math.abs(atlasActorScale(camera, car.frame) - atlasActorScale(camera)) < 1e-10);
});

test('only the occupied cable car surrounds Feka; the other car and moored ferry remain passenger-free', () => {
    for (const occupied of ['a', 'b'] as const) {
        const state = scene(true), a = cable('a', 3.3, -.4), b = cable('b', 3.4, -.5), { context, calls } = recordingContext();
        state.cableCars = [a, b]; state.actor.cableCar = occupied; state.actor.point = (occupied === 'a' ? a : b).foot;
        paintWorldAtlas(context, state);
        const active = occupied === 'a' ? a : b, empty = occupied === 'a' ? b : a;
        const rearIndex = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === active.assets.rear);
        const frontIndex = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === active.assets.foreground);
        const pixels = actorPixels(calls);
        assert.equal(pixels.length, PLAYER_SPRITES.idle.flatMap(row => [...row]).filter(pixel => PLAYER_PALETTE[pixel]).length);
        assert.ok(pixels.every(pixel => calls.indexOf(pixel) > rearIndex && calls.indexOf(pixel) < frontIndex));
        for (const source of [rear, foreground])
            assert.ok(calls.findIndex(call => call.name === 'drawImage' && call.args[0] === source) < calls.indexOf(pixels[0]));
        const emptyRear = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === empty.assets.rear);
        const emptyFront = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === empty.assets.foreground);
        assert.ok(emptyRear < emptyFront);
        if (occupied === 'a') assert.ok(emptyRear > frontIndex, 'The front empty car retains honest depth over the rear passenger.');
        else assert.ok(emptyFront < rearIndex, 'The rear empty car stays behind the occupied front car.');
        const draw = calls[rearIndex], top = atlasCableBounds(active);
        assert.deepEqual(draw.args.slice(1, 5), [0, 0, 144, 260]);
        assert.equal(draw.args[5], mapToScreen({ x: top.left, y: top.top }, camera).x);
    }
});

test('an incomplete or invalid cabin disappears safely and cannot hide the original actor', () => {
    for (const failure of ['rear', 'front', 'frame'] as const) {
        const state = scene(true), car = cable('a', 3.3, -.4), { context, calls } = recordingContext();
        if (failure === 'rear') car.assets.rear = null;
        if (failure === 'front') car.assets.foreground = null;
        if (failure === 'frame') car.frame = { ...car.frame, passengerFoot: { x: Infinity, y: 225 } };
        state.cableCars = [car]; state.actor.cableCar = 'a'; state.actor.point = car.foot;
        paintWorldAtlas(context, state);
        assert.ok(actorPixels(calls).length > 100);
        assert.equal(calls.filter(call => call.name === 'drawImage' && [car.assets.rear, car.assets.foreground].includes(call.args[0] as CanvasImageSource)).length, 0);
    }
});

test('two cable lines keep a single passenger inside the uniquely identified occupied vehicle', () => {
    const ids = ['serra-maintenance-cable-a', 'serra-maintenance-cable-b', 'serra-reserva-passenger-b', 'serra-reserva-passenger-a'];
    for (const occupied of ids) {
        const state = scene(true), { context, calls } = recordingContext();
        state.cableCars = ids.map((id, n) => cable(id, 3 + n / 10, -.3 - n / 10));
        const active = state.cableCars.find(car => car.id === occupied)!;
        state.actor.cableCar = occupied; state.actor.point = active.foot;
        paintWorldAtlas(context, state);
        const pixels = actorPixels(calls);
        assert.equal(pixels.length, PLAYER_SPRITES.idle.flatMap(row => [...row]).filter(pixel => PLAYER_PALETTE[pixel]).length);
        for (const car of state.cableCars) {
            const rearAt = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === car.assets.rear);
            const frontAt = calls.findIndex(call => call.name === 'drawImage' && call.args[0] === car.assets.foreground);
            assert.ok(rearAt < frontAt);
            assert.equal(pixels.every(pixel => calls.indexOf(pixel) > rearAt && calls.indexOf(pixel) < frontAt), car === active);
        }
    }
});

test('authored wire curves keep their projected grip positions and render behind vehicles', () => {
    const paths = [[{ x: 3.61, y: -.42 }, { x: 3.52, y: -1.01 }], [{ x: 3.87, y: -.41 }, { x: 3.78, y: -1 }]];
    const isolated = recordingContext();
    paintCableLines(isolated.context, camera, [...paths, [{ x: NaN, y: 0 }, { x: 0, y: 0 }]]);
    assert.deepEqual(isolated.calls.filter(call => call.name === 'moveTo').map(call => call.args), paths.map(path => {
        const p = mapToScreen(path[0], camera); return [p.x, p.y];
    }));
    assert.equal(isolated.calls.filter(call => call.name === 'stroke').length, 4);
    const state = scene(true), recorded = recordingContext(); state.cablePaths = paths;
    state.cableCars = [cable('serra-reserva-passenger-a', 3.61, -.25)];
    state.actor.cableCar = state.cableCars[0].id; state.actor.point = state.cableCars[0].foot;
    paintWorldAtlas(recorded.context, state);
    const first = mapToScreen(paths[0][0], camera);
    const wireAt = recorded.calls.findIndex(call => call.name === 'moveTo' && call.args[0] === first.x && call.args[1] === first.y);
    const islandAt = recorded.calls.findIndex(call => call.name === 'drawImage' && call.args[0] === state.islands[1].assets.island);
    const cabinAt = recorded.calls.findIndex(call => call.name === 'drawImage' && call.args[0] === state.cableCars![0].assets.rear);
    assert.ok(islandAt < wireAt && wireAt < cabinAt);
});

test('parked cabin paint stays deterministic and a remote-region preview never invents a passenger', () => {
    const state = scene(false), a = recordingContext(), b = recordingContext();
    state.cableCars = [cable('a', 3.3, -.4), cable('b', 3.4, -.5)]; state.actor.visible = false;
    paintWorldAtlas(a.context, state); paintWorldAtlas(b.context, { ...state, time: 99999 });
    assert.equal(actorPixels(a.calls).length, 0); assert.deepEqual(a.calls, b.calls);
});
