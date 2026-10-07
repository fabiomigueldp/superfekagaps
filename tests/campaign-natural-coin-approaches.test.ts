import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { STAGES, stageById } from '../src/adventure/campaign';
import { CAMPAIGN_JUMP_COINS } from '../src/adventure/campaignJumpCoins';
import { CAMPAIGN_NATURAL_GUIDES, naturalGuideKey } from '../scripts/lib/campaignNaturalGuides';
import { beforeNaturalGuides, LANDING_SHELF_ADDITIONS } from '../scripts/lib/naturalGuideBaseline';
import { traceNaturalApproach, approachCoins } from '../scripts/lib/naturalCoinApproach';
import { placeNaturalGuide } from '../scripts/lib/naturalGuidePlacement';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { isSolidTile } from '../src/world/tileRules';
import { TileType, FALLING_PLATFORM_MIN_CONTACT_MS, FALLING_PLATFORM_ARM_MS, FALLING_PLATFORM_FALL_MS, FALLING_PLATFORM_RESPAWN_MS } from '../src/constants';
import hashes from './fixtures/campaign-before-natural-hashes.json';
import previous from './fixtures/campaign-jump-coins-before-natural.json';

for (const guide of CAMPAIGN_NATURAL_GUIDES) {
    const label = `${naturalGuideKey(guide)} ${guide.name}`;
    test(`${label}: actual approach, hazards, pickup ordering and onward landing`, () => {
        const stage = stageById(guide.stage)!, trace = traceNaturalApproach(stage, guide, guide.reference);
        assert.ok(trace.reached && !trace.dead && !trace.damaged, 'No teleport, velocity injection, invincibility or sacrificed helmet can substitute for the approach.');
        const coins = approachCoins(stage, guide), ids = new Set(coins.map(c => c.id));
        assert.equal(trace.collected.filter(id => ids.has(id)).length, guide.count);
        assert.deepEqual(coins.map(({ x, y }) => ({ x, y })), placeNaturalGuide(stage, guide).points, 'The generated table must match the reviewed native route and spacing.');
        if (guide.jump) {
            const launch = trace.jumped[guide.prelude?.length ?? 0];
            assert.ok(launch, 'The intended hop must execute after the preceding approach.');
            const frame = trace.frames.find(f => f.frame === launch.frame)!;
            const ahead = coins.filter(c => c.x >= frame.x && c.x <= frame.x + 180);
            assert.ok(ahead.length > 0);
            for (const coin of ahead) assert.ok(coin.y + 2 - frame.cameraY >= 23, `${coin.id}: opaque coin sprite is hidden behind the HUD at the decision point`);
        }
        for (const coin of coins) {
            assert.ok(coin.y + 2 >= 23, `${coin.id}: never permanently above the HUD`);
            assert.ok(trace.frames.some(f => f.x <= coin.x && coin.x - f.cameraX >= 0 && coin.x - f.cameraX <= 304 && coin.y + 2 - f.cameraY >= 23 && coin.y + 13 - f.cameraY < 180), `${coin.id}: visible before reaching it`);
            for (const other of stage.pickups.filter(p => !ids.has(p.id))) assert.ok(Math.hypot(coin.x - other.x, coin.y - other.y) >= 22, `${coin.id}: crowding ${other.id}`);
            for (let row = Math.floor(coin.y / 16); row <= Math.floor((coin.y + 17.999) / 16); row++)
                for (let col = Math.floor(coin.x / 16); col <= Math.floor((coin.x + 15.999) / 16); col++) assert.ok(!isSolidTile(stage.level.tiles[row]?.[col]), `${coin.id}: buried in terrain`);
        }
        for (let i = 1; i < coins.length; i++) {
            const distance = Math.hypot(coins[i].x - coins[i - 1].x, coins[i].y - coins[i - 1].y);
            assert.ok(distance >= 18 && distance <= 68, 'Readable, normalized spacing along the actual route.');
        }
    });
    if (guide.jump) test(`${label}: usable16px launch corridor and multiple ordinary hold lengths`, () => {
        const stage = stageById(guide.stage)!;
        const shifts = guide.stage === '1-1' && guide.firstCoin === 4 ? [-12, -4, 4] : guide.stage === '1-4' && guide.firstCoin === 4 ? [0, 8, 16] : [-8, 0, 8];
        //6–15 fixed frames are100–250ms, rather than a maximal held jump.
        const holds = [6, 9, 12, 15];
        const safe = holds.map(hold => shifts.every(shift => {
            const trace = traceNaturalApproach(stage, guide, { ...guide.reference, hold, shift });
            return trace.reached && !trace.dead && !trace.damaged;
        }));
        assert.ok(safe.some((value, i) => value && safe[i + 1]), 'At least two adjacent ordinary hold lengths must work across the entire16px takeoff corridor.');
    });
    if (guide.sharedDescent) test(`${label}: ordinary walking and running collect the entire descending trail`, () => {
        const stage = stageById(guide.stage)!, ids = new Set(approachCoins(stage, guide).map(p => p.id));
        for (const run of [false, true]) {
            const trace = traceNaturalApproach(stage, guide, { ...guide.reference, run });
            assert.ok(trace.reached && !trace.dead && !trace.damaged);
            assert.equal(trace.collected.filter(id => ids.has(id)).length, guide.count);
        }
    });
}

for (const key of ['1-4:c4', '5-1:c14', '5-4:c4']) {
    const guide = CAMPAIGN_NATURAL_GUIDES.find(p => naturalGuideKey(p) === key)!;
    test(`${key}: natural approach allows300ms to brake or continue, then the separate upward hop`, () => {
        const stage = stageById(guide.stage)!;
        const shifts = guide.stage === '1-4' ? [0, 8, 16] : [-8, 0, 8];
        for (const run of [false, true]) for (const shift of shifts) for (const hold of [6, 9, 12]) for (const reaction of ['brake', 'continue']) {
            const trace = traceNaturalApproach(stage, guide, { ...guide.reference, run, shift, hold,
                brakeFrames: reaction === 'brake' ? 18 : 0, reactionFrames: reaction === 'continue' ? 18 : 0 });
            assert.ok(trace.reached && !trace.dead && !trace.damaged, `${run ? 'run' : 'walk'}, shift${shift}, hold${hold},${reaction}`);
            assert.ok(trace.landed.some(p => p.feetY === 176), 'Use the intermediate shelf rather than silently bypassing it.');
            assert.ok(trace.landed.some(p => p.feetY === guide.endFeetY), 'The onward jump reaches the higher bank.');
        }
    });
    test(`${key}: shelf extension does not auto-climb the next cliff`, () => {
        const trace = traceNaturalApproach(stageById(guide.stage)!, { ...guide, followup: [] }, guide.reference);
        assert.equal(trace.reached, false, 'The existing16/32px ascent still requires a deliberate jump.');
    });
}

test('the three added1-4 planks retain native contact, collapse and reset timing', () => {
    for (const [col, row] of LANDING_SHELF_ADDITIONS['1-4']) {
        const level = new WorldLevel(stageById('1-4')!.level);
        assert.equal(level.getTile(col, row), TileType.PLATFORM_FALLING);
        level.markFallingPlatformContact(col, row);
        for (const [elapsed, phase] of [[0, 'contact'], [FALLING_PLATFORM_MIN_CONTACT_MS, 'arming'], [FALLING_PLATFORM_ARM_MS, 'falling'], [FALLING_PLATFORM_FALL_MS, undefined]] as const) {
            if (elapsed) level.updateFallingPlatforms(elapsed);
            assert.equal(level.getFallingPlatformRenderData().find(p => p.col === col && p.row === row)?.phase, phase);
        }
        level.updateFallingPlatforms(FALLING_PLATFORM_RESPAWN_MS);
        assert.equal(level.getTile(col, row), TileType.PLATFORM_FALLING);
    }
});

test('authored data preserves the historical 9b73 baseline plus the separately reviewed factory lore', () => {
    assert.equal(CAMPAIGN_NATURAL_GUIDES.length, 24);
    assert.equal(CAMPAIGN_NATURAL_GUIDES.reduce((n, p) => n + p.count, 0), 203);
    assert.equal(Object.values(LANDING_SHELF_ADDITIONS).flat().length, 5);
    for (const stage of STAGES) {
        const before = beforeNaturalGuides(stage);
        if (stage.id === '3-3') {
            // Upstream 68347c4 added exactly these two salon cues after the coin
            // donor's 9b73 baseline. Verify them before reconstructing history;
            // keep the original hash fixture and every other field untouched.
            assert.deepEqual(JSON.parse(JSON.stringify(before.dialogues.slice(1))), [
                { id: '3-3:d1', x: 912, speaker: 'calabrezzo',
                    text: 'Só passa ao Controle de Qualidade quem se apresenta no meu campeonato!', presentation: 'comment' },
                { id: '3-3:d2', x: 1728, speaker: 'feka',
                    text: 'Uma pose no salão e sigo pra Yasmin. Ganhar a luta é outra história.', presentation: 'comment' },
            ]);
            before.dialogues = before.dialogues.slice(0, 1);
        }
        assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), hashes.stages[stage.id as keyof typeof hashes.stages], `${stage.id}: unrelated authored data changed`);
        assert.deepEqual(stage.pickups.map(p => [p.id, p.kind]), before.pickups.map(p => [p.id, p.kind]));
    }
    const secretIds = new Set(Array.from({ length: 9 }, (_, i) => `2-3:c${11 + i}`));
    assert.deepEqual(CAMPAIGN_JUMP_COINS['2-3'].filter(([id]) => secretIds.has(id)), previous['2-3'].filter(([id]) => secretIds.has(String(id))), 'Keep the separate secret-shuttle ride untouched.');
});
