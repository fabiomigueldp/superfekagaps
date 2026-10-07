import { DisposalScope } from './engine/DisposalScope';
import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { GuairaAscent, GUAIRA_ASCENT } from './adventure/experimental/guaira/GuairaAscent';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaAscent(canvas, document.getElementById('lab-status')!);
const lifetime = new DisposalScope();
game.addCleanup(() => lifetime.dispose());
lifetime.listen(window, 'pagehide', event => { if (!event.persisted) game.dispose(); });
const touchControls = installGuairaLabControls(game, canvas, () => game.finished);
lifetime.add(() => touchControls.dispose());
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const pauseAction = new LabToolbarAction(pauseButton);
new LabToolbarAction(document.getElementById('lab-retry')!).setLabel('TENTAR', 'Recomeçar subida');
const exitAction = new LabToolbarAction(mapLink);
let exitShowsCasa: boolean | undefined;
lifetime.listen(pauseButton, 'click', () => { game.toggleAscentPause(); syncToolbar(); canvas.focus(); });
lifetime.listen(document.getElementById('lab-retry')!, 'click', () => { game.load(GUAIRA_ASCENT.id); syncToolbar(); canvas.focus(); });

lifetime.listen(mapLink, 'click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitAscent() { if (!lifetime.isDisposed) fitGuairaLabCanvas(canvas); }
function syncToolbar() {
    if (lifetime.isDisposed) return;
    touchControls.sync();
    const href = game.mapReturnHref;
    if (mapLink.getAttribute('href') !== href) mapLink.setAttribute('href', href);
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    const casa = game.finished;
    if (casa !== exitShowsCasa) {
        exitAction.setLabel(casa ? 'CASA' : 'MAPA', casa ? 'Voltar à Casa da Vazão no mapa' : 'Voltar ao mapa de Guaíra');
        exitShowsCasa = casa;
    }
}
let toolbarFrame = 0;
lifetime.add(() => cancelAnimationFrame(toolbarFrame));
function reflectState() {
    if (lifetime.isDisposed) return;
    syncToolbar(); toolbarFrame = requestAnimationFrame(reflectState);
}
lifetime.listen(window, 'resize', fitAscent);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav');
    if (nav) {
        const observer = new ResizeObserver(fitAscent);
        lifetime.add(() => observer.disconnect()); observer.observe(nav);
    }
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
lifetime.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
reflectState(); fitAscent(); game.start(); canvas.focus();
