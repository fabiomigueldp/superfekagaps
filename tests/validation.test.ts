import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_LEVELS } from '../src/data/levels';
import { PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { findLevelErrors } from '../scripts/validate_levels';
import { findPlayerAssetErrors } from '../scripts/validate_player_assets';
import { TriggerType } from '../src/types';

const copyLevel = () => structuredClone(ALL_LEVELS[0]);

test('shipped campaign and player sprites pass validation', () => {
  assert.deepEqual(findLevelErrors(ALL_LEVELS), []);
  assert.deepEqual(findPlayerAssetErrors(PLAYER_SPRITES), []);
});

test('level coordinates account for a negative world origin', () => {
  const level = copyLevel();
  const offset = { x: -100, y: -40 };
  level.originX = offset.x;
  level.originY = offset.y;
  const placements = [level.playerSpawn, level.goalPosition, ...level.checkpoints,
    ...level.enemies.map(enemy => enemy.position), ...level.collectibles.map(item => item.position)];
  placements.forEach(position => { position.x += offset.x; position.y += offset.y; });
  level.triggers = [{
    id: 'dialog', type: TriggerType.DIALOG, x: offset.x * 16, y: offset.y * 16,
    width: 32, height: 32, active: true, oneShot: true, text: 'Hello'
  }];
  assert.deepEqual(findLevelErrors([level]), []);
  level.playerSpawn.x = 0;
  assert.ok(findLevelErrors([level]).some(error => error.includes('playerSpawn')));
});

test('campaign IDs are unique while custom names are supported', () => {
  const level = copyLevel();
  level.id = 'my-world';
  assert.deepEqual(findLevelErrors([level]), []);
  assert.ok(findLevelErrors([level, level]).some(error => error.includes('duplicado')));
  assert.ok(findLevelErrors([]).length > 0);
});

test('legacy power-up tiles are valid but fractional tiles are rejected', () => {
  const level = copyLevel();
  level.tiles[0][0] = 8;
  level.tiles[0][1] = 9;
  assert.deepEqual(findLevelErrors([level]), []);
  level.tiles[0][0] = 1.5;
  assert.ok(findLevelErrors([level]).length > 0);
});

test('malformed levels report validation errors instead of crashing', () => {
  assert.ok(findLevelErrors([null, {}, { ...copyLevel(), width: NaN }]).length >= 3);
});

test('sprite validator rejects wrong shapes and unmapped palette symbols', () => {
  assert.ok(findPlayerAssetErrors({ ...PLAYER_SPRITES, idle: 'invalid' }).some(error => error.includes('matriz')));
  assert.ok(findPlayerAssetErrors({ ...PLAYER_SPRITES, helmet: [] }).some(error => error.includes('altura')));
  const idle = [...PLAYER_SPRITES.idle];
  idle[0] = '?'.repeat(8);
  assert.ok(findPlayerAssetErrors({ ...PLAYER_SPRITES, idle }).some(error => error.includes('paleta')));
});
