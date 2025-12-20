import { ALL_LEVELS } from '../src/data/levels';

function validateLevels() {
  console.log('🔍 Validando níveis...');
  let hasErrors = false;

  ALL_LEVELS.forEach((level, index) => {
    // Validar ID contíguo
    if (level.id !== index.toString()) {
      console.error(`❌ Erro no Nível ${index}: ID esperado '${index}', encontrado '${level.id}'`);
      hasErrors = true;
    }

    // Validar tiles
    level.tiles.forEach((row, rIdx) => {
      row.forEach((tile, cIdx) => {
        // Tiles válidos: 0-7, 10-13
        const isValid = (tile >= 0 && tile <= 7) || (tile >= 10 && tile <= 13);
        if (!isValid) {
          console.error(`❌ Erro no Nível ${level.id}: Tile inválido '${tile}' em [${rIdx}, ${cIdx}]`);
          hasErrors = true;
        }
      });
    });
  });

  if (hasErrors) {
    console.error('❌ Falha na validação dos níveis.');
    process.exit(1);
  } else {
    console.log(`✅ ${ALL_LEVELS.length} níveis validados com sucesso!`);
    process.exit(0);
  }
}

validateLevels();
