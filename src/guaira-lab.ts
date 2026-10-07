import { DisposalScope } from './engine/DisposalScope';
import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { GuairaBullLab } from './adventure/experimental/guaira/GuairaBullLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaBullLab(canvas, document.getElementById('lab-status')!);
const lifetime = new DisposalScope();
game.addCleanup(() => lifetime.dispose());
lifetime.listen(window, 'pagehide', event => { if (!event.persisted) game.dispose(); });
const touchControls = installGuairaLabControls(game, canvas, () => game.boss?.phase === 'defeated');
lifetime.add(() => touchControls.dispose());
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const ascentLink = document.getElementById('lab-ascent')!;
const pauseAction = new LabToolbarAction(pauseButton);
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Tentar novamente'], ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra'],
    ['lab-ascent', 'SUBIR', 'Subir à Casa da Vazão para observar o desvio da água']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
lifetime.listen(pauseButton, 'click', () => { game.toggleLabPause(); syncToolbar(); canvas.focus(); });
lifetime.listen(document.getElementById('lab-retry')!, 'click', () => { game.load('guaira-lab'); syncToolbar(); canvas.focus(); });
lifetime.listen(ascentLink, 'click', event => {
    // Recheck current state: a queued activation cannot survive Pause or Retry.
    if (!game.canAdvanceToAscent) event.preventDefault();
});

lifetime.listen(mapLink, 'click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitLab() { if (!lifetime.isDisposed) fitGuairaLabCanvas(canvas); }
function syncToolbar() {
    if (lifetime.isDisposed) return;
    touchControls.sync();
    const href = game.mapReturnHref;
    if (mapLink.getAttribute('href') !== href) mapLink.setAttribute('href', href);
    const next = game.canAdvanceToAscent;
    pauseButton.hidden = next;
    ascentLink.hidden = !next;
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    if (next && document.activeElement === pauseButton) ascentLink.focus();
    else if (!next && document.activeElement === ascentLink) pauseButton.focus();
}
let toolbarFrame = 0;
lifetime.add(() => cancelAnimationFrame(toolbarFrame));
function reflectPause() {
    if (lifetime.isDisposed) return;
    syncToolbar(); toolbarFrame = requestAnimationFrame(reflectPause);
}
lifetime.listen(window, 'resize', fitLab);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav');
    if (nav) {
        const observer = new ResizeObserver(fitLab);
        lifetime.add(() => observer.disconnect()); observer.observe(nav);
    }
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
lifetime.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
reflectPause(); fitLab(); game.start(); canvas.focus();
