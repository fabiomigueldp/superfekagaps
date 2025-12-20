// Ponto de entrada - Super Feka Gaps

import { Game } from './game/Game';

// Inicializa o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Super Feka Gaps - Iniciando...');
  
  const game = new Game();
  game.start();
  
  console.log('✅ Jogo iniciado!');
  console.log('📋 Controles:');
  console.log('   ← → : Mover');
  console.log('   Espaço/Z/↑/W : Pular');
  console.log('   Shift/X : Correr');
  console.log('   Enter : Start/Confirmar');
  console.log('   Esc : Pause');
  console.log('   M : Toggle Som');
});
