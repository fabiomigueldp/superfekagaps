import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_LEVELS } from '../src/data/levels';
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
