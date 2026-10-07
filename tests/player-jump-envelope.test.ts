import assert from 'node:assert/strict';
import test from 'node:test';
import { Player } from '../src/entities/Player';
import { Level } from '../src/world/Level';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { GRAVITY, TileType, SPRING_BOOST } from '../src/constants';
import type { InputState, LevelData } from '../src/types';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function flat(LevelType: typeof Level = Level, surface = TileType.GROUND) {
    const data: LevelData = { id: 'jump-envelope', name: 'Jump envelope', width: 80, height: 60,
        tiles: Array.from({ length: 60 }, (_, row) => Array<number>(80).fill(row === 20 ? surface : TileType.EMPTY)),
        playerSpawn: { x: 5, y: 20 }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 78, y: 20 }, timeLimit: 180, isBossLevel: false };
    return new LevelType(data);
}

// Measurements from actual fixed-step Player/Level collisions, not a second ballistic model.
// Releasing after the 150 ms boost still cuts the ascent; a full jump holds through the apex.
const envelopes = [
    { hold: 0, height: 14, apex: 7, land: 16 },
    { hold: 1, height: 19.75, apex: 8, land: 17 },
    { hold: 3, height: 30.8, apex: 9, land: 21 },
    { hold: 6, height: 50.9, apex: 12, land: 27 },
    { hold: 9, height: 71, apex: 15, land: 33 },
    { hold: 60, height: 103, apex: 22, land: 43 }
];
for (const Adapter of [Level, WorldLevel]) {
    test(`${Adapter.name}: walk/run acceleration, braking and air control preserve the measured envelope`, () => {
        for (const run of [false, true]) {
            const level = flat(Adapter), player = new Player(5, 20), speed = run ? 3.5 : 2;
            player.update(DT, idle, level);
            let maxFrame = 0;
            for (let frame = 1; frame <= 20; frame++) {
                player.update(DT, { ...idle, right: true, run }, level);
                if (!maxFrame && player.data.velocity.x === speed) maxFrame = frame;
            }
            assert.equal(maxFrame, run ? 12 : 7);
            const stopX = player.data.position.x;
            let stopFrame = 0;
            for (let frame = 1; frame <= 30; frame++) {
                player.update(DT, idle, level);
                if (player.data.velocity.x === 0) { stopFrame = frame; break; }
            }
            assert.equal(stopFrame, run ? 22 : 19);
            near(player.data.position.x - stopX, run ? 19.17991223846687 : 10.725340688870347);
            player.update(DT, { ...idle, jump: true, jumpPressed: true, right: true, run }, level);
            near(player.data.velocity.x, .3);
            player.update(DT, { ...idle, jump: true, left: true, run }, level);
            near(player.data.velocity.x, 0);
            player.update(DT, { ...idle, jump: true, left: true, run }, level);
            near(player.data.velocity.x, -.3);
        }
    });

    test(`${Adapter.name}: coyote launches are allowed before, but not at, the 100 ms boundary`, () => {
        for (const waitedFrames of [4, 5]) {
            const level = flat(Adapter), player = new Player(5, 20);
            level.data.tiles[20].fill(TileType.EMPTY, 6);
            player.update(DT, idle, level);
            for (let frame = 0; frame < 30 && player.data.isGrounded; frame++)
                player.update(DT, { ...idle, right: true }, level);
            assert.equal(player.data.isGrounded, false);
            for (let frame = 0; frame < waitedFrames; frame++) player.update(DT, idle, level);
            const result = player.update(DT, { ...idle, jump: true, jumpPressed: true }, level);
            assert.equal(result.jumpStarted, waitedFrames === 4);
        }
    });

    test(`${Adapter.name}: short and held arcs retain height, time, running reach and immediate landing control`, () => {
        for (const run of [false, true]) for (const rolling of [false, true]) for (const expected of envelopes) {
            const level = flat(Adapter), player = new Player(5, 20);
            player.update(DT, idle, level);
            if (rolling) for (let frame = 0; frame < 20; frame++) player.update(DT, { ...idle, right: true, run }, level);
            const startX = player.data.position.x, floorY = player.getFeetPosition().y;
            let height = 0, apex = 0, land = 0, starts = 0;
            for (let frame = 0; frame < 80; frame++) {
                const result = player.update(DT, { ...idle, right: true, run,
                    jump: frame < expected.hold, jumpPressed: frame === 0, jumpReleased: frame === expected.hold }, level);
                starts += Number(result.jumpStarted);
                const rise = floorY - player.getFeetPosition().y;
                if (rise > height) { height = rise; apex = frame + 1; }
                if (player.data.isGrounded) { land = frame + 1; break; }
            }
            near(height, expected.height);
            assert.equal(apex, expected.apex);
            assert.equal(land, expected.land);
            assert.equal(starts, 1);
            const speed = run ? 3.5 : 2;
            near(player.data.position.x - startX, land * speed - (rolling ? 0 : run ? 18.7 : 5.7));
            near(player.getFeetPosition().y, floorY);
            assert.equal(player.data.velocity.y, 0);
            assert.equal(player.data.isJumping, false);
            assert.equal(player.data.landingTimer, 90);
            // Landing presentation is cosmetic: the next input can launch immediately.
            const next = player.update(DT, { ...idle, jump: true, jumpPressed: true }, level);
            assert.equal(next.jumpStarted, true);
            assert.equal(player.data.velocity.y, -7.5);
        }
    });

    for (const ceiling of [TileType.GROUND, TileType.CAVE_STONE]) {
        test(`${Adapter.name}: held jump leaves a solid ceiling after one head contact (${ceiling})`, () => {
            const level = flat(Adapter), player = new Player(5, 20);
            level.data.tiles[16].fill(ceiling); // 24 px clearance above the standing head.
            player.update(DT, idle, level);
            let contacts = 0, contactY = 0, landed = false;
            for (let frame = 0; frame < 40; frame++) {
                const hadContact = contacts > 0;
                const result = player.update(DT, { ...idle, jump: true, jumpPressed: frame === 0 }, level);
                if (result.tileHit?.side === 'top') { contacts++; contactY = player.data.position.y; }
                if (hadContact && !player.data.isGrounded) {
                    assert.ok(player.data.position.y > contactY, 'Held input must not pin the player to the ceiling.');
                    assert.ok(player.data.velocity.y > 0, 'Gravity resumes on the next fixed step.');
                }
                if (contacts && player.data.isGrounded) { landed = true; break; }
            }
            assert.equal(contacts, 1);
            assert.equal(landed, true);
            for (let frame = 0; frame < 12; frame++)
                assert.equal(player.update(DT, { ...idle, jump: true }, level).jumpStarted, false, 'Holding cannot auto-repeat.');
        });
    }

    for (const surface of [TileType.PLATFORM, TileType.CAVE_PLATFORM, TileType.PLATFORM_FALLING]) {
        test(`${Adapter.name}: full jump crosses a one-way ledge and lands from above (${surface})`, () => {
            const level = flat(Adapter), player = new Player(5, 20);
            level.data.tiles[16].fill(surface);
            player.update(DT, idle, level);
            let highestFeet = Infinity, hitHead = false, landed = false;
            for (let frame = 0; frame < 80; frame++) {
                const result = player.update(DT, { ...idle, jump: true, jumpPressed: frame === 0 }, level);
                highestFeet = Math.min(highestFeet, player.getFeetPosition().y);
                hitHead ||= result.tileHit?.side === 'top';
                if (player.data.isGrounded) { landed = true; break; }
            }
            assert.equal(hitHead, false);
            near(highestFeet, 320 - 103);
            assert.equal(landed, true);
            near(player.getFeetPosition().y, 256);
        });
    }
}

test('WorldLevel: a solid mechanism underside ends held ascent even without a tileHit event', () => {
    const level = flat(WorldLevel) as WorldLevel, player = new Player(5, 20);
    level.bodies = new WorldObjects([{ id: 'ceiling', kind: 'target', x: 64, y: 256, width: 80, height: 16 }]).bodies;
    player.update(DT, idle, level);
    for (let frame = 0; frame < 4; frame++) player.update(DT, { ...idle, jump: true, jumpPressed: frame === 0 }, level);
    near(player.data.position.y, 272);
    assert.equal(player.data.velocity.y, 0);
    assert.equal(player.data.isJumping, false);
    player.update(DT, { ...idle, jump: true }, level);
    near(player.data.position.y, 272 + GRAVITY);
    assert.equal(player.data.velocity.y, GRAVITY);
});

test('spring impulse remains airborne and unaffected by ceiling-contact cancellation', () => {
    const level = flat(Level, TileType.SPRING), player = new Player(5, 20);
    const result = player.update(DT, idle, level);
    assert.equal(result.tileHit?.type, TileType.SPRING);
    assert.equal(player.data.velocity.y, SPRING_BOOST);
    assert.equal(player.data.isGrounded, false);
    assert.equal(player.data.isJumping, true);
    player.update(DT, idle, level);
    assert.equal(player.data.velocity.y, SPRING_BOOST + GRAVITY);
});
