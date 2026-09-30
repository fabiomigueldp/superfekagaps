import { STAGES } from './campaign';
import { isUnlocked } from './progress';
import type { AdventureSave } from './types';
import { clampMapSelection, getMapCamera, mapToScreen, moveMapSelection, type MapCamera, type MapPoint } from './WorldMapModel';
import { COSTA_ART_BOUNDS, fallbackMapMetadata, frameMapPins, mapActorScale, mapAssetPrefix, paintMapActor, paintMapIsland, paintMapSea, parseMapMetadata, type MapArtAssets, type MapArtMetadata } from './WorldMapArt';
import { WorldMapHud, type WorldMapMotionState } from './WorldMapHud';
import { COAST_PORT_PLACEMENTS, getAtlasCamera, atlasTravelWindow, localToAtlas } from './WorldAtlasModel';
import { atlasActorScale, atlasBoatBounds, paintWorldAtlas, type AtlasBoat, type AtlasIslandLayer } from './WorldAtlasArt';
import { buildJourneyNetwork, parseJourneyBoat, parseJourneyConnection, type JourneyBoatMetadata, type JourneyConnection } from './WorldJourneyNetwork';
import { advanceJourney, canEnterJourney, createJourney, enterJourney, journeyBlockReason, journeyMode, returnToJourney, selectJourney, skipJourney, type JourneyCapabilities, type JourneyNetwork, type JourneyState } from './WorldJourneyModel';
import { ART } from '../graphics/palette';

interface MapCallbacks { select(index: number): void; enter(): void; exit(): void; unlockAudio(): void; arrive?(index: number): void }
interface CachedMapArt { assets: MapArtAssets; metadata: MapArtMetadata; status: 'loading' | 'ready' | 'failed' }
export interface MapReturnContext { playedStage: string; nextSelected: string }
const EMPTY_ART = (): MapArtAssets => ({ island: null, shadow: null, port: null });
const worldOf = (id: string) => Number(id.split('-')[0]);
const indexOf = (id: string) => Math.max(0, STAGES.findIndex(stage => stage.id === id));
export function moveJourneySelection(index: number, key: string): number {
    const direction = key.toLowerCase();
    if (['arrowup', 'w', 'arrowdown', 's'].includes(direction)) {
        const world = Math.floor(clampMapSelection(index) / 5), next = Math.max(0, Math.min(5, world + (['arrowup', 'w'].includes(direction) ? -1 : 1)));
        return next === world ? clampMapSelection(index) : next * 5;
    }
    return moveMapSelection(index, key);
}
/** Matches samplePath's camera-aspect-adjusted distance exactly. */
export function journeyPathSegment(points: readonly MapPoint[], progress: number): number {
    const lengths = points.slice(1).map((point, index) => Math.hypot((point.x - points[index].x) * 1.6, point.y - points[index].y));
    let distance = lengths.reduce((sum, length) => sum + length, 0) * Math.max(0, Math.min(1, progress));
    for (let index = 0; index < lengths.length; index++) {
        if (lengths[index] > 0 && distance < lengths[index]) return index;
        distance -= lengths[index];
    }
    return Math.max(0, lengths.length - 1);
}
const placementFor = (world: number) => COAST_PORT_PLACEMENTS[world] ?? { origin: { x: 0, y: 0 }, scale: 1 };

export interface MapControlPlacement extends MapPoint { width: number; height: number }
export interface MapControlBounds { left: number; top: number; right: number; bottom: number }
const controlRect = (point: MapControlPlacement): MapControlBounds => ({
    left: point.x - point.width / 2, right: point.x + point.width / 2, top: point.y - point.height, bottom: point.y,
});
const controlsIntersect = (a: MapControlBounds, b: MapControlBounds, gap: number): boolean =>
    a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;

/** Screen-space labels may move; the authored geography and journey never do.
 * Keep the nearest free placement, testing the complete native hit rectangles.
 * Priority follows input order, so phase signs keep their established positions
 * and a dock sign first looks for free water beside its actual landing point.
 */
export function layoutMapControls(points: readonly MapControlPlacement[], bounds: MapControlBounds, gap = 8,
    previousOffsets: readonly (MapPoint | undefined)[] = []): MapControlPlacement[] {
    if (!points.length) return [];
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
    const tryOrder = (order: number[]): MapControlPlacement[] | null => {
        const result: MapControlPlacement[] = [], occupied: MapControlBounds[] = [];
        for (const index of order) {
            const point = points[index], minX = Math.ceil(bounds.left + point.width / 2), maxX = Math.floor(bounds.right - point.width / 2);
            const minY = Math.ceil(bounds.top + point.height), maxY = Math.floor(bounds.bottom);
            if (minX > maxX || minY > maxY) return null;
            const xs = new Set([point.x, minX, maxX].map(x => clamp(x, minX, maxX)));
            const ys = new Set([point.y, minY, maxY].map(y => clamp(y, minY, maxY)));
            const previous = previousOffsets[index];
            if (previous) {
                xs.add(clamp(point.x + previous.x * .7, minX, maxX));
                ys.add(clamp(point.y + previous.y * .7, minY, maxY));
            }
            for (const rect of occupied) {
                xs.add(clamp(rect.left - gap - point.width / 2, minX, maxX));
                xs.add(clamp(rect.right + gap + point.width / 2, minX, maxX));
                ys.add(clamp(rect.top - gap, minY, maxY));
                ys.add(clamp(rect.bottom + gap + point.height, minY, maxY));
            }
            let best: MapControlPlacement | null = null, bestCost = Infinity;
            for (const x of xs) for (const y of ys) {
                const candidate = { ...point, x, y }, rect = controlRect(candidate);
                if (occupied.some(other => controlsIntersect(rect, other, gap))) continue;
                const dx = x - point.x, dy = y - point.y;
                // Prefer the established side while the camera eases; when the
                // obstruction clears, return toward the terrain in small steps.
                const cost = dx ** 2 + dy ** 2 * 1.2 + (previous ? 4 * ((dx - previous.x * .7) ** 2 + (dy - previous.y * .7) ** 2) : 0);
                if (cost < bestCost) { best = candidate; bestCost = cost; }
            }
            if (!best) return null;
            result[index] = best; occupied.push(controlRect(best));
        }
        return result;
    };
    const order = points.map((_, index) => index);
    const placed = tryOrder(order) ?? tryOrder([...order].sort((a, b) => points[b].width - points[a].width));
    if (placed) return placed;
    // A very short overview can fragment all free space. Use the minimum number
    // of compact rows only as a last resort; leaders still identify each place.
    const rows: number[][] = [[]]; let rowWidth = 0;
    for (const index of [...order].sort((a, b) => points[a].x - points[b].x)) {
        if (rowWidth && rowWidth + gap + points[index].width > bounds.right - bounds.left) { rows.push([]); rowWidth = 0; }
        rows[rows.length - 1].push(index); rowWidth += (rowWidth ? gap : 0) + points[index].width;
    }
    const heights = rows.map(row => Math.max(...row.map(index => points[index].height)));
    const totalHeight = heights.reduce((sum, height) => sum + height, 0) + gap * (rows.length - 1);
    let top = clamp(points.reduce((sum, point) => sum + point.y, 0) / points.length - totalHeight / 2, bounds.top, bounds.bottom - totalHeight);
    const result: MapControlPlacement[] = [];
    rows.forEach((row, rowIndex) => {
        const width = row.reduce((sum, index) => sum + points[index].width, 0) + gap * (row.length - 1);
        let left = Math.round(bounds.left + (bounds.right - bounds.left - width) / 2);
        for (const index of row) { result[index] = { ...points[index], x: left + points[index].width / 2, y: top + points[index].height }; left += points[index].width + gap; }
        top += heights[rowIndex] + gap;
    });
    return result;
}

/** One map-owned state machine, one mount, and the game's existing animation clock. */
export class WorldMapView {
    readonly hud: WorldMapHud;
    readonly root: HTMLElement;
    private readonly scene: HTMLElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly media = window.matchMedia('(prefers-reduced-motion: reduce)');
    private readonly abort = new AbortController();
    private readonly artCache = new Map<number, CachedMapArt>();
    /** Active snapshots never change underneath an in-flight authored edge. */
    private readonly pairLoads = new Map<number, Promise<void>>();
    private connectionStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    private connection: JourneyConnection | null = null;
    private boatMetadata: JourneyBoatMetadata | null = null;
    private boatImage: HTMLImageElement | null = null;
    private readonly dockImages = new Map<number, HTMLImageElement>();
    private connectionActive = false;
    private assetWarning = '';
    private boatHeadingIndex = -1;
    private boatHeadingAt = 0;
    private readonly activeArt = new Map<number, CachedMapArt>();
    private journey: JourneyState | null = null;
    private network: JourneyNetwork = { nodes: {}, edges: [] };
    private capabilities: JourneyCapabilities = { availableStages: [] };
    private save: AdventureSave | null = null;
    private visible = false;
    private disposed = false;
    private selection = -1;
    private controlSelection = 0;
    private geometryDirty = true;
    private overview = false;
    private lastTime = 0;
    private lastSignature = '';
    private reportedArrival = '';
    private cameraSnap = true;
    private camera: MapCamera = getMapCamera(0, { overview: true }, 1, 1);
    private marker: MapPoint = { x: 0, y: 0 };
    private facingLeft = false;
    private width = 1;
    private height = 1;
    private frameInsets = { top: 90, bottom: 120 };
    private dpr = 1;
    private screenDpr = 0;
    private dirtySize = true;
    private paintDirty = true;
    private restoreTabIndex: string | null = null;
    private readonly resizeObserver: ResizeObserver;
    private readonly onResize = () => { this.dirtySize = true; this.paintDirty = true; };
    private readonly onMotion = () => { this.paintDirty = true; };
    private readonly controlOffsets = new Map<string, MapPoint>();

    constructor(private readonly gameCanvas: HTMLCanvasElement, private readonly callbacks: MapCallbacks) {
        this.hud = new WorldMapHud({
            selectStage: index => this.act(() => this.select(index)),
            selectWorld: world => this.act(() => this.select((world - 1) * 5)),
            enter: () => this.act(() => this.enterSelected(this.controlSelection)),
            skip: () => this.act(() => this.skip()),
            overview: () => this.act(() => { this.overview = !this.overview; this.paintDirty = true; this.refreshHud(); }),
            menu: () => this.act(() => callbacks.exit()),
        });
        this.root = this.hud.root; this.scene = this.hud.scene; this.canvas = this.hud.canvas;
        this.ctx = this.canvas.getContext('2d', { alpha: false })!;
        this.root.addEventListener('keydown', this.onKey);
        document.body.append(this.root);
        this.resizeObserver = new ResizeObserver(this.onResize);
        for (const surface of [this.scene, this.hud.header, this.hud.tools, this.hud.footer]) this.resizeObserver.observe(surface);
        window.addEventListener('resize', this.onResize); this.media.addEventListener('change', this.onMotion);
    }
    private act(action: () => void) { if (this.visible && !this.disposed) { this.callbacks.unlockAudio(); action(); } }
    private select(index: number) { this.selectDestination(index); this.callbacks.select(this.controlSelection); }
    selectDestination(index: number): void {
        const selection = clampMapSelection(index);
        this.controlSelection = selection;
        if (!this.visible || !this.journey || !this.save || this.journey.entered) return;
        this.requestDestination(selection);
        this.refreshHud();
    }
    /** Both DOM and legacy global shortcuts consume this exact single-use gate. */
    enterSelected(index: number): boolean {
        if (!this.visible || this.disposed || !this.journey || clampMapSelection(index) !== this.controlSelection ||
            this.journey.selected !== STAGES[this.controlSelection].id) return false;
        const next = enterJourney(this.journey, this.capabilities);
        if (next === this.journey) return false;
        this.journey = next; this.refreshHud(); this.callbacks.enter(); return true;
    }
    private skip(): void {
        if (!this.journey) return;
        this.journey = skipJourney(this.journey); this.paintDirty = true;
        this.reportArrival(); this.refreshHud();
    }
    private readonly onKey = (event: KeyboardEvent) => {
        if (!this.visible || event.defaultPrevented || !this.hud.regionMenu.hidden || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
        const next = moveJourneySelection(this.controlSelection, event.key);
        if (next !== this.controlSelection) {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.select(next)); this.hud.focusStage(next);
        } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(event.key.toLowerCase())) {
            event.preventDefault(); event.stopPropagation();
        } else if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.callbacks.exit());
        } else if (event.key === 'Enter' && event.target === this.hud.stageButtons[this.controlSelection % 5]) {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.enterSelected(this.controlSelection));
        } else if ((event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault(); event.stopPropagation(); this.act(() => this.enterSelected(this.controlSelection));
        }
    };
    private loadImage(path: string): Promise<HTMLImageElement | null> {
        return new Promise(resolve => {
            const image = new Image(); image.decoding = 'async';
            const finish = (result: HTMLImageElement | null) => { image.onload = null; image.onerror = null; resolve(result); };
            image.onload = () => finish(image); image.onerror = () => finish(null); image.src = path;
        });
    }
    private ensureWorld(world: number): void {
        if (this.artCache.has(world)) return;
        const cached: CachedMapArt = { assets: EMPTY_ART(), metadata: fallbackMapMetadata(world), status: world <= 2 ? 'loading' : 'ready' };
        this.artCache.set(world, cached);
        if (world <= 2) this.pairLoads.set(world, this.loadAssets(world, cached));
    }
    private ensureArt(world: number): void {
        if (world <= 2) { this.ensureWorld(world); this.ensureWorld(world === 1 ? 2 : 1); if (this.connectionStatus === 'idle') void this.loadConnection(); }
        else this.ensureWorld(world);
    }
    private async loadAssets(world: number, cached: CachedMapArt): Promise<void> {
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const name = world === 1 ? 'costa-diorama' : 'porto-diorama';
        const mainImage = this.loadImage(prefix + name + '.webp');
        const mainMetadata = fetch(prefix + name + '.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).then(value => parseMapMetadata(value, world)).catch(() => null);
        if (world === 1) void this.loadImage(prefix + 'costa-shadow.webp').then(image => {
            if (this.abort.signal.aborted) return;
            cached.assets.shadow = image;
            const active = this.activeArt.get(world);
            if (active) active.assets.shadow = image;
            if (worldOf(this.journey?.selected ?? '') <= 2) this.paintDirty = true;
        });
        const [island, metadata] = await Promise.all([mainImage, mainMetadata]);
        if (this.abort.signal.aborted) return;
        cached.status = island && metadata ? 'ready' : 'failed';
        if (island && metadata) { cached.assets.island = island; cached.metadata = metadata; }
        else this.assetWarning = 'A travessia visual não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    private crossingFailed(): boolean {
        return this.connectionStatus === 'failed' || [1, 2].some(world => this.artCache.get(world)?.status === 'failed');
    }
    private async loadConnection(): Promise<void> {
        this.connectionStatus = 'loading';
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const json = (name: string) => fetch(prefix + name, { signal: this.abort.signal }).then(response => response.ok ? response.json() : null).catch(() => null);
        const [raw, rawBoat] = await Promise.all([json('coast-port-journey.meta.json'), json('journey-boat.meta.json'),
            this.pairLoads.get(1), this.pairLoads.get(2)]);
        if (this.abort.signal.aborted) return;
        const coast = this.artCache.get(1), port = this.artCache.get(2);
        const connection = coast?.status === 'ready' && port?.status === 'ready' ? parseJourneyConnection(raw, coast.metadata, port.metadata) : null;
        const boat = parseJourneyBoat(rawBoat);
        const path = (asset: string) => prefix + asset.slice('/assets/world/map/'.length);
        if (connection && boat) {
            const [coastDock, portDock, image] = await Promise.all([this.loadImage(path(connection.docks[1].overlay.path)),
                this.loadImage(path(connection.docks[2].overlay.path)), this.loadImage(path(boat.atlas.path))]);
            if (this.abort.signal.aborted) return;
            const sized = (image: HTMLImageElement | null, size: { width: number; height: number }) => !!image && image.naturalWidth === size.width && image.naturalHeight === size.height;
            if (sized(coastDock, connection.docks[1].overlay) && sized(portDock, connection.docks[2].overlay) && sized(image, boat.atlas)) {
                this.connection = connection; this.boatMetadata = boat; this.boatImage = image;
                this.dockImages.set(1, coastDock!); this.dockImages.set(2, portDock!); this.connectionStatus = 'ready';
            } else this.connectionStatus = 'failed';
        } else this.connectionStatus = 'failed';
        if (this.connectionStatus === 'failed') this.assetWarning = 'A travessia visual não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    show(time: number): void {
        if (this.visible || this.disposed) return;
        this.visible = true; this.hud.setVisible(true); this.lastTime = time; this.dirtySize = true; this.cameraSnap = true;
        this.controlOffsets.clear();
        this.journey = null; this.boatHeadingIndex = -1; this.selection = -1; this.lastSignature = ''; this.geometryDirty = true;
        this.restoreTabIndex = this.gameCanvas.getAttribute('tabindex');
        this.gameCanvas.setAttribute('tabindex', '-1'); this.gameCanvas.setAttribute('aria-hidden', 'true');
        this.gameCanvas.style.visibility = 'hidden'; this.root.focus({ preventScroll: true });
    }
    hide(): void {
        if (!this.visible) return;
        this.visible = false; this.hud.setVisible(false);
        this.gameCanvas.style.visibility = ''; this.gameCanvas.removeAttribute('aria-hidden');
        if (this.restoreTabIndex === null) this.gameCanvas.removeAttribute('tabindex'); else this.gameCanvas.setAttribute('tabindex', this.restoreTabIndex);
        this.gameCanvas.focus({ preventScroll: true });
    }
    dispose(): void {
        if (this.disposed) return;
        this.hide(); this.disposed = true; this.abort.abort(); this.resizeObserver.disconnect();
        window.removeEventListener('resize', this.onResize); this.media.removeEventListener('change', this.onMotion);
        this.root.removeEventListener('keydown', this.onKey); this.hud.dispose();
    }
    private rebuildNetwork(): void {
        for (let world = 1; world <= 6; world++) {
            const cached = this.artCache.get(world);
            this.activeArt.set(world, cached ? { ...cached, assets: { ...cached.assets } } : { metadata: fallbackMapMetadata(world), assets: EMPTY_ART(), status: 'ready' });
        }
        this.connectionActive = this.connectionStatus === 'ready' && [1, 2].every(world => this.activeArt.get(world)?.status === 'ready');
        this.network = buildJourneyNetwork({ islands: [...this.activeArt].map(([world, art]) => ({ world, metadata: art.metadata, placement: placementFor(world), ready: !!art.assets.island })),
            secrets: this.save?.secrets ?? [], connection: this.connection, connectionReady: this.connectionActive });
        this.geometryDirty = false;
    }
    private requestDestination(selection: number): void {
        if (!this.journey) return;
        const id = STAGES[selection].id, world = worldOf(id), currentWorld = worldOf(this.journey.arrived);
        if (this.journey.selected === id && this.selection === selection && !this.journey.blocked) return;
        this.ensureArt(world); this.selection = selection;
        // Regions beyond this slice retain their existing menu handoff. No sea route is fabricated.
        if (world !== currentWorld && (world > 2 || currentWorld > 2 || this.crossingFailed()) && this.capabilities.availableStages.includes(id))
            this.journey = createJourney(id, this.network, this.capabilities);
        else this.journey = selectJourney(this.journey, id, this.network, this.capabilities, { reducedMotion: this.media.matches });
        this.paintDirty = true; this.reportArrival();
    }
    private reportArrival(): void {
        if (!this.journey || this.reportedArrival === this.journey.arrived) return;
        this.reportedArrival = this.journey.arrived; this.callbacks.arrive?.(indexOf(this.journey.arrived));
    }
    private motionState(): WorldMapMotionState {
        const mode = this.journey && journeyMode(this.journey);
        return mode === 'walk' ? 'walking' : mode === 'board' ? 'boarding' : mode === 'sail' ? 'sailing' : mode === 'disembark' ? 'arriving' : 'idle';
    }
    private refreshHud(warning = '', toast = ''): void {
        if (!this.save || !this.journey) return;
        const stage = STAGES[this.controlSelection], world = stage.world;
        this.hud.update({ world, stage: this.controlSelection,
            open: Array.from({ length: 5 }, (_, n) => isUnlocked(`${world}-${n + 1}`, this.save!)),
            completed: Array.from({ length: 5 }, (_, n) => this.save!.completed.includes(`${world}-${n + 1}`)),
            seals: Array.from({ length: 5 }, (_, n) => this.save!.seals.filter(id => id.startsWith(`${world}-${n + 1}:`)).length),
            globalProgress: { completed: this.save.completed.length, seals: this.save.seals.length },
            motionState: this.motionState(), canEnter: canEnterJourney(this.journey, this.capabilities),
            hint: this.journey.blocked === 'no-route' && this.connectionStatus === 'loading' ? 'Preparando o barco e os cais… Você pode escolher outra fase ou voltar ao menu.' : journeyBlockReason(this.journey) || (this.save.secrets.includes(`${world}-3`) ? 'Atalho 3 → 5 descoberto!' : ''),
            warnings: [toast || warning, this.assetWarning], worldAvailability: Array.from({ length: 6 }, (_, n) => isUnlocked(`${n + 1}-1`, this.save!)),
            preview: !!this.journey.blocked, overview: this.overview,
        });
    }
    private measure(): void {
        const bounds = this.scene.getBoundingClientRect(); this.width = Math.max(1, bounds.width); this.height = Math.max(1, bounds.height);
        const headerBottom = Math.max(this.hud.header.getBoundingClientRect().bottom, this.hud.tools.getBoundingClientRect().bottom);
        this.frameInsets = { top: Math.max(16, Math.min(this.height * .35, headerBottom - bounds.top + 14)),
            bottom: Math.max(12, Math.min(this.height * .48, bounds.top + this.height - this.hud.footer.getBoundingClientRect().top + 12)) };
        this.screenDpr = window.devicePixelRatio || 1;
        this.dpr = Math.min(2, this.screenDpr, Math.sqrt(4_000_000 / (this.width * this.height)));
        this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
        this.dirtySize = false; this.paintDirty = true; this.cameraSnap = true;
        this.controlOffsets.clear();
    }
    render(selection: number, save: AdventureSave, time: number, warning: string, toast = '', returned?: MapReturnContext): void {
        if (this.disposed || document.hidden) return;
        this.show(time); this.save = save; this.controlSelection = clampMapSelection(selection);
        this.capabilities = { availableStages: STAGES.filter(stage => isUnlocked(stage.id, save)).map(stage => stage.id) };
        this.ensureArt(STAGES[this.controlSelection].world); this.ensureArt(worldOf(returned?.playedStage ?? save.selected));
        const progressSignature = save.secrets.join(',');
        if (this.lastSignature.split('|')[0] !== progressSignature) this.geometryDirty = true;
        if (this.geometryDirty && !this.journey?.destination) {
            const previous = this.journey; this.rebuildNetwork();
            if (previous && !previous.entered) this.journey = createJourney(previous.arrived, this.network, this.capabilities);
            this.selection = -1;
        }
        if (!this.journey || returned) {
            this.journey = returned ? returnToJourney(returned.playedStage, returned.nextSelected, this.network, this.capabilities, { reducedMotion: this.media.matches })
                : createJourney(save.selected, this.network, this.capabilities);
            this.reportedArrival = save.selected; this.selection = -1;
        }
        this.requestDestination(this.controlSelection);
        const dt = Math.max(0, Math.min(100, time - this.lastTime)); this.lastTime = time;
        const previous = this.journey.point;
        this.journey = advanceJourney(this.journey, dt / 1000, this.media.matches);
        this.marker = this.journey.point;
        if (Math.abs(previous.x - this.marker.x) > 1e-8) this.facingLeft = this.marker.x < previous.x;
        this.reportArrival(); this.refreshHud(warning, toast);
        if (this.dirtySize || this.screenDpr !== (window.devicePixelRatio || 1)) this.measure();
        const signature = `${progressSignature}|${this.controlSelection}|${save.completed.join(',')}|${save.seals.join(',')}|${warning}|${toast}|${this.overview}|${this.journey.arrived}|${this.journey.destination}|${this.journey.blocked}`;
        if (this.media.matches && !this.paintDirty && !this.geometryDirty && signature === this.lastSignature) return;
        this.lastSignature = signature;
        const stage = STAGES[this.controlSelection], actualWorld = worldOf(this.journey.arrived);
        const connected = stage.world <= 2 && actualWorld <= 2;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ctx.imageSmoothingEnabled = true;
        if (connected) this.paintAtlas(stage.world, save, time, dt);
        else this.paintSingle(stage.world, save, time);
        this.paintDirty = false;
    }
    private currentBoat(): AtlasBoat | undefined {
        if (!this.connectionActive || !this.connection || !this.boatMetadata || !this.boatImage) return;
        const active = this.journey!.legs[0];
        let world = worldOf(this.journey!.arrived) as 1 | 2;
        if (active && active.mode !== 'sail') world = worldOf(active.from) as 1 | 2;
        if (world !== 1 && world !== 2) world = 1;
        const dock = this.connection.docks[world];
        let frame = this.boatMetadata.frames[dock.berth.headingFrame], foot = localToAtlas(dock.berth.passenger, placementFor(world));
        if (active?.mode === 'sail') {
            foot = this.marker;
            const segment = journeyPathSegment(active.points, active.progress);
            const headings = active.direction === 1 ? this.connection.segmentHeadings : this.connection.reverseSegmentHeadings;
            const heading = headings[active.direction === 1 ? segment : active.points.length - 2 - segment];
            const remaining = active.duration * (active.direction === 1 ? 1 - active.progress : active.progress);
            const arrivalWorld = (active.direction === 1 ? 2 : 1) as 1 | 2;
            frame = this.boatMetadata.frames[remaining < .65 ? this.connection.docks[arrivalWorld].berth.headingFrame : heading];
        }
        if (this.boatHeadingIndex < 0 || this.media.matches || !active) { this.boatHeadingIndex = frame.index; this.boatHeadingAt = this.lastTime; }
        else if (this.boatHeadingIndex !== frame.index && this.lastTime - this.boatHeadingAt >= 120) {
            const turn = (frame.index - this.boatHeadingIndex + 8) % 8;
            this.boatHeadingIndex = (this.boatHeadingIndex + (turn <= 4 ? 1 : 7)) % 8; this.boatHeadingAt = this.lastTime;
        }
        frame = this.boatMetadata.frames[this.boatHeadingIndex];
        return { foot, frame, assets: { rear: this.boatImage, foreground: this.boatImage } };
    }
    private paintAtlas(world: number, save: AdventureSave, time: number, dt: number): void {
        const islands: AtlasIslandLayer[] = ([1, 2] as const).map(id => ({ world: id, metadata: this.activeArt.get(id)!.metadata,
            placement: placementFor(id), assets: this.activeArt.get(id)!.assets, completed: save.completed, secret: save.secrets.includes(`${id}-3`),
            ...(this.connectionActive && this.connection ? { overlay: { ...this.connection.docks[id].overlay, image: this.dockImages.get(id)! } } : {}) }));
        const active = this.journey!.legs[0], channel = active?.mode === 'board' || active?.mode === 'sail';
        const activeWorld = active && active.mode !== 'sail' ? worldOf(active.from) : world;
        const boat = this.currentBoat();
        // A region preview frames that region. Feka and a moored boat may remain
        // offscreen on the origin island until a real trip begins or we return.
        const trackJourney = !!this.journey!.destination || this.overview || worldOf(this.journey!.arrived) === activeWorld;
        const trackedBoat = trackJourney ? boat : undefined;
        const waterRoute = this.connection?.sailRoute ?? active?.points ?? [];
        const travelPoints = channel ? this.width < 600 ? atlasTravelWindow(waterRoute, this.marker) : waterRoute : undefined;
        const target = getAtlasCamera({ mode: this.overview ? 'overview' : channel ? 'channel' : 'island', activeWorld,
            layers: islands, width: this.width, height: this.height, insets: { ...this.frameInsets, left: 16, right: 16 },
            focus: trackJourney ? this.marker : undefined,
            travelPoints, focusBounds: trackedBoat ? [atlasBoatBounds(trackedBoat.foot, trackedBoat.frame)] : undefined });
        this.camera = this.blendAtlasCamera(target, dt, trackedBoat);
        const aboard = active?.mode === 'sail' || (active?.mode === 'board' && active.progress > .45);
        paintWorldAtlas(this.ctx, { camera: this.camera, time, reducedMotion: this.media.matches, islands,
            actor: { point: this.marker, walking: !!active && active.mode !== 'sail', facingLeft: this.facingLeft, aboard }, boat });
        this.positionNodes(world, channel || activeWorld !== world, boat);
    }
    private blendAtlasCamera(target: MapCamera, dt: number, boat?: AtlasBoat): MapCamera {
        if (this.cameraSnap || this.media.matches) { this.cameraSnap = false; return target; }
        const blend = 1 - Math.exp(-dt / 180);
        const camera = { ...target, zoom: this.camera.zoom + (target.zoom - this.camera.zoom) * blend,
            center: { x: this.camera.center.x + (target.center.x - this.camera.center.x) * blend,
                y: this.camera.center.y + (target.center.y - this.camera.center.y) * blend } };
        if (!boat) return camera;
        // A moving boat remains fully inside the measured scene while the rest of
        // the composition catches up. This changes the camera, never geography.
        const bounds = atlasBoatBounds(boat.foot, boat.frame), base = Math.min(this.width / 1.6, this.height);
        const safe = { left: 28, right: this.width - 28, top: this.frameInsets.top + 12, bottom: this.height - this.frameInsets.bottom - 12 };
        const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
        camera.zoom = Math.min(camera.zoom, Math.max(.001, (safe.right - safe.left) / (width * base * 1.6)),
            Math.max(.001, (safe.bottom - safe.top) / (height * base)));
        const upper = mapToScreen({ x: bounds.left, y: bounds.top }, camera), lower = mapToScreen({ x: bounds.right, y: bounds.bottom }, camera);
        const actor = mapToScreen(this.marker, camera);
        const left = Math.min(upper.x, actor.x - 20), right = Math.max(lower.x, actor.x + 20);
        const top = Math.min(upper.y, actor.y - 44), bottom = Math.max(lower.y, actor.y + 8);
        const shiftX = left < safe.left ? left - safe.left : right > safe.right ? right - safe.right : 0;
        const shiftY = top < safe.top ? top - safe.top : bottom > safe.bottom ? bottom - safe.bottom : 0;
        camera.center.x += shiftX / (base * 1.6 * camera.zoom); camera.center.y += shiftY / (base * camera.zoom);
        return camera;
    }
    private paintSingle(world: number, save: AdventureSave, time: number): void {
        const cached = this.activeArt.get(world)!, points = Object.fromEntries(Object.entries(cached.metadata.nodes).map(([id, point]) => [indexOf(id), point]));
        let camera = getMapCamera(this.controlSelection, { overview: this.overview }, this.width, this.height);
        camera.zoom = Math.min(.82, camera.zoom); camera = frameMapPins(camera, points, this.controlSelection, this.width <= 640, cached.metadata.artBounds ?? (world === 1 ? COSTA_ART_BOUNDS : undefined), this.frameInsets);
        if (this.overview) camera.zoom *= .82; this.camera = camera; this.cameraSnap = true;
        paintMapSea(this.ctx, camera, time, this.media.matches);
        paintMapIsland(this.ctx, { camera, world, time, reducedMotion: this.media.matches, metadata: cached.metadata, assets: cached.assets, secret: save.secrets.includes(`${world}-3`), completed: save.completed });
        if (worldOf(this.journey!.arrived) === world) paintMapActor(this.ctx, { camera, marker: this.marker, time, reducedMotion: this.media.matches,
            walking: !!this.journey!.destination, facingLeft: this.facingLeft });
        this.positionNodes(world, false);
    }
    private positionNodes(world: number, hide: boolean, boat?: AtlasBoat): void {
        const anchors: MapPoint[] = [];
        const stages = Array.from({ length: 5 }, (_, n) => {
            if (hide) return null;
            const id = `${world}-${n + 1}`, point = this.network.nodes[id], screen = mapToScreen(point, this.camera);
            anchors[n] = screen;
            // Do not pull another island's offscreen signs into the current view
            // while the camera is still approaching that island.
            if (screen.x < 0 || screen.x > this.width || screen.y < this.frameInsets.top || screen.y > this.height - this.frameInsets.bottom) return null;
            return { x: screen.x + 36, y: screen.y };
        });
        const docks = ([1, 2] as const).map(destination => {
            if (hide || this.journey?.destination || world > 2 || !this.connectionActive || !this.connection) return null;
            // Buttons name their destination, so each sign stands at the opposite departure dock.
            const departure = destination === 1 ? 2 : 1;
            const point = mapToScreen(localToAtlas(this.connection.docks[departure].dock, placementFor(departure)), this.camera);
            return { ...point, visible: point.x > 8 && point.x < this.width - 8 && point.y > this.frameInsets.top && point.y < this.height - this.frameInsets.bottom,
                available: !!this.save && isUnlocked(`${destination}-1`, this.save) };
        });
        const visible = [...stages.map((point, n) => point ? { id: `stage:${world}-${n + 1}`, point, anchor: anchors[n], width: 56, height: 58 } : null),
            ...docks.map((point, n) => point?.visible ? { id: `dock:${n + 1}`, point, anchor: { x: point.x, y: point.y }, width: 104, height: 56 } : null)].filter((entry): entry is NonNullable<typeof entry> => !!entry);
        const positions = layoutMapControls(visible.map(({ point, width, height }) => ({ ...point, width, height })),
            { left: 8, right: this.width - 8, top: this.frameInsets.top + 2, bottom: this.height - this.frameInsets.bottom - 2 },
            8, this.media.matches ? [] : visible.map(entry => this.controlOffsets.get(entry.id)));
        const actor = mapToScreen(this.marker, this.camera), scale = world <= 2 ? atlasActorScale(this.camera, boat?.frame) : mapActorScale(this.camera);
        const obstacles = [{ left: actor.x - 10 * scale - 2, right: actor.x + 10 * scale + 2, top: actor.y - 28 * scale - 2, bottom: actor.y + 3 }];
        if (boat) {
            const bounds = atlasBoatBounds(boat.foot, boat.frame);
            const a = mapToScreen({ x: bounds.left, y: bounds.top }, this.camera), b = mapToScreen({ x: bounds.right, y: bounds.bottom }, this.camera);
            obstacles.push({ left: a.x - 2, right: b.x + 2, top: a.y - 2, bottom: b.y + 2 });
        }
        for (let index = 0; index < positions.length; index++) {
            const result = positions[index], point = visible[index].point;
            this.controlOffsets.set(visible[index].id, { x: result.x - point.x, y: result.y - point.y });
            if (Math.hypot(result.x - point.x, result.y - point.y) > 2) {
                const rect = controlRect(result), anchor = visible[index].anchor;
                const start = { x: Math.max(rect.left + 6, Math.min(rect.right - 6, anchor.x)),
                    y: anchor.y < rect.top ? rect.top + 14 : anchor.y > rect.bottom ? rect.bottom - 2 : anchor.y };
                // A small wooden leader keeps a displaced sign tied to the dock
                // or phase landing, even at browser zoom and during camera easing.
                this.ctx.save();
                // Separate clips intersect, so overlapping actor/boat bounds can
                // never cancel each other out and expose a line over the sprite.
                for (const obstacle of obstacles) {
                    this.ctx.beginPath(); this.ctx.rect(0, 0, this.width, this.height);
                    this.ctx.rect(obstacle.left, obstacle.top, obstacle.right - obstacle.left, obstacle.bottom - obstacle.top); this.ctx.clip('evenodd');
                }
                this.ctx.beginPath(); this.ctx.moveTo(Math.round(start.x), Math.round(start.y));
                this.ctx.lineTo(Math.round(anchor.x), Math.round(anchor.y));
                this.ctx.strokeStyle = ART.ink; this.ctx.lineWidth = 4; this.ctx.stroke();
                this.ctx.strokeStyle = ART.soilLight; this.ctx.lineWidth = 2; this.ctx.stroke(); this.ctx.restore();
            }
            point.x = result.x; point.y = result.y;
        }
        this.hud.positionNodes(stages, docks);
    }
}
