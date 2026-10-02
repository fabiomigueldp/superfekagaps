/** Export the exact native map actor frames for the Blender geometry audit.
 * node --import tsx tools/diorama/guaira/export_guaira_actor.mjs PROOF_DIRECTORY
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PLAYER_SPRITES, PLAYER_WALK, PLAYER_PALETTE } from '../../../src/assets/playerSpriteSpec.ts';
const output = resolve(process.argv[2] ?? '.');
mkdirSync(output, { recursive: true });
const frames = [PLAYER_SPRITES.idle, ...PLAYER_WALK], opaqueUnion = [];
for (let y = 0; y < 26; y++) for (let x = 0; x < 16; x++) {
    if (frames.some(frame => PLAYER_PALETTE[frame[y][x]])) opaqueUnion.push([x, y]);
}
writeFileSync(join(output, 'feka-actor-source.json'), JSON.stringify({ frames, palette: PLAYER_PALETTE,
    opaqueUnion, pixelWorldWidth: 4.15 * 3 / 384, pixelNormalizedWidth: (4.15 / 20.6) * 3 / 384 }, null, 2));
console.log(`Native Feka audit source: ${frames.length} frames, ${opaqueUnion.length} union pixels`);
