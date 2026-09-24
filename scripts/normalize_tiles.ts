import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export interface NormalizedLevelSource {
  source: string;
  changed: boolean;
}

/** Resize only the literal tile grid, preserving every other level field. */
export function normalizeTileSource(source: string, filename: string): NormalizedLevelSource {
  const diagnostics = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true
  }).diagnostics ?? [];
  const syntaxError = diagnostics.find(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  if (syntaxError) {
    throw new Error(`${filename}: sintaxe inválida: ${ts.flattenDiagnosticMessageText(syntaxError.messageText, ' ')}`);
  }
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = ast.statements
    .filter(ts.isVariableStatement)
    .filter(statement => statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(node => ts.isIdentifier(node.name) && node.name.text === 'DATA');

  let initializer = declaration?.initializer;
  while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) {
    initializer = initializer.expression;
  }
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    throw new Error(`${filename}: esperado export const DATA com um objeto literal.`);
  }
  const dataObject = initializer;

  const property = (name: string): ts.Expression => {
    const properties = dataObject.properties.filter(ts.isPropertyAssignment).filter(node =>
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === name
    );
    if (properties.length !== 1) throw new Error(`${filename}: propriedade '${name}' ausente ou duplicada.`);
    return properties[0].initializer;
  };

  const dimension = (name: string): number => {
    const expression = property(name);
    const value = ts.isNumericLiteral(expression) ? Number(expression.text) : NaN;
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${filename}: '${name}' precisa ser um inteiro positivo literal.`);
    }
    return value;
  };

  const width = dimension('width');
  const height = dimension('height');
  const tiles = property('tiles');
  if (!ts.isArrayLiteralExpression(tiles) || !tiles.elements.every(ts.isArrayLiteralExpression)) {
    throw new Error(`${filename}: 'tiles' precisa ser uma matriz literal.`);
  }

  const rows = tiles.elements as ts.NodeArray<ts.ArrayLiteralExpression>;
  if (rows.some(row => row.elements.some(node => ts.isSpreadElement(node) || ts.isOmittedExpression(node)))) {
    throw new Error(`${filename}: a matriz não pode conter spreads ou posições vazias.`);
  }
  if (rows.length === height && rows.every(row => row.elements.length === width)) {
    return { source, changed: false };
  }

  // Bound allocations when accidentally given corrupt dimensions.
  if (width * height > 1_000_000) throw new Error(`${filename}: grade maior que 1.000.000 de tiles.`);

  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lineStart = source.lastIndexOf('\n', tiles.getStart(ast)) + 1;
  const indent = source.slice(lineStart, tiles.getStart(ast)).match(/^\s*/)?.[0] ?? '  ';
  const corrected = Array.from({ length: height }, (_, row) => {
    const cells = Array.from({ length: width }, (_, col) => rows[row]?.elements[col]?.getText(ast) ?? '0');
    return `${indent}  [${cells.join(', ')}]`;
  });
  const replacement = `[${newline}${corrected.join(`,${newline}`)}${newline}${indent}]`;

  return {
    source: source.slice(0, tiles.getStart(ast)) + replacement + source.slice(tiles.end),
    changed: true
  };
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Uso: npx tsx scripts/normalize_tiles.ts [--check]');
  const checkOnly = args.includes('--check');
  const levelsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/levels');
  const filenames = readdirSync(levelsDirectory).filter(name => name.endsWith('.ts') && name !== 'index.ts').sort();
  if (filenames.length === 0) throw new Error('Nenhum arquivo de nível encontrado em src/data/levels.');

  // Prepare every change before writing, so malformed source files abort the operation.
  const changes = filenames.map(filename => {
    const path = join(levelsDirectory, filename);
    return { path, filename, ...normalizeTileSource(readFileSync(path, 'utf8'), filename) };
  }).filter(result => result.changed);

  for (const change of changes) {
    if (!checkOnly) writeFileSync(change.path, change.source, 'utf8');
    console.log(`${checkOnly ? 'Requer ajuste' : 'Grade ajustada'}: ${change.filename}`);
  }
  if (changes.length === 0) console.log('Nenhuma correção necessária nas grades de src/data/levels.');
  if (checkOnly && changes.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
