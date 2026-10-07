import assert from 'node:assert/strict';
import test from 'node:test';
import { stageById } from '../src/adventure/campaign';
import { CAMPAIGN_NATURAL_GUIDES } from '../scripts/lib/campaignNaturalGuides';
import { traceNaturalApproach, type ApproachFrame, type CoinApproach } from '../scripts/lib/naturalCoinApproach';

const beach: CoinApproach = { stage: '1-1', name: 'Recoverable beach from the actual checkpoint',
    entry: { checkpoint: 0 }, firstCoin: 0, count: 0, endX: 1296, endFeetY: 288 };
const plans = [...CAMPAIGN_NATURAL_GUIDES.filter(p => p.stage === '6-4'), beach];
/** Frozen body-containment-only camera, before landing-preview anticipation. */
function oldCameraY(y: number, p: ApproachFrame, maxY: number): number {
    const screenY = p.y - y;
    const target = p.grounded || screenY > 108 ? p.y - 108 : screenY < 48 ? p.y - 48 : y;
    const delta = Math.max(0, Math.min(maxY, target)) - y;
    return y + delta * .12 + Math.max(0, delta - 40) * .4;
}

for (const plan of plans) for (const run of [false, true]) {
    test(`${plan.stage} ${plan.name}: ${run ? 'run' : 'walk'} previews the real receiving surface`, t => {
        // Production WorldGame.update includes the actual approach, patrol jump,
        // dynamic platforms, hazards and pickups. No maximal launch witness.
        const stage = stageById(plan.stage)!;
        const trace = traceNaturalApproach(stage, plan, { run, phaseFrames: 0 });
        assert.ok(trace.reached && !trace.dead && !trace.damaged);
        const maxY = stage.level.height * 16 - 180;
        let beforeY = Math.max(0, Math.min(maxY, trace.frames[0].y - 112));
        const before = trace.frames.map(p => beforeY = oldCameraY(beforeY, p, maxY));
        const landing = trace.landed.find(l => l.frame > 1 && l.feetY === plan.endFeetY)!;
        assert.ok(landing, 'The intended receiving floor is reached naturally.');
        const preview = (camera: (p: ApproachFrame) => number, inset: number) => {
            let count = 0;
            for (let f = landing.frame - 1; f >= 0; f--) {
                const p = trace.frames[f];
                if (p.grounded || p.y + p.height >= landing.feetY
                    || landing.feetY - camera(p) > 180 - inset
                    || landing.x < p.cameraX || landing.x + p.width > p.cameraX + 320) break;
                count++;
            }
            return count;
        };
        const oldEdge = preview(p => before[p.frame], 0), newEdge = preview(p => p.cameraY, 0);
        const oldStrip = preview(p => before[p.frame], 8), newStrip = preview(p => p.cameraY, 8);
        // At 60 Hz, six frames expose the target for 100 ms; five with a half-
        // tile strip make the surface legible rather than counting a single pixel.
        // This is a minimum preview, not a claim of a full reaction-time window.
        assert.ok(newEdge >= 6, `Receiving edge needs >=100ms preview, got ${newEdge} frames.`);
        assert.ok(newStrip >= 5, `Receiving surface needs >=5 frames with an 8px strip, got ${newStrip}.`);
        if (plan.endFeetY !== 208) {
            assert.ok(oldEdge <= 4 && oldStrip <= 1, 'Fixture must reproduce the inadequate 64px-drop preview.');
            assert.ok(newEdge >= oldEdge + 2 && newStrip >= oldStrip + 4);
        }
        const falls = trace.frames.filter(p => p.vy > 0 && !p.grounded);
        assert.ok(Math.max(...falls.map(p => p.y + p.height - p.cameraY)) < 150);
        for (const p of trace.frames) assert.ok(p.cameraY >= 0 && p.cameraY <= maxY);
        t.diagnostic(JSON.stringify({ oldEdge, newEdge, oldStrip, newStrip,
            landingFrame: landing.frame, maxFallingFeet: Math.max(...falls.map(p => p.y + p.height - p.cameraY)) }));
    });
}
