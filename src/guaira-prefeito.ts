import { GuairaMayorLab } from './adventure/experimental/guaira/GuairaMayorLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaMayorLab(canvas, document.getElementById('lab-status')!);
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

function fitLab() {
    const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 100;
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - navHeight - 12) / 180)));
    document.body.style.paddingTop = `${navHeight}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
function syncToolbar() {
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
