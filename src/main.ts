// Ponto de entrada - Super Feka Gaps

import { Game } from './game/Game';

// Inicializa o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Super Feka Gaps - Iniciando...');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
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
