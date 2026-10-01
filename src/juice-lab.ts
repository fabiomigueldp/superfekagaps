import { JuiceMinibossLab } from './adventure/experimental/JuiceMinibossLab';
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const status = document.getElementById('lab-status')!;
const game = new JuiceMinibossLab(canvas, status);
function fitLab() {
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - (document.querySelector('nav')?.getBoundingClientRect().height ?? 120) - 12) / 180)));
    document.body.style.paddingTop = `${document.querySelector('nav')?.getBoundingClientRect().height ?? 120}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
window.addEventListener('resize', fitLab); fitLab();
const skipButton = document.getElementById('lab-skip');
const replayButton = document.getElementById('lab-replay');
const presentButton = document.getElementById('lab-present');
skipButton?.addEventListener('click', () => { game.skipIntro(); canvas.focus(); });
replayButton?.addEventListener('click', () => { game.replayIntro(); canvas.focus(); });
presentButton?.addEventListener('click', () => { game.presentIntro(); canvas.focus(); });
const pauseButton = document.getElementById('lab-pause')!;
pauseButton.addEventListener('click', () => { game.toggleLabPause(); canvas.focus(); });
function reflectPause() {
    if (skipButton) skipButton.hidden = game.labMode !== 'intro';
    if (replayButton) replayButton.hidden = game.labMode === 'intro';
    if (presentButton) presentButton.hidden = game.intro?.beat !== 'prepare';
    const label = game.state === 'paused' ? 'Continuar' : 'Pausar';
    if (pauseButton.textContent !== label) pauseButton.textContent = label;
    requestAnimationFrame(reflectPause);
}
reflectPause();
if (typeof ResizeObserver !== 'undefined') { const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitLab).observe(nav); }
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load('juice-lab'); canvas.focus(); });
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
game.start(); canvas.focus();
