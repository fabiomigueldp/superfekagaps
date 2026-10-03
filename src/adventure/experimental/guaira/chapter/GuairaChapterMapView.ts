import { chapterExitPresentation } from './GuairaChapterPresentation';
import { LabToolbarAction } from '../../JuiceLabToolbar';
import { approachGuairaCamera, guairaCamera, guairaScreenPoint, paintGuairaMap, paintGuairaWaterFrame, type GuairaCamera } from '../GuairaMapArt';
import { loadGuairaScene } from '../GuairaMapLoader';
import type { GuairaArrival, GuairaMetadata } from '../GuairaMapModel';
import { GUAIRA_WATER_CONTRACT, GuairaWaterMotion, VisibleWaterClock } from '../GuairaWaterMotion';
import { CHAPTER_SCENES } from './GuairaChapterScenes';
import { GuairaChapterWater } from './GuairaChapterWater';
import { publicWaterAudioLevel } from './GuairaChapterAudio';
import { WorldAmbientAudio } from '../../../WorldAmbientAudio';
import { GUAIRA_MAP_AUDIO_PACK } from '../../../ArcadeAudioPack';
import type { GuairaChapterGeneration, GuairaChapterOpening, GuairaChapterSceneId, GuairaChapterSnapshot } from './GuairaChapterSession';
import { GuairaChapterTravel } from './GuairaChapterTravel';
import { sameChapterMapTarget, type GuairaChapterMapTarget, type GuairaChapterNavigation } from './GuairaChapterNavigation';

export interface GuairaChapterMapOptions {
    audioEnabled?: () => boolean;
    storageMessage?: () => string;
    optionalProgress?: () => { gallery: boolean; relief: boolean };
    campaign?: boolean;
    canContinueCampaign?: () => boolean;
    onContinueCampaign?: (generation: GuairaChapterGeneration, revision: number) => void;
    onAudioEnabled?: (enabled: boolean) => void;
    snapshot: GuairaChapterSnapshot;
    navigation: GuairaChapterNavigation;
    arrival: GuairaArrival;
    walkToSelection?: boolean;
    /** Focus the ready map action on internal return, unless another control gained focus. */
    focusAction?: boolean;
    /** The host latches this false on the first entry, including an abandoned attempt. */
    openingAvailable?: boolean;
    onSelect(target: GuairaChapterMapTarget, generation: GuairaChapterGeneration, revision: number): void;
    onEnter(target: GuairaChapterMapTarget, generation: GuairaChapterGeneration, revision: number): void;
    onOpening(opening: GuairaChapterOpening, generation: GuairaChapterGeneration, revision: number): void;
    onRestart(generation: GuairaChapterGeneration, revision: number): void;
    onExit(generation: GuairaChapterGeneration, revision: number): void;
}

const ASSET_ROOT = './assets/world/experimental/guaira/';
const ARRIVAL_NODE: Record<GuairaArrival, string> = { town: 'guaira-1', bairro: 'guaira-2', rice: 'guaira-3', corral: 'guaira-4', vazao: 'guaira-5' };
const ARRIVAL_WORDS: Record<GuairaArrival, string> = { town: 'na estrada', bairro: 'no Bairro da Vala Seca', rice: 'no arrozal', corral: 'no curral', vazao: 'na Casa da Vazão' };
const OPTIONAL_TARGET: GuairaChapterMapTarget = { kind: 'optional', stop: 'bairro' };
const OPTIONAL_PLACE = { title: 'Galeria dos Remendos', short: 'GALERIA', place: 'Bairro da Vala Seca', arrival: 'bairro' as const };
const sameGeneration = (a: GuairaChapterGeneration, b: GuairaChapterGeneration) => a.sessionId === b.sessionId && a.generation === b.generation;
let nextViewId = 1;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const result = document.createElement(tag); result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
}
function control(label: string, name: string, primary = false) {
    const button = element('button', 'chapter-map-control'); button.type = 'button';
    const art = new LabToolbarAction(button, primary); art.setLabel(label, name);
    return { button, art };
}

/** Memory-only map UI. Selection, walking and arrival never create a chapter receipt. */
export class GuairaChapterMapView {
    private readonly shell = element('section', 'guaira-chapter-map');
    private readonly header = element('header', 'chapter-map-header');
    private readonly scene = element('div', 'chapter-map-scene');
    private readonly canvas = element('canvas', 'chapter-map-canvas');
    private readonly footer = element('footer', 'chapter-map-footer');
    private readonly count = element('p', 'chapter-map-count');
    private readonly title = element('h2', 'chapter-map-title');
    private readonly status = element('p', 'chapter-map-status');
    private readonly hint = element('p', 'chapter-map-hint');
    private readonly openingRow = element('div', 'chapter-map-openings');
    private readonly loading = element('div', 'chapter-map-loading', 'Carregando a maquete…');
    private readonly failure = element('div', 'chapter-map-failure');
    private readonly plaque = element('div', 'chapter-map-plaque');
    private readonly plaqueArt = new LabToolbarAction(this.plaque);
    private readonly journey = control('JORNADA', 'Ver a jornada de Guaíra');
    private readonly overview = control('VER MAPA', 'Ver mapa inteiro');
    private readonly sound = control('SOM', 'Ativar ou desativar o som do capítulo');
    private readonly ambient = new WorldAmbientAudio(GUAIRA_MAP_AUDIO_PACK, 'accepted-water');
    private readonly campaignContinue = control('SERRA', 'Seguir viagem para Serra do Mar');
    private readonly exit = control('SAIR', 'Sair do capítulo e voltar à seleção de experimentos');
    private readonly primary = control('ENTRAR', 'Entrar no trecho selecionado', true);
    private readonly skip = control('CHEGAR', 'Chegar agora, pulando a caminhada');
    private readonly returnToChapter = control('RETOMAR', 'Retomar o trecho selecionado');
    private readonly retry = control('TENTAR', 'Tentar carregar a maquete novamente');
    private readonly traversal = control('TRAVESSIA', 'Travessia da Vala Seca: usar como abertura');
    private readonly junction = control('PATIO', 'Pátio das Comportas: usar como abertura alternativa');
    private readonly dialog = element('dialog', 'chapter-map-dialog');
    private readonly dialogCount = element('p', 'chapter-map-count');
    private readonly list = element('ol', 'chapter-map-list');
    private readonly optionalGroup = element('section', 'chapter-map-optional');
    private readonly optionalButton = element('button', 'chapter-map-optional-button');
    private readonly close = control('FECHAR', 'Fechar a jornada e voltar à maquete');
    private readonly restart = control('REINICIAR', 'Voltar à abertura sem apagar trechos concluídos');
    private readonly lifecycle = new AbortController();
    private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
    private observer: ResizeObserver | null = null;
    private readonly waterClock = new VisibleWaterClock();
    private snapshot: GuairaChapterSnapshot;
    private navigation: GuairaChapterNavigation;
    private pendingFocus: Element | null | undefined;
    private openingAvailable: boolean;
    private walkRequested: boolean;
    private entryRequested = false;
    private closed = false;
    private menuOpen = false;
    private windowFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
    private menuVersion = 0;
    private overviewActive = false;
    private loadState: 'loading' | 'ready' | 'failed' = 'loading';
    private loadAbort: AbortController | null = null;
    private travel: GuairaChapterTravel | null = null;
    private metadata: GuairaMetadata | null = null;
    private image: HTMLImageElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    private readonly water = new GuairaChapterWater();
    private camera: GuairaCamera | null = null;
    private paintedCamera: GuairaCamera | null = null;
    private paintedDistance = -1;
    private paintedMoving = false;
    private lastWaterPaint = -Infinity;
    private frame = 0;
    private previousTime = 0;
    private width = 1;
    private height = 1;
    private ratio = 1;
    private presentationKey = '';

    constructor(root: HTMLElement, private readonly options: GuairaChapterMapOptions) {
        this.snapshot = options.snapshot; this.water.update(this.snapshot);
        this.navigation = options.navigation;
        this.pendingFocus = options.focusAction ? document.activeElement : undefined;
        this.openingAvailable = options.openingAvailable ?? (options.snapshot.generation.generation === 0 && options.snapshot.accepted.length === 0);
        this.walkRequested = options.walkToSelection ?? false;
        this.shell.setAttribute('aria-label', 'Mapa do capítulo de Guaíra');
        const identity = element('div', 'chapter-map-identity');
        identity.append(element('h1', 'chapter-map-name', 'GUAÍRA'), this.count);
        const navigation = element('nav', 'chapter-map-navigation'); navigation.setAttribute('aria-label', 'Controles do mapa');
        navigation.append(this.journey.button, this.overview.button, this.sound.button, this.exit.button);
        const destination = chapterExitPresentation(!!this.options.campaign);
        this.exit.art.setLabel(destination.label, destination.description);
        if (this.options.campaign) {
            navigation.append(this.campaignContinue.button);
        }
        this.header.append(identity, navigation);
        this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', 'Maquete de Guaíra com Feka na estrada');
        this.loading.setAttribute('role', 'status'); this.failure.setAttribute('role', 'alert');
        this.failure.append(element('p', '', `O mapa de Guaíra não carregou. Tente novamente ou use ${destination.label}.`), this.retry.button);
        this.plaque.setAttribute('aria-hidden', 'true');
        this.scene.append(this.canvas, this.plaque, this.loading, this.failure);
        const information = element('div', 'chapter-map-information'); information.append(this.title, this.status, this.hint);
        this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.status.setAttribute('aria-atomic', 'true');
        const actions = element('div', 'chapter-map-actions'); actions.append(this.returnToChapter.button, this.skip.button, this.primary.button);
        this.openingRow.setAttribute('role', 'group'); this.openingRow.setAttribute('aria-label', 'Escolha a abertura do capítulo');
        this.openingRow.append(this.traversal.button, this.junction.button);
        this.footer.append(information, actions, this.openingRow);
        const dialogHeader = element('div', 'chapter-map-dialog-header');
        const dialogTitle = element('h2', 'chapter-map-dialog-title', 'Jornada de Guaíra');
        dialogTitle.id = `guaira-chapter-journey-${nextViewId++}`;
        this.dialog.setAttribute('aria-labelledby', dialogTitle.id);
        this.dialog.setAttribute('aria-modal', 'true');
        dialogHeader.append(dialogTitle, this.close.button);
        const optionalTitle = element('h3', 'chapter-map-optional-title', 'Desvio opcional');
        optionalTitle.id = `${dialogTitle.id}-optional`;
        this.optionalGroup.setAttribute('aria-labelledby', optionalTitle.id);
        this.optionalButton.type = 'button';
        this.optionalButton.setAttribute('aria-label', 'Bairro da Vala Seca / Galeria dos Remendos: desvio opcional');
        this.optionalButton.append(element('span', 'chapter-map-step-title', 'Bairro da Vala Seca'), element('span', 'chapter-map-step-state', 'Galeria dos Remendos · fora das cinco etapas'));
        this.optionalGroup.append(optionalTitle, this.optionalButton);
        const dialogFooter = element('div', 'chapter-map-dialog-footer');
        dialogFooter.append(element('p', 'chapter-map-session-note', 'Os trechos concluídos são guardados neste navegador. Retomar uma tentativa recarrega seu início; reiniciar preserva conquistas.'), this.restart.button);
        this.dialog.append(dialogHeader, this.dialogCount, this.list, this.optionalGroup, dialogFooter);
        this.shell.append(this.header, this.scene, this.footer, this.dialog);
        try {
            root.append(this.shell);
            const { signal } = this.lifecycle;
            this.sound.button.addEventListener('click', () => this.toggleSound(), { signal });
            this.shell.addEventListener('pointerdown', () => { if (!this.suspended()) this.ambient.unlock(); }, { signal });
            this.dialog.addEventListener('cancel', event => { event.preventDefault(); if (this.windowFocused) this.closeMenu(); }, { signal });
            this.shell.addEventListener('keydown', event => {
                if (!event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && event.key?.toLowerCase() === 'm') this.toggleSound();
                else if (!this.suspended()) this.ambient.unlock();
                if (event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key) && (event.target as HTMLElement | null)?.tagName === 'BUTTON') event.preventDefault();
                if (event.key === 'Escape' && this.menuOpen && this.windowFocused) { event.preventDefault(); this.closeMenu(); }
            }, { signal });
            this.motion.addEventListener('change', () => {
                if (this.closed) return;
                // A paused walk must not jump in response to a preference change behind a modal.
                if (this.travel && this.walkRequested && !this.suspended()) this.travel.setReducedMotion(this.motion.matches);
                else if (this.travel) this.travel.reducedMotion = this.motion.matches;
                this.camera = null; this.paintedCamera = null; this.waterClock.suspend(); this.reflect(); this.requestFrame();
            }, { signal });
            document.addEventListener('visibilitychange', () => { this.suspendFrames(); if (!document.hidden) this.resume(); }, { signal });
            window.addEventListener('blur', () => { this.windowFocused = false; this.suspendFrames(); this.reflect(); }, { signal });
            window.addEventListener('focus', () => { this.windowFocused = true; this.suspendFrames(); this.resume(); }, { signal });
            window.addEventListener('resize', this.resize, { signal });
            this.observer = new ResizeObserver(this.resize); this.observer.observe(this.scene);
            this.bindActions(); this.reflect(); this.resize(); void this.load();
        } catch (error) {
            // A failed constructor cannot be disposed by the host because it has no instance yet.
            this.dispose();
            throw error;
        }
    }

    /** The host owns both tokens; false preserves the actor's exact physical position. */
    update(snapshot: GuairaChapterSnapshot, walkToSelection = false, openingAvailable = this.openingAvailable, navigation = this.navigation): void {
        if (this.closed) return;
        if (snapshot.generation.sessionId === this.snapshot.generation.sessionId && snapshot.generation.generation < this.snapshot.generation.generation) return;
        if (navigation.revision < this.navigation.revision) return;
        this.snapshot = snapshot; this.water.update(snapshot); this.navigation = navigation; this.openingAvailable = openingAvailable;
        this.walkRequested = walkToSelection; this.entryRequested = false;
        this.closeMenu(false); this.suspendFrames();
        if (this.travel && walkToSelection && this.targetSelectable(navigation.target)) {
            this.travel.reducedMotion = this.motion.matches;
            if (!this.suspended()) this.travel.walkTo(this.selectedPlace().arrival);
        }
        this.renderList(); this.reflect(); this.requestFrame();
    }

    /** Host rechecks this physical gate plus both independent authority tokens. */
    canEnter(target: GuairaChapterMapTarget, generation: GuairaChapterGeneration, revision: number): boolean {
        return this.current(generation, revision, target) && !this.suspended() && this.loadState === 'ready'
            && this.targetSelectable(target) && !!this.travel && !this.moving()
            && this.travel.arrival === this.selectedPlace().arrival;
    }

    dispose(): void {
        if (this.closed) return;
        this.closed = true; this.lifecycle.abort(); this.loadAbort?.abort(); this.suspendFrames(); this.ambient.dispose();
        this.observer?.disconnect(); this.observer = null; this.travel?.dispose(); this.travel = null;
        this.image = null; this.metadata = null; this.water.dispose();
        this.primary.button.onclick = null; this.skip.button.onclick = null;
        this.traversal.button.onclick = null; this.junction.button.onclick = null; this.restart.button.onclick = null;
        this.returnToChapter.button.onclick = null; this.optionalButton.onclick = null;
        this.journey.button.onclick = null; this.close.button.onclick = null; this.overview.button.onclick = null;
        this.campaignContinue.button.onclick = null; this.exit.button.onclick = null; this.retry.button.onclick = null; this.pendingFocus = undefined;
        if (this.dialog.open) this.dialog.close(); this.shell.remove();
    }

    private current(generation: GuairaChapterGeneration, revision: number, target = this.navigation.target) {
        return !this.closed && !this.snapshot.disposed && !this.snapshot.activeAttempt && sameGeneration(generation, this.snapshot.generation)
            && revision === this.navigation.revision && sameChapterMapTarget(target, this.navigation.target);
    }
    private selectable(sceneId: GuairaChapterSceneId) {
        return this.snapshot.route.includes(sceneId) && (sceneId === this.snapshot.nextRecommendedScene || this.snapshot.accepted.some(receipt => receipt.sceneId === sceneId));
    }
    private targetSelectable(target: GuairaChapterMapTarget) {
        return target.kind === 'optional' || (this.snapshot.selectedScene === target.sceneId && this.selectable(target.sceneId));
    }
    private selectedPlace() { return this.navigation.target.kind === 'optional' ? OPTIONAL_PLACE : CHAPTER_SCENES[this.navigation.target.sceneId]; }
    private moving() { return !!this.travel && this.walkRequested && this.travel.moving; }
    private suspended() { return this.closed || this.menuOpen || document.hidden || !this.windowFocused || this.snapshot.disposed || !!this.snapshot.activeAttempt; }

    private bindActions() {
        // Never read a fresh token from a retained callback, even after same-target reselection.
        const generation = this.snapshot.generation, { target, revision } = this.navigation, menuVersion = this.menuVersion;
        const current = () => this.current(generation, revision, target);
        this.journey.button.onclick = () => { if (current()) this.openMenu(); };
        this.close.button.onclick = () => { if (current() && this.windowFocused && menuVersion === this.menuVersion) this.closeMenu(); };
        this.overview.button.onclick = () => {
            if (current() && !this.suspended() && this.loadState === 'ready') {
                this.overviewActive = !this.overviewActive; this.reflect(); this.requestFrame();
            }
        };
        this.campaignContinue.button.onclick = () => {
            if (current() && !this.suspended() && this.options.canContinueCampaign?.()) this.options.onContinueCampaign?.(generation, revision);
        };
        this.exit.button.onclick = () => { if (current() && !this.suspended()) this.options.onExit(generation, revision); };
        this.retry.button.onclick = () => { if (current() && !this.suspended() && this.loadState === 'failed') void this.load(); };
        this.primary.button.onclick = () => {
            if (!current() || this.suspended() || this.entryRequested || this.loadState !== 'ready' || !this.targetSelectable(target)) return;
            if (this.canEnter(target, generation, revision)) {
                this.entryRequested = true; this.reflect(); this.options.onEnter(target, generation, revision);
            } else if (!this.moving() && this.travel) {
                this.walkRequested = true; this.travel.walkTo(this.selectedPlace().arrival);
                this.previousTime = 0; this.reflect(); this.requestFrame();
            }
        };
        this.skip.button.onclick = () => {
            if (!current() || this.suspended() || !this.moving()) return;
            this.travel!.skip(); this.camera = null; this.reflect(); this.requestFrame(); this.primary.button.focus();
        };
        const retainedScene = this.snapshot.selectedScene;
        this.returnToChapter.button.onclick = () => {
            if (current() && target.kind === 'optional' && !this.suspended() && this.loadState === 'ready' && !this.entryRequested)
                this.options.onSelect({ kind: 'chapter', sceneId: retainedScene }, generation, revision);
        };
        const openingAction = (opening: GuairaChapterOpening) => () => {
            if (current() && target.kind === 'chapter' && !this.suspended() && this.loadState === 'ready' && this.openingAvailable && !this.snapshot.accepted.length && !this.entryRequested)
                this.options.onOpening(opening, generation, revision);
        };
        this.traversal.button.onclick = openingAction('guaira-travessia');
        this.junction.button.onclick = openingAction('guaira-patio-comportas');
        this.restart.button.onclick = () => {
            if (current() && this.windowFocused && this.menuOpen && menuVersion === this.menuVersion && !document.hidden) this.options.onRestart(generation, revision);
        };
    }

    private toggleSound() {
        if (this.closed || !this.windowFocused || document.hidden) return;
        this.ambient.enabled = !(this.options.audioEnabled?.() ?? this.ambient.enabled);
        this.options.onAudioEnabled?.(this.ambient.enabled);
        this.syncAudio(); this.ambient.unlock(); this.requestFrame();
    }
    private syncAudio() {
        this.ambient.enabled = this.options.audioEnabled?.() ?? this.ambient.enabled;
        const paused = this.suspended() || this.loadState !== 'ready';
        this.ambient.pause(paused);
        const level = paused ? 0 : publicWaterAudioLevel(this.snapshot, this.travel?.point);
        this.ambient.set(level > 0 ? 'water' : undefined, level);
        this.sound.button.setAttribute('aria-pressed', String(this.ambient.enabled));
        this.sound.art.setLabel(this.ambient.enabled ? 'SOM' : 'MUDO', this.ambient.enabled ? 'Desativar o som do capítulo' : 'Ativar o som do capítulo');
    }
    private reflect() {
        this.syncAudio();
        const snapshot = this.snapshot, selected = this.selectedPlace(), { target, revision } = this.navigation;
        const optional = target.kind === 'optional';
        const ready = this.loadState === 'ready', moving = this.moving();
        const canEnter = this.canEnter(target, snapshot.generation, revision);
        const accepted = !optional && snapshot.accepted.some(receipt => receipt.sceneId === snapshot.selectedScene);
        const opening = !optional && this.openingAvailable && !snapshot.accepted.length && !snapshot.activeAttempt;
        const key = `${snapshot.generation.sessionId}:${snapshot.generation.generation}:${revision}:${optional}:${ready}:${this.loadState}:${moving}:${canEnter}:${this.entryRequested}:${this.overviewActive}:${opening}:${snapshot.selectedScene}:${snapshot.accepted.length}:${this.water.released}:${this.options.storageMessage?.()}:${this.options.canContinueCampaign?.()}`;
        if (key === this.presentationKey) return; this.presentationKey = key;
        // hidden=true drops focus in real DOM immediately, so capture ownership first.
        const focusedSkip = document.activeElement === this.skip.button;
        const focusedReturn = document.activeElement === this.returnToChapter.button;
        this.count.textContent = `${snapshot.accepted.length}/${snapshot.route.length} · concluídos`;
        this.dialogCount.textContent = this.count.textContent;
        this.title.textContent = optional ? selected.title : snapshot.chapterComplete ? 'CAPÍTULO CONCLUÍDO' : opening ? 'ESCOLHA A ABERTURA' : selected.title;
        this.status.textContent = !ready ? this.loadState === 'failed' ? 'A maquete está indisponível. Sua sessão continua aqui.' : 'Carregando a maquete…'
            : moving ? `A caminho de ${selected.place}`
                : optional && canEnter ? 'Desvio opcional · Feka no Bairro da Vala Seca · Galeria disponível'
                    : optional ? 'Desvio opcional · caminhe até o Bairro da Vala Seca'
                : canEnter ? `Selecionado · Feka ${ARRIVAL_WORDS[selected.arrival]} · pronto para ${accepted ? 'repetir' : 'entrar'}`
                    : `Selecionado: ${selected.title} · caminhe até ${selected.place}`;
        const last = snapshot.accepted[snapshot.accepted.length - 1];
        this.hint.textContent = snapshot.chapterComplete && this.water.released ? `A água voltou. Os gaps continuam. · ${snapshot.accepted.length}/${snapshot.route.length} concluídos`
            : last ? `${CHAPTER_SCENES[last.sceneId].title} concluído · ${snapshot.accepted.length}/${snapshot.route.length} concluídos`
                : optional ? 'Galeria e Câmara de Alívio são opcionais'
                    : 'Devolva a água ao bairro em cinco etapas.';
        this.hint.textContent += ` · ${this.options.storageMessage?.() ?? 'Progresso somente nesta sessão.'}`;
        const extras = this.options.optionalProgress?.();
        if (extras?.gallery || extras?.relief) this.hint.textContent += ` · Opcionais: ${extras.gallery ? 'Galeria concluída' : ''}${extras.gallery && extras.relief ? ', ' : ''}${extras.relief ? 'Câmara concluída' : ''}`;
        this.campaignContinue.button.disabled = !this.options.canContinueCampaign?.();
        this.primary.art.setLabel(optional ? canEnter ? 'GALERIA' : 'CAMINHAR' : canEnter && accepted ? 'REPETIR' : !canEnter && !moving && ready ? 'CAMINHAR' : 'ENTRAR',
            optional ? canEnter ? 'Entrar na Galeria dos Remendos, percurso opcional' : 'Caminhar até Bairro da Vala Seca'
                : canEnter && accepted ? snapshot.selectedScene === 'guaira-prefeito' ? 'Repetir o Prefeito em uma nova tentativa' : `Repetir ${selected.title} em uma nova tentativa`
                : !canEnter && !moving && ready ? `Caminhar até ${selected.place}` : `Entrar: ${selected.title}`);
        this.primary.button.disabled = !ready || moving || !this.current(snapshot.generation, revision) || this.entryRequested || !this.targetSelectable(target);
        this.skip.button.hidden = !ready || !moving; this.skip.button.disabled = !ready || !moving;
        this.returnToChapter.button.hidden = !optional;
        this.returnToChapter.button.disabled = !ready || !this.current(snapshot.generation, revision) || this.entryRequested;
        this.returnToChapter.art.setLabel('RETOMAR', `Retomar ${CHAPTER_SCENES[snapshot.selectedScene].title}, trecho selecionado da jornada`);
        this.openingRow.hidden = !opening; this.traversal.button.disabled = !ready || !opening; this.junction.button.disabled = !ready || !opening;
        this.traversal.button.setAttribute('aria-pressed', String(snapshot.opening === 'guaira-travessia'));
        this.junction.button.setAttribute('aria-pressed', String(snapshot.opening === 'guaira-patio-comportas'));
        this.overview.button.disabled = !ready;
        this.journey.button.disabled = !ready || !this.current(snapshot.generation, revision) || this.entryRequested;
        this.overview.button.setAttribute('aria-pressed', String(this.overviewActive));
        this.overview.art.setLabel(this.overviewActive ? 'VER FEKA' : 'VER MAPA', this.overviewActive ? 'Acompanhar Feka' : 'Ver mapa inteiro');
        this.loading.hidden = this.loadState !== 'loading'; this.failure.hidden = this.loadState !== 'failed';
        this.plaqueArt.setLabel(selected.short, selected.title);
        this.plaque.hidden = true; this.paintedCamera = null;
        this.canvas.setAttribute('aria-label', (moving ? `Maquete de Guaíra. Feka a caminho de ${selected.place}.`
            : this.travel?.arrival ? `Maquete de Guaíra. Feka ${ARRIVAL_WORDS[this.travel.arrival]}.` : 'Maquete de Guaíra. Feka na estrada.')
            + (this.water.released && !moving && this.travel?.arrival === 'bairro' ? ' Bica do Bairro com água nesta sessão.' : ''));
        if (!this.suspended() && ((focusedSkip && this.skip.button.hidden) || (focusedReturn && this.returnToChapter.button.hidden))) this.focusMapAction();
    }

    private focusMapAction() {
        const button = this.moving() ? this.skip.button : this.primary.button;
        if (!button.disabled && !button.hidden) button.focus();
    }

    private restorePendingFocus() {
        if (this.pendingFocus === undefined || this.suspended() || this.loadState !== 'ready') return;
        if (document.activeElement === this.pendingFocus) this.focusMapAction();
        this.pendingFocus = undefined;
    }

    private renderList() {
        this.list.replaceChildren();
        const generation = this.snapshot.generation, { target, revision } = this.navigation, menuVersion = ++this.menuVersion;
        this.snapshot.route.forEach((sceneId, index) => {
            const scene = CHAPTER_SCENES[sceneId], item = element('li', 'chapter-map-step');
            const accepted = this.snapshot.accepted.some(receipt => receipt.sceneId === sceneId);
            const state = accepted ? 'Concluído · repetir' : sceneId === this.snapshot.nextRecommendedScene ? 'Próximo trecho' : `Depois de ${CHAPTER_SCENES[this.snapshot.route[index - 1]].title}`;
            const row = element('button', 'chapter-map-step-button'); row.type = 'button';
            row.append(element('span', 'chapter-map-step-title', `${index + 1}. ${scene.title}`), element('span', 'chapter-map-step-state', state));
            row.disabled = !this.selectable(sceneId) || !this.current(generation, revision, target);
            row.setAttribute('aria-label', `${scene.title}: ${state}`);
            row.setAttribute('aria-pressed', String(target.kind === 'chapter' && sceneId === target.sceneId));
            // Property handlers let replaced rows be collected rather than retaining them on the lifetime signal.
            row.onclick = () => {
                if (!this.current(generation, revision, target) || !this.windowFocused || !this.menuOpen || document.hidden || menuVersion !== this.menuVersion || !this.selectable(sceneId)) return;
                this.closeMenu(); this.options.onSelect({ kind: 'chapter', sceneId }, generation, revision);
            };
            item.append(row); this.list.append(item);
        });
        this.optionalButton.disabled = !this.current(generation, revision, target);
        this.optionalButton.setAttribute('aria-pressed', String(target.kind === 'optional'));
        this.optionalButton.onclick = () => {
            if (!this.current(generation, revision, target) || !this.windowFocused || !this.menuOpen || document.hidden || menuVersion !== this.menuVersion) return;
            this.closeMenu(); this.options.onSelect(OPTIONAL_TARGET, generation, revision);
        };
        this.bindActions();
    }
    private openMenu() {
        if (this.closed || this.menuOpen || document.hidden || !this.windowFocused || this.loadState !== 'ready' || this.entryRequested || !this.current(this.snapshot.generation, this.navigation.revision)) return;
        this.renderList(); this.menuOpen = true; this.suspendFrames(); this.reflect();
        this.dialog.showModal(); this.close.button.focus();
    }
    private closeMenu(restoreFocus = true) {
        if (!this.menuOpen) return;
        this.menuOpen = false; if (this.dialog.open) this.dialog.close();
        if (!this.closed) { if (restoreFocus) this.journey.button.focus(); this.resume(); }
    }
    private resume() {
        if (this.travel && this.walkRequested && !this.suspended()) {
            this.travel.reducedMotion = this.motion.matches;
            this.travel.walkTo(this.selectedPlace().arrival);
        }
        this.reflect(); this.restorePendingFocus(); this.requestFrame();
    }
    private suspendFrames() {
        this.ambient.pause(true);
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0; this.previousTime = 0; this.waterClock.suspend();
    }
    private requestFrame() {
        if (!this.frame && !this.suspended() && this.loadState === 'ready') this.frame = requestAnimationFrame(this.render);
    }
    private readonly resize = () => {
        if (this.closed) return;
        const bounds = this.scene.getBoundingClientRect();
        this.width = Math.max(1, bounds.width); this.height = Math.max(1, bounds.height);
        this.ratio = Math.min(2, window.devicePixelRatio || 1);
        this.canvas.width = Math.round(this.width * this.ratio); this.canvas.height = Math.round(this.height * this.ratio);
        this.camera = null; this.paintedCamera = null; this.requestFrame();
    };
    private readonly render = (time: number) => {
        this.frame = 0;
        if (this.suspended() || !this.travel || !this.metadata || !this.image || !this.context) return;
        const dt = this.previousTime ? Math.min(.05, (time - this.previousTime) / 1000) : 1 / 60;
        this.previousTime = time;
        if (this.walkRequested) this.travel.tick(dt);
        this.syncAudio();
        const target = guairaCamera(this.metadata, this.width, this.height, this.travel.point, this.overviewActive);
        this.camera = !this.camera || this.motion.matches ? target : approachGuairaCamera(this.camera, target, dt);
        const seconds = this.waterClock.tick(time, this.water.active && !this.motion.matches);
        const overlay = this.water.active ? { effect: this.water, seconds } : undefined;
        const moving = this.moving();
        // A frozen old target is not a walking actor; position still comes from the real road model.
        const actor = { point: this.travel.point, facingLeft: this.travel.facingLeft, reducedMotion: this.motion.matches, moving };
        const fullPaint = !this.paintedCamera || this.camera.x !== this.paintedCamera.x || this.camera.y !== this.paintedCamera.y
            || this.camera.imageWidth !== this.paintedCamera.imageWidth || this.travel.distance !== this.paintedDistance || moving !== this.paintedMoving;
        this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        if (fullPaint) {
            paintGuairaMap(this.context, this.image, this.camera, actor, time, overlay);
            this.paintedCamera = this.camera; this.paintedDistance = this.travel.distance; this.paintedMoving = moving; this.lastWaterPaint = seconds;
        } else if (overlay && !this.motion.matches && seconds - this.lastWaterPaint >= 1 / 30 - 1e-6) {
            paintGuairaWaterFrame(this.context, this.image, this.camera, actor, time, overlay); this.lastWaterPaint = seconds;
        }
        this.reflect();
        const selected = this.selectedPlace();
        const point = guairaScreenPoint(this.metadata.nodes[ARRIVAL_NODE[selected.arrival]], this.camera);
        const plaqueWidth = this.plaque.getBoundingClientRect().width || 150;
        this.plaque.hidden = this.width < 520 || this.height < 250 || point.x < plaqueWidth / 2 + 8 || point.x > this.width - plaqueWidth / 2 - 8 || point.y < 12 || point.y + 68 > this.height;
        this.plaque.style.left = `${point.x}px`; this.plaque.style.top = `${point.y + 16}px`;
        if (moving || this.camera.x !== target.x || this.camera.y !== target.y || this.camera.imageWidth !== target.imageWidth || (this.water.active && !this.motion.matches)) this.requestFrame();
    };

    private async load() {
        this.loadAbort?.abort(); const abort = new AbortController(); this.loadAbort = abort;
        this.loadState = 'loading'; this.reflect();
        try {
            this.context = this.canvas.getContext('2d');
            if (!this.context) throw new Error('Canvas unavailable');
            const { metadata, image } = await loadGuairaScene(async signal => {
                const response = await fetch(`${ASSET_ROOT}guaira-diorama.meta.json`, { signal });
                if (!response.ok) throw new Error('Metadata unavailable'); return response.json();
            }, async () => {
                const art = new Image(); art.src = `${ASSET_ROOT}guaira-diorama.webp`; await art.decode();
                if (art.naturalWidth !== 1920 || art.naturalHeight !== 1200) throw new Error('Incompatible diorama'); return art;
            }, abort.signal);
            if (this.closed || abort.signal.aborted || this.loadAbort !== abort) return;
            this.metadata = metadata; this.image = image;
            this.travel = new GuairaChapterTravel(metadata, this.options.arrival);
            this.travel.reducedMotion = this.motion.matches;
            this.loadState = 'ready'; this.resume(); this.resize(); void this.loadWater(abort);
        } catch {
            if (this.closed || abort.signal.aborted || this.loadAbort !== abort) return;
            this.loadState = 'failed'; this.suspendFrames(); this.reflect();
        }
    }
    private async loadWater(abort: AbortController) {
        try {
            const atlas = new Image(); atlas.src = `${ASSET_ROOT}guaira-water-mask.png`; await atlas.decode();
            if (this.closed || abort.signal.aborted || this.loadAbort !== abort || !this.travel) return;
            if (atlas.naturalWidth !== GUAIRA_WATER_CONTRACT.atlasSize[0] || atlas.naturalHeight !== GUAIRA_WATER_CONTRACT.atlasSize[1]) return;
            this.water.setIrrigation(new GuairaWaterMotion(atlas, GUAIRA_WATER_CONTRACT, document.createElement('canvas')));
            this.waterClock.suspend(); this.paintedCamera = null; this.requestFrame();
        } catch { /* Water is decoration. A usable diorama remains usable if the mask fails. */ }
    }
}
