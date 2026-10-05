import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { fitText, pixelText, textWidth, wrapText } from '../src/graphics/BitmapFont';

// Ordered drawing snapshots from c1bd522, before the glyph compilation change.
// Preserve individual rectangles: merging them changes alpha/compositing behavior.
const snapshots = [
  ['ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 215, 'db54f3179c04cbf42037e557ccb3d15237cf5782b1b3e82873e71c38cf1e1d83'],
  ['. , : ! ? - + / × ( ) " \' ← → ↓ ↑ · % ° ★ ♥', 181, '8a91ee164306d0d7ec24c80ca59612506d73dbdc154a5d534f90fe9c28041873'],
  ['áàâãéêíóôõúüç ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 159, '6249e4b7c1fc1089377994c29d7ead4226a336228531ab7209bec4ae3353aa3e'],
  ['a\u0301 A\u0303\u0327 ß ﬁ İ Å', 85, 'f468f9965b4c3bb5ef46da4edd5bbb71c2fcc8b381b50fe505c5717795db6ba0'],
  ['未知 🦊 𝒜 \ud800 \udc00 \n\t', 67, '57c26c59c4d2b93428a9807b2c166390fdc12bfbd2fe9f5fb5b25790a0b2ace1'],
  ['', 0, '8b4240f08e6479ac33b972059e578bc26b26dacdac1177c8ea14d4f44bc37eb2'],
  ['   ', 11, '8b4240f08e6479ac33b972059e578bc26b26dacdac1177c8ea14d4f44bc37eb2'],
  ['GUAÍRA: ÁGUA LIBERADA · 43/72', 157, '79971bb7de94b765f7c934466bae4b1dc3335070b2c5fcda3cf855ce49deac8b'],
] as const;

for (const [value, width, expected] of snapshots) test(`bitmap font preserves legacy pixels and width: ${JSON.stringify(value)}`, () => {
  const calls: unknown[] = [];
  const ctx = {
    set fillStyle(color: string) { calls.push(['color', color]); },
    fillRect(...args: number[]) { calls.push(args); },
  } as unknown as CanvasRenderingContext2D;
  for (const scale of [.5, 1, 1.25, 2, 0, -1]) for (const align of ['left', 'center', 'right'] as const)
    pixelText(ctx, value, 160.3, 10.6, 'rgba(1, 2, 3, .4)', scale, align);
  assert.equal(textWidth(value), width);
  assert.equal(createHash('sha256').update(JSON.stringify(calls)).digest('hex'), expected);
});

test('bitmap layout preserves unknown advance, expansion, spaces and wrapping', () => {
  assert.equal(textWidth('?'), 4);
  assert.equal(textWidth('🦊'), 5); // Same fallback drawing, intentionally wider advance.
  assert.equal(textWidth('ß'), 11); // Uppercase expansion to SS.
  assert.equal(textWidth(' '), 3);
  assert.equal(textWidth(''), 0);
  assert.equal(fitText('ÁGUA LIBERADA', 25), 'ÁGU...');
  assert.deepEqual(wrapText('A ÁGUA SEGUE PARA GUAÍRA', 34), ['A ÁGUA', 'SEGUE', 'PARA', 'GUAÍR', 'A']);
});

test('repeated text uses current color, position, scale and destination', () => {
  function record() {
    const calls: unknown[] = [];
    return { calls, ctx: {
      fillStyle: '',
      fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) { calls.push([this.fillStyle, x, y, w, h]); },
    } as unknown as CanvasRenderingContext2D };
  }
  const first = record(), second = record();
  pixelText(first.ctx, 'Á', 4, 10, 'red');
  const count = first.calls.length;
  pixelText(first.ctx, 'Á', 20, 30, 'blue', 2);
  pixelText(second.ctx, 'Á', 20, 30, 'blue', 2);
  assert.deepEqual(first.calls.slice(count), second.calls);
  assert.notDeepEqual(first.calls.slice(0, count), second.calls);
});
