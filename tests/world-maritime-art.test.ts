import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseMaritimeBuoys, paintMaritimeBuoys, type AtlasMaritimeBuoy } from '../src/adventure/WorldMaritimeArt';
import { mapToScreen } from '../src/adventure/WorldMapModel';

const raw = () => JSON.parse(readFileSync(new URL('../public/assets/world/map/maritime-buoys.meta.json', import.meta.url), 'utf8'));
const camera = { width: 472, height: 303, zoom: .12455674767974328, center: { x: 2.0864583333333333, y: .3180771200599629 } };

test('shipped buoy metadata retains the four audited placements and natural map scale', () => {
    const metadata = parseMaritimeBuoys(raw())!;
    assert.ok(metadata);
    assert.deepEqual(metadata.instances.map(instance => [instance.route, instance.sprite, instance.point.x, instance.point.y]), [
        ['coast-port', 'sage', .847552380723927, .8276973448682413],
        ['coast-port', 'coral', 1.1726028037900418, .7212261318945039],
        ['reserva-dominio', 'coral', 2.510399567589041, -1.3321437685421882],
        ['reserva-dominio', 'sage', 2.567669768444458, -.8876690091459706],
    ]);
    for (const sprite of Object.values(metadata.sprites)) {
        assert.equal(sprite.widthInMap, 1.5 / 20.6);
        assert.deepEqual(sprite.waterlineAnchor, { x: 80.00003814697266, y: 165.6254117488861 });
    }
});

test('optional buoy metadata rejects unknown routes, bad art, malformed points and extra instances', () => {
    for (const change of [
        (data: any) => { data.version = 2; },
        (data: any) => { data.coordinateSystem = 'island'; },
        (data: any) => { data.sprites.coral.path = '/unexpected.webp'; },
        (data: any) => { data.sprites.sage.width = 0; },
        (data: any) => { data.sprites.sage.widthInMap = Infinity; },
        (data: any) => { data.sprites.coral.waterlineAnchor.y = 209; },
        (data: any) => { data.instances[0].route = 'new-route'; },
        (data: any) => { data.instances[0].sprite = 'unknown'; },
        (data: any) => { data.instances[0].point.x = NaN; },
        (data: any) => { data.instances[0].id = data.instances[1].id; },
        (data: any) => { data.instances[0].route = 'reserva-dominio'; },
        (data: any) => { data.instances.push({ ...data.instances[0], id: 'extra' }); },
    ]) {
        const data = raw(); change(data); assert.equal(parseMaritimeBuoys(data), null);
    }
    for (const data of [null, undefined, {}, [], 1]) assert.equal(parseMaritimeBuoys(data), null);
});

test('buoys use the authored waterline, remain tiny in compact view, and cull only offscreen frames', () => {
    const metadata = parseMaritimeBuoys(raw())!, calls: unknown[][] = [];
    const context = { save() {}, restore() {}, drawImage(...args: unknown[]) { calls.push(args); } } as unknown as CanvasRenderingContext2D;
    const buoys: AtlasMaritimeBuoy[] = metadata.instances.map(instance => ({ point: instance.point,
        sprite: metadata.sprites[instance.sprite], image: { id: instance.id } as unknown as CanvasImageSource }));
    const before = structuredClone(camera);
    paintMaritimeBuoys(context, camera, buoys);
    assert.equal(calls.length, 4); assert.deepEqual(camera, before);
    calls.forEach((draw, index) => {
        const sprite = buoys[index].sprite, waterline = mapToScreen(buoys[index].point, camera);
        const [, x, y, width, height] = draw as [unknown, number, number, number, number];
        assert.ok(Math.abs(x + width * sprite.waterlineAnchor.x / sprite.width - waterline.x) < 1e-10);
        assert.ok(Math.abs(y + height * sprite.waterlineAnchor.y / sprite.height - waterline.y) < 1e-10);
        assert.ok(width < 5 && height < 6, 'Decorations have no minimum display-size inflation.');
    });
    calls.length = 0;
    paintMaritimeBuoys(context, camera, [{ ...buoys[0], point: { x: 10, y: 10 } }, ...buoys, buoys[0]]);
    assert.equal(calls.length, 3, 'Only the first four candidates can draw, and the offscreen one is culled.');
});
