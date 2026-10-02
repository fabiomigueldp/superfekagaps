import { GuairaBullLab } from './adventure/experimental/guaira/GuairaBullLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaBullLab(canvas, document.getElementById('lab-status')!);
const pauseButton = document.getElementById('lab-pause')!;
const ascentLink = document.getElementById('lab-ascent')!;
const pauseAction = new LabToolbarAction(pauseButton);
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Tentar novamente'], ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra'],
    ['lab-ascent', 'SUBIR', 'Subir à Casa da Vazão para observar o desvio da água']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
pauseButton.addEventListener('click', () => { game.toggleLabPause(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load('guaira-lab'); canvas.focus(); });
ascentLink.addEventListener('click', event => {
    // Recheck current state: a queued activation cannot survive Pause or Retry.
    if (!game.canAdvanceToAscent) event.preventDefault();
});

function fitLab() {
    const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 100;
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - navHeight - 12) / 180)));
    document.body.style.paddingTop = `${navHeight}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
function reflectPause() {
    const next = game.canAdvanceToAscent;
    pauseButton.hidden = next;
    ascentLink.hidden = !next;
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    if (next && document.activeElement === pauseButton) ascentLink.focus();
    else if (!next && document.activeElement === ascentLink) pauseButton.focus();
    requestAnimationFrame(reflectPause);
}
window.addEventListener('resize', fitLab);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitLab).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectPause(); fitLab(); game.start(); canvas.focus();
