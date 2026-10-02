import { box as r, pixelLine as line, polygon, roof } from '../../../WorldPainting';
import type { WorldLevel, WorldObjects } from '../../../WorldPhysics';
import { TileType } from '../../../../constants';
import { supportsStanding, isOneWayTile } from '../../../../world/tileRules';
import { pixelText } from '../../../../graphics/BitmapFont';

/** Existing Guaíra clay, plaster, wood and iron hues; no texture payloads. */
export const GALLERY_MATERIAL_COLORS = Object.freeze({
    ink: '#493c43', clay: '#b86b4c', clayLight: '#d68b5b', clayShade: '#874a3e',
    fracture: '#493c43', fractureLight: '#e8b17c',
    stone: '#8d7968', stoneShade: '#695449', stoneLight: '#bda080',
    cap: '#f2d69b', mortar: '#a58a68', wood: '#997454', woodLight: '#d1ac77',
    iron: '#687776', ironShade: '#4e5c5c', plaster: '#e3c49a', plasterShade: '#bf967d',
});
const P = GALLERY_MATERIAL_COLORS;

function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save(); c.beginPath(); c.rect(0, 23, 320, 157); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    draw(Number.isFinite(cx) ? Math.round(cx) : 0, Number.isFinite(cy) ? Math.round(cy) : 0);
    c.restore();
}

/** An intact tile still fills its collider. The dark fissure is a material mark,
 * not a painted hole: native destruction alone removes the whole tile. */
function clayCover(c: CanvasRenderingContext2D, x: number, y: number, alternate: boolean) {
    r(c, x, y, 16, 16, P.clayShade);
    r(c, x + 1, y + 1, 14, 13, P.clay);
    r(c, x + 1, y + 1, 14, 3, P.clayLight);
    r(c, x + 2, y + 5, 3, 7, P.clayLight);
    r(c, x + 11, y + 8, 3, 5, P.clayShade);
    // Branching silhouette reads even without colour; safe masonry never has it.
    const crack = alternate ? [[9,0],[7,4],[9,7],[6,10],[8,15]] : [[6,0],[8,4],[5,7],[8,11],[6,15]];
    for (let i = 1; i < crack.length; i++) {
        const a = crack[i - 1], b = crack[i];
        line(c, x + a[0] + 1, y + a[1], x + b[0] + 1, y + b[1], P.fractureLight);
        line(c, x + a[0], y + a[1], x + b[0], y + b[1], P.fracture);
    }
    line(c, x + (alternate ? 9 : 5), y + 7, x + (alternate ? 14 : 1), y + 9, P.fracture);
    r(c, x + 2, y + 14, 3, 1, P.clayLight);
    r(c, x + 10, y + 14, 3, 1, P.clayLight);
}

function returnBoard(c: CanvasRenderingContext2D, x: number, y: number, left: boolean, right: boolean) {
    // The native one-way surface has no solid volume below it. Keep the return
    // route visibly open: only an eight-pixel board, never a supporting post.
    r(c, x, y, 16, 2, P.cap);
    r(c, x, y + 2, 16, 4, P.wood);
    r(c, x + 2, y + 3, 11, 1, P.woodLight);
    r(c, x, y + 6, 16, 2, P.stoneShade);
    if (left || right) {
        const edge = left ? x + 1 : x + 12;
        r(c, edge, y + 2, 3, 5, P.ironShade);
        r(c, edge + 1, y + 3, 1, 1, P.stoneLight);
    }
}

function masonry(c: CanvasRenderingContext2D, x: number, y: number, col: number, row: number,
    top: boolean, left: boolean, right: boolean, bottom: boolean) {
    r(c, x, y, 16, 16, P.stone);
    // Broad staggered courses are quieter than the brittle clay's diagonal marks.
    r(c, x, y + 14, 16, 2, P.stoneShade);
    const seam = row % 2 ? 3 : 11;
    r(c, x + seam, y + (top ? 4 : 0), 1, top ? 10 : 14, P.stoneShade);
    if ((col + row * 3) % 4 === 0) r(c, x + 2, y + 7, 5, 2, P.mortar);
    if ((col + row) % 3 === 0) r(c, x + 9, y + 10, 4, 1, P.stoneLight);
    if (left) { r(c, x, y, 2, 16, P.stoneShade); r(c, x + 2, y + 2, 1, 12, P.stoneLight); }
    if (right) r(c, x + 14, y, 2, 16, P.stoneShade);
    if (bottom) r(c, x, y + 14, 16, 2, P.ironShade);
    if (top) {
        // A continuous two-pixel pale edge is reserved for true safe landings.
        r(c, x, y, 16, 2, P.cap);
        r(c, x, y + 2, 16, 2, P.stoneLight);
    }
}

/** The narrow barriers are service partitions suspended from the workshop
 * above, not hanging blocks of masonry. Continuous iron straps lead upward
 * beyond the view; the closed timber panel has no pale shelf-like lower edge. */
function servicePartition(c: CanvasRenderingContext2D, x: number, y: number, row: number, bottom: boolean) {
    r(c, x, y, 16, 16, P.ironShade);
    r(c, x + 3, y, 10, 16, '#a58a68');
    r(c, x + 4, y, 3, 16, '#c0a17a');
    r(c, x + 8, y, 1, 16, '#92745b');
    r(c, x + 1, y, 2, 16, P.iron);
    r(c, x + 13, y, 2, 16, P.iron);
    // Diagonal braces stay inside the real barrier and differ from branching cracks.
    if (row % 2 === 0) {
        line(c, x + 4, y + 2, x + 11, y + 13, '#92745b', 2);
        r(c, x + 3, y + 1, 10, 2, P.ironShade);
        r(c, x + 2, y + 1, 1, 1, '#b1a18a');
        r(c, x + 13, y + 1, 1, 1, '#b1a18a');
    }
    if (bottom) {
        r(c, x, y + 12, 16, 4, P.ironShade);
        r(c, x + 2, y + 13, 12, 1, P.iron);
        r(c, x + 3, y + 14, 1, 1, '#b1a18a');
        r(c, x + 12, y + 14, 1, 1, '#b1a18a');
    }
}

/** Presentation reads native tiles on every render, so partial holes and head
 * bumps cannot leave an obsolete cover or an invented support on screen. */
export function drawGalleryTerrain(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const firstCol = Math.max(0, level.worldToCol(cameraX)), lastCol = Math.min(level.data.width - 1, level.worldToCol(cameraX + 319));
        const firstRow = Math.max(0, level.worldToRow(cameraY + 23)), lastRow = Math.min(level.data.height - 1, level.worldToRow(cameraY + 179));
        const solid = (col: number, row: number) => {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            return supportsStanding(tile) && !isOneWayTile(tile);
        };
        const partitionEnds = new Map<number, number>();
        for (let col = firstCol; col <= lastCol; col++) {
            if (!solid(col,0) || solid(col - 1,0) || solid(col + 1,0)) continue;
            let end = 1;
            while (end < level.data.height && solid(col,end)) end++;
            partitionEnds.set(col,end);
        }
        for (let row = firstRow; row <= lastRow; row++) for (let col = firstCol; col <= lastCol; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile)) continue;
            const x = level.colToWorldX(col) - cameraX, y = level.rowToWorldY(row) - cameraY;
            if (tile === TileType.BRICK_BREAKABLE) { clayCover(c, x, y, col % 2 === 1); continue; }
            if (isOneWayTile(tile)) {
                returnBoard(c, x, y, !isOneWayTile(level.data.tiles[row]?.[col - 1] ?? 0), !isOneWayTile(level.data.tiles[row]?.[col + 1] ?? 0));
                continue;
            }
            // Recognise only a real one-tile column continuous to the stage's
            // upper boundary. The lower disconnected floor remains masonry.
            const upperPartition = row < (partitionEnds.get(col) ?? 0);
            if (upperPartition) { servicePartition(c,x,y,row,!solid(col,row + 1)); continue; }
            masonry(c, x, y, col, row, !solid(col, row - 1), !solid(col - 1, row), !solid(col + 1, row), !solid(col, row + 1));
        }
    });
}

/** A quiet wall-mounted repair niche, away from the actor and jump corridor.
 * Muted tools and an inset frame cannot be mistaken for a usable platform. */
function toolNiche(c: CanvasRenderingContext2D, x: number, y: number) {
    r(c, x, y, 48, 30, '#b6977c');
    r(c, x + 2, y + 2, 44, 27, '#a48668');
    r(c, x + 4, y + 3, 40, 23, '#b39876');
    // A long brush, a mason's trowel and a spare timber offcut, not collectibles.
    r(c, x + 10, y + 7, 2, 15, '#92745b');
    r(c, x + 7, y + 18, 8, 5, '#9f7e61');
    r(c, x + 8, y + 21, 1, 3, '#c0a17a');
    r(c, x + 11, y + 21, 1, 3, '#c0a17a');
    r(c, x + 25, y + 6, 2, 7, '#92745b');
    polygon(c, [[x + 24,y + 13],[x + 19,y + 22],[x + 29,y + 21]], '#8e8777');
    r(c, x + 22, y + 20, 5, 1, '#b1a18a');
    r(c, x + 36, y + 10, 4, 13, '#a58a68');
    r(c, x + 37, y + 11, 1, 11, '#c0a17a');
}

function workshop(c: CanvasRenderingContext2D, cx: number, cy: number) {
    const x = 13 - cx, y = 86 - cy;
    r(c, x + 4, y + 15, 129, 62, '#b6977c');
    r(c, x + 6, y + 16, 122, 58, P.plaster);
    r(c, x + 7, y + 19, 118, 2, '#efd6ae');
    roof(c, x, y, 139, 17);
    r(c, x + 12, y + 44, 22, 30, '#9a765e');
    r(c, x + 14, y + 46, 18, 28, '#816257');
    r(c, x + 16, y + 47, 2, 26, '#a58a68');
    r(c, x + 28, y + 59, 1, 2, '#c7a575');
    r(c, x + 44, y + 26, 62, 11, '#c7a17f');
    pixelText(c, 'OFICINA', x + 49, y + 28, '#816257');
    toolNiche(c, x + 67, y + 41);
    // Broad new plaster patches convey everyday maintenance, never fresh cracks.
    r(c, x + 38, y + 60, 17, 9, '#d0a67e');
    r(c, x + 43, y + 57, 8, 3, '#d0a67e');
    r(c, x + 112, y + 68, 13, 5, '#c7a17f');
    // This shadow sits twelve pixels behind the true cap at y176.
    r(c, x + 4, y + 75, 129, 3, '#b6977c');
}

/** Authored against the measured descent cameras: the first return surface is
 * visible at y160 from each cover; no background object enters either shaft.
 * Only the native terrain layer supplies continuous bright horizontal edges. */
export function drawGalleryBackground(c: CanvasRenderingContext2D, cx: number, cy: number, _time: number, _reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        r(c, 0, 23, 320, 157, '#e6bc8f');
        r(c, 0, 23, 320, 24, '#ebcda4');
        // The view is a dry workshop cutaway. Broad layers become warmer and
        // darker with depth; there are no water hues, flows or victory changes.
        r(c, 0, 160 - cameraY, 320, 272, '#c7a17f');
        r(c, 0, 208 - cameraY, 320, 224, '#bf967d');
        r(c, 0, 304 - cameraY, 320, 128, '#b6977c');
        workshop(c, cameraX, cameraY);
        // Inset rear-wall panels stay low contrast and have no projecting sill.
        for (const [wx, wy, width, height] of [[249,168,124,90],[472,180,78,124],[574,107,116,67]] as const) {
            r(c, wx - cameraX, wy - cameraY, width, height, '#c5a882');
            r(c, wx + 3 - cameraX, wy + 3 - cameraY, width - 6, height - 6, '#cfad87');
            r(c, wx + width - 7 - cameraX, wy + 4 - cameraY, 3, height - 10, '#baa07c');
        }
        toolNiche(c, 273 - cameraX, 215 - cameraY);
        // Hand-smoothed plaster seams are short and broken, never route arrows.
        for (const [wx, wy, w, h] of [[338,232,15,9],[247,250,13,6],[502,255,20,8],[479,306,10,7],[583,158,15,6],[663,143,16,12]] as const) {
            r(c, wx - cameraX, wy - cameraY, w, h, '#c3a280');
            r(c, wx + 3 - cameraX, wy - 2 - cameraY, Math.max(3,w - 8), 2, '#c3a280');
        }
        // Each shaft is a shallow, open-backed dry recess. The warm light has
        // no particles or animation and ends before the actual recovery board.
        for (const [wx, wy, bottom] of [[160,192,288],[384,304,384]] as const) {
            r(c, wx - cameraX, wy - cameraY, 64, bottom - wy, '#a48668');
            r(c, wx + 5 - cameraX, wy - cameraY, 54, bottom - wy, '#b6977c');
            polygon(c, [[wx + 6 - cameraX,wy - cameraY],[wx + 41 - cameraX,wy - cameraY],
                [wx + 57 - cameraX,bottom - 12 - cameraY],[wx + 34 - cameraX,bottom - 12 - cameraY]], '#bf967d');
            // Muted vertical marks explain depth without sketching false stairs.
            for (let dy = 12; dy < bottom - wy - 10; dy += 24) {
                r(c, wx + 7 - cameraX, wy + dy - cameraY, 2, 5, '#a58a68');
                r(c, wx + 56 - cameraX, wy + dy + 5 - cameraY, 2, 4, '#a58a68');
            }
        }
        // A recessed daylight window marks the inspection landing. Its muted
        // frame never crosses the x608/y192 usable cap or imitates an exit door.
        const wx = 625 - cameraX, wy = 118 - cameraY;
        r(c, wx, wy, 32, 35, '#b39876'); r(c, wx + 2, wy + 2, 28, 31, '#e3c49a');
        r(c, wx + 4, wy + 4, 24, 25, '#d4ac83');
        r(c, wx + 4, wy + 4, 24, 12, '#eac799');
        r(c, wx + 14, wy + 3, 3, 28, '#c0a17a');
        r(c, wx + 4, wy + 16, 24, 2, '#c0a17a');
    });
}

/** No new mechanisms or scenery actors in this optional inspection route.
 * WorldGame retains the native player, checkpoint, impacts and completion UI. */
export function drawGalleryObjects(_c: CanvasRenderingContext2D, _objects: WorldObjects, _cx: number, _cy: number,
    _time: number, _reducedMotion: boolean) {}
