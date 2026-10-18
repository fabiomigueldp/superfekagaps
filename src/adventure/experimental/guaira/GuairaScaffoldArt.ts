import type { WorldLevel } from '../../WorldPhysics';
import { TileType as T } from '../../../constants';
import { isSolidTile } from '../../../world/tileRules';
import { box as r, pixelLine as line } from '../../WorldPainting';
import { GUAIRA_COURSES, guairaCourseDetours, type GuairaCourseId } from './GuairaCourseDesign';

/** A rear piling reaches actual masonry, or continues below the stage's open
 * channel. A nominal district floor is not a foundation when its tile is air. */
export function guairaScaffoldFoot(level: WorldLevel, x: number, top: number) {
    const col = Math.floor(x / 16);
    for (let row = Math.floor(top / 16) + 1; row < level.data.height; row++)
        if (isSolidTile(level.getTile(col, row))) return { y: row * 16, masonry: true };
    return { y: level.data.height * 16 + 16, masonry: false };
}

export interface GuairaScaffold { left: number; right: number; top: number }
/** Find complete fixed decks, including the offscreen portion of a run. This
 * keeps both joints fixed while the camera passes a tile/viewport boundary. */
export function guairaOrdinaryScaffolds(level: WorldLevel, id: GuairaCourseId,
    left = 0, right = level.data.width * 16): GuairaScaffold[] {
    const g = GUAIRA_COURSES[id], result: GuairaScaffold[] = [];
    const authored = guairaCourseDetours(id).flatMap(d => [...d.decks, ...d.returns]);
    for (let row = 0; row < level.data.height; row++) {
        let col = Math.max(g.start / 16, Math.floor(left / 16));
        const end = Math.min(level.data.width, Math.ceil(right / 16));
        if (level.getTile(col, row) === T.PLATFORM)
            while (col > g.start / 16 && level.getTile(col - 1, row) === T.PLATFORM) col--;
        while (col < end) {
            if (level.getTile(col, row) !== T.PLATFORM) { col++; continue; }
            const start = col;
            while (col < level.data.width && level.getTile(col, row) === T.PLATFORM) col++;
            const a = start * 16, b = col * 16, top = row * 16;
            if (authored.some(([l, rr, y]) => top === y && a < g.start + rr && b > g.start + l)) continue;
            if (id === 'travessia' && a < g.start + 2528 && b > g.start + 2064) continue;
            if (id === 'alivio' && a === g.start + 1888 && top === g.floor - 128) continue;
            result.push({ left: a, right: b, top });
        }
    }
    return result;
}

/** All horizontal members stay under real boards. Short mortised braces and
 * collars articulate the connection without adding false shelves in a gap. */
export function drawGuairaFixedScaffold(c: CanvasRenderingContext2D, level: WorldLevel,
    left: number, right: number, top: number, cx: number, cy: number) {
    const cameraX = Math.round(cx), cameraY = Math.round(cy), a = left - cameraX, b = right - cameraX;
    if (b < -24 || a > 344) return;
    const y = top + 6 - cameraY, width = right - left;
    r(c, a + 3, y, width - 6, 3, '#a08b6e');
    r(c, a + 5, y + 1, width - 10, 1, '#b9a47e');
    const legs = width < 24 ? [left + Math.floor(width / 2) - 2] : [left + 4, right - 8];
    for (const [index, worldX] of legs.entries()) {
        const foot = guairaScaffoldFoot(level, worldX + 1, top), xx = worldX - cameraX, bottom = foot.y - cameraY;
        r(c, xx, y, 4, bottom - y + (foot.masonry ? 2 : 0), '#9d876a');
        r(c, xx + 1, y + 2, 1, bottom - y - 2, '#bda57e');
        const brace = Math.min(23, bottom - y - 6), reach = Math.min(20, Math.floor(width / 2) - 6);
        if (brace > 7 && reach > 4) {
            const dir = index === 0 ? 1 : -1;
            line(c, xx + 1, y + brace, xx + 1 + dir * reach, y + 2, '#a28c6e', 2);
            line(c, xx + 2, y + brace - 2, xx + 1 + dir * reach, y + 3, '#b49d77');
        }
        r(c, xx - 1, y + 4, 6, 5, '#9c9478');
        r(c, xx, y + 5, 1, 1, '#cab58c'); r(c, xx + 3, y + 7, 1, 1, '#cab58c');
        if (foot.masonry) {
            r(c, xx - 2, bottom - 6, 8, 8, '#aa9979');
            r(c, xx - 1, bottom - 5, 1, 3, '#c3ad84');
        }
    }
}
