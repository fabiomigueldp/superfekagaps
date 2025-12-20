import { PLAYER_SPRITES, PLAYER_FRAME_W, PLAYER_FRAME_H } from '../src/assets/playerSpriteSpec';

function validatePlayerAssets() {
  console.log('🔍 Validando assets do Player (Pixel-Matrix)...');
  let hasErrors = false;

  const requiredAnimations = ['idle', 'walk1', 'walk2', 'jump', 'sit', 'helmet'];
  
  requiredAnimations.forEach(anim => {
    if (!(anim in PLAYER_SPRITES)) {
      console.error(`❌ Erro: Animação obrigatória '${anim}' ausente em PLAYER_SPRITES`);
      hasErrors = true;
    } else {
      const frames = (PLAYER_SPRITES as any)[anim];
      // Se for um array de strings (matriz)
      if (Array.isArray(frames)) {
        if (frames.length !== PLAYER_FRAME_H && anim !== 'helmet') {
          console.error(`❌ Erro: Animação '${anim}' tem altura ${frames.length}, esperado ${PLAYER_FRAME_H}`);
          hasErrors = true;
        }
        frames.forEach((row, rIdx) => {
          if (row.length !== PLAYER_FRAME_W) {
            console.error(`❌ Erro: Animação '${anim}' linha ${rIdx} tem largura ${row.length}, esperado ${PLAYER_FRAME_W}`);
            hasErrors = true;
          }
        });
      }
    }
  });

  if (hasErrors) {
    console.error('❌ Falha na validação dos assets do Player.');
    process.exit(1);
  } else {
    console.log('✅ Assets do Player validados com sucesso!');
    process.exit(0);
  }
}

validatePlayerAssets();
