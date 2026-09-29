import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TileType } from '../src/constants';
import { Level } from '../src/world/Level';
import { Player } from '../src/entities/Player';
import { DATA as WORLD_ONE_ONE } from '../src/data/levels/level_0_world1-1';
import type { InputState, LevelData } from '../src/types';

function caveWith(tile: TileType): Level {
  const tiles = Array.from({ length: 7 }, () => Array<number>(5).fill(TileType.EMPTY));
  tiles[3][1] = tile;
  const data: LevelData = {
    id: 'cave-physics', name: 'Cave physics', width: 5, height: 7, tiles,
    playerSpawn: { x: 1, y: 1 }, goalPosition: { x: 4, y: 1 },
    checkpoints: [], enemies: [], collectibles: [], triggers: [],
    timeLimit: 60, isBossLevel: false
  };
  return new Level(data);
}

test('cave stone is a solid wall and floor', () => {
  const level = caveWith(TileType.CAVE_STONE);
  const falling = level.resolveCollision({ x: 16, y: 32, width: 10, height: 12 }, { x: 0, y: 8 });
  assert.equal(falling.position.y, 36);
  assert.equal(falling.grounded, true);

  const side = level.resolveCollision({ x: 1, y: 50, width: 10, height: 10 }, { x: 8, y: 0 });
  assert.equal(side.position.x, 6);
  assert.equal(side.velocity.x, 0);
});

test('cave ledges catch a fall but allow a jump through them', () => {
  const level = caveWith(TileType.CAVE_PLATFORM);
  const falling = level.resolveCollision(
    { x: 16, y: 32, width: 10, height: 12 }, { x: 0, y: 8 },
    { x: 16, y: 32, width: 10, height: 12 }
  );
  assert.equal(falling.position.y, 36);
  assert.equal(falling.grounded, true);

  const rising = level.resolveCollision({ x: 16, y: 64, width: 10, height: 12 }, { x: 0, y: -8 });
  assert.equal(rising.position.y, 56);
  assert.equal(rising.velocity.y, -8);
});

test('glowing crystals remain decorative and do not block the route', () => {
  const level = caveWith(TileType.GLOW_CRYSTAL);
  const result = level.resolveCollision({ x: 16, y: 32, width: 10, height: 12 }, { x: 0, y: 8 });
  assert.equal(result.position.y, 40);
  assert.equal(result.grounded, false);
});

test('the first cave entrance lands safely and the final spring reaches the surface', () => {
  const level = new Level(structuredClone(WORLD_ONE_ONE));
  const idle: InputState = {
    left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false,
    jumpPressed: false, jumpReleased: false, downPressed: false
  };

  const entrance = new Player(12, 9);
  for (let frame = 0; frame < 90; frame++) entrance.update(1000 / 60, idle, level);
  assert.equal(entrance.data.isDead, false);
  assert.equal(entrance.data.isGrounded, true);
  assert.equal(entrance.data.position.y + entrance.data.height, 18 * 16);

  const exit = new Player(69, 17);
  let highestBottom = Infinity;
  for (let frame = 0; frame < 80; frame++) {
    exit.update(1000 / 60, idle, level);
    highestBottom = Math.min(highestBottom, exit.data.position.y + exit.data.height);
  }
  assert.equal(exit.data.isDead, false);
  assert.ok(highestBottom < 9 * 16, 'the final spring must lift the player above the surface floor');
});
