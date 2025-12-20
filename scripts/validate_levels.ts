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

    // Validar dimensões (height/width)
    if (level.tiles.length !== level.height) {
      console.error(`❌ Nível ${level.id}: height=${level.height} mas tiles.length=${level.tiles.length}`);
      hasErrors = true;
    }

    level.tiles.forEach((row, rIdx) => {
      if (row.length !== level.width) {
        console.error(`❌ Nível ${level.id}: width=${level.width} mas tiles[${rIdx}].length=${row.length}`);
        hasErrors = true;
      }

      row.forEach((tile, cIdx) => {
        // Tiles válidos: 0-7, 10-13
        const isValid = (tile >= 0 && tile <= 7) || (tile >= 10 && tile <= 13);
        if (!isValid) {
          console.error(`❌ Erro no Nível ${level.id}: Tile inválido '${tile}' em [${rIdx}, ${cIdx}]`);
          hasErrors = true;
        }
      });
    });

    const inBounds = (p: { x: number; y: number }) => p.x >= 0 && p.x < level.width && p.y >= 0 && p.y < level.height;

    // Spawn / Goal / Checkpoints
    if (!inBounds(level.playerSpawn)) {
      console.error(`❌ Nível ${level.id}: playerSpawn fora do mapa: (${level.playerSpawn.x}, ${level.playerSpawn.y})`);
      hasErrors = true;
    }

    if (!inBounds(level.goalPosition)) {
      console.error(`❌ Nível ${level.id}: goalPosition fora do mapa: (${level.goalPosition.x}, ${level.goalPosition.y})`);
      hasErrors = true;
    }

    level.checkpoints.forEach((cp, idx) => {
      if (!inBounds(cp)) {
        console.error(`❌ Nível ${level.id}: checkpoint[${idx}] fora do mapa: (${cp.x}, ${cp.y})`);
        hasErrors = true;
      }
    });

    // Enemies
    (level.enemies || []).forEach((e, idx) => {
      if (!inBounds(e.position)) {
        console.error(`❌ Nível ${level.id}: enemy[${idx}] fora do mapa: (${e.position.x}, ${e.position.y})`);
        hasErrors = true;
      }
    });

    // Collectibles
    (level.collectibles || []).forEach((c, idx) => {
      if (!inBounds(c.position)) {
        console.error(`❌ Nível ${level.id}: collectible[${idx}] fora do mapa: (${c.position.x}, ${c.position.y})`);
        hasErrors = true;
      }
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
