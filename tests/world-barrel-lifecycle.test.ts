import assert from 'node:assert/strict';
import test from 'node:test';
import { TileType } from '../src/constants';
import { WorldFoe } from '../src/adventure/WorldEnemies';
import { WorldLevel, WorldObjects, type Barrel } from '../src/adventure/WorldPhysics';

const DT = 1000 / 60;

function floor() {
    return new WorldLevel({
        id: 'barrel-lifecycle', name: 'Barrel lifecycle', width: 140, height: 16,
        tiles: Array.from({ length: 16 }, (_, row) => Array(140).fill(row >= 14 ? TileType.GROUND : TileType.EMPTY)),
        playerSpawn: { x: 1, y: 12 }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 138, y: 12 }, timeLimit: 300, isBossLevel: false,
    });
}

function motion(barrel: Barrel) {
    const { x, y, vx, vy, rotation, landedAt, landingPoint, returned } = barrel;
    return { x, y, vx, vy, rotation, landedAt, landingPoint, returned };
}

test('a loader barrel expiring beside a target cannot unlock it on its final discarded step', () => {
    const level = floor(), objects = new WorldObjects([]);
    const loader = new WorldFoe({ id: 'loader', kind: 'loader', x: 120, y: 224 });
    const player = { x: 180, y: 200, width: 14, height: 24 };
    loader.update(1501, level, objects, player);
    loader.update(851, level, objects, player);
    assert.equal(objects.barrels.length, 1, 'Use the production enemy release.');
    const barrel = objects.barrels[0];
    assert.equal(barrel.life, 13000);
    let steps = 0;
    while (barrel.life > DT && steps < 800) {
        objects.update(DT, level, barrel.x);
        assert.ok(objects.barrels.includes(barrel));
        steps++;
    }
    assert.ok(steps >= 779 && steps <= 780, 'The ordinary 13-second lifetime must actually elapse.');
    // Place the collision boundary half a movement step beyond the surviving barrel.
    objects.bodies.push(...new WorldObjects([{
        id: 'target', kind: 'target', x: barrel.x + barrel.width + barrel.vx / 2,
        y: 208, width: 16, height: 16,
    }]).bodies);
    const before = motion(barrel);
    objects.update(DT, level, barrel.x);
    assert.deepEqual(objects.barrels, []);
    assert.equal(objects.get('target')!.active, false, 'A projectile removed for expiry must not open a gate.');
    assert.equal(objects.get('target')!.hitAt, undefined);
    assert.equal(objects.get('target')!.brokenAt, undefined);
    assert.deepEqual(objects.events, [], 'The discarded step must not produce break feedback.');
    assert.deepEqual(motion(barrel), before);
});

for (const life of [-DT, 0, DT / 2, DT]) for (const pressurized of [false, true])
test(`a retired or expiring barrel cannot touch a target (life: ${life}, pressure required: ${pressurized})`, () => {
    const level = floor(), objects = new WorldObjects([{
        id: 'target', kind: 'target', x: 160, y: 208, width: 16, height: 16, pressurized,
    }]);
    const barrel = objects.spawnBarrel(145, 208, 1);
    barrel.life = life;
    const before = motion(barrel);
    objects.update(DT, level, 145);
    assert.equal(objects.get('target')!.hitAt, undefined, 'Retirement must suppress both successful and rejected hits.');
    assert.equal(objects.get('target')!.active, false);
    assert.deepEqual(objects.events, []);
    assert.deepEqual(motion(barrel), before);
    assert.deepEqual(objects.barrels, []);
    objects.update(DT, level, 145);
    assert.deepEqual(objects.events, []);
});

for (const pressurized of [false, true]) test(`a live barrel keeps its final valid target hit (pressure required: ${pressurized})`, () => {
    const level = floor(), objects = new WorldObjects([{
        id: 'target', kind: 'target', x: 160, y: 208, width: 16, height: 16, pressurized,
    }]);
    const barrel = objects.spawnBarrel(145, 208, 1);
    barrel.life = DT + 1;
    objects.update(DT, level, 145);
    assert.equal(barrel.x, 146.8);
    assert.equal(barrel.y, 208);
    assert.equal(objects.get('target')!.hitAt, DT);
    assert.equal(objects.get('target')!.active, !pressurized);
    assert.deepEqual(objects.events.map(event => event.kind), [pressurized ? 'hit' : 'break']);
    assert.deepEqual(objects.barrels, []);
    objects.update(DT, level, 145);
    assert.deepEqual(objects.events, [], 'A valid consumed hit still emits only once.');
});
