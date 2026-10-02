import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { GuairaJunction, GUAIRA_JUNCTION } from './adventure/experimental/guaira/junction/GuairaJunction';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaJunction(canvas, document.getElementById('lab-status')!);
const touchControls = installGuairaLabControls(game, canvas, () => game.finished);
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const bossLink = document.getElementById('junction-boss')!;
const pauseAction = new LabToolbarAction(pauseButton);
const canAdvance = () => game.finished && game.state === 'playing' && !game.player.data.isDead;
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Recomeçar Pátio das Comportas'],
    ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra'], ['junction-boss', 'CURRAL', 'Enfrentar Ossabravo']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
pauseButton.addEventListener('click', () => { game.toggleJunctionPause(); syncToolbar(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load(GUAIRA_JUNCTION.id); syncToolbar(); canvas.focus(); });

bossLink.addEventListener('click', event => {
    // Recheck current state: a queued activation cannot survive Pause or Retry.
    if (!canAdvance()) event.preventDefault();
});

mapLink.addEventListener('click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitJunction() { fitGuairaLabCanvas(canvas); }
function syncToolbar() {
    touchControls.sync();
    const href = game.mapReturnHref;
    if (mapLink.getAttribute('href') !== href) mapLink.setAttribute('href', href);
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    const next = canAdvance();
    bossLink.hidden = !next;
    pauseButton.hidden = next;
    if (next && document.activeElement === pauseButton) bossLink.focus();
    else if (!next && document.activeElement === bossLink) pauseButton.focus();
}
function reflectState() {
    syncToolbar(); requestAnimationFrame(reflectState);
}
window.addEventListener('resize', fitJunction);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitJunction).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectState(); fitJunction(); game.start(); canvas.focus();
