import './adventure/guaira-campaign.css';
// Ponto de entrada - Super Feka Gaps

import { WorldGame } from './adventure/WorldGame';
import { FactoryCampaign } from './adventure/factory/FactoryCampaign';
import './adventure/map.css';
import './adventure/world-controls-help.css';
import './adventure/experimental/hub/experimental-hub.css';
import './adventure/delicia/map-link.css';

// Inicializa o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Super Feka Gaps - Iniciando...');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('delicia') === 'true') {
    const container = document.getElementById('game-container');
    if (container) container.hidden = true;
    await import('./adventure/delicia/entry');
    return;
  }
  // Optional tools/Classic must not join World's first-load dependency graph.
  // World still starts synchronously; only the selected optional mode waits.
  async function optionalMode<T>(load: () => Promise<T>): Promise<T | null> {
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Carregando…';
    status.style.cssText = 'position:fixed;inset:45% 0 auto;text-align:center;color:#fff;z-index:100';
    document.body.append(status);
    try {
      const mode = await load();
      status.remove();
      return mode;
    } catch (error) {
      console.error('Não foi possível carregar o modo selecionado.', error);
      status.textContent = 'Não foi possível carregar. Recarregue a página para tentar novamente.';
      return null;
    }
  }
  if (params.get('worldEditor') === 'true') {
    const mode = await optionalMode(() => import('./adventure/WorldEditor'));
    if (mode) new mode.WorldEditor(canvas);
    return;
  }
  const isEditor = params.get('editor') === 'true';
  if (!isEditor) {
    // A focusable editing host makes Chrome deliver letter keydown events to
    // the canvas, including layouts/input methods that otherwise send text only.
    canvas.contentEditable = 'true';
    canvas.spellcheck = false;
    canvas.setAttribute('inputmode', 'none');
  }
  const classic = params.get('classic') === 'true';
  let game;
  if (isEditor || classic) {
    const mode = await optionalMode(() => import('./game/ClassicEntry'));
    if (!mode) return;
    game = new mode.Game(canvas);
  } else {
    game = new FactoryCampaign(canvas);
    game.enableGamepadControls();
  }
  game.start();
  if (!isEditor) {
    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
    canvas.focus({ preventScroll: true });
  }

  // Auto-open after the initial canvas focus so the modal owns focus.
  if (game instanceof WorldGame) game.enableExperimentalHub(window.location.search);

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
