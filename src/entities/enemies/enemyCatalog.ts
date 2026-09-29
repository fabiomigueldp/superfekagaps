import { TILE_SIZE } from '../../constants';
import { EnemyType, type Vector2 } from '../../types';

/** Spawn positions mark the ground contact point, in world tiles. */
export const ENEMY_SPECS: Record<EnemyType, { width: number; height: number }> = {
  [EnemyType.MINION]: { width: 16, height: 19 },
  [EnemyType.JOAOZAO]: { width: 32, height: 40 },
};

export function enemySpawnRect(type: EnemyType, spawn: Vector2): { x: number; y: number; width: number; height: number } {
  const spec = ENEMY_SPECS[type];
  return { x: spawn.x * TILE_SIZE, y: spawn.y * TILE_SIZE - spec.height, ...spec };
}
