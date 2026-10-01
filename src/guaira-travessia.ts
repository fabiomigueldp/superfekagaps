import { GuairaTraversal, GUAIRA_TRAVERSAL } from './adventure/experimental/guaira/GuairaTraversal';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new GuairaTraversal(canvas, document.getElementById('lab-status')!);
const pauseButton = document.getElementById('lab-pause')!;
const mapLink = document.getElementById('lab-exit')!;
const bossLink = document.getElementById('traversal-boss')!;
const pauseAction = new LabToolbarAction(pauseButton);
for (const [id, label, name] of [['lab-retry', 'TENTAR', 'Recomeçar travessia'],
    ['lab-exit', 'MAPA', 'Voltar ao mapa de Guaíra'], ['traversal-boss', 'CURRAL', 'Enfrentar Ossabravo']])
    new LabToolbarAction(document.getElementById(id)!).setLabel(label, name);
pauseButton.addEventListener('click', () => { game.toggleTraversalPause(); canvas.focus(); });
document.getElementById('lab-retry')!.addEventListener('click', () => { game.load(GUAIRA_TRAVERSAL.id); canvas.focus(); });

function fitTraversal() {
    const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 100;
    const scale = Math.max(.5, Math.floor(Math.min(innerWidth / 320, (innerHeight - navHeight - 12) / 180)));
    document.body.style.paddingTop = `${navHeight}px`;
    canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`;
}
function reflectState() {
    pauseAction.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA', game.state === 'paused' ? 'Continuar' : 'Pausar');
    bossLink.hidden = !game.finished || game.state === 'paused';
    pauseButton.hidden = game.finished && game.state !== 'paused';
    mapLink.setAttribute('href', `${GUAIRA_TRAVERSAL.mapHref}?at=${game.store.save.checkpoint ? 'rice' : 'town'}`);
    requestAnimationFrame(reflectState);
}
window.addEventListener('resize', fitTraversal);
if (typeof ResizeObserver !== 'undefined') {
    const nav = document.querySelector('nav'); if (nav) new ResizeObserver(fitTraversal).observe(nav);
}
canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
reflectState(); fitTraversal(); game.start(); canvas.focus();
