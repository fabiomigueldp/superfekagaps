import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { GuairaAscent, GUAIRA_ASCENT } from './adventure/experimental/guaira/GuairaAscent';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaAscent(canvas, document.getElementById('lab-status')!);
const touchControls = installGuairaLabControls(game, canvas, () => game.finished);
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const pauseAction = new LabToolbarAction(pauseButton);
new LabToolbarAction(document.getElementById('lab-retry')!).setLabel('TENTAR', 'Recomeçar subida');
const exitAction = new LabToolbarAction(mapLink);
let exitShowsCasa: boolean | undefined;
pauseButton.addEventListener('click', () => { game.toggleAscentPause(); syncToolbar(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load(GUAIRA_ASCENT.id); syncToolbar(); canvas.focus(); });

mapLink.addEventListener('click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitAscent() { fitGuairaLabCanvas(canvas); }
function syncToolbar() {
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
function reflectState() {
    syncToolbar(); requestAnimationFrame(reflectState);
}
window.addEventListener('resize', fitAscent);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitAscent).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectState(); fitAscent(); game.start(); canvas.focus();
