import { chapterExitPresentation, chapterGuidance, chapterTitle, chapterAttemptSummary, chapterResumeGuidance } from './GuairaChapterPresentation';
import { ProgressStore } from '../../../progress';
import { freshGuairaChapterProgress, type GuairaChapterProgress } from './GuairaChapterProgress';
import { reliefChallengeMessage, type GuairaReliefOptions } from '../relief/GuairaReliefChallenge';
import { installReliefReplayControls } from '../relief/GuairaReliefReplayControls';
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
    progressStore?: ProgressStore;
    campaign?: boolean;
    continueCampaign?: () => void;
    canContinueCampaign?: () => boolean;
}

type MountedRuntime =
    | { kind: 'chapter'; attempt: GuairaChapterAttempt; runtime: GuairaChapterRuntime }
    | { kind: 'optional'; token: GuairaChapterExcursionToken; runtime: GuairaChapterExcursionRuntime };

/** One owner for chapter navigation, durable receipts and one mounted native runtime. */
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
    private readonly progressStore: ProgressStore;
    private progress: GuairaChapterProgress;
    private saved = false;
    private readonly campaign: boolean;
    private readonly continueCampaign?: () => void;
    private readonly canContinueCampaign?: () => boolean;

    constructor(private readonly root: HTMLElement, dependencies: GuairaChapterAppDependencies = {}) {
        let storage: Storage | null = null;
        try { storage = window.localStorage; } catch { /* unavailable: session fallback */ }
        this.progressStore = dependencies.progressStore ?? new ProgressStore(storage);
        this.progress = this.progressStore.save.guaira ?? freshGuairaChapterProgress();
        this.session = new GuairaChapterSession({ progress: this.progress });
        this.audioEnabled = this.progress.audioEnabled;
        this.openingAvailable = !this.progress.completed.length && this.progress.resumeScene === null;
        this.navigation = Object.freeze({ target: Object.freeze({ kind: 'chapter', sceneId: this.snapshot.selectedScene }), revision: 0 });
        this.campaign = dependencies.campaign ?? false;
        this.continueCampaign = dependencies.continueCampaign;
        this.canContinueCampaign = dependencies.canContinueCampaign;
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
        const resume = this.progress.resumeScene;
        this.persistProgress(resume);
        if (resume === 'gallery' || resume === 'relief') this.beginExcursion(resume);
        else if (resume && !this.progress.completed.includes(resume)) {
            this.session.selectScene(resume, this.snapshot.generation);
            const attempt = this.session.enterScene(resume, this.snapshot.generation);
            if (attempt) void this.showScene(attempt); else this.showMap('town');
        } else this.showMap('town');
    }
    private storageMessage() {
        return this.progressStore.warning || (this.saved ? 'Conclusões salvas neste navegador.' : 'Progresso somente nesta sessão.');
    }
    private persistProgress(resumeScene: GuairaChapterProgress['resumeScene'] = this.progress.resumeScene) {
        const snapshot = this.snapshot;
        this.progress = { ...this.progress, opening: snapshot.opening,
            completed: snapshot.accepted.map(receipt => receipt.sceneId),
            selectedScene: snapshot.activeAttempt && snapshot.accepted.some(receipt => receipt.sceneId === snapshot.activeAttempt?.sceneId)
                ? snapshot.nextRecommendedScene ?? snapshot.selectedScene : snapshot.selectedScene,
            resumeScene, audioEnabled: this.audioEnabled };
        this.saved = this.progressStore.updateGuaira(this.progress);
    }
    private captureLiveProgress() {
        if (this.mounted?.kind === 'chapter') {
            const { attempt, runtime } = this.mounted;
            this.session.acceptCompletion(attempt, runtime.sample(attempt));
            this.audioEnabled = runtime.game.audio.enabled;
        } else if (this.mounted?.kind === 'optional') {
            const { token, runtime } = this.mounted;
            if (runtime.finished && !runtime.game.player.data.isDead && ['playing', 'paused'].includes(runtime.game.state))
                this.progress.optional[token.sceneId] = true;
            this.audioEnabled = runtime.game.audio.enabled;
        }
        this.persistProgress();
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
        document.title = chapterTitle();
        const options: GuairaChapterMapOptions = {
            audioEnabled: () => this.audioEnabled, onAudioEnabled: enabled => { this.audioEnabled = enabled; this.persistProgress(); },
            storageMessage: () => this.storageMessage(), optionalProgress: () => this.progress.optional,
            campaign: this.campaign, canContinueCampaign: () => this.snapshot.chapterComplete || !!this.canContinueCampaign?.(),
            onContinueCampaign: (generation, revision) => {
                if (!this.currentMapAction(scope, generation, revision) || !(this.snapshot.chapterComplete || this.canContinueCampaign?.())) return;
                this.captureLiveProgress(); this.continueCampaign?.();
            },
            snapshot: this.snapshot, navigation: this.navigation, arrival, walkToSelection, focusAction, openingAvailable: this.openingAvailable,
            onSelect: (target, generation, revision) => {
                if (!this.currentMapAction(scope, generation, revision)) return;
                const retained = this.navigation.target.kind === 'optional' && target.kind === 'chapter'
                    && target.sceneId === this.snapshot.selectedScene;
                if (target.kind === 'chapter' && !retained && !this.session.selectScene(target.sceneId, generation)) return;
                this.advanceNavigation(target); this.persistProgress(null);
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
                const next = new GuairaChapterSession({ progress: { ...this.progress, selectedScene: this.snapshot.opening, resumeScene: null } });
                this.session.dispose();
                if (!next) return;
                this.session = next; this.excursionToken = null; this.openingAvailable = !this.snapshot.accepted.length; this.persistProgress(null);
                this.advanceNavigation({ kind: 'chapter', sceneId: next.snapshot().selectedScene }); this.showMap('town');
            },
            onExit: (generation, revision) => {
                if (this.currentMapAction(scope, generation, revision)) { this.captureLiveProgress(); if (!this.campaign) this.dispose(); this.exit(); }
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
        message.id = 'lab-status'; message.setAttribute('role', 'alert'); message.textContent = 'Não foi possível abrir o mapa de Guaíra. Sua sessão continua aqui. Tentar repete o carregamento.';
        const retry = document.createElement('button'), exit = document.createElement('button');
        retry.type = exit.type = 'button'; retry.id = 'chapter-map-retry'; retry.textContent = 'TENTAR';
        retry.setAttribute('aria-label', 'Tentar abrir a maquete novamente');
        const destination = chapterExitPresentation(this.campaign);
        exit.textContent = destination.label; exit.setAttribute('aria-label', destination.description);
        scope.listen(retry, 'click', () => {
            if (!this.current(scope)) return;
            this.advanceNavigation(); this.showMap(arrival, walkToSelection, focusAction);
        });
        scope.listen(exit, 'click', () => { if (this.current(scope)) { this.captureLiveProgress(); if (!this.campaign) this.dispose(); this.exit(); } });
        nav.append(message, retry, exit); this.root.append(nav);
    }
    private changeOpening(opening: GuairaChapterOpening, generation: GuairaChapterGeneration, revision: number, scope: DisposalScope) {
        if (!this.currentMapAction(scope, generation, revision) || !this.openingAvailable || this.navigation.target.kind !== 'chapter') return;
        const next = this.session.restartChapter(generation, { opening });
        if (!next) return;
        this.session = next; this.excursionToken = null; this.persistProgress(null);
        this.advanceNavigation({ kind: 'chapter', sceneId: next.snapshot().selectedScene }); this.showMap('town');
    }

    private keyboardHint() {
        const hint = document.createElement('p'); hint.id = 'chapter-keyboard-hint';
        hint.textContent = 'Teclado: ←/→ mover · Espaço pular · ↓ no ar: sentada · Shift correr · Esc pausa · M som';
        return hint;
    }

    /** Same sound preference in every room; never routes through the campaign menu. */
    private sceneSound(scope: DisposalScope, canvas: HTMLCanvasElement) {
        const button = document.createElement('button'); button.type = 'button'; button.id = 'chapter-sound';
        const art = new LabToolbarAction(button);
        const sync = () => {
            const game = this.current(scope) ? this.mounted?.runtime.game : null;
            button.disabled = !game || game.isDisposed;
            const enabled = game?.audio.enabled ?? this.audioEnabled;
            art.setLabel(enabled ? 'SOM' : 'MUDO', enabled ? 'Desativar o som do capítulo' : 'Ativar o som do capítulo');
            button.setAttribute('aria-pressed', String(enabled));
        };
        scope.listen(button, 'click', () => {
            const game = this.current(scope) && this.focused && !document.hidden ? this.mounted?.runtime.game : null;
            if (!game || game.isDisposed) return;
            game.audio.unlock(); game.audio.toggle(); this.audioEnabled = game.audio.enabled;
            this.persistProgress(); sync(); canvas.focus({ preventScroll: true });
        });
        sync(); return { button, sync };
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
        new LabToolbarAction(map).setLabel('MAPA', 'Voltar ao mapa de Guaíra');
        primaryArt.setLabel('PAUSA', 'Pausar'); primary.disabled = true;

        const canvas = document.createElement('canvas'); canvas.id = 'game-canvas'; canvas.tabIndex = 0;
        canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
        const sound = this.sceneSound(scope, canvas);
        nav.append(status, primary, retry, map, sound.button, this.keyboardHint());
        canvas.setAttribute('aria-label', `${info.title}. ${info.objective} Setas para mover, Espaço para pular, baixo no ar para sentada, Shift para correr, Escape para pausar e M para o som.`);
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
        return { canvas, status, primary, primaryArt, sound, fit };
    }

    private async showScene(attempt: GuairaChapterAttempt) {
        if (this.isDisposed) return;
        this.persistProgress(attempt.sceneId);
        const scope = this.replaceView('loading'), activity = this.sceneActivity(scope);
        const info = CHAPTER_SCENES[attempt.sceneId];
        try {
            const panel = this.scenePanel(attempt, scope);
            panel.status.textContent = `Abrindo ${info.title}…`;
            document.title = chapterTitle(info.title);
            const factory = await this.loadScene(attempt.sceneId);
            if (!this.current(scope) || this.snapshot.activeAttempt !== attempt) return;
            // Native hints go to a detached node. The chapter changes only page
            // guidance; the actual canvas/character/mechanisms remain native.
            const nativeStatus = document.createElement('span');
            const runtime = factory(panel.canvas, nativeStatus), game = runtime.game;
            game.stage = { ...game.stage, name: info.title, subtitle: info.objective };
            let ownsAudioPreference = false;
            scope.add(() => { if (ownsAudioPreference) this.audioEnabled = game.audio.enabled; game.dispose(); });
            if (!this.current(scope) || this.snapshot.activeAttempt !== attempt) return;
            this.mounted = { kind: 'chapter', attempt, runtime }; this.phase = 'game';
            const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            Object.assign(game.store.save.preferences, this.progressStore.save.preferences,
                { shake: this.progressStore.save.preferences.shake && !reducedMotion });
            game.audio.enabled = this.audioEnabled; ownsAudioPreference = true; game.audio.volume();
            const controls = installGuairaLabControls(game, panel.canvas, () => !!runtime.sample(attempt).result);
            scope.add(() => controls.dispose());
            const reflect = () => {
                if (!this.current(scope) || game.isDisposed) return false;
                controls.sync(); panel.sound.sync();
                const live = runtime.sample(attempt), complete = this.session.canContinue(attempt, live);
                if (this.session.acceptCompletion(attempt, live) || this.audioEnabled !== game.audio.enabled) {
                    this.audioEnabled = game.audio.enabled; this.persistProgress();
                }
                panel.primary.disabled = game.state !== 'playing' && game.state !== 'paused';
                panel.primaryArt.setLabel(game.state === 'paused' || complete ? 'CONTINUAR' : 'PAUSA',
                    game.state === 'paused' ? 'Retomar a tentativa' : complete ? 'Continuar a jornada pelo mapa' : 'Pausar');
                const step = this.snapshot.route.indexOf(attempt.sceneId) + 1;
                const guidance = chapterGuidance(nativeStatus.textContent, info.objective);
                const message = game.state === 'paused' ? `Pausado · Continuar retoma daqui · ${chapterResumeGuidance()}`
                    : !live.alive ? 'Feka caiu · retorno ao ponto seguro desta tentativa'
                    : complete ? `Trecho concluído · ${chapterAttemptSummary(game.coins)} · Continuar volta ao mapa de Guaíra`
                    : `Etapa ${step}/5 · ${game.boss?.hint ?? guidance}`;
                const statusMessage = `${message} · ${this.storageMessage()}`;
                if (panel.status.textContent !== statusMessage) panel.status.textContent = statusMessage;
                return true;
            };
            if (activity.shouldPause() && game.state === 'playing') runtime.togglePause();
            activity.observe(reflect); panel.fit(); game.start(); panel.canvas.focus({ preventScroll: true });
            document.title = chapterTitle(info.title);
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
        status.textContent = 'Não foi possível abrir este trecho. Tentar repete o carregamento; Mapa volta ao mapa de Guaíra.';
        const retry = document.createElement('button'), map = document.createElement('button');
        retry.type = map.type = 'button'; retry.id = 'chapter-retry'; map.id = 'chapter-map-return';
        retry.textContent = 'TENTAR'; retry.setAttribute('aria-label', 'Tentar abrir este trecho novamente');
        map.textContent = 'MAPA'; map.setAttribute('aria-label', 'Voltar ao mapa de Guaíra');
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
        this.persistProgress(null); this.showMap(arrival, action === 'continue');
    }
    private currentExcursion(token: GuairaChapterExcursionToken, scope: DisposalScope) {
        return this.current(scope) && this.excursionToken === token && token.sessionId === this.snapshot.generation.sessionId
            && token.navigationRevision === this.navigation.revision && this.navigation.target.kind === 'optional'
            && !this.snapshot.activeAttempt;
    }
    private beginExcursion(sceneId: GuairaChapterExcursionSceneId = 'gallery', options?: GuairaReliefOptions) {
        this.advanceNavigation({ kind: 'optional', stop: 'bairro' });
        const token: GuairaChapterExcursionToken = Object.freeze({ sceneId, sessionId: this.snapshot.generation.sessionId,
            attemptId: ++this.excursionAttempt, navigationRevision: this.navigation.revision });
        this.excursionToken = token; this.persistProgress(sceneId); void this.showExcursion(token, options);
    }
    private leaveExcursion(token: GuairaChapterExcursionToken, scope: DisposalScope) {
        if (!this.currentExcursion(token, scope)) return;
        this.captureLiveProgress(); this.persistProgress(null); this.excursionToken = null; this.advanceNavigation(); this.showMap('bairro', false, true);
    }
    private excursionPanel(token: GuairaChapterExcursionToken, scope: DisposalScope, options?: GuairaReliefOptions) {
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

        const canvas = document.createElement('canvas'); canvas.id = 'game-canvas'; canvas.tabIndex = 0;
        canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
        const sound = this.sceneSound(scope, canvas);
        nav.append(status, primary, retry, map, sound.button, this.keyboardHint());
        canvas.setAttribute('aria-label', `${info.title}, percurso opcional. ${info.objective}. Setas para mover, Espaço para pular, baixo no ar para sentada, Shift para correr, Escape para pausar e M para o som.`);
        this.root.append(nav, canvas);
        scope.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
        scope.listen(retry, 'click', () => {
            if (!this.currentExcursion(token, scope) || (token.sceneId === 'relief' && (!this.focused || document.hidden))) return;
            if (this.mounted?.kind === 'optional' && this.mounted.runtime.sceneId === 'relief' && this.mounted.runtime.routes) return;
            this.beginExcursion(token.sceneId, options);
        });
        scope.listen(map, 'click', () => this.leaveExcursion(token, scope));
        const fit = () => { if (this.current(scope)) fitGuairaLabCanvas(canvas); };
        scope.listen(window, 'resize', fit);
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(fit); scope.add(() => observer.disconnect()); observer.observe(nav);
        }
        fit(); return { canvas, status, primary, retry, primaryArt, sound, fit };
    }
    private async showExcursion(token: GuairaChapterExcursionToken, options?: GuairaReliefOptions) {
        if (this.isDisposed) return;
        const scope = this.replaceView('loading'), activity = this.sceneActivity(scope), info = CHAPTER_EXCURSIONS[token.sceneId];
        try {
            const panel = this.excursionPanel(token, scope, options);
            panel.status.textContent = `Abrindo ${info.title} · desvio opcional…`;
            document.title = chapterTitle(info.title);
            const factory = await this.loadExcursion(token.sceneId);
            if (!this.currentExcursion(token, scope)) return;
            const nativeStatus = document.createElement('span');
            const runtime = factory(panel.canvas, nativeStatus, options), game = runtime.game;
            game.stage = { ...game.stage, name: info.title, subtitle: info.objective };
            // Own the native resources before controls, observers or reflection can fail.
            let ownsAudioPreference = false;
            scope.add(() => { if (ownsAudioPreference) this.audioEnabled = game.audio.enabled; game.dispose(); });
            if (!this.currentExcursion(token, scope)) return;
            if (runtime.sceneId !== token.sceneId) throw Error('Optional factory returned a different room');
            this.mounted = { kind: 'optional', token, runtime }; this.phase = 'game';
            const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            Object.assign(game.store.save.preferences, this.progressStore.save.preferences,
                { shake: this.progressStore.save.preferences.shake && !reducedMotion });
            game.audio.enabled = this.audioEnabled; ownsAudioPreference = true; game.audio.volume();
            const controls = installGuairaLabControls(game, panel.canvas, () => runtime.finished);
            scope.add(() => controls.dispose());
            const routes = runtime.sceneId === 'relief' ? runtime.routes : undefined;
            const replay = routes ? installReliefReplayControls(scope, routes, panel.primary, panel.retry,
                () => this.currentExcursion(token, scope) && this.focused && !document.hidden && !game.isDisposed
                    && this.mounted?.kind === 'optional' && this.mounted.token === token,
                nextOptions => this.beginExcursion('relief', nextOptions)) : null;
            type PrimaryAction = 'pause' | 'resume' | 'relief' | 'other-route' | null;
            let primaryAction: PrimaryAction = null, primaryRevision = 0, pressedPrimaryRevision: number | null = null, releasePrimary = () => {};
            scope.listen(panel.primary, 'pointerdown', () => { pressedPrimaryRevision = primaryRevision; });
            scope.listen(panel.primary, 'pointercancel', () => { pressedPrimaryRevision = -1; });
            const actionNow = (): PrimaryAction => game.isDisposed ? null : game.state === 'paused' ? 'resume'
                : game.state !== 'playing' ? null : runtime.finished && !game.player.data.isDead
                    ? token.sceneId === 'gallery' ? 'relief' : routes ? 'other-route' : 'pause' : 'pause';
            const invalidatePrimary = () => {
                primaryRevision++; primaryAction = null; releasePrimary(); releasePrimary = () => {};
                panel.primary.disabled = true;
            };
            scope.add(invalidatePrimary);
            scope.listen(window, 'blur', invalidatePrimary);
            scope.listen(document, 'visibilitychange', () => { if (document.hidden) invalidatePrimary(); });
            const reflect = () => {
                if (!this.currentExcursion(token, scope) || game.isDisposed) return false;
                controls.sync(); panel.sound.sync(); replay?.sync();
                if ((runtime.finished && !game.player.data.isDead && ['playing', 'paused'].includes(game.state)
                    && !this.progress.optional[token.sceneId]) || this.audioEnabled !== game.audio.enabled) this.captureLiveProgress();
                const action = actionNow();
                if (action !== primaryAction) {
                    invalidatePrimary(); primaryAction = action;
                    const revision = primaryRevision;
                    if (action && action !== 'other-route') releasePrimary = scope.listen(panel.primary, 'click', event => {
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
                panel.primaryArt.setLabel(action === 'resume' ? 'CONTINUAR' : action === 'other-route' ? 'OUTRA ROTA' : action === 'relief' ? 'ALÍVIO' : 'PAUSA',
                    action === 'resume' ? 'Retomar a tentativa opcional'
                        : action === 'other-route' ? 'Tentar outra rota na Câmara de Alívio'
                        : action === 'relief' ? 'Seguir para a Câmara de Alívio, continuação opcional' : 'Pausar');
                let message = game.state === 'paused' ? `Pausado · Continuar retoma daqui · ${chapterResumeGuidance()}`
                    : game.player.data.isDead ? 'Feka caiu · retorno ao ponto seguro desta tentativa opcional'
                    : runtime.finished ? runtime.sceneId === 'gallery'
                        ? 'Acesso de inspeção aberto · Alívio segue para a Câmara de Alívio; Bairro volta ao mapa de Guaíra'
                        : `Passagem inspecionada · ${runtime.reliefOpened ? 'alívio aberto, grelha sem pressão' : 'alívio intacto, grelha mantém o ciclo'} · Bairro volta ao mapa de Guaíra`
                    : runtime.sceneId === 'relief' && nativeStatus.textContent && !nativeStatus.textContent.startsWith('Pausado')
                        ? nativeStatus.textContent : `Desvio opcional · ${info.objective}`;
                if (runtime.finished && !game.player.data.isDead && game.state === 'playing') message += ` · ${chapterAttemptSummary(game.coins)}`;
                if (routes && game.state === 'playing' && !game.player.data.isDead) {
                    if (runtime.finished) message += ' · Outra rota propõe um novo objetivo opcional';
                    const optional = reliefChallengeMessage(routes.snapshot);
                    if (optional && !message.includes(optional)) message += ` · ${optional}`;
                }
                const statusMessage = `${message} · ${this.storageMessage()}`;
                if (panel.status.textContent !== statusMessage) panel.status.textContent = statusMessage;
                return true;
            };
            if (activity.shouldPause() && game.state === 'playing') runtime.togglePause();
            activity.observe(reflect); panel.fit(); game.start(); panel.canvas.focus({ preventScroll: true });
            document.title = chapterTitle(info.title);
        } catch (error) {
            if (!this.currentExcursion(token, scope)) return;
            this.excursionError(token, options); console.error('Chapter excursion initialization failed', error);
        }
    }
    private excursionError(token: GuairaChapterExcursionToken, options?: GuairaReliefOptions) {
        const scope = this.replaceView('error'), info = CHAPTER_EXCURSIONS[token.sceneId];
        const nav = document.createElement('nav'), status = document.createElement('p');
        nav.className = 'chapter-game-toolbar'; nav.setAttribute('aria-label', `Recuperar ${info.title}`);
        status.id = 'lab-status'; status.setAttribute('role', 'alert');
        status.textContent = `Não foi possível abrir ${info.title}. Tentar repete o carregamento; Bairro volta ao capítulo. Sua jornada continua aqui.`;
        const retry = document.createElement('button'), map = document.createElement('button');
        retry.type = map.type = 'button'; retry.id = 'chapter-retry'; map.id = 'chapter-map-return';
        retry.textContent = 'TENTAR'; retry.setAttribute('aria-label', `Tentar abrir ${info.title} novamente`);
        map.textContent = 'BAIRRO'; map.setAttribute('aria-label', 'Voltar ao Bairro da Vala Seca no capítulo');
        scope.listen(retry, 'click', () => {
            if (!this.currentExcursion(token, scope) || (token.sceneId === 'relief' && (!this.focused || document.hidden))) return;
            if (this.mounted?.kind === 'optional' && this.mounted.runtime.sceneId === 'relief' && this.mounted.runtime.routes) return;
            this.beginExcursion(token.sceneId, options);
        });
        scope.listen(map, 'click', () => this.leaveExcursion(token, scope));
        nav.append(status, retry, map); this.root.append(nav);
    }
    dispose() {
        if (this.isDisposed) return;
        this.captureLiveProgress();
        this.advanceNavigation(); this.excursionToken = null;
        this.phase = 'disposed'; this.session.dispose(); this.view.dispose(); this.lifetime.dispose();
        this.map = null; this.mounted = null; this.root.replaceChildren();
        document.body.classList.remove('chapter-map', 'chapter-game');
        document.body.style.paddingTop = ''; document.body.style.paddingBottom = '';
    }
}
