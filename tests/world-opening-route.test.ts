import test from 'node:test';
import assert from 'node:assert/strict';
import { stageById } from '../src/adventure/campaign';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { overlaps } from '../src/adventure/types';
import { Player } from '../src/entities/Player';
import type { InputState } from '../src/types';
import { auditRoute } from './helpers/worldRoutes';

const idle: InputState = { left: false, right: false, run: false, jump: false, down: false, start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const lowerTrail = () => stageById('1-1')!.pickups.filter(p => p.kind === 'coin' && p.x >= 75 * 16 && p.x <= 85 * 16);

test('World 1-1 coin trail descends into the seal gap and follows its recovery steps', () => {
    const stage = stageById('1-1')!;
    assert.deepEqual(lowerTrail().map(p => [p.x / 16, p.y / 16]), [
        [75, 12], [77, 13], [78, 14.5], [80, 17], [81, 17], [82, 15], [83, 13], [85, 11]
    ]);
    assert.equal(stage.pickups.filter(p => p.kind === 'coin').length, 40, 'Redistribute the existing coins rather than inflate rewards.');
    assert.deepEqual(stage.pickups.find(p => p.id === '1-1:s2'), { id: '1-1:s2', kind: 'seal', x: 79 * 16, y: 16 * 16 });
});

test('walking down the World 1-1 trail rewards the fall and two ordinary jumps recover', () => {
    const stage = stageById('1-1')!, level = new WorldLevel(stage.level), player = new Player(74, 14);
    const collected = new Set<string>();
    player.data.isGrounded = true;
    const feet = () => player.data.position.y + player.data.height;
    const step = (input: Partial<InputState>) => {
        player.update(1000 / 60, { ...idle, ...input }, level);
        assert.equal(player.data.isDead, false);
        // Match WorldGame's pickup rectangle while exercising the real Player/collision code.
        for (const pickup of stage.pickups)
            if (overlaps(player.getRect(), { x: pickup.x, y: pickup.y, width: 16, height: 18 }))
                collected.add(pickup.id);
    };
    for (let frame = 0; frame < 100; frame++) {
        step({ right: player.data.position.x < 81 * 16 });
        if (player.data.isGrounded && feet() === 18 * 16 && player.data.position.x >= 81 * 16)
            break;
    }
    assert.equal(player.data.isGrounded, true);
    assert.equal(feet(), 18 * 16, 'Walking off the ledge must land on the lower beach.');
    assert.ok(collected.has('1-1:s2'), 'The recoverable fall should collect the second seal.');
    assert.ok(lowerTrail().slice(0, 5).every(p => collected.has(p.id)), 'The descent and beach coins must be collectible without jumping.');

    for (const [targetX, floorY] of [[83, 16], [85, 13]]) {
        for (let frame = 0; frame < 100; frame++) {
            step({ right: player.data.position.x < targetX * 16, jump: frame < 9, jumpPressed: frame === 0, jumpReleased: frame === 9 });
            if (frame > 2 && player.data.isGrounded)
                break;
        }
        assert.equal(player.data.isGrounded, true);
        assert.equal(feet(), floorY * 16, 'The existing recovery step must lead back to the main route.');
    }
    assert.ok(player.data.position.x >= 84 * 16);
    assert.ok(lowerTrail().every(p => collected.has(p.id)), 'The complete trail should be collectible along the recovery path.');
});

test('the World 1-1 lower beach retains a physical route to the normal exit', () => {
    const stage = structuredClone(stageById('1-1')!);
    stage.level.playerSpawn = { x: 79, y: 18 };
    const audit = auditRoute(stage);
    assert.ok(audit.ok, 'Starting on the lower beach must not trap the player.');
});
