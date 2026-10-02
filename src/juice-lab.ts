import { JuiceLabHost } from './adventure/experimental/JuiceLabHost';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const status = document.getElementById('lab-status')!;
// Native dialogue/combat hints stay authoritative; the page adds recovery context.
const nativeStatus = document.createElement('span');
const game = new JuiceLabHost(canvas, nativeStatus);
function listen(target: EventTarget, type: string, listener: EventListener) {
    target.addEventListener(type, listener);
    game.addCleanup(() => target.removeEventListener(type, listener));
}
const focusCanvas = () => canvas.focus({ preventScroll: true });
let wasDead = false, recoveryUntil = 0;
function resetFeedback() { wasDead = false; recoveryUntil = 0; }
function fitLab() {
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - (document.querySelector('nav')?.getBoundingClientRect().height ?? 120) - 12) / 180)));
    document.body.style.paddingTop = `${document.querySelector('nav')?.getBoundingClientRect().height ?? 120}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
listen(window, 'resize', fitLab);
const skipButton = document.getElementById('lab-skip') as HTMLButtonElement | null;
const replayButton = document.getElementById('lab-replay');
const presentButton = document.getElementById('lab-present');
const retryButton = document.getElementById('lab-retry')!;
for (const [id, label, name] of [
    ['lab-present', 'POSE', 'Apresentar pose'],
    ['lab-replay', 'REVER', 'Rever introdução'], ['lab-retry', 'TENTAR', 'Tentar novamente'],
    ['lab-exit', 'SAIR', 'Voltar aos experimentos']
]) {
    const control = document.getElementById(id);
    if (control) new LabToolbarAction(control, id === 'lab-present').setLabel(label, name);
}
const skipAction = skipButton ? new LabToolbarAction(skipButton) : null;
if (skipButton) listen(skipButton, 'click', () => {
    if (game.epilogue.frame) game.epilogue.skip(); else game.skipIntro();
    resetFeedback(); reflectPause(); focusCanvas();
});
if (replayButton) listen(replayButton, 'click', () => { resetFeedback(); game.replayIntro(); reflectPause(); focusCanvas(); });
if (presentButton) listen(presentButton, 'click', () => { game.presentIntro(); focusCanvas(); });
const pauseButton = document.getElementById('lab-pause')!;
const pauseAction = new LabToolbarAction(pauseButton);
listen(pauseButton, 'click', () => { game.toggleLabPause(); reflectPause(); focusCanvas(); });
function showControl(control: HTMLElement | null, visible: boolean) {
    if (!control || control.hidden === !visible) return;
    if (!visible && document.activeElement === control) focusCanvas();
    control.hidden = !visible;
}
function reflectPause() {
    if (game.isDisposed) return;
    reflectStatus();
    const epilogue = game.epilogue.frame;
    showControl(skipButton, game.labMode === 'intro' || !!epilogue && epilogue.beat !== 'complete');
    if (skipButton) skipButton.disabled = !!epilogue && game.state !== 'playing';
    skipAction?.setLabel(epilogue ? 'PULAR EPILOGO' : 'PULAR INTRO', epilogue ? 'Pular epílogo' : 'Pular introdução');
    showControl(replayButton, game.labMode !== 'intro');
    showControl(presentButton, game.intro?.beat === 'prepare');
    showControl(retryButton, game.labMode !== 'intro');
    const label = game.state === 'paused' ? 'Continuar' : 'Pausar';
    if (pauseButton.textContent !== label) pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', label);
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
// Reuse the existing toolbar refresh; action handlers can also sync immediately.
let toolbarFrame = 0;
function refreshToolbar() {
    if (game.isDisposed) return;
    reflectPause(); toolbarFrame = requestAnimationFrame(refreshToolbar);
}
refreshToolbar(); fitLab();
game.addCleanup(() => cancelAnimationFrame(toolbarFrame));
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav');
    if (nav) {
        const observer = new ResizeObserver(fitLab); observer.observe(nav);
        game.addCleanup(() => observer.disconnect());
    }
}
listen(retryButton, 'click', () => { resetFeedback(); game.load('juice-lab'); reflectPause(); focusCanvas(); });
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
listen(canvas, 'pointerdown', focusCanvas);
listen(window, 'pagehide', event => {
    // A cached history entry will reuse this document, including its listeners.
    if ((event as PageTransitionEvent).persisted) {
        if (game.state === 'playing') game.toggleLabPause();
        reflectPause();
    } else game.dispose();
});
game.start(); focusCanvas();
