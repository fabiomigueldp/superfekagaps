import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mapStageSignKind, paintPhysicalDockSign, paintPhysicalStageSign, parseMapSignMetadata } from '../src/adventure/WorldMapSignArt';
import { ART } from '../src/graphics/palette';

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
