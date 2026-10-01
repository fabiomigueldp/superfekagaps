import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mapStageSignKind, paintPhysicalDockSign, paintPhysicalStageSign, paintPhysicalTravelSign, parseMapSignMetadata, parseMapFactorySignMetadata, parseMapFactoryLeftSignMetadata } from '../src/adventure/WorldMapSignArt';
import { textWidth } from '../src/graphics/BitmapFont';
import { ART } from '../src/graphics/palette';
import { parseMapIslandSignMetadata, paintPhysicalIslandSign } from '../src/adventure/WorldMapSignArt';

const metadata = () => JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-atlas.meta.json', import.meta.url), 'utf8'));
function canvas() {
    const calls: Array<{ method: string; args: unknown[]; color?: string }> = [];
    const context = { fillStyle: '', imageSmoothingEnabled: true,
        setTransform: (...args: unknown[]) => calls.push({ method: 'setTransform', args }),
        drawImage: (...args: unknown[]) => calls.push({ method: 'drawImage', args }),
        fillRect: (...args: unknown[]) => calls.push({ method: 'fillRect', args, color: context.fillStyle }) };
    const surface = { width: 0, height: 0, style: { transform: '' }, getContext: () => context };
    return { canvas: surface as unknown as HTMLCanvasElement, calls };
}

test('owned island nameboards preserve all six labels, accents and stable native targets', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/island-signs.meta.json', import.meta.url), 'utf8'));
    const data = parseMapIslandSignMetadata(raw); assert.ok(data);
    const bytes = readFileSync(new URL('../public/assets/world/map/island-signs.webp', import.meta.url));
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8X'); assert.ok(bytes[20] & 0x10);
    assert.equal(1 + bytes.readUIntLE(24, 3), data.width); assert.equal(1 + bytes.readUIntLE(27, 3), data.height);
    const atlas = { metadata: data, image: {} as HTMLImageElement };
    for (const label of ['1 COSTA', '2 PORTO', '3 FÁBRICA', '4 SERRA', '5 RESERVA', '6 DOMÍNIO'])
        for (const [selected, open, sourceX] of [[false, true, 0], [true, true, 256], [true, false, 512]] as const) {
            const painted = canvas(); assert.equal(paintPhysicalIslandSign(painted.canvas, atlas, label, selected, open), true);
            assert.equal(painted.canvas.width, 256); assert.equal(painted.canvas.height, 88);
            assert.equal(painted.canvas.style.transform, 'translate(0px, 3px)');
            assert.equal(painted.calls.find(call => call.method === 'drawImage')!.args[1], sourceX);
            for (const pixel of painted.calls.filter(call => call.method === 'fillRect' && call.color === ART.ink)) {
                const [x, y, width, height] = pixel.args as number[], face = data.frames.island.usableFace;
                assert.ok(pixel.args.every(Number.isInteger));
                if (y < face.y) {
                    assert.ok(selected && x >= 56 && x + width <= 72 && y >= 0 && y + height <= 10, 'The selection outline stays above every accented label.');
                    continue;
                }
                assert.ok(x >= face.x && y >= face.y && x + width <= face.x + face.width && y + height <= face.y + face.height);
            }
        }
});

test('selected island pointers retain a contrasting outline at compact size without repainting locks or letters', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/island-signs.meta.json', import.meta.url), 'utf8'));
    const atlas = { metadata: parseMapIslandSignMetadata(raw)!, image: {} as HTMLImageElement };
    let openMarker: unknown;
    for (const open of [true, false]) {
        const selected = canvas(), idle = canvas();
        paintPhysicalIslandSign(selected.canvas, atlas, '6 DOMÍNIO', true, open);
        paintPhysicalIslandSign(idle.canvas, atlas, '6 DOMÍNIO', false, open);
        const lettering = (painted: ReturnType<typeof canvas>) => painted.calls.filter(call => call.method === 'fillRect' && Number(call.args[1]) >= 11);
        assert.deepEqual(lettering(selected), lettering(idle), 'Selection never alters the complete accented name.');
        const marker = selected.calls.filter(call => call.method === 'fillRect' && Number(call.args[1]) < 10);
        assert.ok(marker.length > 0);
        assert.equal(idle.calls.some(call => call.method === 'fillRect' && Number(call.args[1]) < 10), false);
        if (open) openMarker = marker; else {
            assert.deepEqual(marker, openMarker, 'A locked preview retains the same clear selection marker.');
            assert.deepEqual(selected.calls.find(call => call.method === 'drawImage'), idle.calls.find(call => call.method === 'drawImage'), 'The locked wood and red keeper are unchanged.');
        }
        const compact = new Map<string, string>();
        for (const call of marker) {
            const [x, y, width, height] = (call.args as number[]).map(value => value / 2);
            assert.ok([x, y, width, height].every(Number.isInteger), 'Every marker block survives 50% display scale as whole pixels.');
            for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) compact.set(`${px},${py}`, call.color!);
        }
        assert.deepEqual(new Set(compact.values()), new Set([ART.ink, ART.paper, ART.gold]));
        const xs = [...compact.keys()].map(key => Number(key.split(',')[0])), ys = [...compact.keys()].map(key => Number(key.split(',')[1]));
        assert.equal(Math.max(...xs) - Math.min(...xs) + 1, 8); assert.equal(Math.max(...ys) - Math.min(...ys) + 1, 5);
        for (const [key, color] of compact) if (color !== ART.ink) {
            const [x, y] = key.split(',').map(Number);
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
                assert.ok(compact.has(`${x + dx},${y + dy}`), 'Cream and brass remain enclosed by the dark outline at compact size.');
        }
    }
});

test('malformed island name art cannot shrink targets, clip accents or shift a selected board', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/island-signs.meta.json', import.meta.url), 'utf8'));
    for (const change of [
        (data: any) => { data.frames[0].displaySize.height = 30; },
        (data: any) => { data.frames[1].foot.y += 1; },
        (data: any) => { data.frames[0].usableFace.y = 14; },
        (data: any) => { data.frames[0].sourceRect.x = 256; },
        (data: any) => { data.frames[0].letterCenter.x = Infinity; },
        (data: any) => { data.frames[1] = data.frames[0]; },
        (data: any) => { data.atlas.image = 'other.webp'; },
    ]) { const data = structuredClone(raw); change(data); assert.equal(parseMapIslandSignMetadata(data), null); }
    const reordered = structuredClone(raw);
    reordered.frames[0].foot = { y: raw.frames[0].foot.y, x: raw.frames[0].foot.x };
    assert.ok(parseMapIslandSignMetadata(reordered), 'JSON key order does not change geometry.');
    const fallback = canvas(); assert.equal(paintPhysicalIslandSign(fallback.canvas, null, '1 COSTA', false, true), false);
    assert.equal(fallback.calls.length, 0);
});

test('frozen atlas metadata preserves native targets, integer bitmap text and a subpixel foot error', () => {
    const raw = metadata(), data = parseMapSignMetadata(raw); assert.ok(data);
    assert.equal(data.width, 560); assert.equal(data.height, 232); assert.equal(Object.keys(data.frames).length, 7);
    for (const frame of Object.values(data.frames)) {
        assert.deepEqual(frame.displaySize, frame.kind.startsWith('dock-') ? { width: 104, height: 56 } : { width: 56, height: 58 });
        const shift = Math.round(frame.displaySize.height - frame.foot.y);
        assert.ok(Math.abs(frame.foot.y + shift - frame.displaySize.height) < .4);
        assert.equal(shift, frame.kind.startsWith('dock-') ? 10 : 11);
    }
    for (const change of [
        (copy: any) => { copy.frames.pop(); },
        (copy: any) => { copy.frames[1] = copy.frames[0]; },
        (copy: any) => { copy.frames[0].sourceRect.x = -1; },
        (copy: any) => { copy.frames[0].sourceRect.width = 1; },
        (copy: any) => { copy.frames[0].foot.y = NaN; },
        (copy: any) => { copy.frames[0].letterCenter.x = 500; },
        (copy: any) => { copy.frames[0].letterPixelScale = 1.5; },
        (copy: any) => { copy.atlas.image = 'https://example.invalid/unexpected.webp'; },
    ]) { const copy = structuredClone(raw); change(copy); assert.equal(parseMapSignMetadata(copy), null); }
});

test('stage state variants retain completion under selection and physical locking under locked preview', () => {
    assert.equal(mapStageSignKind(false, false, true), 'stage');
    assert.equal(mapStageSignKind(true, false, true), 'selected');
    assert.equal(mapStageSignKind(false, true, true), 'complete');
    assert.equal(mapStageSignKind(true, true, true), 'selected-complete');
    assert.equal(mapStageSignKind(true, false, false), 'locked');
    const atlas = { metadata: parseMapSignMetadata(metadata())!, image: {} as HTMLImageElement };
    for (let world = 1; world <= 6; world++) for (let phase = 1; phase <= 5; phase++) {
        const painted = canvas();
        assert.equal(paintPhysicalStageSign(painted.canvas, atlas, `${world}-${phase}`, true, true, true), true);
        assert.equal(painted.canvas.width, 112); assert.equal(painted.canvas.height, 116);
        assert.equal(painted.canvas.style.transform, 'translate(0px, 11px)');
        const draw = painted.calls.find(call => call.method === 'drawImage')!;
        assert.deepEqual(draw.args.slice(1, 5), [448, 0, 112, 116]);
        for (const call of painted.calls.filter(call => call.method === 'fillRect')) {
            assert.equal(call.color, ART.ink, 'IDs retain contrast on selected and closed pale faces.');
            assert.ok(call.args.every(Number.isInteger), 'Glyph cells must stay on whole CSS pixels.');
        }
    }
});

test('physical dock arrows retain names and attached gate marker without a floating lock', () => {
    const atlas = { metadata: parseMapSignMetadata(metadata())!, image: {} as HTMLImageElement };
    for (const world of [1, 2]) {
        const painted = canvas();
        assert.equal(paintPhysicalDockSign(painted.canvas, atlas, world, false), true);
        assert.equal(painted.canvas.width, 208); assert.equal(painted.canvas.height, 112);
        assert.equal(painted.canvas.style.transform, 'translate(0px, 10px)');
        const draw = painted.calls.find(call => call.method === 'drawImage')!;
        assert.equal(draw.args[1], world === 1 ? 208 : 0);
        // Authored support centers: COSTA x80.51, PORTO x23.49 CSSpx.
        const bandX = world === 1 ? 79 : 22;
        assert.ok(painted.calls.some(call => call.method === 'fillRect' && call.color === ART.gold && call.args.join(',') === `${bandX},35,4,1`));
    }
    const fallback = canvas();
    assert.equal(paintPhysicalStageSign(fallback.canvas, null, '1-1', true, false, true), false);
    assert.equal(paintPhysicalDockSign(fallback.canvas, null, 2, false), false);
    assert.equal(fallback.calls.length, 0, 'Missing decoration leaves the existing procedural renderer available.');
});


test('Factory arrow provides measured room for every original bitmap cell including its accent', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-factory.meta.json', import.meta.url), 'utf8'));
    const frame = parseMapFactorySignMetadata(raw); assert.ok(frame);
    assert.equal(textWidth('FÁBRICA', 2), 82);
    assert.ok(frame.usableFace.width > 82); assert.ok(frame.usableFace.height >= 18);
    const painted = canvas();
    assert.equal(paintPhysicalTravelSign(painted.canvas, null, { frame, image: {} as HTMLImageElement },
        { label: 'FÁBRICA', direction: 'right', wide: true }, true), true);
    assert.equal(painted.canvas.width, 256); assert.equal(painted.canvas.height, 112);
    for (const call of painted.calls.filter(call => call.method === 'fillRect')) {
        const [x, y, width, height] = call.args as number[];
        assert.equal(call.color, ART.ink); assert.ok(call.args.every(Number.isInteger));
        assert.ok(x >= frame.usableFace.x && x + width <= frame.usableFace.x + frame.usableFace.width);
        assert.ok(y >= frame.usableFace.y && y + height <= frame.usableFace.y + frame.usableFace.height, 'Accent cells must stay on the painted plank.');
    }
    for (const change of [
        (copy: any) => { copy.frames[0].usableFace.width = 65; },
        (copy: any) => { copy.frames[0].usableFace.y = 14; },
        (copy: any) => { copy.frames[0].displaySize.width = 104; },
        (copy: any) => { copy.frames[0].sourceRect.x = 1; },
        (copy: any) => { copy.atlas.image = 'signs-atlas.webp'; },
    ]) { const copy = structuredClone(raw); change(copy); assert.equal(parseMapFactorySignMetadata(copy), null); }
});

test('the two Porto signs use opposite physical arrows and departure-side gates', () => {
    const atlas = { metadata: parseMapSignMetadata(metadata())!, image: {} as HTMLImageElement };
    for (const direction of ['left', 'right'] as const) {
        const painted = canvas();
        assert.equal(paintPhysicalTravelSign(painted.canvas, atlas, null, { label: 'PORTO', direction }, false), true);
        const draw = painted.calls.find(call => call.method === 'drawImage')!;
        assert.equal(draw.args[1], direction === 'left' ? 208 : 0);
        const bandX = direction === 'left' ? 79 : 22;
        assert.ok(painted.calls.some(call => call.method === 'fillRect' && call.color === ART.gold && call.args.join(',') === `${bandX},35,4,1`));
    }
    const fallback = canvas();
    assert.equal(paintPhysicalTravelSign(fallback.canvas, atlas, null, { label: 'FÁBRICA', direction: 'right', wide: true }, false), false);
    assert.equal(fallback.calls.length, 0, 'A missing wide prop cannot squeeze Factory lettering onto the short board.');
});

test('the Serra return uses its own left Factory blank, full accented lettering and right-side support gate', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-factory-left.meta.json', import.meta.url), 'utf8'));
    const frame = parseMapFactoryLeftSignMetadata(raw); assert.ok(frame);
    assert.equal(parseMapFactorySignMetadata(raw), null, 'The left supplement cannot replace the released right-arrow image.');
    const atlas = { frame, image: {} as HTMLImageElement }, painted = canvas();
    assert.equal(paintPhysicalTravelSign(painted.canvas, null, atlas, { label: 'FÁBRICA', direction: 'left', wide: true }, true), true);
    assert.equal(painted.canvas.width, 256); assert.equal(painted.canvas.height, 112);
    assert.equal(painted.canvas.style.transform, 'translate(0px, 10px)');
    assert.ok(Math.abs(frame.foot.y + 10 - frame.displaySize.height) < .4);
    for (const call of painted.calls.filter(call => call.method === 'fillRect')) {
        const [x, y, width, height] = call.args as number[];
        assert.equal(call.color, ART.ink); assert.ok(call.args.every(Number.isInteger));
        assert.ok(x >= frame.usableFace.x && x + width <= frame.usableFace.x + frame.usableFace.width);
        assert.ok(y >= frame.usableFace.y && y + height <= frame.usableFace.y + frame.usableFace.height, 'The acute accent stays on the measured face.');
    }
    const closed = canvas();
    paintPhysicalTravelSign(closed.canvas, null, atlas, { label: 'FÁBRICA', direction: 'left', wide: true }, false);
    assert.ok(closed.calls.some(call => call.method === 'fillRect' && call.color === ART.gold && call.args.join(',') === '103,35,4,1'));
    const wrongDirection = canvas();
    assert.equal(paintPhysicalTravelSign(wrongDirection.canvas, null, atlas, { label: 'FÁBRICA', direction: 'right', wide: true }, true), false);
    assert.equal(wrongDirection.calls.length, 0);
    for (const change of [
        (copy: any) => { copy.frames[0].kind = 'factory-right'; },
        (copy: any) => { copy.atlas.image = 'signs-factory.webp'; },
        (copy: any) => { copy.frames[0].letterCenter.y = 10; },
        (copy: any) => { copy.frames[0].displaySize.width = 104; },
    ]) { const copy = structuredClone(raw); change(copy); assert.equal(parseMapFactoryLeftSignMetadata(copy), null); }
});

test('Serra lettering fits the released right arrow without changing its target or left support', () => {
    const atlas = { metadata: parseMapSignMetadata(metadata())!, image: {} as HTMLImageElement }, painted = canvas();
    const frame = atlas.metadata.frames['dock-right'];
    assert.equal(paintPhysicalTravelSign(painted.canvas, atlas, null, { label: 'SERRA', direction: 'right' }, true), true);
    assert.equal(painted.canvas.width, 208); assert.equal(painted.canvas.height, 112);
    for (const call of painted.calls.filter(call => call.method === 'fillRect')) {
        const [x, y, width, height] = call.args as number[];
        assert.ok(x >= frame.usableFace.x && x + width <= frame.usableFace.x + frame.usableFace.width);
        assert.ok(y >= frame.usableFace.y && y + height <= frame.usableFace.y + frame.usableFace.height);
    }
});
