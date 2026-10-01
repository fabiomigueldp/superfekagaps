/** Export the real source sprite masks for the Blender link audit.
 * Run from the repository: node --import tsx tools/diorama/export_factory_serra_sprite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_SPRITES } from '../../src/assets/playerSpriteSpec.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.FEKA_FACTORY_SERRA_OUT || '/tmp/feka-factory-serra-link';
const atlas = fs.readFileSync(path.join(root, 'src/adventure/WorldAtlasArt.ts'), 'utf8');
const formula = atlas.match(/const FEKA_PIXEL_MAP_WIDTH = ([^;]+);/)?.[1];
if (!formula || !/^[0-9\s()+*/.]+$/.test(formula)) throw new Error('Unexpected atlas pixel formula');
const frames = Object.fromEntries(['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6'].map(key => [key, PLAYER_SPRITES[key]]));
if (Object.values(frames).some(rows => rows.length !== 26 || rows.some(row => row.length !== 16))) throw new Error('Unexpected Feka source grid');
const record = { source: 'src/assets/playerSpriteSpec.ts; src/adventure/WorldAtlasArt.ts; src/adventure/WorldMapArt.ts', foot: [8, 26], pixelMapWidth: Function('return ' + formula)(), formula, frames };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'feka-sprite-source.json'), JSON.stringify(record, null, 2) + '\n');
console.log('EXPORTED_FACTORY_SERRA_SPRITE=' + path.join(output, 'feka-sprite-source.json'));
