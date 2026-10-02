import { DisposalScope } from '../../../../engine/DisposalScope';
import { LabToolbarAction } from '../../JuiceLabToolbar';
import { fitGuairaLabCanvas } from '../../../../guaira-lab-layout';
import { installGuairaLabControls } from '../../../../guaira-lab-controls';
import type { GuairaArrival } from '../GuairaMapModel';
import { GuairaChapterSession, type GuairaChapterAttempt, type GuairaChapterGeneration,
    type GuairaChapterLiveResult, type GuairaChapterOpening, type GuairaChapterSceneId } from './GuairaChapterSession';
import { CHAPTER_SCENES, loadGuairaChapterScene, type GuairaChapterRuntime, type GuairaChapterSceneFactory } from './GuairaChapterScenes';
import { GuairaChapterMapView, type GuairaChapterMapOptions } from './GuairaChapterMapView';
import { sameChapterMapTarget, type GuairaChapterMapTarget, type GuairaChapterNavigation } from './GuairaChapterNavigation';
import { CHAPTER_EXCURSIONS, loadGuairaChapterExcursion, type GuairaChapterExcursionSceneId, type GuairaChapterExcursionFactory, type GuairaChapterExcursionRuntime, type GuairaChapterExcursionToken } from './GuairaChapterExcursions';

export interface GuairaChapterMapPort {
    update(snapshot: ReturnType<GuairaChapterSession['snapshot']>, walkToSelection?: boolean, openingAvailable?: boolean, navigation?: GuairaChapterNavigation): void;
    canEnter(target: GuairaChapterMapTarget, generation: GuairaChapterGeneration, revision: number): boolean;
    dispose(): void;
}
export interface GuairaChapterAppDependencies {
    loadScene?: (sceneId: GuairaChapterSceneId) => Promise<GuairaChapterSceneFactory>;
    loadExcursion?: (sceneId: GuairaChapterExcursionSceneId) => Promise<GuairaChapterExcursionFactory>;
    createMap?: (root: HTMLElement, options: GuairaChapterMapOptions) => GuairaChapterMapPort;
    exit?: () => void;
}

type MountedRuntime =
    | { kind: 'chapter'; attempt: GuairaChapterAttempt; runtime: GuairaChapterRuntime }
    | { kind: 'optional'; token: GuairaChapterExcursionToken; runtime: GuairaChapterExcursionRuntime };

/** One owner for the chapter, one mounted map or native game, no persistence. */
export class GuairaChapterApp {
    private readonly lifetime = new DisposalScope();
    private view = new DisposalScope();
    private session = new GuairaChapterSession();
    private map: GuairaChapterMapPort | null = null;
    private mounted: MountedRuntime | null = null;
    private navigation: GuairaChapterNavigation = Object.freeze({ target: Object.freeze({ kind: 'chapter', sceneId: this.session.snapshot().selectedScene }), revision: 0 });
    private excursionToken: GuairaChapterExcursionToken | null = null;
    private excursionAttempt = 0;
    private openingAvailable = true;
    private audioEnabled = true;
    private focused = typeof document.hasFocus !== 'function' || document.hasFocus();
    private phase: 'map' | 'loading' | 'game' | 'error' | 'disposed' = 'map';
    private readonly loadScene: NonNullable<GuairaChapterAppDependencies['loadScene']>;
    private readonly loadExcursion: NonNullable<GuairaChapterAppDependencies['loadExcursion']>;
    private readonly createMap: NonNullable<GuairaChapterAppDependencies['createMap']>;
    private readonly exit: () => void;

    constructor(private readonly root: HTMLElement, dependencies: GuairaChapterAppDependencies = {}) {
        this.loadScene = dependencies.loadScene ?? loadGuairaChapterScene;
        this.loadExcursion = dependencies.loadExcursion ?? loadGuairaChapterExcursion;
        this.createMap = dependencies.createMap ?? ((node, options) => new GuairaChapterMapView(node, options));
        this.exit = dependencies.exit ?? (() => location.assign('./'));
        this.lifetime.listen(window, 'blur', () => { this.focused = false; });
        this.lifetime.listen(window, 'focus', () => { this.focused = true; });
        // A held native Enter must not activate a newly mounted map action again.
        // Gameplay Space/directions on the canvas keep the native Input behaviour.
        this.lifetime.listen(window, 'keydown', event => {
            const target = event.target;
            if (event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key) &&
                target instanceof HTMLElement && this.root.contains(target) && target.closest('button, a[href]'))
                event.preventDefault();
        }, true);
        this.showMap('town');
    }
    get snapshot() { return this.session.snapshot(); }
    get mode() { return this.phase; }
    get activeGame() { return this.mounted?.runtime.game ?? null; }
    get isDisposed() { return this.lifetime.isDisposed; }

    private replaceView(phase: Exclude<GuairaChapterApp['phase'], 'disposed'>) {
        this.view.dispose();
        this.view = new DisposalScope(); this.map = null; this.mounted = null; this.phase = phase;
        this.root.replaceChildren();
        document.body.classList.toggle('chapter-game', phase !== 'map');
        document.body.classList.toggle('chapter-map', phase === 'map');
        document.body.style.paddingTop = ''; document.body.style.paddingBottom = '';
        return this.view;
    }
    private current(scope: DisposalScope) { return !this.isDisposed && this.view === scope && !scope.isDisposed; }

    /** Observe focus before lazy construction; a missed native blur must still pause its new game. */
    private sceneActivity(scope: DisposalScope) {
        let interrupted = !this.focused || document.hidden;
        let reflect: (() => boolean) | null = null, frame: number | null = null;
        const active = () => this.current(scope) && this.focused && !document.hidden;
        const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
        const refresh = () => {
            stop();
            if (!active() || !reflect) return;
            if (!reflect()) return;
            if (active()) frame = requestAnimationFrame(refresh);
        };
        scope.add(stop);
        scope.listen(window, 'blur', () => { interrupted = true; stop(); });
        scope.listen(window, 'focus', refresh);
        scope.listen(document, 'visibilitychange', () => { if (document.hidden) interrupted = true; refresh(); });
        return { shouldPause: () => interrupted, observe: (next: () => boolean) => { reflect = next; refresh(); } };
    }

    private advanceNavigation(target = this.navigation.target) {
        this.navigation = Object.freeze({ target: Object.freeze({ ...target }), revision: this.navigation.revision + 1 });
    }
    private currentMapAction(scope: DisposalScope, generation: GuairaChapterGeneration, revision: number) {
        const snapshot = this.snapshot;
        return this.current(scope) && this.phase === 'map' && this.focused && !document.hidden && !snapshot.activeAttempt && !snapshot.disposed
            && revision === this.navigation.revision && generation.sessionId === snapshot.generation.sessionId
            && generation.generation === snapshot.generation.generation;
    }
    private showMap(arrival: GuairaArrival, walkToSelection = false, focusAction = false) {
        if (this.isDisposed) return;
        const scope = this.replaceView('map'), node = document.createElement('div');
        node.id = 'guaira-chapter-map'; this.root.append(node);
        document.title = 'Guaíra · Capítulo nesta sessão';
        const options: GuairaChapterMapOptions = {
            snapshot: this.snapshot, navigation: this.navigation, arrival, walkToSelection, focusAction, openingAvailable: this.openingAvailable,
            onSelect: (target, generation, revision) => {
                if (!this.currentMapAction(scope, generation, revision)) return;
                const retained = this.navigation.target.kind === 'optional' && target.kind === 'chapter'
                    && target.sceneId === this.snapshot.selectedScene;
                if (target.kind === 'chapter' && !retained && !this.session.selectScene(target.sceneId, generation)) return;
                this.advanceNavigation(target);
                this.map?.update(this.snapshot, true, this.openingAvailable, this.navigation);
            },
            onEnter: (target, generation, revision) => {
                if (!this.currentMapAction(scope, generation, revision) || !sameChapterMapTarget(target, this.navigation.target)
                    || !this.map?.canEnter(target, generation, revision)) return;
                if (target.kind === 'optional') { this.beginExcursion(); return; }
                const attempt = this.session.enterScene(target.sceneId, generation);
                if (!attempt) return;
                this.advanceNavigation(target); this.openingAvailable = false; void this.showScene(attempt);
            },
            onOpening: (opening, generation, revision) => this.changeOpening(opening, generation, revision, scope),
            onRestart: (generation, revision) => {
                if (!this.currentMapAction(scope, generation, revision)) return;
                const next = this.session.restartChapter(generation);
                if (!next) return;
                this.session = next; this.excursionToken = null; this.openingAvailable = true;
                this.advanceNavigation({ kind: 'chapter', sceneId: next.snapshot().selectedScene }); this.showMap('town');
            },
            onExit: (generation, revision) => {
                if (this.currentMapAction(scope, generation, revision)) { this.dispose(); this.exit(); }
            }
        };
        try {
            const map = this.createMap(node, options);
            scope.add(() => map.dispose());
            if (this.current(scope)) this.map = map;
        } catch (error) {
            if (!this.current(scope)) return;
            this.mapError(arrival, walkToSelection, focusAction);
            console.error('Chapter map initialization failed', error);
        }
    }
    private mapError(arrival: GuairaArrival, walkToSelection: boolean, focusAction: boolean) {
        const scope = this.replaceView('error');
        const nav = document.createElement('nav'), message = document.createElement('p');
        nav.className = 'chapter-game-toolbar'; nav.setAttribute('aria-label', 'Recuperar a maquete de Guaíra');
        message.id = 'lab-status'; message.setAttribute('role', 'alert'); message.textContent = 'Não foi possível abrir a maquete. Sua sessão continua aqui. Tentar repete o carregamento.';
        const retry = document.createElement('button'), exit = document.createElement('button');
        retry.type = exit.type = 'button'; retry.id = 'chapter-map-retry'; retry.textContent = 'TENTAR';
        retry.setAttribute('aria-label', 'Tentar abrir a maquete novamente');
        exit.textContent = 'SAIR'; exit.setAttribute('aria-label', 'Sair do capítulo e voltar ao jogo principal');
        scope.listen(retry, 'click', () => {
            if (!this.current(scope)) return;
            this.advanceNavigation(); this.showMap(arrival, walkToSelection, focusAction);
        });
        scope.listen(exit, 'click', () => { if (this.current(scope)) { this.dispose(); this.exit(); } });
        nav.append(message, retry, exit); this.root.append(nav);
    }
    private changeOpening(opening: GuairaChapterOpening, generation: GuairaChapterGeneration, revision: number, scope: DisposalScope) {
        if (!this.currentMapAction(scope, generation, revision) || !this.openingAvailable) return;
        const next = this.session.restartChapter(generation, { opening });
        if (!next) return;
        this.session = next; this.excursionToken = null;
        this.advanceNavigation({ kind: 'chapter', sceneId: next.snapshot().selectedScene }); this.showMap('town');
    }

    private scenePanel(attempt: GuairaChapterAttempt, scope: DisposalScope) {
        const info = CHAPTER_SCENES[attempt.sceneId], nav = document.createElement('nav');
        nav.className = 'chapter-game-toolbar'; nav.setAttribute('aria-label', 'Controles do capítulo de Guaíra');
        const status = document.createElement('span'); status.id = 'lab-status'; status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
        const primary = document.createElement('button'), retry = document.createElement('button'), map = document.createElement('button');
        primary.type = retry.type = map.type = 'button';
        primary.id = 'chapter-primary'; retry.id = 'chapter-retry'; map.id = 'chapter-map-return';
        const primaryArt = new LabToolbarAction(primary, true);
        new LabToolbarAction(retry).setLabel('TENTAR', `Recomeçar ${info.title} nesta tentativa`);
        new LabToolbarAction(map).setLabel('MAPA', 'Voltar à maquete do capítulo');
        primaryArt.setLabel('PAUSA', 'Pausar'); primary.disabled = true;
        nav.append(status, primary, retry, map);
        const canvas = document.createElement('canvas'); canvas.id = 'game-canvas'; canvas.tabIndex = 0;
        canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
        canvas.setAttribute('aria-label', `${info.title}. ${info.objective} Setas para mover, Espaço para pular, baixo no ar para sentada, Shift para correr e Escape para pausar.`);
        this.root.append(nav, canvas);
        scope.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
        scope.listen(retry, 'click', () => {
            if (!this.current(scope)) return;
            const next = this.session.retry(attempt);
            if (next) { this.advanceNavigation(); void this.showScene(next); }
        });
        scope.listen(map, 'click', () => this.leaveScene(attempt, 'map', scope));
        scope.listen(primary, 'click', () => {
            if (!this.current(scope) || this.mounted?.kind !== 'chapter' || this.mounted.attempt !== attempt) return;
            const runtime = this.mounted.runtime, game = runtime.game;
            if (game.isDisposed) return;
            if (game.state === 'paused') { runtime.togglePause(); canvas.focus(); return; }
            if (this.session.canContinue(attempt, runtime.sample(attempt))) this.leaveScene(attempt, 'continue', scope);
            else { runtime.togglePause(); canvas.focus(); }
        });
        const fit = () => { if (this.current(scope)) fitGuairaLabCanvas(canvas); };
        scope.listen(window, 'resize', fit);
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(fit); scope.add(() => observer.disconnect()); observer.observe(nav);
        }
        fit();
        return { canvas, status, primary, primaryArt, fit };
    }

    private async showScene(attempt: GuairaChapterAttempt) {
        if (this.isDisposed) return;
        const scope = this.replaceView('loading'), activity = this.sceneActivity(scope);
        const info = CHAPTER_SCENES[attempt.sceneId];
        try {
            const panel = this.scenePanel(attempt, scope);
            panel.status.textContent = `Abrindo ${info.title}…`;
            document.title = `Guaíra · ${info.title} · capítulo`;
            const factory = await this.loadScene(attempt.sceneId);
            if (!this.current(scope) || this.snapshot.activeAttempt !== attempt) return;
            // Native hints go to a detached node. The chapter changes only page
            // guidance; the actual canvas/character/mechanisms remain native.
            const nativeStatus = document.createElement('span');
            const runtime = factory(panel.canvas, nativeStatus), game = runtime.game;
            let ownsAudioPreference = false;
            scope.add(() => { if (ownsAudioPreference) this.audioEnabled = game.audio.enabled; game.dispose(); });
            if (!this.current(scope) || this.snapshot.activeAttempt !== attempt) return;
            this.mounted = { kind: 'chapter', attempt, runtime }; this.phase = 'game';
            game.audio.enabled = this.audioEnabled; ownsAudioPreference = true; game.audio.volume();
            const controls = installGuairaLabControls(game, panel.canvas, () => !!runtime.sample(attempt).result);
            scope.add(() => controls.dispose());
            const reflect = () => {
                if (!this.current(scope) || game.isDisposed) return false;
                controls.sync();
                const live = runtime.sample(attempt), complete = this.session.canContinue(attempt, live);
                panel.primary.disabled = game.state !== 'playing' && game.state !== 'paused';
                panel.primaryArt.setLabel(game.state === 'paused' || complete ? 'CONTINUAR' : 'PAUSA',
                    game.state === 'paused' ? 'Retomar a tentativa' : complete ? 'Continuar a jornada pela maquete' : 'Pausar');
                const step = this.snapshot.route.indexOf(attempt.sceneId) + 1;
                const native = nativeStatus.textContent?.split(/ · setas\/A D:| · setas:| · Esc:/)[0] || info.objective;
                // The free-lab introduction names the fictional setting. In the
                // chapter this line should tell the player what to do next.
                const guidance = native === 'Guaíra fictícia' ? info.objective : native;
                const message = game.state === 'paused' ? 'Pausado · Continuar volta à tentativa'
                    : !live.alive ? 'Feka caiu · retorno ao ponto seguro desta tentativa'
                    : complete ? 'Trecho concluído · Continuar volta à maquete'
                    : `Etapa ${step}/5 · ${game.boss?.hint ?? guidance}`;
                if (panel.status.textContent !== message) panel.status.textContent = message;
                return true;
            };
            if (activity.shouldPause() && game.state === 'playing') runtime.togglePause();
            activity.observe(reflect); panel.fit(); game.start(); panel.canvas.focus({ preventScroll: true });
            document.title = `Guaíra · ${info.title} · capítulo`;
        } catch (error) {
            if (!this.current(scope)) return;
            // Retire any partially mounted controls/runtime before installing a
            // fresh error view, while retaining the still-unfinished attempt.
            this.sceneError(attempt);
            console.error('Chapter scene initialization failed', error);
        }
    }
    private sceneError(attempt: GuairaChapterAttempt) {
        const scope = this.replaceView('error');
        // Recovery must not depend on the canvas or observer that may have failed.
        const nav = document.createElement('nav'), status = document.createElement('p');
        nav.className = 'chapter-game-toolbar'; nav.setAttribute('aria-label', 'Recuperar o trecho de Guaíra');
        status.id = 'lab-status'; status.setAttribute('role', 'alert');
        status.textContent = 'Não foi possível abrir este trecho. Tentar repete o carregamento; Mapa volta à maquete.';
        const retry = document.createElement('button'), map = document.createElement('button');
        retry.type = map.type = 'button'; retry.id = 'chapter-retry'; map.id = 'chapter-map-return';
        retry.textContent = 'TENTAR'; retry.setAttribute('aria-label', 'Tentar abrir este trecho novamente');
        map.textContent = 'MAPA'; map.setAttribute('aria-label', 'Voltar à maquete do capítulo');
        scope.listen(retry, 'click', () => {
            if (!this.current(scope)) return;
            const next = this.session.retry(attempt);
            if (next) { this.advanceNavigation(); void this.showScene(next); }
        });
        scope.listen(map, 'click', () => this.leaveScene(attempt, 'map', scope));
        nav.append(status, retry, map); this.root.append(nav);
    }
    private leaveScene(attempt: GuairaChapterAttempt, action: 'continue' | 'map', scope: DisposalScope) {
        if (!this.current(scope)) return;
        const runtime = this.mounted?.kind === 'chapter' && this.mounted.attempt === attempt ? this.mounted.runtime : null;
        const live: GuairaChapterLiveResult = runtime?.sample(attempt) ?? { attempt, state: 'loading', alive: false, result: null };
        const transition = action === 'continue' ? this.session.continueFrom(attempt, live) : this.session.exitToMap(attempt, live);
        if (!transition) return;
        const arrival = runtime?.returnArrival() ?? CHAPTER_SCENES[attempt.sceneId].arrival;
        this.advanceNavigation({ kind: 'chapter', sceneId: this.snapshot.selectedScene });
        this.showMap(arrival, action === 'continue');
    }
    private currentExcursion(token: GuairaChapterExcursionToken, scope: DisposalScope) {
        return this.current(scope) && this.excursionToken === token && token.sessionId === this.snapshot.generation.sessionId
            && token.navigationRevision === this.navigation.revision && this.navigation.target.kind === 'optional'
            && !this.snapshot.activeAttempt;
    }
    private beginExcursion(sceneId: GuairaChapterExcursionSceneId = 'gallery') {
        this.advanceNavigation({ kind: 'optional', stop: 'bairro' });
        const token: GuairaChapterExcursionToken = Object.freeze({ sceneId, sessionId: this.snapshot.generation.sessionId,
            attemptId: ++this.excursionAttempt, navigationRevision: this.navigation.revision });
        this.excursionToken = token; void this.showExcursion(token);
    }
    private leaveExcursion(token: GuairaChapterExcursionToken, scope: DisposalScope) {
        if (!this.currentExcursion(token, scope)) return;
        this.excursionToken = null; this.advanceNavigation(); this.showMap('bairro', false, true);
    }
    private excursionPanel(token: GuairaChapterExcursionToken, scope: DisposalScope) {
        const info = CHAPTER_EXCURSIONS[token.sceneId], nav = document.createElement('nav');
        nav.className = 'chapter-game-toolbar'; nav.setAttribute('aria-label', `Controles de ${info.title}, desvio opcional`);
        const status = document.createElement('span'); status.id = 'lab-status'; status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
        const primary = document.createElement('button'), retry = document.createElement('button'), map = document.createElement('button');
        primary.type = retry.type = map.type = 'button';
        primary.id = 'chapter-primary'; retry.id = 'chapter-retry'; map.id = 'chapter-map-return';
        const primaryArt = new LabToolbarAction(primary, true);
        new LabToolbarAction(retry).setLabel('TENTAR', `Recomeçar ${info.title} nesta tentativa opcional`);
        new LabToolbarAction(map).setLabel('BAIRRO', 'Voltar ao Bairro da Vala Seca no capítulo');
        primaryArt.setLabel('PAUSA', 'Pausar'); primary.disabled = true;
        nav.append(status, primary, retry, map);
        const canvas = document.createElement('canvas'); canvas.id = 'game-canvas'; canvas.tabIndex = 0;
        canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
        canvas.setAttribute('aria-label', `${info.title}, percurso opcional. ${info.objective}. Setas para mover, Espaço para pular, baixo no ar para sentada, Shift para correr e Escape para pausar.`);
        this.root.append(nav, canvas);
        scope.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
        scope.listen(retry, 'click', () => { if (this.currentExcursion(token, scope)) this.beginExcursion(token.sceneId); });
        scope.listen(map, 'click', () => this.leaveExcursion(token, scope));
        const fit = () => { if (this.current(scope)) fitGuairaLabCanvas(canvas); };
        scope.listen(window, 'resize', fit);
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(fit); scope.add(() => observer.disconnect()); observer.observe(nav);
        }
        fit(); return { canvas, status, primary, primaryArt, fit };
    }
    private async showExcursion(token: GuairaChapterExcursionToken) {
        if (this.isDisposed) return;
        const scope = this.replaceView('loading'), activity = this.sceneActivity(scope), info = CHAPTER_EXCURSIONS[token.sceneId];
        try {
            const panel = this.excursionPanel(token, scope);
            panel.status.textContent = `Abrindo ${info.title} · desvio opcional…`;
            document.title = `Guaíra · ${info.title} · capítulo`;
            const factory = await this.loadExcursion(token.sceneId);
            if (!this.currentExcursion(token, scope)) return;
            const nativeStatus = document.createElement('span');
            const runtime = factory(panel.canvas, nativeStatus), game = runtime.game;
            // Own the native resources before controls, observers or reflection can fail.
            let ownsAudioPreference = false;
            scope.add(() => { if (ownsAudioPreference) this.audioEnabled = game.audio.enabled; game.dispose(); });
            if (!this.currentExcursion(token, scope)) return;
            if (runtime.sceneId !== token.sceneId) throw Error('Optional factory returned a different room');
            this.mounted = { kind: 'optional', token, runtime }; this.phase = 'game';
            game.audio.enabled = this.audioEnabled; ownsAudioPreference = true; game.audio.volume();
            const controls = installGuairaLabControls(game, panel.canvas, () => runtime.finished);
            scope.add(() => controls.dispose());
            type PrimaryAction = 'pause' | 'resume' | 'relief' | null;
            let primaryAction: PrimaryAction = null, primaryRevision = 0, pressedPrimaryRevision: number | null = null, releasePrimary = () => {};
            scope.listen(panel.primary, 'pointerdown', () => { pressedPrimaryRevision = primaryRevision; });
            scope.listen(panel.primary, 'pointercancel', () => { pressedPrimaryRevision = -1; });
            const actionNow = (): PrimaryAction => game.isDisposed ? null : game.state === 'paused' ? 'resume'
                : game.state !== 'playing' ? null : token.sceneId === 'gallery' && runtime.finished && !game.player.data.isDead ? 'relief' : 'pause';
            const invalidatePrimary = () => {
                primaryRevision++; primaryAction = null; releasePrimary(); releasePrimary = () => {};
                panel.primary.disabled = true;
            };
            scope.add(invalidatePrimary);
            scope.listen(window, 'blur', invalidatePrimary);
            scope.listen(document, 'visibilitychange', () => { if (document.hidden) invalidatePrimary(); });
            const reflect = () => {
                if (!this.currentExcursion(token, scope) || game.isDisposed) return false;
                controls.sync();
                const action = actionNow();
                if (action !== primaryAction) {
                    invalidatePrimary(); primaryAction = action;
                    const revision = primaryRevision;
                    if (action) releasePrimary = scope.listen(panel.primary, 'click', event => {
                        if (!this.currentExcursion(token, scope) || !this.focused || document.hidden
                            || this.mounted?.kind !== 'optional' || this.mounted.token !== token
                            || revision !== primaryRevision || actionNow() !== action) return;
                        const pressedRevision = pressedPrimaryRevision; pressedPrimaryRevision = null;
                        if (event.detail !== 0 && pressedRevision !== null && pressedRevision !== revision) return;
                        // Every action is leased to its displayed state. A saved ALÍVIO
                        // callback cannot turn into Resume, or survive interruption.
                        invalidatePrimary();
                        if (action === 'relief') { this.beginExcursion('relief'); return; }
                        runtime.togglePause(); reflect(); panel.canvas.focus({ preventScroll: true });
                    });
                }
                panel.primary.disabled = action === null;
                panel.primaryArt.setLabel(action === 'resume' ? 'CONTINUAR' : action === 'relief' ? 'ALÍVIO' : 'PAUSA',
                    action === 'resume' ? 'Retomar a tentativa opcional'
                        : action === 'relief' ? 'Seguir para a Câmara de Alívio, continuação opcional' : 'Pausar');
                const message = game.state === 'paused' ? `Pausado · Continuar volta a ${info.title}`
                    : game.player.data.isDead ? 'Feka caiu · retorno ao ponto seguro desta tentativa opcional'
                    : runtime.finished ? runtime.sceneId === 'gallery'
                        ? 'Acesso de inspeção aberto · Alívio segue para a Câmara de Alívio; Bairro volta à maquete'
                        : `Passagem inspecionada · ${runtime.reliefOpened ? 'alívio aberto, grelha sem pressão' : 'alívio intacto, grelha mantém o ciclo'} · Bairro volta à maquete`
                    : runtime.sceneId === 'relief' && nativeStatus.textContent && !nativeStatus.textContent.startsWith('Pausado')
                        ? nativeStatus.textContent : `Desvio opcional · ${info.objective}`;
                if (panel.status.textContent !== message) panel.status.textContent = message;
                return true;
            };
            if (activity.shouldPause() && game.state === 'playing') runtime.togglePause();
            activity.observe(reflect); panel.fit(); game.start(); panel.canvas.focus({ preventScroll: true });
            document.title = `Guaíra · ${info.title} · capítulo`;
        } catch (error) {
            if (!this.currentExcursion(token, scope)) return;
            this.excursionError(token); console.error('Chapter excursion initialization failed', error);
        }
    }
    private excursionError(token: GuairaChapterExcursionToken) {
        const scope = this.replaceView('error'), info = CHAPTER_EXCURSIONS[token.sceneId];
        const nav = document.createElement('nav'), status = document.createElement('p');
        nav.className = 'chapter-game-toolbar'; nav.setAttribute('aria-label', `Recuperar ${info.title}`);
        status.id = 'lab-status'; status.setAttribute('role', 'alert');
        status.textContent = `Não foi possível abrir ${info.title}. Tentar repete o carregamento; Bairro volta ao capítulo. Sua jornada continua aqui.`;
        const retry = document.createElement('button'), map = document.createElement('button');
        retry.type = map.type = 'button'; retry.id = 'chapter-retry'; map.id = 'chapter-map-return';
        retry.textContent = 'TENTAR'; retry.setAttribute('aria-label', `Tentar abrir ${info.title} novamente`);
        map.textContent = 'BAIRRO'; map.setAttribute('aria-label', 'Voltar ao Bairro da Vala Seca no capítulo');
        scope.listen(retry, 'click', () => { if (this.currentExcursion(token, scope)) this.beginExcursion(token.sceneId); });
        scope.listen(map, 'click', () => this.leaveExcursion(token, scope));
        nav.append(status, retry, map); this.root.append(nav);
    }
    dispose() {
        if (this.isDisposed) return;
        this.advanceNavigation(); this.excursionToken = null;
        this.phase = 'disposed'; this.session.dispose(); this.view.dispose(); this.lifetime.dispose();
        this.map = null; this.mounted = null; this.root.replaceChildren();
        document.body.classList.remove('chapter-map', 'chapter-game');
        document.body.style.paddingTop = ''; document.body.style.paddingBottom = '';
    }
}
