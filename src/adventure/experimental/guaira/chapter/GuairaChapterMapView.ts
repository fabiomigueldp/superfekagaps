import { LabToolbarAction } from '../../JuiceLabToolbar';
import { approachGuairaCamera, guairaCamera, guairaScreenPoint, paintGuairaMap, paintGuairaWaterFrame, type GuairaCamera } from '../GuairaMapArt';
import { loadGuairaScene } from '../GuairaMapLoader';
import type { GuairaArrival, GuairaMetadata } from '../GuairaMapModel';
import { GUAIRA_WATER_CONTRACT, GuairaWaterMotion, VisibleWaterClock } from '../GuairaWaterMotion';
import { CHAPTER_SCENES } from './GuairaChapterScenes';
import type { GuairaChapterGeneration, GuairaChapterOpening, GuairaChapterSceneId, GuairaChapterSnapshot } from './GuairaChapterSession';
import { GuairaChapterTravel } from './GuairaChapterTravel';

export interface GuairaChapterMapOptions {
    snapshot: GuairaChapterSnapshot;
    arrival: GuairaArrival;
    walkToSelection?: boolean;
    /** The host latches this false on the first entry, including an abandoned attempt. */
    openingAvailable?: boolean;
    onSelect(sceneId: GuairaChapterSceneId, generation: GuairaChapterGeneration): void;
    onEnter(sceneId: GuairaChapterSceneId, generation: GuairaChapterGeneration): void;
    onOpening(opening: GuairaChapterOpening, generation: GuairaChapterGeneration): void;
    onRestart(generation: GuairaChapterGeneration): void;
    onExit(): void;
}

const ASSET_ROOT = './assets/world/experimental/guaira/';
const ARRIVAL_NODE: Record<GuairaArrival, string> = { town: 'guaira-1', bairro: 'guaira-2', rice: 'guaira-3', corral: 'guaira-4', vazao: 'guaira-5' };
const ARRIVAL_WORDS: Record<GuairaArrival, string> = { town: 'na estrada', bairro: 'no Bairro da Vala Seca', rice: 'no arrozal', corral: 'no curral', vazao: 'na Casa da Vazão' };
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
    private readonly exit = control('SAIR', 'Sair do capítulo e voltar ao jogo principal');
    private readonly primary = control('ENTRAR', 'Entrar no trecho selecionado', true);
    private readonly skip = control('CHEGAR', 'Chegar agora, pulando a caminhada');
    private readonly retry = control('TENTAR', 'Tentar carregar a maquete novamente');
    private readonly traversal = control('TRAVESSIA', 'Travessia da Vala Seca: usar como abertura');
    private readonly junction = control('PATIO', 'Pátio das Comportas: usar como abertura alternativa');
    private readonly dialog = element('dialog', 'chapter-map-dialog');
    private readonly dialogCount = element('p', 'chapter-map-count');
    private readonly list = element('ol', 'chapter-map-list');
    private readonly close = control('FECHAR', 'Fechar a jornada e voltar à maquete');
    private readonly restart = control('REINICIAR', 'Reiniciar o capítulo e descartar as conclusões desta sessão');
    private readonly lifecycle = new AbortController();
    private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
    private observer: ResizeObserver | null = null;
    private readonly waterClock = new VisibleWaterClock();
    private snapshot: GuairaChapterSnapshot;
    private openingAvailable: boolean;
    private walkRequested: boolean;
    private entryRequested = false;
    private closed = false;
    private menuOpen = false;
    private menuVersion = 0;
    private overviewActive = false;
    private loadState: 'loading' | 'ready' | 'failed' = 'loading';
    private loadAbort: AbortController | null = null;
    private travel: GuairaChapterTravel | null = null;
    private metadata: GuairaMetadata | null = null;
    private image: HTMLImageElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    private water: GuairaWaterMotion | undefined;
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
        this.snapshot = options.snapshot;
        this.openingAvailable = options.openingAvailable ?? (options.snapshot.generation.generation === 0 && options.snapshot.accepted.length === 0);
        this.walkRequested = options.walkToSelection ?? false;
        this.shell.setAttribute('aria-label', 'Mapa do capítulo de Guaíra');
        const identity = element('div', 'chapter-map-identity');
        identity.append(element('h1', 'chapter-map-name', 'GUAÍRA'), this.count);
        const navigation = element('nav', 'chapter-map-navigation'); navigation.setAttribute('aria-label', 'Controles do mapa');
        navigation.append(this.journey.button, this.overview.button, this.exit.button);
        this.header.append(identity, navigation);
        this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', 'Maquete de Guaíra com Feka na estrada');
        this.loading.setAttribute('role', 'status'); this.failure.setAttribute('role', 'alert');
        this.failure.append(element('p', '', 'A maquete não carregou. Tente novamente ou use SAIR.'), this.retry.button);
        this.plaque.setAttribute('aria-hidden', 'true');
        this.scene.append(this.canvas, this.plaque, this.loading, this.failure);
        const information = element('div', 'chapter-map-information'); information.append(this.title, this.status, this.hint);
        this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.status.setAttribute('aria-atomic', 'true');
        const actions = element('div', 'chapter-map-actions'); actions.append(this.skip.button, this.primary.button);
        this.openingRow.setAttribute('role', 'group'); this.openingRow.setAttribute('aria-label', 'Escolha a abertura do capítulo');
        this.openingRow.append(this.traversal.button, this.junction.button);
        this.footer.append(information, actions, this.openingRow);
        const dialogHeader = element('div', 'chapter-map-dialog-header');
        const dialogTitle = element('h2', 'chapter-map-dialog-title', 'Jornada de Guaíra');
        dialogTitle.id = `guaira-chapter-journey-${nextViewId++}`;
        this.dialog.setAttribute('aria-labelledby', dialogTitle.id);
        this.dialog.setAttribute('aria-modal', 'true');
        dialogHeader.append(dialogTitle, this.close.button);
        const dialogFooter = element('div', 'chapter-map-dialog-footer');
        dialogFooter.append(element('p', 'chapter-map-session-note', 'Válido enquanto esta página estiver aberta. Recarregar reinicia o capítulo.'), this.restart.button);
        this.dialog.append(dialogHeader, this.dialogCount, this.list, dialogFooter);
        this.shell.append(this.header, this.scene, this.footer, this.dialog);
        try {
            root.append(this.shell);
            const { signal } = this.lifecycle;
            this.journey.button.addEventListener('click', () => this.openMenu(), { signal });
            this.close.button.addEventListener('click', () => this.closeMenu(), { signal });
            this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.closeMenu(); }, { signal });
            this.shell.addEventListener('keydown', event => {
                if (event.key === 'Escape' && this.menuOpen) { event.preventDefault(); this.closeMenu(); }
            }, { signal });
            this.overview.button.addEventListener('click', () => {
                if (!this.closed && this.loadState === 'ready' && !this.menuOpen) {
                    this.overviewActive = !this.overviewActive; this.reflect(); this.requestFrame();
                }
            }, { signal });
            this.exit.button.addEventListener('click', () => { if (!this.closed) options.onExit(); }, { signal });
            this.retry.button.addEventListener('click', () => { if (!this.closed && this.loadState === 'failed') void this.load(); }, { signal });
            this.motion.addEventListener('change', () => {
                if (this.closed) return;
                // A paused walk must not jump in response to a preference change behind a modal.
                if (this.travel && this.walkRequested && !this.suspended()) this.travel.setReducedMotion(this.motion.matches);
                else if (this.travel) this.travel.reducedMotion = this.motion.matches;
                this.camera = null; this.paintedCamera = null; this.waterClock.suspend(); this.reflect(); this.requestFrame();
            }, { signal });
            document.addEventListener('visibilitychange', () => { this.suspendFrames(); if (!document.hidden) this.resume(); }, { signal });
            window.addEventListener('resize', this.resize, { signal });
            this.observer = new ResizeObserver(this.resize); this.observer.observe(this.scene);
            this.bindActions(); this.reflect(); this.resize(); void this.load();
        } catch (error) {
            // A failed constructor cannot be disposed by the host because it has no instance yet.
            this.dispose();
            throw error;
        }
    }

    /** The host calls after accepting a new generation; false does not move the actor. */
    update(snapshot: GuairaChapterSnapshot, walkToSelection = false, openingAvailable = this.openingAvailable): void {
        if (this.closed) return;
        if (snapshot.generation.sessionId === this.snapshot.generation.sessionId && snapshot.generation.generation < this.snapshot.generation.generation) return;
        this.snapshot = snapshot; this.openingAvailable = openingAvailable;
        this.walkRequested = walkToSelection; this.entryRequested = false;
        this.closeMenu(false); this.suspendFrames();
        if (this.travel && walkToSelection && this.selectable(snapshot.selectedScene)) {
            this.travel.reducedMotion = this.motion.matches;
            if (!this.suspended()) this.travel.walkTo(CHAPTER_SCENES[snapshot.selectedScene].arrival);
        }
        this.bindActions(); this.renderList(); this.reflect(); this.requestFrame();
    }

    /** Host must recheck both this physical gate and the session before entering. */
    canEnter(sceneId: GuairaChapterSceneId, generation: GuairaChapterGeneration): boolean {
        return this.current(generation) && !this.menuOpen && !document.hidden && this.loadState === 'ready'
            && this.selectable(sceneId) && this.snapshot.selectedScene === sceneId && !!this.travel
            && !this.moving() && this.travel.arrival === CHAPTER_SCENES[sceneId].arrival;
    }

    dispose(): void {
        if (this.closed) return;
        this.closed = true; this.lifecycle.abort(); this.loadAbort?.abort(); this.suspendFrames();
        this.observer?.disconnect(); this.observer = null; this.travel?.dispose(); this.travel = null;
        this.image = null; this.metadata = null; this.water = undefined;
        this.primary.button.onclick = null; this.skip.button.onclick = null;
        this.traversal.button.onclick = null; this.junction.button.onclick = null; this.restart.button.onclick = null;
        if (this.dialog.open) this.dialog.close(); this.shell.remove();
    }

    private current(generation: GuairaChapterGeneration) {
        return !this.closed && !this.snapshot.disposed && !this.snapshot.activeAttempt && sameGeneration(generation, this.snapshot.generation);
    }
    private selectable(sceneId: GuairaChapterSceneId) {
        return this.snapshot.route.includes(sceneId) && (sceneId === this.snapshot.nextRecommendedScene || this.snapshot.accepted.some(receipt => receipt.sceneId === sceneId));
    }
    private moving() { return !!this.travel && this.walkRequested && this.travel.moving; }
    private suspended() { return this.closed || this.menuOpen || document.hidden || this.snapshot.disposed || !!this.snapshot.activeAttempt; }

    private bindActions() {
        // Every installed action captures its rendered generation, including actions retained by a queued event.
        const generation = this.snapshot.generation, sceneId = this.snapshot.selectedScene;
        this.primary.button.onclick = () => {
            if (!this.current(generation) || this.menuOpen || document.hidden || this.entryRequested || this.loadState !== 'ready' || !this.selectable(sceneId)) return;
            if (this.canEnter(sceneId, generation)) {
                this.entryRequested = true; this.reflect(); this.options.onEnter(sceneId, generation);
            } else if (!this.moving() && this.travel) {
                this.walkRequested = true; this.travel.walkTo(CHAPTER_SCENES[sceneId].arrival);
                this.previousTime = 0; this.reflect(); this.requestFrame();
            }
        };
        this.skip.button.onclick = () => {
            if (!this.current(generation) || this.suspended() || !this.moving()) return;
            this.travel!.skip(); this.camera = null; this.reflect(); this.requestFrame(); this.primary.button.focus();
        };
        const openingAction = (opening: GuairaChapterOpening) => () => {
            if (this.current(generation) && !this.suspended() && this.loadState === 'ready' && this.openingAvailable && !this.snapshot.accepted.length && !this.entryRequested)
                this.options.onOpening(opening, generation);
        };
        this.traversal.button.onclick = openingAction('guaira-travessia');
        this.junction.button.onclick = openingAction('guaira-patio-comportas');
        this.restart.button.onclick = () => {
            if (this.current(generation) && this.menuOpen) this.options.onRestart(generation);
        };
    }

    private reflect() {
        const snapshot = this.snapshot, selected = CHAPTER_SCENES[snapshot.selectedScene];
        const ready = this.loadState === 'ready', moving = this.moving();
        const canEnter = this.canEnter(snapshot.selectedScene, snapshot.generation);
        const accepted = snapshot.accepted.some(receipt => receipt.sceneId === snapshot.selectedScene);
        const opening = this.openingAvailable && !snapshot.accepted.length && !snapshot.activeAttempt;
        const key = `${snapshot.generation.sessionId}:${snapshot.generation.generation}:${ready}:${this.loadState}:${moving}:${canEnter}:${this.entryRequested}:${this.overviewActive}:${opening}:${snapshot.selectedScene}:${snapshot.accepted.length}`;
        if (key === this.presentationKey) return; this.presentationKey = key;
        this.count.textContent = `${snapshot.accepted.length}/${snapshot.route.length} · nesta sessão`;
        this.dialogCount.textContent = this.count.textContent;
        this.title.textContent = snapshot.chapterComplete ? 'CAPÍTULO CONCLUÍDO' : opening ? 'ESCOLHA A ABERTURA' : selected.title;
        this.status.textContent = !ready ? this.loadState === 'failed' ? 'A maquete está indisponível. Sua sessão continua aqui.' : 'Carregando a maquete…'
            : moving ? `A caminho de ${selected.place}`
                : canEnter ? `Selecionado · Feka ${ARRIVAL_WORDS[selected.arrival]} · pronto para ${accepted ? 'repetir' : 'entrar'}`
                    : `Selecionado: ${selected.title} · caminhe até ${selected.place}`;
        const last = snapshot.accepted[snapshot.accepted.length - 1];
        this.hint.textContent = snapshot.chapterComplete ? `Água pública liberada · ${snapshot.accepted.length}/${snapshot.route.length} nesta sessão`
            : last ? `${CHAPTER_SCENES[last.sceneId].title} concluído · ${snapshot.accepted.length}/${snapshot.route.length} nesta sessão`
                : 'Recarregar recomeça o capítulo';
        this.primary.art.setLabel(canEnter && accepted ? 'REPETIR' : !canEnter && !moving && ready ? 'CAMINHAR' : 'ENTRAR',
            canEnter && accepted ? snapshot.selectedScene === 'guaira-prefeito' ? 'Repetir o Prefeito em uma nova tentativa' : `Repetir ${selected.title} em uma nova tentativa`
                : !canEnter && !moving && ready ? `Caminhar até ${selected.place}` : `Entrar: ${selected.title}`);
        this.primary.button.disabled = !ready || moving || !this.current(snapshot.generation) || this.entryRequested || !this.selectable(snapshot.selectedScene);
        this.skip.button.hidden = !ready || !moving; this.skip.button.disabled = !ready || !moving;
        this.openingRow.hidden = !opening; this.traversal.button.disabled = !ready; this.junction.button.disabled = !ready;
        this.traversal.button.setAttribute('aria-pressed', String(snapshot.opening === 'guaira-travessia'));
        this.junction.button.setAttribute('aria-pressed', String(snapshot.opening === 'guaira-patio-comportas'));
        this.overview.button.disabled = !ready;
        this.journey.button.disabled = !ready || !this.current(snapshot.generation) || this.entryRequested;
        this.overview.button.setAttribute('aria-pressed', String(this.overviewActive));
        this.overview.art.setLabel(this.overviewActive ? 'VER FEKA' : 'VER MAPA', this.overviewActive ? 'Acompanhar Feka' : 'Ver mapa inteiro');
        this.loading.hidden = this.loadState !== 'loading'; this.failure.hidden = this.loadState !== 'failed';
        this.plaqueArt.setLabel(selected.short, selected.title);
        this.plaque.hidden = true; this.paintedCamera = null;
        this.canvas.setAttribute('aria-label', moving ? `Maquete de Guaíra. Feka a caminho de ${selected.place}.`
            : this.travel?.arrival ? `Maquete de Guaíra. Feka ${ARRIVAL_WORDS[this.travel.arrival]}.` : 'Maquete de Guaíra. Feka na estrada.');
    }

    private renderList() {
        this.list.replaceChildren();
        const generation = this.snapshot.generation, menuVersion = ++this.menuVersion;
        this.snapshot.route.forEach((sceneId, index) => {
            const scene = CHAPTER_SCENES[sceneId], item = element('li', 'chapter-map-step');
            const accepted = this.snapshot.accepted.some(receipt => receipt.sceneId === sceneId);
            const state = accepted ? 'Concluído · repetir' : sceneId === this.snapshot.nextRecommendedScene ? 'Próximo trecho' : `Depois de ${CHAPTER_SCENES[this.snapshot.route[index - 1]].title}`;
            const row = element('button', 'chapter-map-step-button'); row.type = 'button';
            row.append(element('span', 'chapter-map-step-title', `${index + 1}. ${scene.title}`), element('span', 'chapter-map-step-state', state));
            row.disabled = !this.selectable(sceneId) || !this.current(generation);
            row.setAttribute('aria-label', `${scene.title}: ${state}`);
            row.setAttribute('aria-pressed', String(sceneId === this.snapshot.selectedScene));
            // Property handlers let replaced rows be collected rather than retaining them on the lifetime signal.
            row.onclick = () => {
                if (!this.current(generation) || !this.menuOpen || menuVersion !== this.menuVersion || !this.selectable(sceneId)) return;
                this.closeMenu(); this.options.onSelect(sceneId, generation);
            };
            item.append(row); this.list.append(item);
        });
    }
    private openMenu() {
        if (this.closed || this.menuOpen || this.loadState !== 'ready' || this.entryRequested || !this.current(this.snapshot.generation)) return;
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
            this.travel.walkTo(CHAPTER_SCENES[this.snapshot.selectedScene].arrival);
        }
        this.reflect(); this.requestFrame();
    }
    private suspendFrames() {
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
        const target = guairaCamera(this.metadata, this.width, this.height, this.travel.point, this.overviewActive);
        this.camera = !this.camera || this.motion.matches ? target : approachGuairaCamera(this.camera, target, dt);
        const seconds = this.waterClock.tick(time, !!this.water && !this.motion.matches);
        const overlay = this.water ? { effect: this.water, seconds } : undefined;
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
        const selected = CHAPTER_SCENES[this.snapshot.selectedScene];
        const point = guairaScreenPoint(this.metadata.nodes[ARRIVAL_NODE[selected.arrival]], this.camera);
        const plaqueWidth = this.plaque.getBoundingClientRect().width || 150;
        this.plaque.hidden = this.width < 520 || this.height < 250 || point.x < plaqueWidth / 2 + 8 || point.x > this.width - plaqueWidth / 2 - 8 || point.y < 12 || point.y + 68 > this.height;
        this.plaque.style.left = `${point.x}px`; this.plaque.style.top = `${point.y + 16}px`;
        if (moving || this.camera.x !== target.x || this.camera.y !== target.y || this.camera.imageWidth !== target.imageWidth || (this.water && !this.motion.matches)) this.requestFrame();
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
            this.water = new GuairaWaterMotion(atlas, GUAIRA_WATER_CONTRACT, document.createElement('canvas'));
            this.waterClock.suspend(); this.paintedCamera = null; this.requestFrame();
        } catch { /* Water is decoration. A usable diorama remains usable if the mask fails. */ }
    }
}
