import { GuairaBullLab } from './adventure/experimental/guaira/GuairaBullLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaBullLab(canvas, document.getElementById('lab-status')!);
const pauseButton = document.getElementById('lab-pause')!;
const pauseAction = new LabToolbarAction(pauseButton);
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Tentar novamente'], ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
pauseButton.addEventListener('click', () => { game.toggleLabPause(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load('guaira-lab'); canvas.focus(); });

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
