import { ISLANDS, STAGES } from './campaign';
import { fitText, panel, pixelText, textWidth, wrapText } from '../graphics/BitmapFont';
import { ART } from '../graphics/palette';
import { mapAssetPrefix } from './WorldMapArt';
import { loadMapSignAtlas, paintPhysicalDockSign, paintPhysicalStageSign, type MapSignAtlas } from './WorldMapSignArt';

export type WorldMapMotionState = 'idle' | 'walking' | 'boarding' | 'sailing' | 'arriving';
export interface WorldMapHudCallbacks {
    selectStage(index: number): void;
    selectWorld(world: number): void;
    enter(): void;
    skip(): void;
    overview(): void;
    menu(): void;
}
export interface WorldMapHudState {
    /** Visible region, 1–6. Stage is a global campaign index, 0–29. */
    world: number;
    stage: number;
    /** Five entries for the visible region, in campaign order. */
    open: readonly boolean[];
    completed: readonly boolean[];
    seals: readonly number[];
    globalProgress: { completed: number; seals: number };
    motionState: WorldMapMotionState;
    canEnter: boolean;
    hint: string;
    warnings?: readonly string[];
    /** Six entries, one per region. Locked regions remain inspectable. */
    worldAvailability: readonly boolean[];
    /** Inspecting a place Feka has not arrived at; never announce arrival. */
    preview?: boolean;
    overview?: boolean;
}
export interface WorldMapHudPoint {
    /** Scene-relative CSS pixels at the foot of the sign. */
    x: number;
    y: number;
    visible?: boolean;
    /** A closed dock remains inspectable and announces its gate. */
    available?: boolean;
}

const MOTION_COPY: Record<WorldMapMotionState, string> = {
    idle: '', walking: 'Feka a caminho', boarding: 'Embarcando', sailing: 'Navegando', arriving: 'Desembarcando',
};
const REGION_NAMES = ['Costa', 'Porto', 'Fábrica', 'Serra', 'Reserva', 'Domínio'];
let instanceId = 0;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
    const result = document.createElement(tag);
    result.className = className;
    if (text) result.textContent = text;
    return result;
}
function accessibleText(parent: HTMLElement, value: string): HTMLSpanElement {
    const label = element('span', 'world-map-sr', value);
    parent.append(label);
    return label;
}
function bitmap(parent: HTMLElement): HTMLCanvasElement {
    const canvas = element('canvas', 'world-map-bitmap');
    canvas.setAttribute('aria-hidden', 'true');
    parent.append(canvas);
    return canvas;
}
function context(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
    canvas.width = width * 2; canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false; }
    return ctx;
}
function lettering(canvas: HTMLCanvasElement, text: string, color: string = ART.paper, maxWidth = 180): void {
    const width = Math.min(maxWidth, textWidth(text)), ctx = context(canvas, width + 2, 12);
    if (ctx) pixelText(ctx, fitText(text, width), 1, 3, color);
}
function phaseLettering(canvas: HTMLCanvasElement, text: string): void {
    // Keep every campaign title readable at native pixel size, including 320px screens.
    const lines = wrapText(text, 140), width = Math.max(...lines.map(line => textWidth(line)));
    const ctx = context(canvas, width + 2, lines.length * 11 + 1);
    if (ctx) lines.forEach((line, index) => pixelText(ctx, line, 1, 3 + index * 11, ART.paper));
}
function action(className: string, text: string, run: () => void): HTMLButtonElement {
    const button = element('button', className);
    button.type = 'button'; button.setAttribute('aria-label', text);
    lettering(bitmap(button), text);
    accessibleText(button, text);
    button.addEventListener('click', run);
    return button;
}
function lock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = ART.muted;
    ctx.fillRect(x + 1, y, 3, 1); ctx.fillRect(x, y + 1, 1, 3); ctx.fillRect(x + 4, y + 1, 1, 3);
    ctx.fillRect(x, y + 3, 5, 4); ctx.fillStyle = ART.ink; ctx.fillRect(x + 2, y + 4, 1, 2);
}
function stageSign(canvas: HTMLCanvasElement, id: string, selected: boolean, completed: boolean, open: boolean): void {
    canvas.style.transform = '';
    const ctx = context(canvas, 28, 29);
    if (!ctx) return;
    ctx.fillStyle = ART.soilDark; ctx.fillRect(6, 18, 3, 11); ctx.fillRect(20, 18, 3, 11);
    ctx.fillStyle = ART.soilLight; ctx.fillRect(6, 19, 1, 9); ctx.fillRect(20, 19, 1, 9);
    panel(ctx, 0, 7, 26, 15, open ? ART.ink : ART.rockDark, selected ? ART.goldLight : open ? ART.gold : ART.rockLight);
    pixelText(ctx, id, 13, 11, selected ? ART.goldLight : open ? ART.paper : ART.muted, 1, 'center');
    if (selected) pixelText(ctx, '↓', 13, 0, ART.goldLight, 1, 'center');
    if (completed) {
        ctx.fillStyle = ART.gold; ctx.fillRect(24, 0, 1, 9);
        ctx.fillStyle = ART.tealLight; ctx.fillRect(19, 0, 5, 3); ctx.fillRect(21, 3, 3, 1);
    }
    if (!open) lock(ctx, 21, 0);
}
function dockSign(canvas: HTMLCanvasElement, world: number, available: boolean, current: boolean): void {
    canvas.style.transform = '';
    const ctx = context(canvas, 52, 28);
    if (!ctx) return;
    ctx.fillStyle = ART.soilDark; ctx.fillRect(9, 17, 3, 11); ctx.fillRect(39, 17, 3, 11);
    ctx.fillStyle = ART.soilTop; ctx.fillRect(9, 19, 1, 8); ctx.fillRect(39, 19, 1, 8);
    panel(ctx, 0, 3, 50, 17, ART.ink, available ? ART.gold : ART.rockLight);
    const name = world === 1 ? '← COSTA' : 'PORTO →';
    pixelText(ctx, name, 25, 8, current ? ART.goldLight : available ? ART.paper : ART.muted, 1, 'center');
    if (!available) lock(ctx, 44, 0);
}

/** DOM-only map controls. The owner supplies projection, journey state and the game loop. */
export class WorldMapHud {
    readonly root = element('section', 'world-map world-map-connected');
    readonly scene = element('div', 'world-map-scene');
    readonly canvas = element('canvas', 'world-map-art');
    readonly nodeLayer = element('nav', 'world-map-nodes');
    readonly header = element('header', 'world-map-header');
    readonly tools = element('div', 'world-map-tools');
    readonly footer = element('footer', 'world-map-footer');
    readonly stageButtons: HTMLButtonElement[] = [];
    readonly dockButtons: HTMLButtonElement[] = [];
    readonly regionMenu = element('nav', 'world-map-region-menu');
    readonly regionButton: HTMLButtonElement;
    readonly enterButton: HTMLButtonElement;
    readonly skipButton: HTMLButtonElement;
    private readonly title = element('h1', 'world-map-title');
    private readonly titleBitmap = bitmap(this.title);
    private readonly titleText = accessibleText(this.title, 'Mapa do arquipélago');
    private readonly stageTitle = element('h2', 'world-map-stage-title');
    private readonly stageTitleBitmap = bitmap(this.stageTitle);
    private readonly stageTitleText = accessibleText(this.stageTitle, '');
    private readonly status = element('p', 'world-map-status');
    private readonly hint = element('p', 'world-map-hint');
    private readonly stageDetails = element('span', 'world-map-stage-details');
    private readonly globalProgress = element('p', 'world-map-region-progress');
    private readonly warning = element('p', 'world-map-warning');
    private readonly announcer = element('p', 'world-map-sr');
    private readonly stageCanvases: HTMLCanvasElement[] = [];
    private readonly dockCanvases: HTMLCanvasElement[] = [];
    private readonly regionButtons: HTMLButtonElement[] = [];
    private readonly regionStates: HTMLSpanElement[] = [];
    private readonly overviewButton: HTMLButtonElement;
    private readonly playCanvas: HTMLCanvasElement;
    private readonly playText: HTMLSpanElement;
    private state: WorldMapHudState | null = null;
    private signature = '';
    private announcement = '';
    private readonly dockSignatures = ['', ''];
    private readonly dockAvailability = [false, false];
    private readonly assetAbort = new AbortController();
    private signAtlas: MapSignAtlas | null = null;
    private signsRequested = false;
    private disposed = false;

    constructor(callbacks: WorldMapHudCallbacks) {
        const id = ++instanceId;
        this.root.hidden = true; this.root.tabIndex = -1;
        this.root.setAttribute('aria-label', 'Mapa do arquipélago');
        this.canvas.setAttribute('aria-hidden', 'true');
        this.nodeLayer.setAttribute('aria-label', 'Fases e cais do mapa');
        this.scene.append(this.canvas, this.nodeLayer);
        this.regionButton = action('world-map-tool world-map-archipelago', 'Arquipélago', () => this.toggleRegionMenu());
        this.regionButton.setAttribute('aria-expanded', 'false');
        this.regionMenu.id = `world-map-regions-${id}`;
        this.regionButton.setAttribute('aria-controls', this.regionMenu.id);
        this.regionMenu.setAttribute('aria-label', 'As seis ilhas'); this.regionMenu.hidden = true;
        this.overviewButton = action('world-map-tool world-map-overview', '← →', () => this.run(() => callbacks.overview()));
        // The game's original alphabet has cardinal arrows; no external icon or font is needed.
        lettering(this.overviewButton.children[0] as HTMLCanvasElement, '← →');
        this.overviewButton.setAttribute('aria-label', 'Ver panorama'); this.overviewButton.title = 'Ver panorama';
        this.overviewButton.setAttribute('aria-pressed', 'false');
        const menu = action('world-map-tool world-map-menu', 'II', () => this.run(() => callbacks.menu()));
        menu.setAttribute('aria-label', 'Menu do jogo'); menu.title = 'Menu do jogo';
        this.tools.append(this.regionButton, this.overviewButton, menu); this.header.append(this.title, this.tools);
        for (let n = 0; n < 5; n++) {
            const button = element('button', 'world-map-node'); button.type = 'button';
            const canvas = bitmap(button); accessibleText(button, `Fase ${n + 1}`);
            button.addEventListener('click', () => this.run(() => {
                if (this.state) callbacks.selectStage((this.state.world - 1) * 5 + n);
            }));
            button.hidden = true;
            this.stageButtons.push(button); this.stageCanvases.push(canvas); this.nodeLayer.append(button);
        }
        for (let world = 1; world <= 2; world++) {
            const button = element('button', 'world-map-dock'); button.type = 'button';
            const canvas = bitmap(button); accessibleText(button, `Cais: ${REGION_NAMES[world - 1]}`);
            button.addEventListener('click', () => this.run(() => callbacks.selectWorld(world)));
            button.hidden = true;
            this.dockButtons.push(button); this.dockCanvases.push(canvas); this.nodeLayer.append(button);
        }
        const drawerHeading = element('div', 'world-map-region-heading');
        const drawerTitle = element('h2', 'world-map-region-title');
        lettering(bitmap(drawerTitle), 'ARQUIPÉLAGO', ART.goldLight); accessibleText(drawerTitle, 'Arquipélago');
        const close = action('world-map-tool world-map-region-close', '×', () => this.closeRegionMenu(true));
        close.setAttribute('aria-label', 'Fechar arquipélago');
        drawerHeading.append(drawerTitle, close); this.regionMenu.append(drawerHeading, this.globalProgress);
        for (const island of ISLANDS) {
            const button = element('button', 'world-map-region'); button.type = 'button';
            const name = element('span', 'world-map-region-name');
            lettering(bitmap(name), `${island.id} ${REGION_NAMES[island.id - 1]}`, ART.paper);
            accessibleText(name, island.name);
            const status = element('span', 'world-map-region-state');
            button.append(name, status);
            button.addEventListener('click', () => this.run(() => {
                this.closeRegionMenu(true); callbacks.selectWorld(island.id);
            }));
            this.regionButtons.push(button); this.regionStates.push(status); this.regionMenu.append(button);
        }
        const copy = element('div', 'world-map-stage-copy');
        copy.append(this.stageDetails, this.status, this.hint);
        const actions = element('div', 'world-map-stage-actions');
        this.enterButton = element('button', 'world-map-enter'); this.enterButton.type = 'button';
        this.playCanvas = bitmap(this.enterButton); this.playText = accessibleText(this.enterButton, 'Entrar');
        this.enterButton.addEventListener('click', () => this.run(() => {
            if (this.state?.canEnter && !this.state.preview && this.state.motionState === 'idle' && this.state.open[this.state.stage % 5]) callbacks.enter();
        }));
        this.skipButton = action('world-map-skip', 'Pular →', () => this.run(() => {
            if (this.state && this.state.motionState !== 'idle') callbacks.skip();
        }));
        this.skipButton.setAttribute('aria-label', 'Pular viagem e chegar ao destino');
        this.skipButton.hidden = true; actions.append(this.enterButton, this.skipButton);
        this.warning.hidden = true; this.warning.setAttribute('role', 'status');
        this.hint.id = `world-map-hint-${id}`;
        this.enterButton.setAttribute('aria-describedby', this.hint.id);
        this.announcer.setAttribute('role', 'status'); this.announcer.setAttribute('aria-live', 'polite');
        this.announcer.setAttribute('aria-atomic', 'true');
        this.footer.append(this.stageTitle, copy, actions, this.warning);
        this.root.append(this.scene, this.header, this.footer, this.regionMenu, this.announcer);
        this.root.addEventListener('keydown', this.onKey);
    }

    /** Mount is explicit so the game controls ownership and canvas focus restoration. */
    setVisible(visible: boolean): void {
        if (this.disposed) return;
        this.root.hidden = !visible;
        if (!visible) this.closeRegionMenu();
        else this.loadSignArt();
    }
    private loadSignArt(): void {
        if (this.signsRequested) return;
        this.signsRequested = true;
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        void loadMapSignAtlas(prefix, this.assetAbort.signal).then(atlas => {
            if (!atlas || this.disposed) return;
            this.signAtlas = atlas;
            if (!this.state) return;
            for (let n = 0; n < 5; n++) this.paintStage(n, this.state);
            this.dockSignatures.fill('');
            this.dockAvailability.forEach((available, n) => this.updateDock(n, available));
        });
    }
    private run(action: () => void): void { if (!this.disposed && !this.root.hidden) action(); }

    update(state: WorldMapHudState): void {
        if (this.disposed) return;
        this.state = state;
        const signature = JSON.stringify(state);
        if (signature === this.signature) return;
        this.signature = signature;
        const island = ISLANDS[state.world - 1], stage = STAGES[state.stage];
        if (!island || !stage) return;
        const local = stage.number - 1, open = !!state.open[local], completed = !!state.completed[local];
        const traveling = state.motionState !== 'idle';
        const canEnter = state.canEnter && open && !state.preview && !traveling;
        const title = `${stage.id} ${stage.name}`;
        this.titleText.textContent = island.name;
        lettering(this.titleBitmap, island.name, ART.goldLight, 165);
        this.stageTitleText.textContent = title;
        phaseLettering(this.stageTitleBitmap, title);
        this.stageTitle.title = title;
        this.stageDetails.textContent = stage.encounter ? 'Encontro' : `${state.seals[local] ?? 0}/3 selos`;
        this.status.textContent = state.preview ? traveling ? `Prévia · ${MOTION_COPY[state.motionState]}` : 'Prévia · Feka não chegou aqui'
            : traveling ? MOTION_COPY[state.motionState]
            : !open ? 'Caminho fechado'
            : canEnter ? completed ? 'Concluída · pode entrar de novo' : 'Feka chegou · pode entrar'
            : 'Destino marcado';
        this.hint.textContent = state.hint || (state.preview || !open ? 'Conclua o caminho anterior para visitar.'
            : traveling ? 'Você pode mudar o destino durante a viagem.' : 'Toque numa placa para caminhar até ela.');
        this.enterButton.disabled = !canEnter;
        const playLabel = canEnter ? 'Entrar →' : state.preview ? 'Prévia' : traveling ? 'A caminho' : open ? 'Aguarde' : 'Fechada';
        lettering(this.playCanvas, playLabel, canEnter ? ART.ink : ART.muted);
        this.playText.textContent = playLabel;
        this.enterButton.setAttribute('aria-label', canEnter ? `Entrar na fase ${stage.id}: ${stage.name}` : `${playLabel}. ${this.status.textContent}`);
        this.skipButton.hidden = !traveling;
        this.enterButton.hidden = traveling;
        this.overviewButton.setAttribute('aria-pressed', String(!!state.overview));
        this.overviewButton.setAttribute('aria-label', state.overview ? 'Aproximar mapa' : 'Ver panorama');
        this.root.setAttribute('data-motion', state.motionState);
        this.root.classList.toggle('is-preview', !!state.preview);
        this.globalProgress.textContent = `${state.globalProgress.completed}/30 fases · ${state.globalProgress.seals}/72 selos`;
        const warnings = state.warnings?.filter(Boolean).join(' ') ?? '';
        this.warning.textContent = warnings; this.warning.hidden = !warnings;
        for (let n = 0; n < 5; n++) {
            const entry = STAGES[(state.world - 1) * 5 + n], selected = entry.id === stage.id;
            const unlocked = !!state.open[n], done = !!state.completed[n], button = this.stageButtons[n];
            const status = !unlocked ? 'bloqueada' : done ? 'concluída' : 'disponível';
            this.paintStage(n, state);
            button.classList.toggle('is-selected', selected); button.classList.toggle('is-completed', done); button.classList.toggle('is-locked', !unlocked);
            button.setAttribute('aria-pressed', String(selected));
            button.setAttribute('aria-label', `Fase ${entry.id}: ${entry.name}, ${status}. ${unlocked ? 'Marcar destino.' : 'Ver caminho bloqueado.'}`);
            button.title = `${entry.id} · ${entry.name} · ${status}`;
        }
        this.regionButtons.forEach((button, n) => {
            const current = n + 1 === state.world, available = !!state.worldAvailability[n];
            button.setAttribute('aria-current', current ? 'location' : 'false');
            button.setAttribute('aria-label', `Ilha ${n + 1}: ${ISLANDS[n].name}. ${current ? 'No mapa. ' : ''}${available ? 'Disponível.' : 'Bloqueada. Ver prévia.'}`);
            button.classList.toggle('is-current', current);
            this.regionStates[n].textContent = current ? state.preview ? 'Prévia' : 'No mapa' : available ? 'Visitar →' : 'Bloqueada';
        });
        this.dockButtons.forEach((_button, n) => this.updateDock(n, !!state.worldAvailability[n]));
        const announcement = `${title}. ${this.status.textContent}. ${this.stageDetails.textContent}.`;
        if (announcement !== this.announcement) { this.announcement = announcement; this.announcer.textContent = announcement; }
    }
    private paintStage(index: number, state: WorldMapHudState): void {
        const entry = STAGES[(state.world - 1) * 5 + index], selected = entry.id === STAGES[state.stage].id;
        if (state.world > 2 || !paintPhysicalStageSign(this.stageCanvases[index], this.signAtlas, entry.id, selected, !!state.completed[index], !!state.open[index]))
            stageSign(this.stageCanvases[index], entry.id, selected, !!state.completed[index], !!state.open[index]);
    }

    /** Five phase points, then Costa and Porto dock points. Missing points hide controls. */
    positionNodes(stages: readonly (WorldMapHudPoint | null)[], docks: readonly (WorldMapHudPoint | null)[]): void {
        const position = (button: HTMLButtonElement, point: WorldMapHudPoint | null | undefined) => {
            button.hidden = !point || point.visible === false || !Number.isFinite(point.x) || !Number.isFinite(point.y);
            if (!button.hidden && point) button.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -100%)`;
        };
        this.stageButtons.forEach((button, n) => position(button, stages[n]));
        this.dockButtons.forEach((button, n) => {
            const point = docks[n]; position(button, point);
            if (point?.available !== undefined && this.state) this.updateDock(n, point.available);
        });
    }
    private updateDock(index: number, available: boolean): void {
        const current = this.state?.world === index + 1, physical = !!this.state && this.state.world <= 2;
        const key = `${available}:${current}:${physical}`;
        if (this.dockSignatures[index] === key) return;
        this.dockSignatures[index] = key;
        this.dockAvailability[index] = available;
        if (!physical || !paintPhysicalDockSign(this.dockCanvases[index], this.signAtlas, index + 1, available))
            dockSign(this.dockCanvases[index], index + 1, available, current);
        const button = this.dockButtons[index];
        button.classList.toggle('is-locked', !available);
        button.setAttribute('aria-label', `Cais para ${ISLANDS[index].name}. ${available ? 'Marcar destino da travessia.' : 'Travessia bloqueada. Ver prévia.'}`);
    }
    focusStage(globalIndex: number): void {
        if (this.state && Math.floor(globalIndex / 5) === this.state.world - 1) this.stageButtons[globalIndex % 5]?.focus({ preventScroll: true });
    }
    focusEnter(): void { if (!this.enterButton.disabled && !this.enterButton.hidden) this.enterButton.focus({ preventScroll: true }); }
    closeRegionMenu(restoreFocus = false): void {
        if (this.regionMenu.hidden) return;
        this.regionMenu.hidden = true; this.regionButton.setAttribute('aria-expanded', 'false');
        if (restoreFocus) this.regionButton.focus({ preventScroll: true });
    }
    private toggleRegionMenu(): void {
        if (this.root.hidden) return;
        if (!this.regionMenu.hidden) { this.closeRegionMenu(true); return; }
        this.regionMenu.hidden = false; this.regionButton.setAttribute('aria-expanded', 'true');
        this.regionButtons[(this.state?.world ?? 1) - 1]?.focus({ preventScroll: true });
    }
    private readonly onKey = (event: KeyboardEvent) => {
        // Only consume drawer commands. Scene movement and Enter remain game-owned.
        if (this.regionMenu.hidden || event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation(); this.closeRegionMenu(true);
    };
    dispose(): void {
        this.disposed = true; this.root.hidden = true; this.assetAbort.abort();
        this.root.removeEventListener('keydown', this.onKey); this.root.remove();
    }
}
