import { DisposalScope } from './engine/DisposalScope';
import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { GuairaTraversal, GUAIRA_TRAVERSAL } from './adventure/experimental/guaira/GuairaTraversal';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaTraversal(canvas, document.getElementById('lab-status')!);
const lifetime = new DisposalScope();
game.addCleanup(() => lifetime.dispose());
lifetime.listen(window, 'pagehide', event => { if (!event.persisted) game.dispose(); });
const touchControls = installGuairaLabControls(game, canvas, () => game.finished);
lifetime.add(() => touchControls.dispose());
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const bossLink = document.getElementById('traversal-boss')!;
const pauseAction = new LabToolbarAction(pauseButton);
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Recomeçar travessia'],
    ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra'], ['traversal-boss', 'CURRAL', 'Enfrentar Ossabravo']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
lifetime.listen(pauseButton, 'click', () => { game.toggleTraversalPause(); syncToolbar(); canvas.focus(); });
lifetime.listen(document.getElementById('lab-retry')!, 'click', () => { game.load(GUAIRA_TRAVERSAL.id); syncToolbar(); canvas.focus(); });

lifetime.listen(bossLink, 'click', event => {
    // Recheck current state: a queued activation cannot survive Pause or Retry.
    if (!game.canAdvanceToBoss) event.preventDefault();
});

lifetime.listen(mapLink, 'click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitTraversal() { if (!lifetime.isDisposed) fitGuairaLabCanvas(canvas); }
function syncToolbar() {
    if (lifetime.isDisposed) return;
    touchControls.sync();
    const href = game.mapReturnHref;
    if (mapLink.getAttribute('href') !== href) mapLink.setAttribute('href', href);
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    const next = game.canAdvanceToBoss;
    bossLink.hidden = !next;
    pauseButton.hidden = next;
    if (next && document.activeElement === pauseButton) bossLink.focus();
    else if (!next && document.activeElement === bossLink) pauseButton.focus();
}
let toolbarFrame = 0;
lifetime.add(() => cancelAnimationFrame(toolbarFrame));
function reflectState() {
    if (lifetime.isDisposed) return;
    syncToolbar(); toolbarFrame = requestAnimationFrame(reflectState);
}
lifetime.listen(window, 'resize', fitTraversal);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav');
    if (nav) {
        const observer = new ResizeObserver(fitTraversal);
        lifetime.add(() => observer.disconnect()); observer.observe(nav);
    }
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
lifetime.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
reflectState(); fitTraversal(); game.start(); canvas.focus();
