import assert from 'node:assert/strict';
import test from 'node:test';
import { Player } from '../src/entities/Player';
import { WorldLevel, WorldObjects, BELT_CARRY_SPEED } from '../src/adventure/WorldPhysics';
import { stageById } from '../src/adventure/campaign';
import { advanceCampaignCamera } from '../src/adventure/WorldCampaignCamera';
import { CAMPAIGN_JUMP_PLANS, type CampaignJumpPlan } from '../scripts/lib/campaignJumpPlans';
import { TileType } from '../src/constants';
import type { InputState, LevelData, PlayerData } from '../src/types';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
type Camera = { x: number; y: number };
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
/** Frozen pre-catch-up camera, including the already-corrected beach framing. */
function beforeCamera(camera: Camera, player: PlayerData, level: LevelData) {
    const p = player.position, screenY = p.y - camera.y;
    camera.x += (clamp(p.x - 125 + player.velocity.x * 12, level.width * 16 - 320) - camera.x) * .12;
    const targetY = player.isGrounded || screenY > 108 ? p.y - 108 : screenY < 48 ? p.y - 48 : camera.y;
    camera.y += (clamp(targetY, level.height * 16 - 180) - camera.y) * .12;
}
function route(plan: CampaignJumpPlan) {
    // Same declared local launch witnesses as the coin tests, not a full-stage
    // solver: real fixed-step Player, terrain, belts and carrier collisions.
    const stage = stageById(plan.stage)!, level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
    level.bodies = objects.bodies;
    const witness = plan.witness, carrier = 'carrier' in witness ? objects.get(witness.carrier) : null;
    const player = 'carrier' in witness ? new Player((carrier!.x + witness.offsetX) / 16, carrier!.y / 16)
        : new Player(witness.x / 16, witness.feetY / 16);
    player.update(DT, idle, level); assert.equal(player.data.isGrounded, true);
    const before: Camera = { x: 0, y: 0 }, after: Camera = { x: 0, y: 0 };
    for (let frame = 0; frame < 300; frame++) {
        beforeCamera(before, player.data, stage.level); advanceCampaignCamera(after, player.data, stage.level);
    }
    let hazards = false;
    const step = (input: InputState) => {
        const previous = player.getRect();
        level.updateDynamicTiles(DT); objects.update(DT, level, previous.x);
        if (player.data.isGrounded) {
            player.data.position = level.transport(previous);
            const belt = level.beltAt(player.getRect());
            if (belt) player.data.position = level.resolveCollision(player.getRect(),
                { x: (belt.direction ?? 1) * (belt.active ? -1 : 1) * BELT_CARRY_SPEED, y: 0 }, player.getRect()).position;
        }
        player.update(DT, input, level);
        hazards ||= level.checkSpikeCollision(player.getRect()) || level.checkLavaCollision(player.getRect());
        if (player.data.isGrounded) {
            const col = level.worldToCol(player.getRect().x + player.data.width / 2), row = level.worldToRow(player.getFeetPosition().y + 1);
            if (level.getTile(col, row) === TileType.PLATFORM_FALLING) level.markFallingPlatformContact(col, row);
        }
        level.updateFallingPlatforms(DT);
        const snapshot = structuredClone(player.data);
        beforeCamera(before, player.data, stage.level); advanceCampaignCamera(after, player.data, stage.level);
        assert.deepEqual(player.data, snapshot, 'Camera tracking cannot change gameplay.');
        assert.equal(after.x, before.x, 'Horizontal framing stays byte-for-byte identical.');
    };
    if (!('carrier' in witness)) for (let frame = 0; frame < (witness.approachFrames ?? 0); frame++)
        step({ ...idle, right: true, run: witness.run });
    const snapshot = () => ({ player: structuredClone(player.data), before: { ...before }, after: { ...after } });
    const rows = [snapshot()];
    const frames = carrier ? Math.ceil(carrier.period! / 2 / DT) : 120;
    for (let frame = 0; frame < frames; frame++) {
        step('carrier' in witness ? idle : { ...idle, right: true, run: witness.run,
            jump: frame < witness.hold, jumpPressed: frame === 0, jumpReleased: frame === witness.hold });
        rows.push(snapshot());
        if (!carrier && (player.data.isDead || frame > 1 && player.data.isGrounded)) break;
    }
    assert.equal(hazards, false); assert.equal(player.data.isDead, false); assert.equal(player.data.isGrounded, true);
    assert.equal(player.getFeetPosition().y, plan.landing[2]);
    // Include settling so a landing must not create camera reversal or overshoot.
    const settledY = clamp(player.data.position.y - 108, stage.level.height * 16 - 180);
    for (let frame = 0; frame < 120; frame++) {
        const oldY = after.y;
        advanceCampaignCamera(after, player.data, stage.level);
        assert.ok(Math.abs(after.y - settledY) <= Math.abs(oldY - settledY) + 1e-9, 'Landing settles monotonically.');
        assert.ok((settledY - oldY) * (settledY - after.y) >= -1e-9, 'Landing cannot overshoot and reverse.');
    }
    return { rows, stage };
}

for (const plan of CAMPAIGN_JUMP_PLANS) test(`${plan.stage} camera: ${plan.name} retains visible body and bounded framing`, () => {
    const { rows, stage } = route(plan);
    for (const row of rows) {
        const p = row.player, cam = row.after;
        assert.ok(p.position.x - cam.x >= 0 && p.position.x + p.width - cam.x <= 320);
        assert.ok(p.position.y - cam.y >= -1e-9 && p.position.y + p.height - cam.y < 175);
        assert.ok(cam.x >= 0 && cam.x <= stage.level.width * 16 - 320);
        assert.ok(cam.y >= 0 && cam.y <= stage.level.height * 16 - 180);
        if (p.velocity.y < 0 || 'carrier' in plan.witness) assert.equal(cam.y, row.before.y, 'Ascent, stationary transport and short-hop dead zone are unchanged.');
        assert.ok(cam.y >= row.before.y - 1e-9, 'Extra follow is only downward.');
    }
    const penultimate = rows.at(-2)!;
    assert.ok(plan.landing[2] - penultimate.after.y < 180, 'The arrival surface is visible before contact.');
});

test('the native final high descent reproduces clipped feet before and catches up smoothly before landing', t => {
    const plan = CAMPAIGN_JUMP_PLANS.find(p => p.name === 'Final high descent')!, { rows } = route(plan);
    const feet = (row: typeof rows[number], camera: 'before' | 'after') => row.player.position.y + row.player.height - row[camera].y;
    assert.ok(feet(rows.at(-1)!, 'before') > 180);
    assert.ok(Math.max(...rows.map(row => feet(row, 'after'))) < 172);
    assert.ok(plan.landing[2] - rows.at(-2)!.after.y < 180);
    let oldDelta = 0, largestChange = 0;
    for (let frame = 1; frame < rows.length; frame++) {
        const delta = rows[frame].after.y - rows[frame - 1].after.y;
        assert.ok(delta >= 0, 'No direction chatter during the uninterrupted descent.');
        assert.ok(delta < 10, 'Camera movement never snaps farther than the actual terminal fall step.');
        largestChange = Math.max(largestChange, Math.abs(delta - oldDelta)); oldDelta = delta;
    }
    assert.ok(largestChange < 2.4);
    t.diagnostic(JSON.stringify({ beforeLandingFeet: feet(rows.at(-1)!, 'before'), afterLandingFeet: feet(rows.at(-1)!, 'after'),
        maxAfterFeet: Math.max(...rows.map(row => feet(row, 'after'))), largestCameraStepChange: largestChange }));
});

test('vertical catch-up stays continuous, monotonic and bounded through the lower-edge threshold', () => {
    const player = new Player(100, 16), level = { width: 240, height: 100 };
    player.data.isGrounded = false; player.data.velocity = { x: 0, y: 10 };
    let previous = 0;
    for (let lag = 39; lag <= 41; lag += .01) {
        const camera = { x: 0, y: 0 }; player.data.position.y = 108 + lag;
        advanceCampaignCamera(camera, player.data, level);
        assert.ok(camera.y >= previous); if (previous) assert.ok(camera.y - previous < .006);
        previous = camera.y;
    }
    for (const speed of [10, 12]) {
        const camera = { x: 0, y: 0 }; player.data.position.y = 108;
        for (let frame = 0; frame < 80; frame++) {
            player.data.position.y += speed; advanceCampaignCamera(camera, player.data, level);
            assert.ok(player.data.position.y + player.data.height - camera.y < 175, 'Sustained fall and ground pound stay within the viewport.');
        }
    }
});
