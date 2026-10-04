import assert from 'node:assert/strict';
import test from 'node:test';
import { pixelText, textWidth } from '../src/graphics/BitmapFont';
import { ART } from '../src/graphics/palette';
import { paintGuairaTouchAction } from '../src/adventure/experimental/guaira/GuairaTouchAction';

/** Exact integer rectangles from the production painter, not browser/phone QA. */
function raster() {
    const pixels = new Map<string, string>();
    let scale = 1;
    const ctx = {
        fillStyle: '',
        setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
            assert.deepEqual([b, c, e, f], [0, 0, 0, 0]); assert.equal(a, d); scale = a;
        },
        clearRect() { pixels.clear(); },
        fillRect(x: number, y: number, w: number, h: number) {
            for (const coordinate of [x, y, w, h]) assert.ok(Number.isInteger(coordinate * scale));
            for (let yy = y * scale; yy < (y + h) * scale; yy++) {
                for (let xx = x * scale; xx < (x + w) * scale; xx++) {
                    assert.ok(xx >= 0 && xx < 44 && yy >= 0 && yy < 44, 'all painted pixels stay inside the 44px target');
                    pixels.set(`${xx},${yy}`, ctx.fillStyle);
                }
            }
        }
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, pixels };
}

test('touch captions fit full words below full-size familiar symbols inside unchanged plates', () => {
    for (const [symbol, caption] of [['←', ''], ['→', ''], ['↓', 'Golpe'], ['X', 'Correr'], ['↑', 'Pular']]) {
        const art = raster(), foreground = raster();
        paintGuairaTouchAction(art.ctx, symbol, caption);
        pixelText(foreground.ctx, symbol, 22, caption ? 8 : 15, ART.paper, 2, 'center');
        if (caption) {
            assert.ok(textWidth(caption) <= 36, 'at least four horizontal pixels of padding remain');
            pixelText(foreground.ctx, caption, 22, 27, ART.paper, 1, 'center');
            const captionPixels = [...art.pixels].filter(([position, color]) => color === ART.paper && Number(position.split(',')[1]) >= 27);
            assert.ok(captionPixels.length > 40, 'caption glyphs are actually painted');
            assert.ok(captionPixels.every(([position]) => {
                const [x, y] = position.split(',').map(Number);
                return x >= 4 && x < 40 && y >= 27 && y < 34;
            }), 'captions clear the side edges and bottom trim');
        }
        assert.deepEqual([...art.pixels].filter(([, color]) => color === ART.paper).sort(), [...foreground.pixels].sort(),
            'symbols retain their 2px bitmap scale and captions are not clipped or overwritten');
    }
});
