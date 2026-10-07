import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, stageById } from '../src/adventure/campaign';
import { CAMPAIGN_JUMP_COINS } from '../src/adventure/campaignJumpCoins';
import { CAMPAIGN_JUMP_PLANS } from '../scripts/lib/campaignJumpPlans';
import { traceJump, traceCarrierRide, sampleJumpCoins, collectedOnTrace } from '../scripts/lib/jumpCoinTrajectory';
import { isSolidTile } from '../src/world/tileRules';
import baseline from './fixtures/campaign-pickups-before-jump-coins.json';

for (const plan of CAMPAIGN_JUMP_PLANS) {
    test(`${plan.stage}: ${plan.name} follows the real traversal and lands safely`, () => {
        const stage = stageById(plan.stage)!;
        const trace = 'carrier' in plan.witness ? traceCarrierRide(stage, plan.witness) : traceJump(stage, plan.witness);
        assert.equal(trace.launchGrounded, true, 'Launch from a real unembedded supporting surface.');
        assert.equal(trace.dead, false);
        assert.equal(trace.hazardContact, false, 'No spike or lava contact in the approach or traversal.');
        assert.equal(trace.landed, true);
        const [left, right, feet] = plan.landing, last = trace.frames.at(-1)!;
        assert.equal(trace.landingFeet, feet);
        assert.ok(last.x >= left && last.x + last.width <= right, 'Land with the whole body on the intended surface.');
        const ids = new Set(Array.from({ length: plan.count }, (_, i) => `${plan.stage}:c${plan.firstCoin + i}`));
        const coins = stage.pickups.filter(p => ids.has(p.id));
        assert.equal(coins.length, plan.count);
        assert.deepEqual(coins.map(({ x, y }) => ({ x, y })), sampleJumpCoins(trace, plan.count, plan.endTrim), 'Generated content must track current engine behavior, not a magic parabola.');
        assert.equal(collectedOnTrace(trace, coins), plan.count, 'WorldGame 16×18 pickup envelopes collect the entire guide.');
        assert.equal(new Set(coins.map(p => `${p.x},${p.y}`)).size, plan.count, 'Carrier dwell cannot stack coins.');
        for (const coin of coins) {
            assert.ok(coin.y >= 0 && coin.x >= 0);
            for (const other of stage.pickups.filter(p => !ids.has(p.id)))
                assert.ok(Math.hypot(coin.x - other.x, coin.y - other.y) >= 22, `${coin.id}: overlaps another authored reward ${other.id}`);
            for (let row = Math.floor(coin.y / 16); row <= Math.floor((coin.y + 17.999) / 16); row++)
                for (let col = Math.floor(coin.x / 16); col <= Math.floor((coin.x + 15.999) / 16); col++)
                    assert.ok(!isSolidTile(stage.level.tiles[row]?.[col]), `${coin.id}: pickup buried in solid terrain`);
        }
        const old = (baseline as Record<string, (string | number)[][]>)[plan.stage].filter(p => ids.has(String(p[0]))).map(p => ({ x: Number(p[2]), y: Number(p[3]) }));
        assert.ok(collectedOnTrace(trace, old) < plan.count, 'This route repairs a measured mismatch.');
    });
    if (!('carrier' in plan.witness)) for (const offset of [-4, 4]) {
        test(`${plan.stage}: ${plan.name} tolerates a ${offset}px takeoff shift`, () => {
            if ('carrier' in plan.witness) return;
            const stage = stageById(plan.stage)!, trace = traceJump(stage, { ...plan.witness, x: plan.witness.x + offset });
            const coins = stage.pickups.filter(p => CAMPAIGN_JUMP_COINS[plan.stage].some(([id]) => id === p.id && Number(id.split(':c')[1]) >= plan.firstCoin && Number(id.split(':c')[1]) < plan.firstCoin + plan.count));
            assert.equal(trace.launchGrounded, true);
            assert.equal(trace.dead, false);
        assert.equal(trace.hazardContact, false, 'No spike or lava contact in the approach or traversal.');
            assert.equal(trace.landed, true);
            assert.equal(trace.landingFeet, plan.landing[2]);
            assert.equal(collectedOnTrace(trace, coins), plan.count, 'The collection envelope must forgive nearby takeoff positions.');
        });
    }
}

test('calibration preserves every existing pickup ID/count and all non-arc placements', () => {
    assert.equal(CAMPAIGN_JUMP_PLANS.length, 25);
    assert.equal(Object.keys(CAMPAIGN_JUMP_COINS).length, 13);
    for (const stage of STAGES) {
        const old = (baseline as Record<string, (string | number)[][]>)[stage.id];
        const moved = new Set((CAMPAIGN_JUMP_COINS[stage.id] ?? []).map(([id]) => id));
        assert.deepEqual(stage.pickups.map(p => [p.id, p.kind]), old.map(p => p.slice(0, 2)), `${stage.id}: IDs and ordering are stable`);
        assert.deepEqual(stage.pickups.filter(p => !moved.has(p.id)).map(p => [p.id, p.kind, p.x, p.y]), old.filter(p => !moved.has(String(p[0]))), `${stage.id}: preserve seals, equipment, intentional trails and route cues`);
    }
});
