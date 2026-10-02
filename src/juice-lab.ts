import { JuiceMinibossLab } from './adventure/experimental/JuiceMinibossLab';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const status = document.getElementById('lab-status')!;
// Native dialogue/combat hints stay authoritative; the page adds recovery context.
const nativeStatus = document.createElement('span');
const game = new JuiceMinibossLab(canvas, nativeStatus);
let wasDead = false, recoveryUntil = 0;
function resetFeedback() { wasDead = false; recoveryUntil = 0; }
function fitLab() {
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - (document.querySelector('nav')?.getBoundingClientRect().height ?? 120) - 12) / 180)));
    document.body.style.paddingTop = `${document.querySelector('nav')?.getBoundingClientRect().height ?? 120}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
window.addEventListener('resize', fitLab);
const skipButton = document.getElementById('lab-skip');
const replayButton = document.getElementById('lab-replay');
const presentButton = document.getElementById('lab-present');
const retryButton = document.getElementById('lab-retry')!;
for (const [id, label, name] of [
    ['lab-present', 'POSE', 'Apresentar pose'], ['lab-skip', 'PULAR INTRO', 'Pular introdução'],
    ['lab-replay', 'REVER', 'Rever introdução'], ['lab-retry', 'TENTAR', 'Tentar novamente'],
    ['lab-exit', 'SAIR', 'Voltar aos experimentos']
]) {
    const control = document.getElementById(id);
    if (control) new LabToolbarAction(control, id === 'lab-present').setLabel(label, name);
}
skipButton?.addEventListener('click', () => { resetFeedback(); game.skipIntro(); canvas.focus(); });
replayButton?.addEventListener('click', () => { resetFeedback(); game.replayIntro(); canvas.focus(); });
presentButton?.addEventListener('click', () => { game.presentIntro(); canvas.focus(); });
const pauseButton = document.getElementById('lab-pause')!;
const pauseAction = new LabToolbarAction(pauseButton);
pauseButton.addEventListener('click', () => { game.toggleLabPause(); canvas.focus(); });
function reflectPause() {
    if (game.isDisposed) return;
    reflectStatus();
    if (skipButton) skipButton.hidden = game.labMode !== 'intro';
    if (replayButton) replayButton.hidden = game.labMode === 'intro';
    if (presentButton) presentButton.hidden = game.intro?.beat !== 'prepare';
    retryButton.hidden = game.labMode === 'intro';
    const label = game.state === 'paused' ? 'Continuar' : 'Pausar';
    if (pauseButton.textContent !== label) pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', label);
    requestAnimationFrame(reflectPause);
}
function reflectStatus() {
    if (game.labMode !== 'combat') resetFeedback();
    else if (game.player.data.isDead) wasDead = true;
    else if (wasDead) { wasDead = false; recoveryUntil = performance.now() + 1800; }
    const message = game.state === 'paused' || game.labMode !== 'combat' ? nativeStatus.textContent
        : game.player.data.isDead ? 'Feka caiu · a luta reinicia automaticamente'
        : performance.now() < recoveryUntil ? `Nova tentativa · ${nativeStatus.textContent}` : nativeStatus.textContent;
    if (status.textContent !== message) status.textContent = message;
}
reflectPause(); fitLab();
if (typeof ResizeObserver !== 'undefined') { const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitLab).observe(nav); }
retryButton.addEventListener('click', () => { resetFeedback(); game.load('juice-lab'); reflectStatus(); canvas.focus(); });
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
game.start(); canvas.focus();
