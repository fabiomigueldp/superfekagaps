import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTileSource } from '../scripts/normalize_tiles';

test('normalizer handles exported DATA files with quoted keys and preserves other fields', () => {
  const source = `import type { LevelData } from '../../types';
// Keep this comment and metadata exactly as written.
export const DATA: LevelData = {
  "id": "custom-world",
  "width": 3,
  "height": 2,
  "tiles": [[1, 2], [3, 4, 5, 6]],
  "originX": -10,
  "name": "Keep [brackets], tiles: and apostrophes'"
};
`;
  const result = normalizeTileSource(source, 'custom.ts');
  assert.equal(result.changed, true);
  assert.match(result.source, /\[1, 2, 0\]/);
  assert.match(result.source, /\[3, 4, 5\]/);
  assert.equal(result.source.slice(0, result.source.indexOf('"tiles"')), source.slice(0, source.indexOf('"tiles"')));
  assert.equal(result.source.slice(result.source.indexOf('"originX"')), source.slice(source.indexOf('"originX"')));
  assert.deepEqual(normalizeTileSource(result.source, 'custom.ts'), { source: result.source, changed: false });
});

test('normalizer respects declared height and Windows line endings', () => {
  const source = 'export const DATA = {\r\n  width: 2, height: 3, tiles: [[1]]\r\n};\r\n';
  const result = normalizeTileSource(source, 'custom.ts');
  assert.match(result.source, /\[1, 0\]/);
  assert.equal(result.source.match(/\[0, 0\]/g)?.length, 2);
  assert.equal(result.source.replace(/\r\n/g, '').includes('\n'), false);
});

test('normalizer refuses unsupported declarations instead of replacing unrelated source', () => {
  assert.throws(() => normalizeTileSource('export const DATA = {width: 2, height: 1, tiles: [[1};', 'custom.ts'), /sintaxe inválida/);
  assert.throws(() => normalizeTileSource('export const DATA = loadLevel();', 'custom.ts'), /objeto literal/);
  assert.throws(() => normalizeTileSource('export const DATA = {width: 0, height: 1, tiles: []};', 'custom.ts'), /inteiro positivo/);
  assert.throws(() => normalizeTileSource('export const DATA = {width: 2, height: 1, tiles: [[...other]]};', 'custom.ts'), /spreads/);
});
