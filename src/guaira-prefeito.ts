import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { GuairaMayorLab } from './adventure/experimental/guaira/GuairaMayorLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaMayorLab(canvas, document.getElementById('lab-status')!);
const touchControls = installGuairaLabControls(game, canvas, () => game.mayor.publicWaterOpen);
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const pauseAction = new LabToolbarAction(pauseButton);
new LabToolbarAction(document.getElementById('lab-retry')!).setLabel('TENTAR', 'Tentar novamente');
const exitAction = new LabToolbarAction(mapLink);
let exitShowsCasa: boolean | undefined;
pauseButton.addEventListener('click', () => { game.toggleLabPause(); syncToolbar(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load('guaira-prefeito'); syncToolbar(); canvas.focus(); });

mapLink.addEventListener('click', () => {
    // Use the live result even if this activation precedes the next animation frame.
    mapLink.setAttribute('href', game.mapReturnHref);
});

function fitLab() { fitGuairaLabCanvas(canvas); }
function syncToolbar() {
    touchControls.sync();
    const href = game.mapReturnHref;
    if (mapLink.getAttribute('href') !== href) mapLink.setAttribute('href', href);
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    const casa = game.mayor.publicWaterOpen;
    if (casa !== exitShowsCasa) {
        exitAction.setLabel(casa ? 'CASA' : 'MAPA', casa ? 'Voltar à Casa da Vazão' : 'Voltar à Casa da Vazão no mapa');
        exitShowsCasa = casa;
    }
}
function reflectToolbar() {
    syncToolbar(); requestAnimationFrame(reflectToolbar);
}
window.addEventListener('resize', fitLab);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitLab).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectToolbar(); fitLab(); game.start(); canvas.focus();
