import { DisposalScope } from '../../../../engine/DisposalScope';
import { LabToolbarAction } from '../../JuiceLabToolbar';
import { fitGuairaLabCanvas } from '../../../../guaira-lab-layout';
import { installGuairaLabControls } from '../../../../guaira-lab-controls';
import type { GuairaArrival } from '../GuairaMapModel';
import { GuairaChapterSession, type GuairaChapterAttempt, type GuairaChapterGeneration,
    type GuairaChapterLiveResult, type GuairaChapterOpening, type GuairaChapterSceneId } from './GuairaChapterSession';
import { CHAPTER_SCENES, loadGuairaChapterScene, type GuairaChapterRuntime, type GuairaChapterSceneFactory } from './GuairaChapterScenes';
import { GuairaChapterMapView, type GuairaChapterMapOptions } from './GuairaChapterMapView';

export interface GuairaChapterMapPort {
    update(snapshot: ReturnType<GuairaChapterSession['snapshot']>, walkToSelection?: boolean, openingAvailable?: boolean): void;
    canEnter(sceneId: GuairaChapterSceneId, generation: GuairaChapterGeneration): boolean;
    dispose(): void;
}
export interface GuairaChapterAppDependencies {
    loadScene?: (sceneId: GuairaChapterSceneId) => Promise<GuairaChapterSceneFactory>;
    createMap?: (root: HTMLElement, options: GuairaChapterMapOptions) => GuairaChapterMapPort;
    exit?: () => void;
}

/** One owner for the chapter, one mounted map or native game, no persistence. */
export class GuairaChapterApp {
    private readonly lifetime = new DisposalScope();
    private view = new DisposalScope();
    private session = new GuairaChapterSession();
    private map: GuairaChapterMapPort | null = null;
    private runtime: GuairaChapterRuntime | null = null;
    private openingAvailable = true;
    private audioEnabled = true;
    private phase: 'map' | 'loading' | 'game' | 'error' | 'disposed' = 'map';
    private readonly loadScene: NonNullable<GuairaChapterAppDependencies['loadScene']>;
    private readonly createMap: NonNullable<GuairaChapterAppDependencies['createMap']>;
    private readonly exit: () => void;

    constructor(private readonly root: HTMLElement, dependencies: GuairaChapterAppDependencies = {}) {
        this.loadScene = dependencies.loadScene ?? loadGuairaChapterScene;
        this.createMap = dependencies.createMap ?? ((node, options) => new GuairaChapterMapView(node, options));
        this.exit = dependencies.exit ?? (() => location.assign('./'));
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
    get activeGame() { return this.runtime?.game ?? null; }
    get isDisposed() { return this.lifetime.isDisposed; }

    private replaceView(phase: Exclude<GuairaChapterApp['phase'], 'disposed'>) {
        this.view.dispose();
        this.view = new DisposalScope(); this.map = null; this.runtime = null; this.phase = phase;
        this.root.replaceChildren();
        document.body.classList.toggle('chapter-game', phase !== 'map');
        document.body.classList.toggle('chapter-map', phase === 'map');
        document.body.style.paddingTop = ''; document.body.style.paddingBottom = '';
        return this.view;
    }
    private current(scope: DisposalScope) { return !this.isDisposed && this.view === scope && !scope.isDisposed; }

    private showMap(arrival: GuairaArrival, walkToSelection = false) {
        if (this.isDisposed) return;
        const scope = this.replaceView('map'), node = document.createElement('div');
        node.id = 'guaira-chapter-map'; this.root.append(node);
        document.title = 'Guaíra · Capítulo nesta sessão';
        const options: GuairaChapterMapOptions = {
            snapshot: this.snapshot, arrival, walkToSelection, openingAvailable: this.openingAvailable,
            onSelect: (scene, generation) => {
                if (!this.current(scope)) return;
                const next = this.session.selectScene(scene, generation);
                if (next) this.map?.update(next, true, this.openingAvailable);
            },
            onEnter: (scene, generation) => {
                if (!this.current(scope) || !this.map?.canEnter(scene, generation)) return;
                const attempt = this.session.enterScene(scene, generation);
                if (!attempt) return;
                this.openingAvailable = false; void this.showScene(attempt);
            },
            onOpening: (opening, generation) => this.changeOpening(opening, generation, scope),
            onRestart: generation => {
                if (!this.current(scope)) return;
                const next = this.session.restartChapter(generation);
                if (!next) return;
                this.session = next; this.openingAvailable = true; this.showMap('town');
            },
            onExit: () => { if (this.current(scope)) { this.dispose(); this.exit(); } }
        };
        try {
            const map = this.createMap(node, options);
            this.map = map; scope.add(() => map.dispose());
        } catch (error) {
            scope.dispose(); this.root.replaceChildren();
            const message = document.createElement('p');
            message.setAttribute('role', 'alert'); message.textContent = 'Não foi possível abrir a maquete. Recarregar começa uma nova visita.';
            const exit = document.createElement('a'); exit.href = './'; exit.textContent = 'Sair para o jogo principal';
            this.root.append(message, exit); console.error('Chapter map initialization failed', error);
        }
    }
    private changeOpening(opening: GuairaChapterOpening, generation: GuairaChapterGeneration, scope: DisposalScope) {
        if (!this.current(scope) || !this.openingAvailable) return;
        const next = this.session.restartChapter(generation, { opening });
        if (!next) return;
        this.session = next; this.showMap('town');
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
            if (next) void this.showScene(next);
        });
        scope.listen(map, 'click', () => this.leaveScene(attempt, 'map', scope));
        scope.listen(primary, 'click', () => {
            if (!this.current(scope) || !this.runtime) return;
            const game = this.runtime.game;
            if (game.isDisposed) return;
            if (game.state === 'paused') { this.runtime.togglePause(); canvas.focus(); return; }
            if (this.session.canContinue(attempt, this.runtime.sample(attempt))) this.leaveScene(attempt, 'continue', scope);
            else { this.runtime.togglePause(); canvas.focus(); }
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
        const scope = this.replaceView('loading');
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
            this.runtime = runtime; this.phase = 'game';
            scope.add(() => { this.audioEnabled = game.audio.enabled; game.dispose(); });
            game.audio.enabled = this.audioEnabled; game.audio.volume();
            const controls = installGuairaLabControls(game, panel.canvas, () => !!runtime.sample(attempt).result);
            scope.add(() => controls.dispose());
            let frame: number | null = null;
            const stopFrame = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
            scope.add(stopFrame);
            const reflect = () => {
                frame = null;
                if (!this.current(scope) || game.isDisposed) return;
                controls.sync();
                const live = runtime.sample(attempt), complete = this.session.canContinue(attempt, live);
                panel.primary.disabled = game.state !== 'playing' && game.state !== 'paused';
                panel.primaryArt.setLabel(game.state === 'paused' || complete ? 'CONTINUAR' : 'PAUSA',
                    game.state === 'paused' ? 'Retomar a tentativa' : complete ? 'Continuar a jornada pela maquete' : 'Pausar');
                const step = this.snapshot.route.indexOf(attempt.sceneId) + 1;
                const native = nativeStatus.textContent?.split(/ · setas\/A D:| · setas:| · Esc:/)[0] || info.objective;
                const message = game.state === 'paused' ? 'Pausado · Continuar volta à tentativa'
                    : !live.alive ? 'Feka caiu · retorno ao ponto seguro desta tentativa'
                    : complete ? 'Trecho concluído · Continuar volta à maquete'
                    : `Etapa ${step}/5 · ${game.boss?.hint ?? native}`;
                if (panel.status.textContent !== message) panel.status.textContent = message;
                if (!document.hidden) frame = requestAnimationFrame(reflect);
            };
            scope.listen(document, 'visibilitychange', () => { stopFrame(); if (!document.hidden) reflect(); });
            reflect(); panel.fit(); game.start(); panel.canvas.focus({ preventScroll: true });
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
            if (next) void this.showScene(next);
        });
        scope.listen(map, 'click', () => this.leaveScene(attempt, 'map', scope));
        nav.append(status, retry, map); this.root.append(nav);
    }
    private leaveScene(attempt: GuairaChapterAttempt, action: 'continue' | 'map', scope: DisposalScope) {
        if (!this.current(scope)) return;
        const runtime = this.runtime;
        const live: GuairaChapterLiveResult = runtime?.sample(attempt) ?? { attempt, state: 'loading', alive: false, result: null };
        const transition = action === 'continue' ? this.session.continueFrom(attempt, live) : this.session.exitToMap(attempt, live);
        if (!transition) return;
        const arrival = runtime?.returnArrival() ?? CHAPTER_SCENES[attempt.sceneId].arrival;
        this.showMap(arrival, action === 'continue');
    }
    dispose() {
        if (this.isDisposed) return;
        this.phase = 'disposed'; this.session.dispose(); this.view.dispose(); this.lifetime.dispose();
        this.map = null; this.runtime = null; this.root.replaceChildren();
        document.body.classList.remove('chapter-map', 'chapter-game');
        document.body.style.paddingTop = ''; document.body.style.paddingBottom = '';
    }
}
