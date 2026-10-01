import { JuiceMinibossLab } from './adventure/experimental/JuiceMinibossLab';
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const status = document.getElementById('lab-status')!;
const game = new JuiceMinibossLab(canvas, status);
function fitLab() {
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - (innerWidth <= 620 ? 92 : 64)) / 180)));
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
window.addEventListener('resize', fitLab); fitLab();
const pauseButton = document.getElementById('lab-pause')!;
pauseButton.addEventListener('click', () => { game.toggleLabPause(); canvas.focus(); });
function reflectPause() {
    const label = game.state === 'paused' ? 'Continuar' : 'Pausar';
    if (pauseButton.textContent !== label) pauseButton.textContent = label;
    requestAnimationFrame(reflectPause);
}
reflectPause();
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load('juice-lab'); canvas.focus(); });
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
game.start(); canvas.focus();
