import type { AdventureStage } from '../../src/adventure/types';
import { overlaps } from '../../src/adventure/types';
import { isSolidTile } from '../../src/world/tileRules';
import { traceNaturalApproach, type ApproachTrace } from './naturalCoinApproach';
import type { NaturalCoinGuide } from './campaignNaturalGuides';

const collected = (trace: ApproachTrace, x: number, y: number) => trace.frames.some(f => overlaps(f, { x, y, width: 16, height: 18 }));
function clear(stage: AdventureStage, ids: Set<string>, x: number, y: number) {
    if (y < 25 || stage.pickups.some(p => !ids.has(p.id) && Math.hypot(p.x - x, p.y - y) < 22)) return false;
    for (let row = Math.floor(y / 16); row <= Math.floor((y + 17.999) / 16); row++)
        for (let col = Math.floor(x / 16); col <= Math.floor((x + 15.999) / 16); col++)
            if (isSolidTile(stage.level.tiles[row]?.[col])) return false;
    return true;
}
/** Sample a complete, real incoming route. On a descending path, centre coins in
 * the shared walking/running pickup envelope instead of inventing an aerial arc. */
export function placeNaturalGuide(stage: AdventureStage, guide: NaturalCoinGuide) {
    const reference = traceNaturalApproach(stage, guide, guide.reference);
    if (!reference.reached || reference.dead || reference.damaged) throw new Error(`${guide.stage}:${guide.firstCoin}: reference approach did not reach safety without damage`);
    const traces = [reference];
    if (guide.sharedDescent) {
        const alternate = traceNaturalApproach(stage, guide, { ...guide.reference, run: !guide.reference.run });
        if (!alternate.reached || alternate.dead || alternate.damaged) throw new Error(`${guide.stage}:${guide.firstCoin}: descending route is not safe at both speeds`);
        traces.push(alternate);
    }
    const ids = new Set(Array.from({ length: guide.count }, (_, i) => `${guide.stage}:c${guide.firstCoin + i}`));
    const segment = reference.frames.filter(f => f.x - 1 >= guide.span[0] && f.x - 1 <= guide.span[1]);
    if (segment.length < 2) throw new Error(`${guide.stage}:${guide.firstCoin}: missing authored traversal span`);
    const distances = [0];
    for (let i = 1; i < segment.length; i++) distances.push(distances[i - 1] + Math.hypot(segment[i].x - segment[i - 1].x, segment[i].y - segment[i - 1].y));
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < guide.count; i++) {
        const distance = distances[distances.length - 1] * i / (guide.count - 1);
        const nearest = segment[distances.reduce((best, d, index) => Math.abs(d - distance) < Math.abs(distances[best] - distance) ? index : best, 0)];
        const targetX = nearest.x - 1, targetY = nearest.y + nearest.height / 2 - 9;
        let best: { x: number; y: number; score: number } | undefined;
        for (const dx of [0, -4, 4, -8, 8]) for (let dy = -18; dy <= 18; dy += 2) {
            const x = Math.round(targetX + dx), y = Math.round(targetY + dy);
            if (!clear(stage, ids, x, y) || !collected(reference, x, y) || points.some(p => Math.hypot(p.x - x, p.y - y) < 18)) continue;
            // A pickup needs to be visible while approaching, before collection.
            const approach = reference.frames.filter(f => f.x <= x && x - f.cameraX >= 0 && x - f.cameraX <= 304);
            const seen = approach.some(f => y + 2 - f.cameraY >= 24 && y + 13 - f.cameraY < 180);
            if (!seen) continue;
            const coverage = traces.filter(t => collected(t, x, y)).length;
            const score = coverage * 1000 - Math.abs(dx) * 3 - Math.abs(dy);
            if (!best || score > best.score) best = { x, y, score };
        }
        if (!best) throw new Error(`${guide.stage}:c${guide.firstCoin + i}: no readable clear pickup near ${targetX.toFixed(1)},${targetY.toFixed(1)}`);
        points.push({ x: best.x, y: best.y });
    }
    return { points, reference, traces };
}
