import { GuairaTraversal, GUAIRA_TRAVERSAL } from './adventure/experimental/guaira/GuairaTraversal';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaTraversal(canvas, document.getElementById('lab-status')!);
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const bossLink = document.getElementById('traversal-boss')!;
const pauseAction = new LabToolbarAction(pauseButton);
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Recomeçar travessia'],
    ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra'], ['traversal-boss', 'CURRAL', 'Enfrentar Ossabravo']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
pauseButton.addEventListener('click', () => { game.toggleTraversalPause(); syncToolbar(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load(GUAIRA_TRAVERSAL.id); syncToolbar(); canvas.focus(); });

bossLink.addEventListener('click', event => {
    // Recheck current state: a queued activation cannot survive Pause or Retry.
    if (!game.canAdvanceToBoss) event.preventDefault();
});

mapLink.addEventListener('click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitTraversal() {
    const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 100;
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - navHeight - 12) / 180)));
    document.body.style.paddingTop = `${navHeight}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
function syncToolbar() {
    const href = game.mapReturnHref;
    if (mapLink.getAttribute('href') !== href) mapLink.setAttribute('href', href);
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    const next = game.canAdvanceToBoss;
    bossLink.hidden = !next;
    pauseButton.hidden = next;
    if (next && document.activeElement === pauseButton) bossLink.focus();
    else if (!next && document.activeElement === bossLink) pauseButton.focus();
}
function reflectState() {
    syncToolbar(); requestAnimationFrame(reflectState);
}
window.addEventListener('resize', fitTraversal);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitTraversal).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectState(); fitTraversal(); game.start(); canvas.focus();
