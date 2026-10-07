import { TileType as T } from '../constants';
import { drawBlockImpacts } from '../graphics/blockImpactArt';
import { TilePainter } from '../graphics/TilePainter';
import type { Island } from './types';
import type { WorldLevel } from './WorldPhysics';
import { box, pixelLine, polygon, rivet, ink } from './WorldPainting';
const original = new TilePainter();
function platform(c: CanvasRenderingContext2D, x: number, y: number, world: number, col: number, falling: boolean, left: boolean, right: boolean) {
    const metal = [2, 3, 5].includes(world);
    box(c, x, y, 16, 7, ink);
    box(c, x, y, 16, 2, metal ? '#cbdedc' : world === 6 ? '#f0dab2' : '#e0bb7d');
    box(c, x + 1, y + 2, 15, 3, metal ? '#608ba2' : world === 6 ? '#b5a19a' : '#9b6d50');
    box(c, x + 1, y + 5, 15, 2, metal ? '#304e68' : '#674d49');
    if (metal) {
        rivet(c, x + 6, y + 2);
        if (left || right)
            box(c, x + (left ? 0 : 14), y + 2, 2, 7, '#284157');
    }
    else {
        box(c, x + (col % 2 ? 5 : 10), y + 3, 5, 1, '#be9468');
        box(c, x + 15, y + 2, 1, 4, '#533e3d');
    }
    if (falling) {
        pixelLine(c, x + 8, y + 1, x + 5, y + 4, '#674648');
        pixelLine(c, x + 5, y + 4, x + 9, y + 6, '#674648');
    }
    if (left || right)
        polygon(c, [[x + (left ? 1 : 15), y + 7], [x + (left ? 7 : 9), y + 7], [x + (left ? 1 : 15), y + 13]], metal ? '#36596f' : '#795945');
}
export function drawWorldTerrain(c: CanvasRenderingContext2D, level: WorldLevel, island: Island, cx: number, cy: number, time: number, reducedMotion = false) {
    const tiles = level.getRenderTiles(), world = island.id;
    for (let row = Math.max(0, Math.floor(cy / 16)); row < Math.min(tiles.length, Math.ceil((cy + 180) / 16) + 1); row++)
        for (let col = Math.max(0, Math.floor(cx / 16)); col < Math.min(level.data.width, Math.ceil((cx + 320) / 16) + 1); col++) {
            const t = tiles[row][col];
            if (!t)
                continue;
            const x = col * 16 - cx, y = row * 16 - cy, above = tiles[row - 1]?.[col], left = tiles[row][col - 1] === t, right = tiles[row][col + 1] === t;
            const v = ((Math.imul(col + 7, 73856093) ^ Math.imul(row + 3, 19349663)) >>> 0) % 23;
            if (t === T.PLATFORM || t === T.PLATFORM_FALLING) {
                platform(c, x, y, world, col, t === T.PLATFORM_FALLING, !left, !right);
                continue;
            }
            if (t === T.ICE) {
                box(c, x, y, 16, 16, '#4c93ba');
                box(c, x, y, 16, 3, '#e3fbef');
                box(c, x + 1, y + 3, 14, 3, '#aee7ee');
                polygon(c, [[x, y + 9], [x + 10, y + 3], [x + 16, y + 6], [x + 5, y + 14]], '#74c2d9');
                pixelLine(c, x + 2, y + 12, x + 11, y + 5, '#c1f2f2');
                box(c, x, y + 15, 16, 1, '#315e85');
                if (!left)
                    box(c, x, y + 3, 2, 13, '#c5f3ec');
                if (!right)
                    box(c, x + 14, y + 3, 2, 13, '#355d86');
                continue;
            }
            if (t !== T.GROUND) {
                original.draw(c, t, x, y + (t === T.BRICK ? level.blockImpacts.offset(col, row, reducedMotion) : 0), tiles, row, col, world === 6 ? 'citadel' : world === 5 ? 'ember' : 'meadow', time, col, row);
                continue;
            }
            const top = above !== T.GROUND && above !== T.ICE;
            if (world === 1 && level.data.isBossLevel && col > 3 && col < 17) {
                box(c, x, y, 16, 16, '#795b49');
                box(c, x, y + 3, 15, 4, '#a47b51');
                box(c, x, y + 9, 15, 4, '#956a4a');
                box(c, x + 15, y, 1, 16, '#423f42');
                box(c, x, y + 7, 16, 2, '#5b4540');
                box(c, x + 3, y + 4, 6, 1, '#c1935e');
                if (top) {
                    box(c, x, y, 16, 2, '#eed098');
                    box(c, x + 2, y + 2, 12, 1, '#c9a06a');
                    box(c, x + 3, y + 4, 2, 2, '#554c49');
                }
                continue;
            }
            if (world === 1) {
                box(c, x, y, 16, 16, v % 3 ? '#b18a64' : '#b9926b');
                if (row % 3 === 0) {
                    box(c, x, y + 12, 16, 3, '#9b795e');
                    box(c, x + ((col % 3) * 3), y + 11, 7, 1, '#d2ad7a');
                }
                if (v % 5 === 0) {
                    polygon(c, [[x + 2, y + 5], [x + 10, y + 3], [x + 14, y + 7], [x + 11, y + 12], [x + 3, y + 11]], '#c8a478');
                    box(c, x + 4, y + 5, 7, 1, '#e3c38b');
                    box(c, x + 9, y + 11, 4, 1, '#947465');
                }
                if (!left) {
                    box(c, x, y, 2, 16, '#ecd29b');
                    box(c, x + 2, y + 4, 1, 8, '#d6b67f');
                }
                if (!right)
                    box(c, x + 13, y, 3, 16, '#826c62');
                if (top) {
                    box(c, x, y, 16, 2, '#c7db7b');
                    box(c, x, y + 2, 16, 3, '#7ead4b');
                    box(c, x, y + 5, 16, 2, '#497b48');
                    box(c, x + v % 9, y + 5, 3, 3, '#6c994b');
                    box(c, x + 9, y + 2, 4, 1, '#a4c963');
                    if (col % 4 === 1) {
                        pixelLine(c, x + 4, y + 7, x + 6, y + 12, '#6f7150');
                        pixelLine(c, x + 6, y + 12, x + 9, y + 13, '#6f7150');
                    }
                }
            }
            else if (world === 4) {
                box(c, x, y, 16, 16, '#6b8a9c');
                polygon(c, [[x, y], [x + 9, y], [x + 5, y + 16], [x, y + 16]], '#99adb0');
                box(c, x + (col % 3) * 4, y, 2, 16, '#587186');
                if (row % 3 === 1)
                    pixelLine(c, x, y + 12, x + 15, y + 9, '#465f76');
                if (v % 4 === 0)
                    box(c, x + 7, y + 5, 5, 2, '#aec0bc');
                if (!left)
                    box(c, x, y, 2, 16, '#c3cec0');
                if (!right)
                    box(c, x + 14, y, 2, 16, '#405771');
                if (top) {
                    box(c, x, y, 16, 2, '#d1dfa9');
                    box(c, x, y + 2, 16, 2, '#8baa6b');
                    box(c, x + v % 12, y + 4, 3, 4, '#658d61');
                }
            }
            else if (world === 6) {
                box(c, x, y, 16, 16, '#c7b797');
                box(c, x, y + 14, 16, 2, '#8f8690');
                box(c, x, y + 1, 16, 1, '#e6d3aa');
                const seam = row % 2 ? 7 : 15;
                box(c, x + seam, y, 1, 15, '#998b86');
                box(c, x + seam + 1, y + 2, 1, 11, '#daccaa');
                if (v % 4 === 0)
                    box(c, x + 3, y + 6, 5, 1, '#ac9b8c');
                if (!left)
                    box(c, x, y, 2, 16, '#f0ddb4');
                if (!right)
                    box(c, x + 14, y, 2, 16, '#8d8190');
                if (top) {
                    box(c, x, y, 16, 3, '#f5e4bd');
                    box(c, x, y + 3, 16, 2, '#d8c39d');
                    box(c, x, y + 5, 16, 1, '#938a87');
                    if (col % 5 === 2) {
                        box(c, x + 6, y, 6, 2, '#97b976');
                    }
                }
            }
            else {
                // Large joined plates: the material reads as a structure, not a grid of identical cubes.
                const cold = world === 5;
                box(c, x, y, 16, 16, cold ? '#426c87' : '#345a73');
                if (col % 4 === 0) {
                    box(c, x, y, 3, 16, '#213d56');
                    box(c, x + 3, y, 2, 16, cold ? '#8ab5c5' : '#6a91a2');
                }
                if (row % 3 === 2) {
                    box(c, x, y + 12, 16, 4, '#223e56');
                    box(c, x, y + 12, 16, 1, '#658d9e');
                }
                // Braces continue across the 4 x 3 plate group instead of isolated diagonal marks.
                for (let py = 0; py < 16; py++)
                    for (const gx of [Math.round(((row % 3) * 16 + py) * 64 / 48), 63 - Math.round(((row % 3) * 16 + py) * 64 / 48)]) {
                        const px = gx - (col % 4) * 16;
                        if (px >= 0 && px < 15) {
                            box(c, x + px, y + py, 2, 1, '#52798f');
                            box(c, x + px, y + py, 1, 1, '#7699aa');
                        }
                    }
                if (v % 5 === 0) {
                    for (let j = 0; j < 3; j++)
                        box(c, x + 5, y + 5 + j * 3, 8, 1, '#203e55');
                }
                if (!left) {
                    box(c, x, y, 3, 16, '#85aebb');
                    box(c, x + 3, y, 2, 16, '#26455d');
                }
                if (!right) {
                    box(c, x + 12, y, 2, 16, '#698f9f');
                    box(c, x + 14, y, 2, 16, ink);
                }
                if (top) {
                    box(c, x, y, 16, 2, world === 2 ? '#efcb85' : '#c9dfda');
                    box(c, x, y + 2, 16, 4, world === 2 ? '#ab7e54' : '#759cad');
                    box(c, x, y + 6, 16, 2, ink);
                    if (world === 2) {
                        box(c, x + 2, y + 3, 8, 1, '#d4aa6f');
                        box(c, x + 15, y, 1, 7, '#76584d');
                    }
                    else
                        rivet(c, x + 7, y + 3);
                }
            }
        }
    drawBlockImpacts(c, level.blockImpacts, cx, cy, world === 6 ? 'citadel' : 'meadow', reducedMotion);
}
