import { DisposalScope } from './engine/DisposalScope';
import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';
import { INSPECTION_ROOMS, loadGuairaInspectionRoom, type GuairaInspectionRoomSceneId,
    type GuairaInspectionRoomFactory } from './adventure/experimental/guaira/GuairaInspectionRooms';

export interface GuairaGalleryPageDependencies {
    loadRoom?: (sceneId: GuairaInspectionRoomSceneId) => Promise<GuairaInspectionRoomFactory>;
}

/** A free visit always starts at Gallery. Relief is an explicit, local continuation. */
export function mountGuairaGalleryPage(dependencies: GuairaGalleryPageDependencies = {}): () => void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const status = document.getElementById('lab-status')!;
    const primary = document.getElementById('lab-pause') as HTMLButtonElement;
    const retry = document.getElementById('lab-retry') as HTMLButtonElement;
    const map = document.getElementById('lab-exit') as HTMLAnchorElement;
    const nav = document.querySelector('nav');
    const lifetime = new DisposalScope(), loadRoom = dependencies.loadRoom ?? loadGuairaInspectionRoom;
    let view = new DisposalScope(), focused = typeof document.hasFocus !== 'function' || document.hasFocus();
    let audioEnabled = true, actionEpoch = 0, primaryRevision = 0;
    let primaryPress: number | null = null, primaryKey: number | null = null;
    let retryPress: number | null = null, retryKey: number | null = null;
    const current = (owner: DisposalScope) => !lifetime.isDisposed && owner === view && !owner.isDisposed;
    const active = (owner: DisposalScope) => current(owner) && focused && !document.hidden;
    // Native anchor navigation, including modified clicks and browser history.
    map.href = './guaira.html?at=bairro';
    lifetime.listen(window, 'blur', () => { focused = false; actionEpoch++; });
    lifetime.listen(window, 'focus', () => { focused = true; });
    lifetime.listen(document, 'visibilitychange', () => { if (document.hidden) actionEpoch++; });
    lifetime.listen(primary, 'pointerdown', () => { primaryPress = primaryRevision; });
    lifetime.listen(primary, 'pointercancel', () => { primaryPress = -1; });
    lifetime.listen(retry, 'pointerdown', () => { retryPress = actionEpoch; });
    lifetime.listen(retry, 'pointercancel', () => { retryPress = -1; });
    lifetime.listen(window, 'keydown', event => {
        if (!['Enter', ' ', 'Spacebar'].includes(event.key) || (event.target !== primary && event.target !== retry)) return;
        if (event.repeat) { event.preventDefault(); return; }
        if (event.target === primary) primaryKey = primaryRevision;
        else retryKey = actionEpoch;
    }, true);
    function retryAction(owner: DisposalScope, sceneId: GuairaInspectionRoomSceneId) {
        let release = () => {};
        const bind = () => {
            release();
            const epoch = actionEpoch;
            release = owner.listen(retry, 'click', event => {
                if (!active(owner) || epoch !== actionEpoch) return;
                const pressed = event.detail === 0 ? retryKey : retryPress;
                if (event.detail === 0) retryKey = null; else retryPress = null;
                if (pressed !== null && pressed !== epoch) return;
                void mount(sceneId);
            });
        };
        owner.listen(window, 'focus', bind);
        owner.listen(document, 'visibilitychange', () => { if (!document.hidden) bind(); });
        bind();
    }

    function replace() {
        view.dispose(); view = new DisposalScope(); actionEpoch++; primaryRevision++;
        primary.disabled = true;
        return view;
    }
    async function mount(sceneId: GuairaInspectionRoomSceneId) {
        if (lifetime.isDisposed) return;
        const owner = replace(), info = INSPECTION_ROOMS[sceneId];
        let interrupted = !focused || document.hidden, frame: number | null = null;
        let reflect: (() => boolean) | null = null;
        const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
        const refresh = () => {
            stop();
            if (active(owner) && reflect?.() && active(owner)) frame = requestAnimationFrame(refresh);
        };
        owner.add(stop);
        owner.listen(window, 'blur', () => { interrupted = true; stop(); });
        owner.listen(window, 'focus', refresh);
        owner.listen(document, 'visibilitychange', () => { if (document.hidden) interrupted = true; refresh(); });
        retryAction(owner, sceneId);
        try {
            // Reusing the same three native controls preserves focus and normal exit semantics.
            primary.replaceChildren(); retry.replaceChildren(); map.replaceChildren();
            const primaryArt = new LabToolbarAction(primary, true);
            primaryArt.setLabel('PAUSA', 'Pausar');
            new LabToolbarAction(retry).setLabel('TENTAR', `Recomeçar ${info.title}`);
            new LabToolbarAction(map).setLabel('MAPA', 'Voltar ao Bairro da Vala Seca');
            status.setAttribute('role', 'status');
            status.textContent = `Abrindo ${info.title}…`;
            nav?.setAttribute('aria-label', `Controles de ${info.title}`);
            canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
            canvas.setAttribute('aria-label', `${info.title}, percurso opcional. ${info.objective}. Setas para mover, Espaço para pular, baixo no ar para sentada, Shift para correr e Escape para pausar.`);
            document.title = `Guaíra · ${info.title} · visita livre`;
            const factory = await loadRoom(sceneId);
            if (!current(owner)) return;
            const nativeStatus = document.createElement('span');
            const runtime = factory(canvas, nativeStatus), game = runtime.game;
            let keepAudio = false;
            owner.add(() => { if (keepAudio) audioEnabled = game.audio.enabled; game.dispose(); });
            if (!current(owner)) return;
            if (runtime.sceneId !== sceneId) throw Error('Optional factory returned a different room');
            game.audio.enabled = audioEnabled; game.audio.volume(); keepAudio = true;
            const controls = installGuairaLabControls(game, canvas, () => runtime.finished);
            owner.add(() => controls.dispose());
            type Action = 'pause' | 'resume' | 'relief' | null;
            let action: Action = null, releasePrimary = () => {};
            const actionNow = (): Action => game.isDisposed ? null : game.state === 'paused' ? 'resume'
                : game.state !== 'playing' ? null : sceneId === 'gallery' && runtime.finished && !game.player.data.isDead ? 'relief' : 'pause';
            const invalidate = () => {
                primaryRevision++; action = null; releasePrimary(); releasePrimary = () => {}; primary.disabled = true;
            };
            owner.add(invalidate);
            owner.listen(window, 'blur', invalidate);
            owner.listen(document, 'visibilitychange', () => { if (document.hidden) invalidate(); });
            reflect = () => {
                if (!current(owner) || game.isDisposed) return false;
                controls.sync();
                const next = actionNow();
                if (next !== action) {
                    invalidate(); action = next;
                    const revision = primaryRevision;
                    if (next) releasePrimary = owner.listen(primary, 'click', event => {
                        if (!active(owner) || revision !== primaryRevision || actionNow() !== next) return;
                        const pressed = event.detail === 0 ? primaryKey : primaryPress;
                        if (event.detail === 0) primaryKey = null; else primaryPress = null;
                        if (pressed !== null && pressed !== revision) return;
                        invalidate();
                        if (next === 'relief') { void mount('relief'); return; }
                        runtime.togglePause(); reflect?.(); canvas.focus({ preventScroll: true });
                    });
                }
                primary.disabled = next === null;
                primaryArt.setLabel(next === 'resume' ? 'CONTINUAR' : next === 'relief' ? 'ALÍVIO' : 'PAUSA',
                    next === 'resume' ? 'Continuar a tentativa'
                        : next === 'relief' ? 'Seguir para a Câmara de Alívio, continuação opcional' : 'Pausar');
                const message = game.state === 'paused' ? `Pausado · Continuar volta a ${info.title}`
                    : game.player.data.isDead ? 'Feka caiu · retorno ao ponto seguro desta tentativa'
                    : runtime.finished ? runtime.sceneId === 'gallery'
                        ? 'Acesso de inspeção aberto · Alívio segue para a Câmara de Alívio; Mapa volta ao Bairro da Vala Seca'
                        : `Passagem inspecionada · ${runtime.reliefOpened ? 'alívio aberto, grelha sem pressão' : 'alívio intacto, grelha mantém o ciclo'} · Mapa volta ao Bairro da Vala Seca`
                    : nativeStatus.textContent && !nativeStatus.textContent.startsWith('Pausado') ? nativeStatus.textContent : info.objective;
                if (status.textContent !== message) status.textContent = message;
                return true;
            };
            owner.listen(canvas, 'pointerdown', () => { if (current(owner)) canvas.focus({ preventScroll: true }); });
            const fit = () => { if (current(owner)) fitGuairaLabCanvas(canvas); };
            owner.listen(window, 'resize', fit);
            if (nav && typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(fit); owner.add(() => observer.disconnect()); observer.observe(nav);
            }
            if (interrupted && game.state === 'playing') runtime.togglePause();
            refresh(); fit(); game.start();
            if (active(owner)) canvas.focus({ preventScroll: true });
            document.title = `Guaíra · ${info.title} · visita livre`;
        } catch (error) {
            if (!current(owner)) return;
            const recovery = replace();
            primary.replaceChildren(); retry.replaceChildren(); map.replaceChildren();
            primary.textContent = 'PAUSA'; retry.textContent = 'TENTAR'; map.textContent = 'MAPA';
            retry.setAttribute('aria-label', `Tentar abrir ${info.title} novamente`);
            status.setAttribute('role', 'alert');
            status.textContent = `Não foi possível abrir ${info.title}. Tentar repete o carregamento; Mapa volta ao Bairro da Vala Seca.`;
            retryAction(recovery, sceneId);
            console.error('Inspection room initialization failed', error);
        }
    }
    void mount('gallery');
    return () => { if (lifetime.isDisposed) return; view.dispose(); lifetime.dispose(); };
}

let disposeGallery = mountGuairaGalleryPage();
window.addEventListener('pagehide', () => disposeGallery());
window.addEventListener('pageshow', event => {
    if (event.persisted) { disposeGallery(); disposeGallery = mountGuairaGalleryPage(); }
});
