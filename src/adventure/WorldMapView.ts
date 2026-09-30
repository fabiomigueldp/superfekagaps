import { ISLANDS, STAGES } from './campaign';
import { isUnlocked } from './progress';
import type { AdventureSave } from './types';
import { buildTravelPath, clampMapSelection, easeMapMotion, getMapCamera, mapToScreen, moveMapSelection, recordMapTravel, retargetMapTravel, samplePath, type MapCamera, type MapPoint } from './WorldMapModel';
import { COSTA_ART_BOUNDS, FALLBACK_POINTS, fallbackMapMetadata, frameMapPins, mapActorScale, mapAssetPrefix, paintWorldMap, parseMapMetadata, type MapArtAssets, type MapArtMetadata } from './WorldMapArt';

interface MapCallbacks { select(index: number): void; enter(): void; exit(): void; unlockAudio(): void; }
const STAGE_NOTES = [
    'O primeiro passo de uma grande viagem. A praia guarda mais do que parece.',
    'Madeira, corda e coragem. Encontre seu ritmo nas pontes da costa.',
    'Por cima é rápido. Por baixo, um caminho pode mudar toda a viagem.',
    'Uma sequência de falésias. Respire fundo e encontre o próximo apoio.',
    'Joãozão está na ponte. É aqui que a travessia fica pessoal.'
];
const LANDMARKS = ['A chegada', 'As pontes', 'O arco de pedra', 'As falésias', 'O grande encontro'];
const WORLD_SYMBOLS = ['☀', '⚓', '◈', '△', '❄', '♜'];
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag); element.className = className; if (text) element.textContent = text; return element;
}
function button(className: string, label: string, action: () => void): HTMLButtonElement {
    const b = el('button', className, label); b.type = 'button'; b.addEventListener('click', action); return b;
}
/** Dedicated high-resolution presentation. One mount, one game-owned render loop, zero extra RAFs. */
export class WorldMapView {
    readonly root = el('section', 'world-map');
    private readonly scene = el('div', 'world-map-scene');
    private readonly canvas = el('canvas', 'world-map-art');
    private readonly ctx: CanvasRenderingContext2D;
    private readonly nodeLayer = el('nav', 'world-map-nodes');
    private readonly title = el('h1', 'world-map-title');
    private readonly subtitle = el('p', 'world-map-subtitle');
    private readonly worldNumber = el('span', 'world-map-eyebrow');
    private readonly progress = el('span', 'world-map-total');
    private readonly chapter = el('span', 'world-map-chapter');
    private readonly stageName = el('h2', 'world-map-stage-title');
    private readonly description = el('p', 'world-map-description');
    private readonly seals = el('span', 'world-map-seals');
    private readonly routeHint = el('span', 'world-map-route-hint');
    private readonly announcer = el('p', 'world-map-sr');
    private readonly warning = el('p', 'world-map-warning');
    private readonly play: HTMLButtonElement;
    private readonly overviewButton: HTMLButtonElement;
    private readonly nodes: HTMLButtonElement[] = [];
    private readonly worlds: HTMLButtonElement[] = [];
    private readonly media = window.matchMedia('(prefers-reduced-motion: reduce)');
    private readonly abort = new AbortController();
    private metadata: MapArtMetadata = fallbackMapMetadata();
    private assets: MapArtAssets = { island: null, shadow: null, port: null };
    private visible = false;
    private selection = -1;
    private controlSelection = 0;
    private geometryDirty = false;
    private lastSignature = '';
    private overview = false;
    private shownAt = 0;
    private lastTime = 0;
    private travelStarted = 0;
    private travelDuration = 0;
    private travel: MapPoint[] = [FALLBACK_POINTS[0]];
    private travelHistory: MapPoint[] = [];
    private marker: MapPoint = FALLBACK_POINTS[0];
    private camera: MapCamera = getMapCamera(0, { overview: true }, 1, 1);
    private width = 1;
    private height = 1;
    private dpr = 1;
    private screenDpr = 0;
    private dirtySize = true;
    private paintDirty = true;
    private restoreTabIndex: string | null = null;
    private readonly resizeObserver: ResizeObserver;
    private readonly onResize = () => { this.dirtySize = true; };
    private readonly onMotion = () => { this.paintDirty = true; if (this.media.matches) this.travelDuration = 0; };

    constructor(private readonly gameCanvas: HTMLCanvasElement, private readonly callbacks: MapCallbacks) {
        this.root.hidden = true;
        this.root.tabIndex = -1;
        this.root.setAttribute('aria-label', 'Mapa do arquipélago');
        this.canvas.setAttribute('aria-hidden', 'true');
        this.ctx = this.canvas.getContext('2d', { alpha: false })!;
        this.scene.append(this.canvas, this.nodeLayer);
        this.nodeLayer.setAttribute('aria-label', 'Fases desta ilha');
        this.root.append(this.scene);
        const header = el('header', 'world-map-header');
        const brand = el('span', 'world-map-brand', 'SUPER FEKA GAPS  /  WORLD');
        header.append(brand, this.worldNumber, this.title, this.subtitle);
        this.root.append(header);
        const tools = el('div', 'world-map-tools');
        this.overviewButton = button('world-map-quiet', 'Ver panorama', () => {
            this.overview = !this.overview; this.paintDirty = true;
            this.overviewButton.textContent = this.overview ? 'Aproximar ilha' : 'Ver panorama';
            this.overviewButton.setAttribute('aria-pressed', String(this.overview));
        });
        this.overviewButton.setAttribute('aria-pressed', 'false');
        tools.append(this.progress, this.overviewButton, button('world-map-quiet world-map-menu', 'Menu', () => this.act(() => callbacks.exit())));
        this.root.append(tools);
        for (let n = 0; n < 5; n++) {
            const b = button('world-map-node', '', () => this.act(() => {
                const index = Math.floor(this.controlSelection / 5) * 5 + n;
                if (index === this.controlSelection) callbacks.enter(); else this.select(index);
            }));
            b.append(el('span', 'world-map-node-disc', String(n + 1)), el('span', 'world-map-node-check', '✓'));
            this.nodeLayer.append(b); this.nodes.push(b);
        }
        const footer = el('footer', 'world-map-footer');
        const card = el('div', 'world-map-stage');
        const details = el('div', 'world-map-stage-copy');
        const row = el('div', 'world-map-detail-row'); row.append(this.chapter, this.seals);
        details.append(row, this.stageName, this.description);
        const actions = el('div', 'world-map-stage-actions');
        this.play = button('world-map-play', 'Jogar fase  →', () => this.act(() => callbacks.enter()));
        actions.append(this.routeHint, this.play);
        card.append(details, actions);
        const rail = el('nav', 'world-map-worlds'); rail.setAttribute('aria-label', 'As seis ilhas');
        for (const island of ISLANDS) {
            const b = button('world-map-world', '', () => this.act(() => this.select((island.id - 1) * 5)));
            b.append(el('span', 'world-map-world-symbol', WORLD_SYMBOLS[island.id - 1]), el('span', 'world-map-world-name', island.name), el('span', 'world-map-world-index', String(island.id).padStart(2, '0')));
            this.worlds.push(b); rail.append(b);
        }
        const controls = el('p', 'world-map-controls', '← → fases   ·   ↑ ↓ ilhas   ·   Enter jogar   ·   Esc menu');
        footer.append(card, rail, controls);
        this.warning.setAttribute('role', 'status'); this.warning.hidden = true;
        this.announcer.setAttribute('role', 'status'); this.announcer.setAttribute('aria-live', 'polite');
        this.root.append(footer, this.warning, this.announcer);
        this.root.addEventListener('keydown', this.onKey);
        document.body.append(this.root);
        this.resizeObserver = new ResizeObserver(this.onResize); this.resizeObserver.observe(this.scene);
        window.addEventListener('resize', this.onResize);
        this.media.addEventListener('change', this.onMotion);
        void this.loadAssets();
    }
    private select(index: number) { this.controlSelection = clampMapSelection(index); this.callbacks.select(this.controlSelection); }
    private act(action: () => void) { if (this.visible) { this.callbacks.unlockAudio(); action(); } }
    private readonly onKey = (event: KeyboardEvent) => {
        if (!this.visible || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
        const next = moveMapSelection(this.controlSelection, event.key);
        if (next !== this.controlSelection) {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.select(next));
            this.nodes[next % 5].focus({ preventScroll: true });
        } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(event.key.toLowerCase())) {
            event.preventDefault(); event.stopPropagation();
        } else if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.callbacks.exit());
        } else if ((event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.callbacks.enter());
        }
    };
    private async loadImage(path: string): Promise<HTMLImageElement | null> {
        return new Promise(resolve => {
            const img = new Image(); img.decoding = 'async';
            img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = path;
        });
    }
    private async loadAssets() {
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const [island, shadow, port, metadata] = await Promise.all([
            this.loadImage(prefix + 'costa-diorama.webp'), this.loadImage(prefix + 'costa-shadow.webp'),
            this.loadImage(prefix + 'porto-distant.webp'),
            fetch(prefix + 'costa-diorama.meta.json', { signal: this.abort.signal }).then(r => r.ok ? r.json() : null).then(parseMapMetadata).catch(() => null)
        ]);
        if (this.abort.signal.aborted) return;
        // Never overlay guessed coordinates on actual art if the matching camera export fails.
        if (island && metadata) { this.assets = { island, shadow, port }; this.metadata = metadata; }
        this.geometryDirty = true; this.lastSignature = '';
    }
    show(time: number) {
        if (this.visible) return;
        this.visible = true; this.root.hidden = false; this.shownAt = time; this.lastTime = time; this.dirtySize = true;
        this.selection = -1; this.lastSignature = '';
        this.camera = getMapCamera(0, { overview: true }, this.width, this.height);
        this.restoreTabIndex = this.gameCanvas.getAttribute('tabindex');
        this.gameCanvas.setAttribute('tabindex', '-1'); this.gameCanvas.setAttribute('aria-hidden', 'true');
        this.gameCanvas.style.visibility = 'hidden';
        this.root.focus({ preventScroll: true });
    }
    hide() {
        if (!this.visible) return;
        this.visible = false; this.root.hidden = true;
        this.gameCanvas.style.visibility = '';
        this.gameCanvas.removeAttribute('aria-hidden');
        if (this.restoreTabIndex === null) this.gameCanvas.removeAttribute('tabindex'); else this.gameCanvas.setAttribute('tabindex', this.restoreTabIndex);
        this.gameCanvas.focus({ preventScroll: true });
    }
    dispose() {
        this.hide(); this.abort.abort(); this.resizeObserver.disconnect();
        window.removeEventListener('resize', this.onResize); this.media.removeEventListener('change', this.onMotion);
        this.root.removeEventListener('keydown', this.onKey); this.root.remove();
    }
    private points(world: number): Record<number, MapPoint> {
        return Object.fromEntries(FALLBACK_POINTS.map((fallback, i) => [(world - 1) * 5 + i,
            world === 1 && this.assets.island ? this.metadata.nodes[`1-${i + 1}`] : fallback]));
    }
    render(selection: number, save: AdventureSave, time: number, warning: string, toast = '') {
        this.show(time); selection = clampMapSelection(selection); this.controlSelection = selection;
        if (this.dirtySize || this.screenDpr !== (window.devicePixelRatio || 1)) {
            const bounds = this.scene.getBoundingClientRect();
            this.width = Math.max(1, bounds.width); this.height = Math.max(1, bounds.height);
            this.screenDpr = window.devicePixelRatio || 1;
            // Keep a 4 MP backing-store budget even on ultrawide/high-DPR displays.
            this.dpr = Math.min(2, this.screenDpr, Math.sqrt(4_000_000 / (this.width * this.height)));
            this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
            this.dirtySize = false; this.paintDirty = true;
        }
        const stage = STAGES[selection], points = this.points(stage.world), reducedMotion = this.media.matches;
        const signature = `${selection}|${save.completed.join(',')}|${save.seals.join(',')}|${save.secrets.join(',')}|${warning}|${toast}`;
        if (reducedMotion && !this.paintDirty && !this.geometryDirty && signature === this.lastSignature) return;
        if (this.selection !== selection || this.geometryDirty) {
            const old = this.geometryDirty ? -1 : this.selection;
            this.geometryDirty = false;
            const requested = old < 0 ? [points[selection]] : buildTravelPath(old, selection, points,
                stage.world === 1 ? this.metadata.routes : {}, save.secrets.includes(`${stage.world}-3`), stage.world === 1 ? this.metadata.secretRoute : []);
            const previousProgress = this.travelDuration ? Math.min(1, (time - this.travelStarted) / this.travelDuration) : 1;
            const continuing = old >= 0 && Math.floor(old / 5) === Math.floor(selection / 5) && previousProgress < 1;
            const easedProgress = easeMapMotion(previousProgress, reducedMotion);
            const next = continuing ? retargetMapTravel(this.travel, easedProgress, requested, this.travelHistory) : requested;
            this.travelHistory = continuing ? recordMapTravel(this.travelHistory, this.travel, easedProgress) : [];
            this.travel = next;
            this.travelStarted = time; this.travelDuration = this.travel.length > 1 ? Math.min(1800, 540 + Math.abs(selection - old) * 250) : 0;
            this.selection = selection;
        }
        const progress = this.travelDuration ? Math.min(1, (time - this.travelStarted) / this.travelDuration) : 1;
        const previous = this.marker;
        this.marker = samplePath(this.travel, easeMapMotion(progress, reducedMotion));
        let target = getMapCamera(selection, { overview: this.overview }, this.width, this.height);
        const opening = reducedMotion ? 1 : Math.min(1, (time - this.shownAt) / 1600);
        const focus = points[selection];
        const portrait = this.width < 600;
        const fitHeight = Math.min(this.width / 1.6, this.height);
        const closeZoom = portrait ? Math.min(1.25, Math.max(.45, (this.height - 140) / (fitHeight * .93))) : 1.04;
        target.zoom = (stage.world !== 1 ? Math.min(.82, closeZoom) : closeZoom) * (.84 + .16 * easeMapMotion(opening, reducedMotion));
        target.center = { x: .5 + (focus.x - .5) * .12,
            y: .52 + (focus.y - .52) * .035 - (portrait ? 60 / (fitHeight * target.zoom) : 0) };
        target = frameMapPins(target, points, selection, portrait, stage.world === 1 && this.assets.island ? COSTA_ART_BOUNDS : undefined);
        // Keep panorama distinct even when a short scene has already constrained close zoom.
        if (this.overview) target.zoom *= .82;
        const dt = Math.max(0, Math.min(80, time - this.lastTime)); this.lastTime = time;
        const blend = reducedMotion ? 1 : 1 - Math.exp(-dt / 260);
        this.camera = { ...target, center: { x: this.camera.center.x + (target.center.x - this.camera.center.x) * blend, y: this.camera.center.y + (target.center.y - this.camera.center.y) * blend }, zoom: this.camera.zoom + (target.zoom - this.camera.zoom) * blend };
        this.camera = frameMapPins(this.camera, points, selection, portrait, stage.world === 1 && this.assets.island ? COSTA_ART_BOUNDS : undefined);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ctx.imageSmoothingEnabled = true;
        paintWorldMap(this.ctx, { camera: this.camera, world: stage.world, time, reducedMotion, metadata: this.metadata, assets: this.assets,
            secret: save.secrets.includes(`${stage.world}-3`), completed: save.completed, marker: this.marker, walking: progress < 1, facingLeft: this.marker.x < previous.x });
        for (let i = 0; i < 5; i++) {
            const q = mapToScreen(points[(stage.world - 1) * 5 + i], this.camera);
            this.nodes[i].style.transform = `translate(${q.x}px, ${q.y - (i === stage.number - 1 ? mapActorScale(this.camera) * 26 + 4 : 0)}px) translate(-50%, -100%)`;
        }
        this.paintDirty = false;
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;
        const island = ISLANDS[stage.world - 1], open = isUnlocked(stage.id, save), completed = save.completed.includes(stage.id);
        this.subtitle.textContent = island.description;
        this.title.textContent = island.name; this.worldNumber.textContent = `ARQUIPÉLAGO  /  ILHA ${String(stage.world).padStart(2, '0')}`;
        this.progress.textContent = `${save.completed.length}/30 fases  ·  ✦ ${save.seals.length}/72 selos`;
        this.chapter.textContent = `${stage.id}  ·  ${stage.world === 1 ? LANDMARKS[stage.number - 1] : 'Próxima travessia'}`;
        this.stageName.textContent = stage.name;
        this.description.textContent = stage.world === 1 ? STAGE_NOTES[stage.number - 1] : island.description;
        const sealCount = save.seals.filter(id => id.startsWith(stage.id + ':')).length;
        this.seals.textContent = stage.encounter ? (completed ? '✦ Encontro vencido' : '⚑ Encontro') : `${'◆'.repeat(sealCount)}${'◇'.repeat(3 - sealCount)}  ${sealCount}/3`;
        this.play.disabled = !open; this.play.textContent = open ? completed ? 'Jogar de novo  →' : 'Jogar fase  →' : 'Fase bloqueada';
        this.routeHint.textContent = save.secrets.includes(`${stage.world}-3`) ? '✦ Atalho 3 → 5 descoberto' : !open ? 'Conclua o caminho anterior para abrir' : 'Há sempre outro caminho para descobrir';
        this.routeHint.classList.toggle('is-secret', save.secrets.includes(`${stage.world}-3`));
        this.announcer.textContent = `${stage.id}, ${stage.name}. ${open ? completed ? 'Concluída.' : 'Disponível.' : 'Bloqueada.'} ${stage.encounter ? '' : `${sealCount} de 3 selos.`}`;
        this.warning.textContent = toast || warning; this.warning.hidden = !this.warning.textContent;
        for (let n = 0; n < 5; n++) {
            const id = `${stage.world}-${n + 1}`, s = STAGES[(stage.world - 1) * 5 + n], node = this.nodes[n];
            node.classList.toggle('is-selected', n === stage.number - 1); node.classList.toggle('is-completed', save.completed.includes(id)); node.classList.toggle('is-locked', !isUnlocked(id, save));
            node.setAttribute('aria-pressed', String(n === stage.number - 1));
            node.setAttribute('aria-label', `${id}: ${s.name}, ${isUnlocked(id, save) ? save.completed.includes(id) ? 'concluída' : 'disponível' : 'bloqueada'}`);
            node.title = s.name;
        }
        this.worlds.forEach((b, i) => {
            b.classList.toggle('is-current', i + 1 === stage.world); b.classList.toggle('is-locked', !isUnlocked(`${i + 1}-1`, save));
            b.setAttribute('aria-current', i + 1 === stage.world ? 'location' : 'false');
            b.setAttribute('aria-label', `Ilha ${i + 1}: ${ISLANDS[i].name}${isUnlocked(`${i + 1}-1`, save) ? '' : ', bloqueada'}`);
        });
    }
}
