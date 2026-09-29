// Ponto de entrada - Super Feka Gaps

import { Game } from './game/Game';
import './game/scoreboard.css';

// Inicializa o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Super Feka Gaps - Iniciando...');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  const isEditor = new URLSearchParams(window.location.search).get('editor') === 'true';
  if (!isEditor) {
    // A focusable editing host makes Chrome deliver letter keydown events to
    // the canvas, including layouts/input methods that otherwise send text only.
    canvas.contentEditable = 'true';
    canvas.spellcheck = false;
    canvas.setAttribute('inputmode', 'none');
  }
  const game = new Game(canvas);
  game.start();
  if (!isEditor) {
    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
    canvas.focus({ preventScroll: true });
  }

  console.log('✅ Jogo iniciado!');
  console.log('📋 Controles:');
  console.log('   A/D ou ←/→ : Mover');
  console.log('   W, Espaço, Z ou ↑ : Pular');
  console.log('   S ou ↓ (no ar) : Sentada violenta');
  console.log('   Shift/X : Correr');
  console.log('   Enter : Start/Confirmar');
  console.log('   Esc : Pause');
  console.log('   M : Toggle Som');
});
