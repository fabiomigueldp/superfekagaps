import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_LEVELS } from '../src/data/levels';
import { TILE_SIZE } from '../src/constants';
import type { Vector2 } from '../src/types';
import { normalizeLevelData } from '../src/world/levelValidation';

export function findLevelErrors(levels: readonly unknown[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (levels.length === 0) errors.push('A campanha precisa ter pelo menos um nível.');

  levels.forEach((value, index) => {
    let level;
    try {
      level = normalizeLevelData(value);
    } catch (error) {
      errors.push(`Nível na posição ${index}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (ids.has(level.id)) errors.push(`ID de nível duplicado: '${level.id}'.`);
    ids.add(level.id);

    const minX = level.originX ?? 0;
    const minY = level.originY ?? 0;
    const maxX = minX + level.width;
    const maxY = minY + level.height;
    const checkPosition = (position: Vector2, field: string): void => {
      if (position.x < minX || position.x >= maxX || position.y < minY || position.y >= maxY) {
        errors.push(`Nível ${level.id}: ${field} fora do mapa: (${position.x}, ${position.y}).`);
      }
    };

    checkPosition(level.playerSpawn, 'playerSpawn');
    checkPosition(level.goalPosition, 'goalPosition');
    level.checkpoints.forEach((position, i) => checkPosition(position, `checkpoint[${i}]`));
    level.enemies.forEach((enemy, i) => checkPosition(enemy.position, `enemy[${i}]`));
    level.collectibles.forEach((collectible, i) => checkPosition(collectible.position, `collectible[${i}]`));

    // Trigger rectangles use world pixels; other placements use world tiles.
    level.triggers.forEach((trigger, i) => {
      if (trigger.x + trigger.width <= minX * TILE_SIZE || trigger.x >= maxX * TILE_SIZE ||
          trigger.y + trigger.height <= minY * TILE_SIZE || trigger.y >= maxY * TILE_SIZE) {
        errors.push(`Nível ${level.id}: trigger[${i}] não cruza a área do mapa.`);
      }
    });
  });
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = findLevelErrors(ALL_LEVELS);
  errors.forEach(error => console.error(`❌ ${error}`));
  if (errors.length > 0) {
    console.error('❌ Falha na validação dos níveis.');
    process.exitCode = 1;
  } else {
    console.log(`✅ ${ALL_LEVELS.length} níveis validados com sucesso!`);
  }
}
