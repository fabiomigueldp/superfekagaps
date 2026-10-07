import { TILE_SIZE } from '../constants';
import { BLOCK_BREAK_MS, type BlockImpact, type BlockImpacts } from '../world/BlockImpacts';
import { ART, type Biome } from './palette';
import { SpriteAtlas, type PixelFrame } from './pixels';

const atlas = new SpriteAtlas();
const clay = { _: null, i: ART.ink, b: ART.soilLight, l: ART.soilTop, d: ART.soilDark };
const stone = { _: null, i: ART.ink, b: ART.rock, l: ART.rockTop, d: ART.rockDark };
const chunk: PixelFrame = ['_illi_', 'ilbbbi', 'ibbbbi', 'ibdbbi', 'ibdddi', '_iiii_'];
const rotate = (frame: PixelFrame): PixelFrame => frame[0].split('').map((_, x) => frame.map(row => row[x]).reverse().join(''));
const turns: PixelFrame[] = [chunk];
for (let i = 1; i < 4; i++) turns.push(rotate(turns[i - 1]));

/** Ballistic motion in pixels/seconds, sampled from simulation age, never wall time. */
export function blockFragmentPose(impact: BlockImpact, index: number, reducedMotion = false) {
    const right = index % 2 === 1, lower = index > 1;
    const t = reducedMotion ? 0 : impact.age / 1000;
    const vx = (right ? 1 : -1) * (lower ? 62 : 43);
    const vy = impact.direction === 'down' ? (lower ? 65 : -35) : (lower ? -70 : -106);
    return {
        x: (right ? 9 : 1) + vx * t,
        y: (lower ? 9 : 1) + vy * t + 260 * t * t,
        turn: reducedMotion ? 0 : ((Math.floor(impact.age / (lower ? 65 : 85)) * (right ? 1 : -1)) % 4 + 4) % 4,
        alpha: reducedMotion ? Math.max(0, 1 - impact.age / 120)
            : Math.min(1, Math.max(0, (BLOCK_BREAK_MS - impact.age) / 130))
    };
}

/** Four cached, pixel-rotated masonry chunks. No shake, flash, timers or collision work. */
export function drawBlockImpacts(c: CanvasRenderingContext2D, impacts: BlockImpacts, cx: number, cy: number,
    biome: Biome, reducedMotion = false, originX = 0, originY = 0, width = 320, height = 180): void {
    if (!impacts.active.length) return;
    const palette = biome === 'citadel' ? stone : clay;
    for (const impact of impacts.active) {
        if (reducedMotion && impact.age >= 120) continue;
        if (impact.kind === 'bump' && !reducedMotion) continue;
        const x = (impact.col + originX) * TILE_SIZE - Math.round(cx), y = (impact.row + originY) * TILE_SIZE - Math.round(cy);
        // Downward chunks travel up to 114 px from their source before expiry.
        if (x < -64 || x > width + 48 || y < -128 || y > height + 32) continue;
        c.save();
        if (impact.kind === 'bump') {
            // In reduced motion the solid block stays still; a few stationary mortar grains mark contact.
            c.globalAlpha = Math.max(0, 1 - impact.age / 120); c.fillStyle = palette.l;
            c.fillRect(x + 4, y + 16, 2, 1); c.fillRect(x + 9, y + 16, 1, 1); c.fillRect(x + 12, y + 16, 1, 1);
            c.restore(); continue;
        }
        for (let i = 0; i < 4; i++) {
            const p = blockFragmentPose(impact, i, reducedMotion);
            c.globalAlpha = p.alpha;
            atlas.draw(c, turns[p.turn], palette, x + p.x, y + p.y);
        }
        // Brief contact crumbs remain at the struck edge while the pieces separate.
        if (!reducedMotion && impact.age < 90) {
            c.globalAlpha = 1 - impact.age / 90;
            c.fillStyle = palette.l;
            const edge = y + (impact.direction === 'up' ? 16 : 0);
            c.fillRect(x + 5, edge, 2, 1); c.fillRect(x + 10, edge, 1, 1);
        }
        c.restore();
    }
}
