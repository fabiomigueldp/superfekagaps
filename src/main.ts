// Ponto de entrada - Super Feka Gaps

import { Game } from './game/Game';
import { installFullscreen } from './engine/Fullscreen';

// Inicializa o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Super Feka Gaps - Iniciando...');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  const isEditor = new URLSearchParams(location.search).get('editor') === 'true';
  if (!isEditor) {
    canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.tabIndex = 0;
    canvas.setAttribute('inputmode', 'none');
    canvas.addEventListener('pointerdown', () => canvas.focus({preventScroll:true}));
  }
  if (!isEditor) installFullscreen();
  const game = new Game(canvas);
  game.start();

  console.log('✅ Jogo iniciado!');
  console.log('📋 Controles:');
  console.log('   ← → / A/D / WASD : Mover');
  console.log('   Espaço/Z/↑/W : Pular');
  console.log('   Shift/X : Correr');
  console.log('   Enter : Start/Confirmar');
  console.log('   Esc : Pause');
  console.log('   M : Toggle Som');
});
