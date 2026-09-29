import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLAYER_SPRITES, PLAYER_PALETTE, PLAYER_FRAME_W, PLAYER_FRAME_H, PLAYER_HELMET_H } from '../src/assets/playerSpriteSpec';

export function findPlayerAssetErrors(sprites: Record<string, unknown>, palette = PLAYER_PALETTE): string[] {
  const errors: string[] = [];
  const requiredAnimations = Object.keys(PLAYER_SPRITES);

  for (const animation of requiredAnimations) {
    if (!Object.prototype.hasOwnProperty.call(sprites, animation)) errors.push(`Animação obrigatória '${animation}' ausente.`);
  }

  for (const [animation, frame] of Object.entries(sprites)) {
    if (!Array.isArray(frame)) {
      errors.push(`Animação '${animation}' precisa ser uma matriz de strings.`);
      continue;
    }

    // Accessories use their own canvas height and retain the shared pixel scale.
    const expectedHeight = animation === 'helmet' ? PLAYER_HELMET_H : PLAYER_FRAME_H;
    if (frame.length !== expectedHeight) {
      errors.push(`Animação '${animation}' tem altura ${frame.length}, esperado ${expectedHeight}.`);
    }
    frame.forEach((row: unknown, rowIndex: number) => {
      if (typeof row !== 'string') {
        errors.push(`Animação '${animation}', linha ${rowIndex}: esperado texto.`);
        return;
      }
      if (row.length !== PLAYER_FRAME_W) {
        errors.push(`Animação '${animation}', linha ${rowIndex}: largura ${row.length}, esperado ${PLAYER_FRAME_W}.`);
      }
      for (const symbol of new Set(row)) {
        if (!Object.prototype.hasOwnProperty.call(palette, symbol)) {
          errors.push(`Animação '${animation}', linha ${rowIndex}: símbolo '${symbol}' ausente da paleta.`);
        }
      }
    });
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = findPlayerAssetErrors(PLAYER_SPRITES);
  errors.forEach(error => console.error(`❌ ${error}`));
  if (errors.length > 0) {
    console.error('❌ Falha na validação dos assets do Player.');
    process.exitCode = 1;
  } else {
    console.log('✅ Assets do Player validados com sucesso!');
  }
}
