import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

(async () => {
  const mod = await import('../src/data/levels');
  const levels = mod.ALL_LEVELS as any[];
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '../src/data/levels.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  for (const level of levels) {
    const corrected = level.tiles.map((row: number[]) => {
      if (row.length > level.width) return row.slice(0, level.width);
      if (row.length < level.width) return row.concat(Array(level.width - row.length).fill(0));
      return row;
    });

    // check if any row changed
    let changed = false;
    for (let i = 0; i < corrected.length; i++) {
      const a = corrected[i];
      const b = level.tiles[i];
      if (!b || a.length !== b.length || a.some((v, idx) => v !== b[idx])) {
        changed = true;
        break;
      }
    }

    if (!changed) continue;

    // Replace the tiles array in source file for this level
    const exportNameMatch = content.match(new RegExp("export const (LEVEL_[A-Z0-9_]+)\s*:", 'm'));
    // Better locate by level id
    const idToken = `id: '${level.id}',`;
    const idIndex = content.indexOf(idToken);
    if (idIndex === -1) {
      console.warn(`Não achei o nível ${level.id} no arquivo fonte (id token). Pulando.`);
      continue;
    }

    // Find 'tiles:' after idIndex
    const tilesIndex = content.indexOf('tiles:', idIndex);
    if (tilesIndex === -1) {
      console.warn(`Não achei 'tiles:' para o nível ${level.id}.`);
      continue;
    }

    // Find the opening bracket after tiles:
    const openBracketIndex = content.indexOf('[', tilesIndex);
    if (openBracketIndex === -1) {
      console.warn(`Não achei '[' after tiles: para nível ${level.id}.`);
      continue;
    }

    // Find matching closing bracket for the tiles array
    let idx = openBracketIndex;
    let depth = 0;
    while (idx < content.length) {
      const ch = content[idx];
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) break;
      }
      idx++;
    }
    const closeBracketIndex = idx;
    if (closeBracketIndex === openBracketIndex) {
      console.warn(`Falha ao encontrar fechamento do array tiles para id=${level.id}`);
      continue;
    }

    // Build replacement string with indentation matching original
    const indentMatch = content.slice(0, openBracketIndex).match(/(^|\n)(\s*)$/);
    const indent = indentMatch ? indentMatch[2] : '  ';
    const replacement = JSON.stringify(corrected, null, 2)
      .split('\n')
      .map((l, i) => (i === 0 ? l : indent + l))
      .join('\n');

    content = content.slice(0, openBracketIndex) + replacement + content.slice(closeBracketIndex + 1);
    updated = true;
    console.log(`Nível ${level.id}: tiles corrigidos (ajustados para width=${level.width}).`);
  }

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Arquivo src/data/levels.ts atualizado com correções de tiles.');
  } else {
    console.log('Nenhuma correção necessária.');
  }
})();
