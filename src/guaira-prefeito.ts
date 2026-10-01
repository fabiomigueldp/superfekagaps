import { GuairaMayorLab } from './adventure/experimental/guaira/GuairaMayorLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaMayorLab(canvas, document.getElementById('lab-status')!);
const pauseButton = document.getElementById('lab-pause')!;
const pauseAction = new LabToolbarAction(pauseButton);
new LabToolbarAction(document.getElementById('lab-retry')!).setLabel('TENTAR', 'Tentar novamente');
new LabToolbarAction(document.getElementById('lab-exit')!).setLabel('MAPA', 'Voltar à Casa da Vazão no mapa');
pauseButton.addEventListener('click', () => { game.toggleLabPause(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load('guaira-prefeito'); canvas.focus(); });

function fitLab() {
    const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 100;
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - navHeight - 12) / 180)));
    document.body.style.paddingTop = `${navHeight}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
function reflectPause() {
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    requestAnimationFrame(reflectPause);
}
window.addEventListener('resize', fitLab);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitLab).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectPause(); fitLab(); game.start(); canvas.focus();
