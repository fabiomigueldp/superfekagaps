import { campaignWaterRestored, campaignWaterOverlay, loadCampaignWaterImage } from './GuairaCampaignConsequences';
import { GuairaCampaignWaterMotion } from './GuairaCampaignWaterMotion';
import { campaignMapDirection, guairaTravelDirections } from './CampaignWayfinding';
import { DELICIA_ATLAS, DELICIA_ENTRY, DELICIA_MAP_IMAGE } from './delicia/DeliciaIsland';
import { lettering } from './delicia/DeliciaUI';
import { showGuairaRegion } from './WorldGuairaRegion';
import { GUAIRA_CAMPAIGN_ART, campaignTerrainBounds, campaignArtBounds, campaignArtOverlay, loadCampaignRegionImage, type GuairaCampaignRegion } from './GuairaCampaignArt';
import { STAGES } from './campaign';
import { isUnlocked } from './progress';
import type { AdventureSave } from './types';
import { clampMapSelection, getMapCamera, mapStagePrerequisite, mapToScreen, moveMapSelection, type MapCamera, type MapPoint } from './WorldMapModel';
import { COSTA_ART_BOUNDS, fallbackMapMetadata, frameMapPins, mapActorScale, mapAssetPrefix, paintMapActor, paintMapIsland, paintMapSea, parseMapMetadata, type MapArtAssets, type MapArtMetadata } from './WorldMapArt';
import { WorldMapHud, WORLD_MAP_TRAVEL_ACTIONS, WORLD_MAP_TRAVEL_ACTION_IDS,
    type WorldMapMotionState, type WorldMapHudPoint, type WorldMapTravelActionId } from './WorldMapHud';
import { WORLD_ATLAS_PLACEMENTS, getAtlasCamera, atlasTravelWindow, atlasIslandBounds, localToAtlas, type AtlasBounds } from './WorldAtlasModel';
import { atlasActorBounds, atlasActorScale, atlasBoatBounds, paintWorldAtlas, type AtlasBoat, type AtlasIslandLayer } from './WorldAtlasArt';
import { buildJourneyNetwork, parseJourneyBoat, parseJourneyConnection, parseJourneyBridge, PORT_FACTORY_BRIDGE_EDGE,
    type JourneyBoatMetadata, type JourneyConnection, type JourneyBridge } from './WorldJourneyNetwork';
import { advanceJourney, canEnterJourney, createJourney, enterJourney, journeyBlockReason, journeyMode, returnToJourney, selectJourney, skipJourney, type JourneyCapabilities, type JourneyNetwork, type JourneyState } from './WorldJourneyModel';
import { ART } from '../graphics/palette';
import { SERRA_CABLE_PAIR, parseSerraMaintenanceCable, matchesSerraAssetSize,
    type SerraMaintenanceCable } from './WorldSerraJourney';
import { cableEdgeDirections, createCablePair, sampleCablePair, updateCablePairAfterTravel,
    type CablePairDefinition, type CablePairState, type CableFootPaths } from './WorldCableModel';
import { atlasCableBounds, type AtlasCableCar } from './WorldCableArt';
import { PASSENGER_CABLE_PAIR, parseReservaPassengerCable, type ReservaPassengerCable } from './WorldReservaJourney';
import { COAST_PORT_FERRY, createFerry, ferryEdgeDirections, sampleFerry, updateFerryAfterTravel,
    type FerryDefinition, type FerryState } from './WorldFerryModel';
import { DOMINIO_FERRY, parseDominioJourney, matchesDominioAssetSize, type DominioJourneyConnection } from './WorldDominioJourney';
import { MARITIME_BUOY_SPRITES, parseMaritimeBuoys, type MaritimeBuoyKind, type MaritimeBuoyMetadata } from './WorldMaritimeArt';
export { journeyPathSegment } from './WorldFerryModel';

interface MapCallbacks { guaira?(from: 'factory' | 'serra'): void; select(index: number): void; enter(): void; exit(): void; unlockAudio(): void; arrive?(index: number): void }
interface CachedMapArt { assets: MapArtAssets; metadata: MapArtMetadata; status: 'loading' | 'ready' | 'failed' }
interface CableLineView {
    definition: CablePairDefinition;
    state: CablePairState;
    metadata: SerraMaintenanceCable | ReservaPassengerCable;
    paths: CableFootPaths;
    image: HTMLImageElement;
}
interface FerryLineView {
    definition: FerryDefinition;
    state: FerryState;
    docks: Readonly<Record<number, { berth: { passenger: MapPoint; headingFrame: number }; aboardProgress?: number }>>;
    segmentHeadings: readonly number[];
    reverseSegmentHeadings: readonly number[];
    sailRoute: readonly MapPoint[];
}
export interface MapReturnContext { playedStage: string; nextSelected: string }
const EMPTY_ART = (): MapArtAssets => ({ island: null, shadow: null, port: null });
const DIORAMA_NAMES: Readonly<Record<number, string>> = { 1: 'costa-diorama', 2: 'porto-diorama', 3: 'fabrica-diorama', 4: 'serra-diorama', 5: 'reserva-diorama', 6: 'dominio-diorama' };
const inAtlas = (world: number) => Object.prototype.hasOwnProperty.call(DIORAMA_NAMES, world);
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
const placementFor = (world: number) => WORLD_ATLAS_PLACEMENTS[world] ?? { origin: { x: 0, y: 0 }, scale: 1 };

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

/** Compact numbers must stay attached to their own shoreline. If that cannot
 * fit, the existing Arquipélago selector is safer than a misleading packed row. */
export function layoutCompactIslandControls(points: readonly MapControlPlacement[], owners: readonly MapControlBounds[],
    bounds: MapControlBounds): MapControlPlacement[] | null {
    const valid = (placed: readonly MapControlPlacement[]) => placed.every((point, index) => {
        const anchor = points[index], owner = owners[index], box = controlRect(point);
        return owner && Math.abs(point.x - anchor.x) <= 12 && Math.abs(point.y - anchor.y) <= 12 &&
            point.x >= owner.left && point.x <= owner.right && Math.abs(point.y - owner.bottom) <= 12 &&
            box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom &&
            placed.slice(index + 1).every(other => !controlsIntersect(box, controlRect(other), 8));
    });
    const direct = points.map(point => ({ ...point, x: Math.round(point.x), y: Math.round(point.y) }));
    if (valid(direct)) return direct;
    const placed = layoutMapControls(points, bounds);
    if (valid(placed)) return placed;
    // A two-pixel adjustment can free the neighboring row. Try each island
    // once; acceptance always uses the original anchors and shore constraints.
    for (let index = 0; index < Math.min(6, points.length); index++) {
        const nudged = points.map((point, n) => n === index ? { ...point, y: point.y + 2 } : point);
        const retry = layoutMapControls(nudged, bounds);
        if (valid(retry)) return retry;
    }
    return null;
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
    private boatLoad: Promise<void> | null = null;
    private readonly dockImages = new Map<number, HTMLImageElement>();
    private connectionActive = false;
    private bridgeStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    private bridge: JourneyBridge | null = null;
    private readonly bridgeImages = new Map<'open' | 'closed', HTMLImageElement>();
    private bridgeActive = false;
    private maintenanceStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    private maintenanceCable: SerraMaintenanceCable | null = null;
    private maintenanceImage: HTMLImageElement | null = null;
    private maintenanceActive = false;
    private maintenancePaths: { a: MapPoint[]; b: MapPoint[] } | null = null;
    private cablePair = createCablePair();
    private passengerStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    private passengerCable: ReservaPassengerCable | null = null;
    private passengerImage: HTMLImageElement | null = null;
    private readonly passengerOverlays = new Map<string, HTMLImageElement>();
    private passengerActive = false;
    private passengerPair = createCablePair();
    private assetWarning = '';
    private coastFerry = createFerry(COAST_PORT_FERRY, 1);
    private dominioFerry = createFerry(DOMINIO_FERRY, 1);
    private dominioStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    private dominioConnection: DominioJourneyConnection | null = null;
    private readonly dominioOverlays = new Map<string, HTMLImageElement>();
    private dominioActive = false;
    private buoysStarted = false;
    private buoyMetadata: MaritimeBuoyMetadata | null = null;
    private readonly buoyImages = new Map<MaritimeBuoyKind, HTMLImageElement>();
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
    private compactOverviewKey = '';
    private compactOverviewPositions: MapControlPlacement[] | null = null;

    private campaignWaterImage: HTMLImageElement | null = null;
    private campaignWaterMotion: GuairaCampaignWaterMotion | null = null;
    private campaignWaterSeconds = 0;
    private readonly campaignImages = new Map<GuairaCampaignRegion, HTMLImageElement>();
    private guairaDialog?: () => void;
    private deliciaImage?: HTMLImageElement;
    private deliciaStarted = false;
    private readonly deliciaPin = document.createElement('a');
    openGuairaRegion(): void { this.showGuaira(); }
    private showGuaira(): void {
        if (!this.save || !this.journey || this.journey.destination) return;
        this.guairaDialog?.();
        this.guairaDialog = showGuairaRegion(this.save, this.journey.arrived, {
            fly: from => this.callbacks.guaira?.(from), goToFactory: () => this.select(14), goToSerra: () => this.select(indexOf(guairaTravelDirections(this.save!, this.journey!.arrived).approach)),
        });
    }
    constructor(private readonly gameCanvas: HTMLCanvasElement, private readonly callbacks: MapCallbacks) {
        this.hud = new WorldMapHud({
            selectGuaira: callbacks.guaira ? () => this.act(() => this.showGuaira()) : undefined,
            selectStage: index => this.act(() => this.select(index)),
            selectWorld: world => this.act(() => {
                const selection = this.journey && !this.journey.destination && world === worldOf(this.journey.arrived)
                    ? indexOf(this.journey.arrived) : (world - 1) * 5;
                this.overview = false; this.paintDirty = true; this.select(selection);
            }),
            returnToFeka: () => this.act(() => {
                if (!this.journey || this.journey.destination || !this.journey.blocked) return;
                this.overview = false; this.paintDirty = true; this.select(indexOf(this.journey.arrived));
                this.root.focus({ preventScroll: true });
            }),
            selectOverviewWorld: world => this.act(() => {
                const selection = world === worldOf(STAGES[this.controlSelection].id) ? this.controlSelection
                    : this.journey && world === worldOf(this.journey.arrived) ? indexOf(this.journey.arrived) : (world - 1) * 5;
                this.overview = false; this.paintDirty = true; this.select(selection);
                this.root.focus({ preventScroll: true });
            }),
            selectTravel: id => this.act(() => {
                const action = WORLD_MAP_TRAVEL_ACTIONS[id];
                this.select(action.toStage ? indexOf(action.toStage) : (action.toWorld - 1) * 5);
            }),
            enter: () => this.act(() => this.enterSelected(this.controlSelection)),
            skip: () => this.act(() => this.skip()),
            overview: () => this.act(() => { this.overview = !this.overview; this.paintDirty = true; this.refreshHud(); }),
            menu: () => this.act(() => callbacks.exit()),
        });
        this.root = this.hud.root; this.scene = this.hud.scene; this.canvas = this.hud.canvas;
        this.ctx = this.canvas.getContext('2d', { alpha: false })!;
        this.root.addEventListener('keydown', this.onKey);
        document.body.append(this.root);
        const deliciaLink = document.createElement('a');
        deliciaLink.href = DELICIA_ENTRY; deliciaLink.className = 'world-map-delicia';
        deliciaLink.setAttribute('aria-label', 'Império da Delícia');
        const dlLabel = lettering('Império da Delícia', ART.goldLight); deliciaLink.append(dlLabel); this.scene.append(deliciaLink);
        this.deliciaPin.href = DELICIA_ENTRY; this.deliciaPin.className = 'world-map-delicia-island';
        this.deliciaPin.setAttribute('aria-label', 'Império da Delícia'); this.deliciaPin.append(lettering('Império da Delícia', ART.goldLight)); this.deliciaPin.hidden = true; this.scene.append(this.deliciaPin);
        if (callbacks.guaira) {
            void loadCampaignWaterImage().then(image => {
                if (!this.disposed && image) {
                    this.campaignWaterImage = image;
                    this.campaignWaterMotion = new GuairaCampaignWaterMotion(image, () => document.createElement('canvas'));
                    this.paintDirty = true;
                }
            });
            for (const region of ['fabrica', 'guaira', 'serra'] as const) void loadCampaignRegionImage(region).then(image => {
                if (!this.disposed && image) { this.campaignImages.set(region, image); this.paintDirty = true; }
            });
        }
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
        const before = this.journey;
        this.journey = skipJourney(before); this.updateVehicles(before, this.journey); this.paintDirty = true;
        this.reportArrival(); this.refreshHud();
    }
    private updateVehicles(before: JourneyState, after: JourneyState): void {
        this.coastFerry = updateFerryAfterTravel(this.coastFerry, COAST_PORT_FERRY, before, after);
        this.dominioFerry = updateFerryAfterTravel(this.dominioFerry, DOMINIO_FERRY, before, after);
        this.cablePair = updateCablePairAfterTravel(this.cablePair, SERRA_CABLE_PAIR, before, after);
        this.passengerPair = updateCablePairAfterTravel(this.passengerPair, PASSENGER_CABLE_PAIR, before, after);
        this.updateCapabilities();
    }
    private updateCapabilities(): void {
        if (!this.save) return;
        this.capabilities = { availableStages: STAGES.filter(stage => isUnlocked(stage.id, this.save!)).map(stage => stage.id),
            edgeDirections: {
                ...(this.connectionActive ? ferryEdgeDirections(this.coastFerry, COAST_PORT_FERRY, isUnlocked('2-1', this.save)) : {}),
                ...(this.dominioActive ? ferryEdgeDirections(this.dominioFerry, DOMINIO_FERRY, isUnlocked('6-1', this.save)) : {}),
                ...(this.maintenanceActive ? cableEdgeDirections(this.cablePair, SERRA_CABLE_PAIR,
                    this.save.secrets.includes('4-3'), this.journey?.legs[0]) : {}),
                ...(this.passengerActive ? cableEdgeDirections(this.passengerPair, PASSENGER_CABLE_PAIR,
                    isUnlocked('5-1', this.save), this.journey?.legs[0]) : {}),
            } };
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
        } else if ((event.key === 'Enter' || event.key === ' ') &&
            !(event.target instanceof HTMLElement && event.target.closest('button, a[href]'))) {
            // Native links and buttons own activation; map shortcuts must not launch a phase behind them.
            event.preventDefault(); event.stopPropagation(); this.act(() => this.enterSelected(this.controlSelection));
        }
    };
    private loadImage(path: string, signal = this.abort.signal): Promise<HTMLImageElement | null> {
        return new Promise(resolve => {
            if (signal.aborted) { resolve(null); return; }
            const image = new Image(); image.decoding = 'async';
            const finish = (result: HTMLImageElement | null) => {
                image.onload = null; image.onerror = null; signal.removeEventListener('abort', aborted); resolve(result);
            };
            const aborted = () => finish(null);
            signal.addEventListener('abort', aborted, { once: true });
            image.onload = () => finish(image); image.onerror = () => finish(null); image.src = path;
        });
    }
    private ensureWorld(world: number): void {
        if (this.artCache.has(world)) return;
        const cached: CachedMapArt = { assets: EMPTY_ART(), metadata: fallbackMapMetadata(world), status: inAtlas(world) ? 'loading' : 'ready' };
        this.artCache.set(world, cached);
        if (inAtlas(world)) this.pairLoads.set(world, this.loadAssets(world, cached));
    }
    private ensureArt(world: number): void {
        if (this.overview && !this.deliciaStarted) {
            this.deliciaStarted = true;
            void this.loadImage(DELICIA_MAP_IMAGE).then(image => {
                if (image && !this.disposed) { this.deliciaImage = image; this.paintDirty = true; }
            });
        }
        if (inAtlas(world)) {
            if (!this.buoysStarted) void this.loadBuoys();
            this.ensureWorld(1); this.ensureWorld(2);
            if (this.connectionStatus === 'idle') void this.loadConnection();
            // The third island is explicit lazy content, never a recursive
            // consequence of Porto being Costa's neighboring scenery.
            if (world >= 3 || this.overview || (world === 2 && this.save && isUnlocked('3-1', this.save))) {
                this.ensureWorld(3);
                if (this.bridgeStatus === 'idle') void this.loadBridge();
            }
            if (world >= 4 || this.overview || (world === 3 && this.save && isUnlocked('4-1', this.save))) {
                this.ensureWorld(4);
                if (this.maintenanceStatus === 'idle') void this.loadMaintenanceCable();
            }
            if (world >= 5 || this.overview || (world === 4 && this.save && isUnlocked('5-1', this.save))) {
                this.ensureWorld(5);
                if (this.passengerStatus === 'idle') void this.loadPassengerCable();
            }
            if (world === 6 || this.overview || (world === 5 && this.save && isUnlocked('6-1', this.save))) {
                this.ensureWorld(6);
                if (this.dominioStatus === 'idle') void this.loadDominioConnection();
            }
        }
        else this.ensureWorld(world);
    }
    private async loadBuoys(): Promise<void> {
        this.buoysStarted = true;
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const metadata = await fetch(prefix + 'maritime-buoys.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).then(parseMaritimeBuoys).catch(() => null);
        if (this.abort.signal.aborted || !metadata) return;
        this.buoyMetadata = metadata;
        await Promise.all(MARITIME_BUOY_SPRITES.map(async kind => {
            const sprite = metadata.sprites[kind], image = await this.loadImage(prefix + sprite.path.slice('/assets/world/map/'.length));
            if (this.abort.signal.aborted || !image || image.naturalWidth !== sprite.width || image.naturalHeight !== sprite.height) return;
            this.buoyImages.set(kind, image); this.paintDirty = true;
        }));
    }
    private async loadAssets(world: number, cached: CachedMapArt): Promise<void> {
        if (this.abort.signal.aborted) return;
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const name = DIORAMA_NAMES[world];
        const pairAbort = new AbortController(), abortPair = () => pairAbort.abort();
        this.abort.signal.addEventListener('abort', abortPair, { once: true });
        // Both assets are required: explicit failure must settle the pair even if its partner is still pending.
        const required = <T>(load: Promise<T | null>) => load.then(value => {
            if (value === null) throw new Error('Missing required map asset');
            return value;
        });
        const mainImage = required(this.loadImage(prefix + name + '.webp', pairAbort.signal));
        const mainMetadata = required(fetch(prefix + name + '.meta.json', { signal: pairAbort.signal })
            .then(response => response.ok ? response.json() : null).then(value => parseMapMetadata(value, world)));
        const pair = await Promise.all([mainImage, mainMetadata]).catch(() => null);
        this.abort.signal.removeEventListener('abort', abortPair);
        if (!pair) pairAbort.abort();
        if (this.abort.signal.aborted || this.artCache.get(world) !== cached) return;
        const island = pair?.[0] ?? null, metadata = pair?.[1] ?? null;
        const matchingPair = island && metadata && (world < 3 || (island.naturalWidth === 1920 && island.naturalHeight === 1200));
        cached.status = matchingPair ? 'ready' : 'failed';
        if (matchingPair) { cached.assets.island = island; cached.metadata = metadata; }
        else this.assetWarning = 'A travessia visual não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    private crossingFailed(from: number, to: number): boolean {
        if ((from <= 3) !== (to <= 3)) return false; // The Guaíra flight is the only crossing.
        const low = Math.min(from, to), high = Math.max(from, to);
        return (low === 1 && high >= 2 && (this.connectionStatus === 'failed' || [1, 2].some(world => this.artCache.get(world)?.status === 'failed'))) ||
            (low <= 2 && high >= 3 && (this.bridgeStatus === 'failed' || [2, 3].some(world => this.artCache.get(world)?.status === 'failed'))) ||
            (low <= 4 && high >= 5 && (this.passengerStatus === 'failed' || [4, 5].some(world => this.artCache.get(world)?.status === 'failed'))) ||
            (low <= 5 && high === 6 && (this.dominioStatus === 'failed' || [5, 6].some(world => this.artCache.get(world)?.status === 'failed'))) ||
            // A previous regional fallback can leave Feka opposite the ferry.
            // Keep that recovery usable without boarding an absent vessel.
            (low === 1 && inAtlas(high) && this.coastFerry.mooredWorld !== (from === 1 ? 1 : 2)) ||
            (low <= 5 && high === 6 && this.dominioFerry.mooredWorld !== (from === 6 ? 6 : 5));
    }
    private crossingLoading(from: number, to: number): boolean {
        if ((from <= 3) !== (to <= 3)) return false; // The Guaíra flight is the only crossing.
        const low = Math.min(from, to), high = Math.max(from, to);
        return (low === 1 && high >= 2 && this.connectionStatus === 'loading') ||
            (low <= 2 && high >= 3 && this.bridgeStatus === 'loading') ||
            (low <= 4 && high >= 5 && this.passengerStatus === 'loading') ||
            (low <= 5 && high === 6 && this.dominioStatus === 'loading');
    }
    private async loadConnection(): Promise<void> {
        this.connectionStatus = 'loading';
        const boatLoad = this.boatLoad ??= this.loadSharedBoat();
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const json = (name: string) => fetch(prefix + name, { signal: this.abort.signal }).then(response => response.ok ? response.json() : null).catch(() => null);
        const [raw] = await Promise.all([json('coast-port-journey.meta.json'),
            this.pairLoads.get(1), this.pairLoads.get(2)]);
        if (this.abort.signal.aborted) return;
        const coast = this.artCache.get(1), port = this.artCache.get(2);
        const connection = coast?.status === 'ready' && port?.status === 'ready' ? parseJourneyConnection(raw, coast.metadata, port.metadata) : null;
        const path = (asset: string) => prefix + asset.slice('/assets/world/map/'.length);
        if (connection) {
            const [coastDock, portDock] = await Promise.all([this.loadImage(path(connection.docks[1].overlay.path)),
                this.loadImage(path(connection.docks[2].overlay.path)), boatLoad]);
            if (this.abort.signal.aborted) return;
            const sized = (image: HTMLImageElement | null, size: { width: number; height: number }) => !!image && image.naturalWidth === size.width && image.naturalHeight === size.height;
            if (sized(coastDock, connection.docks[1].overlay) && sized(portDock, connection.docks[2].overlay) && this.boatMetadata && this.boatImage) {
                this.connection = connection;
                this.dockImages.set(1, coastDock!); this.dockImages.set(2, portDock!); this.connectionStatus = 'ready';
            } else this.connectionStatus = 'failed';
        } else this.connectionStatus = 'failed';
        if (this.connectionStatus === 'failed') this.assetWarning = 'A travessia visual não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    private async loadSharedBoat(): Promise<void> {
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const raw = await fetch(prefix + 'journey-boat.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).catch(() => null);
        if (this.abort.signal.aborted) return;
        const boat = parseJourneyBoat(raw);
        if (!boat) return;
        const image = await this.loadImage(prefix + boat.atlas.path.slice('/assets/world/map/'.length));
        if (this.abort.signal.aborted) return;
        if (matchesSerraAssetSize(image, boat.atlas)) { this.boatMetadata = boat; this.boatImage = image; }
    }
    private async loadDominioConnection(): Promise<void> {
        this.dominioStatus = 'loading';
        const boatLoad = this.boatLoad ??= this.loadSharedBoat();
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const request = fetch(prefix + 'reserva-dominio-journey.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).catch(() => null);
        const [raw] = await Promise.all([request, this.pairLoads.get(5), this.pairLoads.get(6)]);
        if (this.abort.signal.aborted) return;
        const reserva = this.artCache.get(5), dominio = this.artCache.get(6);
        const connection = reserva?.status === 'ready' && dominio?.status === 'ready'
            ? parseDominioJourney(raw, reserva.metadata, dominio.metadata, { 5: placementFor(5), 6: placementFor(6) }) : null;
        if (connection) {
            const [images] = await Promise.all([Promise.all(connection.overlays.map(layer =>
                this.loadImage(prefix + layer.path.slice('/assets/world/map/'.length)))), boatLoad]);
            if (this.abort.signal.aborted) return;
            if (this.boatMetadata && this.boatImage && images.every((image, index) => matchesDominioAssetSize(image, connection.overlays[index]))) {
                this.dominioConnection = connection;
                connection.overlays.forEach((layer, index) => this.dominioOverlays.set(layer.path, images[index]!));
                this.dominioStatus = 'ready';
            } else this.dominioStatus = 'failed';
        } else this.dominioStatus = 'failed';
        if (this.dominioStatus === 'failed') this.assetWarning = 'A travessia da doca aquecida não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    private async loadBridge(): Promise<void> {
        this.bridgeStatus = 'loading';
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const request = fetch(prefix + 'port-factory-bridge.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).catch(() => null);
        const [raw] = await Promise.all([request, this.pairLoads.get(2), this.pairLoads.get(3)]);
        if (this.abort.signal.aborted) return;
        const port = this.artCache.get(2), factory = this.artCache.get(3);
        const bridge = port?.status === 'ready' && factory?.status === 'ready'
            ? parseJourneyBridge(raw, port.metadata, factory.metadata, { 2: placementFor(2), 3: placementFor(3) }) : null;
        if (bridge) {
            const states = ['open', 'closed'] as const;
            const images = await Promise.all(states.map(state => this.loadImage(prefix + bridge.overlays[state].path.slice('/assets/world/map/'.length))));
            if (this.abort.signal.aborted) return;
            if (images.every((image, index) => image && image.naturalWidth === bridge.overlays[states[index]].width &&
                image.naturalHeight === bridge.overlays[states[index]].height)) {
                this.bridge = bridge; states.forEach((state, index) => this.bridgeImages.set(state, images[index]!)); this.bridgeStatus = 'ready';
            } else this.bridgeStatus = 'failed';
        } else this.bridgeStatus = 'failed';
        if (this.bridgeStatus === 'failed') this.assetWarning = 'A ponte de carga não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    private async loadMaintenanceCable(): Promise<void> {
        this.maintenanceStatus = 'loading';
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const request = fetch(prefix + 'serra-maintenance-cable.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).catch(() => null);
        const [raw] = await Promise.all([request, this.pairLoads.get(4)]);
        if (this.abort.signal.aborted) return;
        const serra = this.artCache.get(4), cable = serra?.status === 'ready' ? parseSerraMaintenanceCable(raw, serra.metadata) : null;
        if (cable) {
            const image = await this.loadImage(prefix + cable.atlas.path.slice('/assets/world/map/'.length));
            if (this.abort.signal.aborted) return;
            if (matchesSerraAssetSize(image, cable.atlas)) {
                this.maintenanceCable = cable; this.maintenanceImage = image; this.maintenanceStatus = 'ready';
            } else this.maintenanceStatus = 'failed';
        } else this.maintenanceStatus = 'failed';
        if (this.maintenanceStatus === 'failed') this.assetWarning = 'A cabine não carregou. O percurso a pé continua disponível.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    private async loadPassengerCable(): Promise<void> {
        this.passengerStatus = 'loading';
        const prefix = mapAssetPrefix((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/');
        const request = fetch(prefix + 'serra-reserva-link.meta.json', { signal: this.abort.signal })
            .then(response => response.ok ? response.json() : null).catch(() => null);
        const [raw] = await Promise.all([request, this.pairLoads.get(4), this.pairLoads.get(5)]);
        if (this.abort.signal.aborted) return;
        const serra = this.artCache.get(4), reserva = this.artCache.get(5);
        const cable = serra?.status === 'ready' && reserva?.status === 'ready'
            ? parseReservaPassengerCable(raw, serra.metadata, reserva.metadata, { 4: placementFor(4), 5: placementFor(5) }) : null;
        if (cable) {
            const layers = [cable.atlas, ...cable.overlays];
            const images = await Promise.all(layers.map(layer => this.loadImage(prefix + layer.path.slice('/assets/world/map/'.length))));
            if (this.abort.signal.aborted) return;
            if (images.every((image, index) => matchesSerraAssetSize(image, layers[index]))) {
                this.passengerCable = cable; this.passengerImage = images[0];
                cable.overlays.forEach((layer, index) => this.passengerOverlays.set(layer.path, images[index + 1]!));
                this.passengerStatus = 'ready';
            } else this.passengerStatus = 'failed';
        } else this.passengerStatus = 'failed';
        if (this.passengerStatus === 'failed') this.assetWarning = 'A linha de passageiros não carregou. As fases continuam disponíveis pelo arquipélago.';
        this.geometryDirty = true; this.paintDirty = true;
    }
    show(time: number): void {
        if (this.visible || this.disposed) return;
        this.visible = true; this.hud.setVisible(true); this.lastTime = time; this.dirtySize = true; this.cameraSnap = true;
        this.controlOffsets.clear();
        this.journey = null; this.cablePair = createCablePair(); this.passengerPair = createCablePair();
        this.coastFerry = createFerry(COAST_PORT_FERRY, 1);
        this.dominioFerry = createFerry(DOMINIO_FERRY, 1);
        this.selection = -1; this.lastSignature = ''; this.geometryDirty = true;
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
        this.guairaDialog?.();
        this.root.removeEventListener('keydown', this.onKey); this.hud.dispose();
    }
    private rebuildNetwork(): void {
        for (let world = 1; world <= 6; world++) {
            const cached = this.artCache.get(world);
            this.activeArt.set(world, cached ? { ...cached, assets: { ...cached.assets } } : { metadata: fallbackMapMetadata(world), assets: EMPTY_ART(), status: 'ready' });
        }
        this.connectionActive = this.connectionStatus === 'ready' && [1, 2].every(world => this.activeArt.get(world)?.status === 'ready');
        this.bridgeActive = this.bridgeStatus === 'ready' && [2, 3].every(world => this.activeArt.get(world)?.status === 'ready');
        this.maintenanceActive = this.maintenanceStatus === 'ready' && this.activeArt.get(4)?.status === 'ready';
        this.passengerActive = this.passengerStatus === 'ready' && [4, 5].every(world => this.activeArt.get(world)?.status === 'ready');
        this.dominioActive = this.dominioStatus === 'ready' && [5, 6].every(world => this.activeArt.get(world)?.status === 'ready');
        this.maintenancePaths = this.maintenanceActive && this.maintenanceCable ? {
            a: this.maintenanceCable.lanes.a.pathPoints.map(point => localToAtlas(point, placementFor(4))),
            b: this.maintenanceCable.lanes.b.pathPoints.map(point => localToAtlas(point, placementFor(4))),
        } : null;
        this.network = buildJourneyNetwork({ islands: [...this.activeArt].map(([world, art]) => ({ world, metadata: art.metadata, placement: placementFor(world), ready: !!art.assets.island })),
            secrets: this.save?.secrets ?? [], connection: this.connection, connectionReady: this.connectionActive,
            bridge: this.bridge, bridgeReady: this.bridgeActive, bridgeOpen: !!this.save && isUnlocked('3-1', this.save),
            maintenanceCable: this.maintenanceCable, maintenanceCableReady: this.maintenanceActive,
            passengerCable: this.passengerCable, passengerCableReady: this.passengerActive,
            passengerCableOpen: !!this.save && isUnlocked('5-1', this.save),
            dominioConnection: this.dominioConnection, dominioConnectionReady: this.dominioActive,
            dominioConnectionOpen: !!this.save && isUnlocked('6-1', this.save) });
        this.updateCapabilities();
        this.geometryDirty = false;
    }
    private requestDestination(selection: number): void {
        if (!this.journey) return;
        const id = STAGES[selection].id, world = worldOf(id), currentWorld = worldOf(this.journey.arrived);
        if (this.journey.selected === id && this.selection === selection && !this.journey.blocked) return;
        this.ensureArt(world); this.selection = selection;
        this.updateCapabilities();
        // Regions beyond this slice retain their existing menu handoff. No sea route is fabricated.
        if (world !== currentWorld && !this.journey.destination &&
            (!inAtlas(world) || !inAtlas(currentWorld) || this.crossingFailed(currentWorld, world)) && this.capabilities.availableStages.includes(id))
            this.journey = createJourney(id, this.network, this.capabilities);
        else {
            this.journey = selectJourney(this.journey, id, this.network, this.capabilities);
            if (this.media.matches) {
                const before = this.journey; this.journey = skipJourney(before); this.updateVehicles(before, this.journey);
            }
        }
        this.paintDirty = true; this.reportArrival();
    }
    private reportArrival(): void {
        if (!this.journey || this.reportedArrival === this.journey.arrived) return;
        this.reportedArrival = this.journey.arrived; this.callbacks.arrive?.(indexOf(this.journey.arrived));
    }
    private motionState(): WorldMapMotionState {
        const mode = this.journey && journeyMode(this.journey);
        return mode === 'walk' ? 'walking' : mode === 'board' || mode === 'cable-board' ? 'boarding' : mode === 'sail' ? 'sailing'
            : mode === 'cable' ? 'riding' : mode === 'disembark' || mode === 'cable-disembark' ? 'arriving' : 'idle';
    }
    private refreshHud(warning = '', toast = ''): void {
        if (!this.save || !this.journey) return;
        const stage = STAGES[this.controlSelection], world = stage.world;
        this.hud.update({ world, stage: this.controlSelection, arrivedWorld: worldOf(this.journey.arrived), arrivedStage: this.journey.arrived,
            open: Array.from({ length: 5 }, (_, n) => isUnlocked(`${world}-${n + 1}`, this.save!)),
            completed: Array.from({ length: 5 }, (_, n) => this.save!.completed.includes(`${world}-${n + 1}`)),
            seals: Array.from({ length: 5 }, (_, n) => this.save!.seals.filter(id => id.startsWith(`${world}-${n + 1}:`)).length),
            guairaAvailable: guairaTravelDirections(this.save, this.journey.arrived).available,
            globalProgress: { completed: this.save.completed.length, guaira: this.save.guaira.completed.length, seals: this.save.seals.length },
            motionState: this.motionState(), canEnter: canEnterJourney(this.journey, this.capabilities),
            prerequisiteStage: this.journey.blocked === 'unavailable' ? mapStagePrerequisite(stage.id, this.save) : null,
            hint: this.journey.blocked === 'no-route' && this.crossingLoading(worldOf(this.journey.arrived), world)
                ? world === 5 ? 'Preparando a linha de passageiros… Você pode escolher outra fase ou voltar ao menu.'
                    : world === 4 ? 'Preparando a passagem da Serra… Você pode escolher outra fase ou voltar ao menu.'
                    : world === 3 ? 'Preparando a ponte de carga… Você pode escolher outra fase ou voltar ao menu.'
                    : 'Preparando o barco e os cais… Você pode escolher outra fase ou voltar ao menu.'
                : this.journey.blocked === 'no-route' && ((world <= 3) !== (worldOf(this.journey.arrived) <= 3)) ? 'A passagem entre Fábrica e Serra é por Guaíra. Abra Arquipélago → Guaíra para embarcar.' : journeyBlockReason(this.journey) || campaignMapDirection(this.save, this.journey.arrived, stage.id, !!this.journey.destination) || (this.save.secrets.includes(`${world}-3`) ? 'Atalho 3 → 5 descoberto!' : ''),
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
        this.updateCapabilities();
        this.ensureArt(STAGES[this.controlSelection].world); this.ensureArt(worldOf(returned?.playedStage ?? save.selected));
        const progressSignature = `${save.secrets.join(',')}:${isUnlocked('3-1', save)}:${isUnlocked('4-1', save)}:${isUnlocked('5-1', save)}:${isUnlocked('6-1', save)}`;
        if (this.lastSignature.split('|')[0] !== progressSignature) this.geometryDirty = true;
        if (this.geometryDirty && !this.journey?.destination) {
            const previous = this.journey; this.rebuildNetwork();
            if (previous && !previous.entered) this.journey = createJourney(previous.arrived, this.network, this.capabilities);
            this.selection = -1;
        }
        if (!this.journey || returned) {
            this.cablePair = createCablePair(); this.passengerPair = createCablePair(); this.journey = null; this.updateCapabilities();
            this.journey = returned ? returnToJourney(returned.playedStage, returned.nextSelected, this.network, this.capabilities)
                : createJourney(save.selected, this.network, this.capabilities);
            this.coastFerry = createFerry(COAST_PORT_FERRY, worldOf(this.journey.arrived));
            this.dominioFerry = createFerry(DOMINIO_FERRY, worldOf(this.journey.arrived));
            this.updateCapabilities();
            this.reportedArrival = save.selected; this.selection = -1;
        }
        this.requestDestination(this.controlSelection);
        const dt = Math.max(0, Math.min(100, time - this.lastTime)); this.lastTime = time;
        const previousState = this.journey, previous = previousState.point;
        this.journey = advanceJourney(previousState, dt / 1000, this.media.matches);
        this.updateVehicles(previousState, this.journey);
        this.marker = this.journey.point;
        if (Math.abs(previous.x - this.marker.x) > 1e-8) this.facingLeft = this.marker.x < previous.x;
        this.reportArrival(); this.refreshHud(warning, toast);
        if (this.dirtySize || this.screenDpr !== (window.devicePixelRatio || 1)) this.measure();
        const signature = `${progressSignature}|water:${campaignWaterRestored(save)}|${this.controlSelection}|${save.completed.join(',')}|${save.seals.join(',')}|${warning}|${toast}|${this.overview}|${this.journey.arrived}|${this.journey.destination}|${this.journey.blocked}`;
        if (this.media.matches && !this.paintDirty && !this.geometryDirty && signature === this.lastSignature) return;
        this.lastSignature = signature;
        const stage = STAGES[this.controlSelection];
        const connected = inAtlas(stage.world);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ctx.imageSmoothingEnabled = true;
        if (connected) this.paintAtlas(stage.world, save, time, dt);
        else this.paintSingle(stage.world, save, time);
        this.paintDirty = false;
    }
    private ferryLines(): FerryLineView[] {
        const lines: FerryLineView[] = [];
        if (this.connectionActive && this.connection)
            lines.push({ ...this.connection, definition: COAST_PORT_FERRY, state: this.coastFerry });
        if (this.dominioActive && this.dominioConnection)
            lines.push({ ...this.dominioConnection, definition: DOMINIO_FERRY, state: this.dominioFerry });
        return lines;
    }
    private currentBoat(id = COAST_PORT_FERRY.id): AtlasBoat | undefined {
        const line = this.ferryLines().find(line => line.definition.id === id);
        if (!line || !this.boatMetadata || !this.boatImage) return;
        const berths = Object.fromEntries(line.definition.worlds.map(world => {
            const berth = line.docks[world].berth;
            return [world, { foot: localToAtlas(berth.passenger, placementFor(world)), headingFrame: berth.headingFrame }];
        }));
        const pose = sampleFerry(line.state, line.definition, { berths,
            segmentHeadings: line.segmentHeadings, reverseSegmentHeadings: line.reverseSegmentHeadings, art: this.boatMetadata },
        { active: this.journey!.legs[0], point: this.marker, time: this.lastTime, reducedMotion: this.media.matches });
        if (id === COAST_PORT_FERRY.id) this.coastFerry = pose.state; else this.dominioFerry = pose.state;
        return { id, foot: pose.foot, frame: this.boatMetadata.frames[pose.frameIndex], motion: pose.motion,
            assets: { rear: this.boatImage, foreground: this.boatImage } };
    }
    private currentBoats(): AtlasBoat[] {
        return this.ferryLines().flatMap(line => {
            const boat = this.currentBoat(line.definition.id); return boat ? [boat] : [];
        });
    }
    private activeFerry(aboardOnly = false): FerryLineView | undefined {
        const active = this.journey?.legs[0];
        if (!active) return;
        return this.ferryLines().find(line => active.mode === 'sail' ? active.id === line.definition.sailEdge :
            active.mode === 'board' && line.definition.worlds.some(world => active.id === line.definition.boardingEdges[world] &&
                (!aboardOnly || active.progress >= (line.docks[world].aboardProgress ?? .45))));
    }
    private cableLines(): CableLineView[] {
        const lines: CableLineView[] = [];
        if (this.maintenanceActive && this.maintenanceCable && this.maintenanceImage && this.maintenancePaths)
            lines.push({ definition: SERRA_CABLE_PAIR, state: this.cablePair, metadata: this.maintenanceCable,
                paths: this.maintenancePaths, image: this.maintenanceImage });
        if (this.passengerActive && this.passengerCable && this.passengerImage)
            lines.push({ definition: PASSENGER_CABLE_PAIR, state: this.passengerPair, metadata: this.passengerCable,
                paths: { a: this.passengerCable.lanes.a.pathPoints, b: this.passengerCable.lanes.b.pathPoints }, image: this.passengerImage });
        return lines;
    }
    private currentCableCars(): AtlasCableCar[] {
        return this.cableLines().flatMap(line => {
            const pose = sampleCablePair(line.state, line.definition, line.paths, this.journey?.legs[0]);
            return pose ? line.metadata.paintOrder.map(car => ({ id: line.definition.lanes[car].rideEdge,
                foot: pose.feet[car], frame: line.metadata.frame, assets: { rear: line.image, foreground: line.image } })) : [];
        });
    }
    private activeCableCar(aboardOnly = false): string | undefined {
        const active = this.journey?.legs[0];
        if (!active) return;
        for (const line of this.cableLines()) for (const car of ['a', 'b'] as const) {
            const lane = line.definition.lanes[car];
            if (active.mode === 'cable' && active.id === lane.rideEdge) return lane.rideEdge;
            if (active.mode === 'cable-board') for (const terminal of ['lower', 'upper'] as const)
                if (active.id === lane.boardingEdges[terminal] && (!aboardOnly || active.progress >= line.metadata.lanes[car][terminal].aboardProgress)) return lane.rideEdge;
        }
    }
    private campaignIslandAssets(world: number): MapArtAssets {
        const original = this.activeArt.get(world)!.assets;
        const region = world === 3 ? 'fabrica' : world === 4 ? 'serra' : null;
        const replacement = region && GUAIRA_CAMPAIGN_ART[region].replacesBase && this.campaignImages.get(region);
        return replacement ? { ...original, island: replacement } : original;
    }
    private paintAtlas(world: number, save: AdventureSave, time: number, dt: number): void {
        const ids = [1, 2, ...([3, 4, 5, 6].filter(id => this.overview || world === id || !!this.activeArt.get(id)?.assets.island))];
        const islands: AtlasIslandLayer[] = ids.map(id => ({ world: id, metadata: this.activeArt.get(id)!.metadata,
            placement: placementFor(id), assets: this.campaignIslandAssets(id), completed: save.completed, secret: save.secrets.includes(`${id}-3`),
            ...(this.connectionActive && this.connection && (id === 1 || id === 2)
                ? { overlay: { ...this.connection.docks[id].overlay, image: this.dockImages.get(id)! } } : {}),
            approachBounds: [...(this.bridgeActive && this.bridge && (id === 2 || id === 3) ? [this.bridge.landings[id].approachBounds] : []),
                ...(this.passengerActive && this.passengerCable && (id === 4 || id === 5)
                    ? [this.passengerCable.stations[id === 4 ? 'lower' : 'upper'].artBounds] : []),
                ...(this.dominioActive && this.dominioConnection && (id === 5 || id === 6)
                    ? [this.dominioConnection.docks[id].artBounds] : [])] }));
        const actorInAtlas = inAtlas(worldOf(this.journey!.arrived));
        const active = actorInAtlas ? this.journey!.legs[0] : undefined;
        const onBridge = active?.id === PORT_FACTORY_BRIDGE_EDGE;
        const cableCar = actorInAtlas ? this.activeCableCar() : undefined;
        const channel = active?.mode === 'board' || active?.mode === 'sail' || onBridge || !!cableCar;
        const activeWorld = active && active.mode !== 'sail' ? worldOf(active.from) : world;
        const boats = this.currentBoats(), cableCars = this.currentCableCars(), activeFerry = this.activeFerry();
        // A region preview frames that region. Feka and a moored boat may remain
        // offscreen on the origin island until a real trip begins or we return.
        const trackJourney = actorInAtlas && (!!this.journey!.destination || this.overview || worldOf(this.journey!.arrived) === activeWorld);
        const trackedFerry = activeFerry ?? (!cableCar && !onBridge
            ? this.ferryLines().find(line => line.definition.worlds.includes(activeWorld)) : undefined);
        const trackedBoat = trackJourney && trackedFerry ? boats.find(boat => boat.id === trackedFerry.definition.id) : undefined;
        const trackedCabin = trackJourney && cableCar ? cableCars.find(car => car.id === cableCar) : undefined;
        const travelRoute = onBridge ? this.bridge?.bridgeRoute ?? active.points
                : cableCar ? active!.points : activeFerry?.sailRoute ?? active?.points ?? [];
        const travelPoints = channel ? this.width < 600 ? atlasTravelWindow(travelRoute, this.marker) : travelRoute : undefined;
        const bridgeState = isUnlocked('3-1', save) ? 'open' : 'closed';
        const overlay = this.bridgeActive && this.bridge ? this.bridge.overlays[bridgeState] : null;
        const passengerState = isUnlocked('5-1', save) ? 'open' : 'closed';
        const passengerLayers = this.passengerActive && this.passengerCable
            ? this.passengerCable.overlays.filter(layer => !layer.when || layer.when === passengerState) : [];
        const dominioState = isUnlocked('6-1', save) ? 'open' : 'closed';
        const dominioLayers = this.dominioActive && this.dominioConnection
            ? this.dominioConnection.overlays.filter(layer => !layer.when || layer.when === dominioState) : [];
        const cablePaths = this.passengerActive && this.passengerCable ? this.passengerCable.cablePolylines : [];
        const connectionBounds = [overlay, ...passengerLayers, ...dominioLayers].flatMap(layer => layer ? [{ left: layer.left, top: layer.top,
            right: layer.left + layer.widthInMap, bottom: layer.top + layer.heightInMap }] : []);
        for (const region of this.campaignImages.keys()) connectionBounds.push(region === 'guaira' ? campaignTerrainBounds(region) : campaignArtBounds(region));
        if (this.deliciaImage) connectionBounds.push({ left: DELICIA_ATLAS.left, top: DELICIA_ATLAS.top,
            right: DELICIA_ATLAS.left + DELICIA_ATLAS.widthInMap, bottom: DELICIA_ATLAS.top + DELICIA_ATLAS.heightInMap });
        const cablePoints = cablePaths.flat();
        if (cablePoints.length) connectionBounds.push({ left: Math.min(...cablePoints.map(p => p.x)), right: Math.max(...cablePoints.map(p => p.x)),
            top: Math.min(...cablePoints.map(p => p.y)), bottom: Math.max(...cablePoints.map(p => p.y)) });
        const occupiedCabin = actorInAtlas ? this.activeCableCar(true) : undefined;
        const occupiedBoat = actorInAtlas ? this.activeFerry(true)?.definition.id : undefined;
        const actorPoint = active?.mode === 'sail' ? boats.find(boat => boat.id === occupiedBoat)?.foot ?? this.marker : this.marker;
        const actorFrame = cableCars.find(car => car.id === occupiedCabin)?.frame ?? boats.find(boat => boat.id === occupiedBoat)?.frame;
        const overviewActorBounds = this.overview && actorInAtlas ? atlasActorBounds(actorPoint, actorFrame, !occupiedCabin && !occupiedBoat) : undefined;
        const focusBounds = [...(overviewActorBounds ? [overviewActorBounds] : []),
            ...(this.overview ? boats.map(boat => atlasBoatBounds(boat.foot, boat.frame))
            : trackedBoat ? [atlasBoatBounds(trackedBoat.foot, trackedBoat.frame)] : []),
            ...(this.overview ? cableCars.map(atlasCableBounds) : trackedCabin ? [atlasCableBounds(trackedCabin)] : [])];
        const target = getAtlasCamera({ mode: this.overview ? 'overview' : channel ? 'channel' : 'island', activeWorld,
            layers: islands, width: this.width, height: this.height, insets: { ...this.frameInsets, left: 16, right: 16 },
            focus: trackJourney && !this.overview ? actorPoint : undefined,
            travelPoints, connectionBounds, focusBounds });
        this.camera = this.blendAtlasCamera(target, dt, trackedCabin ? atlasCableBounds(trackedCabin)
            : trackedBoat ? atlasBoatBounds(trackedBoat.foot, trackedBoat.frame) : undefined, overviewActorBounds, actorPoint);
        this.deliciaPin.hidden = !this.overview || !this.deliciaImage;
        if (!this.deliciaPin.hidden) {
            const point = mapToScreen({ x: DELICIA_ATLAS.left + DELICIA_ATLAS.widthInMap * .5,
                y: DELICIA_ATLAS.top + DELICIA_ATLAS.heightInMap * .87 }, this.camera);
            this.deliciaPin.style.left = `${point.x}px`; this.deliciaPin.style.top = `${point.y}px`;
        }
        const aboard = !!occupiedCabin || !!occupiedBoat;
        const waterRestored = campaignWaterRestored(save);
        // Reuse the visible map cadence; hidden or reduced-motion time never catches up.
        if (waterRestored && !this.media.matches) this.campaignWaterSeconds += Math.min(50, dt) / 1000;
        paintWorldAtlas(this.ctx, { camera: this.camera, time, reducedMotion: this.media.matches, islands,
            buoys: this.buoyMetadata?.instances.flatMap(instance => {
                const ready = instance.route === 'coast-port' ? this.connectionActive : this.dominioActive;
                const image = this.buoyImages.get(instance.sprite);
                return ready && image ? [{ point: instance.point, sprite: this.buoyMetadata!.sprites[instance.sprite], image }] : [];
            }),
            connections: [...Array.from(this.campaignImages).filter(([region]) => !GUAIRA_CAMPAIGN_ART[region].replacesBase).flatMap(([region, image]) => {
                const water = region === 'guaira' ? campaignWaterOverlay(save, this.campaignWaterImage) : null;
                const motion = water ? this.campaignWaterMotion?.overlays(waterRestored, this.camera, this.campaignWaterSeconds, this.media.matches) ?? [] : [];
                return [campaignArtOverlay(region, image), ...(water ? [water, ...motion] : [])];
            }), ...(overlay ? [{ ...overlay, image: this.bridgeImages.get(bridgeState)! }] : []),
                ...(this.deliciaImage ? [{ ...DELICIA_ATLAS, image: this.deliciaImage }] : []),
                ...passengerLayers.map(layer => ({ ...layer, image: this.passengerOverlays.get(layer.path)! })),
                ...dominioLayers.map(layer => ({ ...layer, image: this.dominioOverlays.get(layer.path)! }))],
            actor: { point: actorPoint, walking: !!active && active.mode !== 'sail' && active.mode !== 'cable', facingLeft: this.facingLeft, aboard,
                visible: actorInAtlas, cableCar: occupiedCabin, boatId: occupiedBoat }, boats, cableCars, cablePaths });
        this.positionNodes(world, channel || activeWorld !== world, boats, cableCars);
    }
    private blendAtlasCamera(target: MapCamera, dt: number, bounds?: AtlasBounds, actorBounds?: AtlasBounds, actorPoint = this.marker): MapCamera {
        if (this.cameraSnap || this.media.matches) { this.cameraSnap = false; return target; }
        const blend = 1 - Math.exp(-dt / 180);
        const camera = { ...target, zoom: this.camera.zoom + (target.zoom - this.camera.zoom) * blend,
            center: { x: this.camera.center.x + (target.center.x - this.camera.center.x) * blend,
                y: this.camera.center.y + (target.center.y - this.camera.center.y) * blend } };
        bounds ??= actorBounds;
        if (!bounds) return camera;
        // Keep the vehicle and Feka together while the composition catches up.
        // At a distant dock their combined span can exceed the viewport even
        // when the vehicle alone fits; translation cannot fix that overflow.
        const base = Math.min(this.width / 1.6, this.height);
        const safe = { left: 28, right: this.width - 28, top: this.frameInsets.top + 12, bottom: this.height - this.frameInsets.bottom - 12 };
        const span = (zoom: number) => {
            const x = base * 1.6 * zoom, y = base * zoom;
            return {
                width: Math.max(bounds.right * x, actorBounds ? actorBounds.right * x : actorPoint.x * x + 20)
                    - Math.min(bounds.left * x, actorBounds ? actorBounds.left * x : actorPoint.x * x - 20),
                height: Math.max(bounds.bottom * y, actorBounds ? actorBounds.bottom * y : actorPoint.y * y + 8)
                    - Math.min(bounds.top * y, actorBounds ? actorBounds.top * y : actorPoint.y * y - 44),
            };
        };
        const fits = (zoom: number) => {
            const size = span(zoom);
            return size.width <= safe.right - safe.left && size.height <= safe.bottom - safe.top;
        };
        if (!fits(camera.zoom)) {
            let low = .001, high = camera.zoom;
            for (let n = 0; n < 20; n++) {
                const middle = (low + high) / 2;
                if (fits(middle)) low = middle; else high = middle;
            }
            camera.zoom = low;
        }
        const upper = mapToScreen({ x: bounds.left, y: bounds.top }, camera), lower = mapToScreen({ x: bounds.right, y: bounds.bottom }, camera);
        const actor = mapToScreen(actorPoint, camera);
        const actorUpper = actorBounds ? mapToScreen({ x: actorBounds.left, y: actorBounds.top }, camera) : { x: actor.x - 20, y: actor.y - 44 };
        const actorLower = actorBounds ? mapToScreen({ x: actorBounds.right, y: actorBounds.bottom }, camera) : { x: actor.x + 20, y: actor.y + 8 };
        const left = Math.min(upper.x, actorUpper.x), right = Math.max(lower.x, actorLower.x);
        const top = Math.min(upper.y, actorUpper.y), bottom = Math.max(lower.y, actorLower.y);
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
    private positionNodes(world: number, hide: boolean, boats: readonly AtlasBoat[] = [], cableCars: readonly AtlasCableCar[] = []): void {
        if (this.overview) {
            this.hud.positionNodes([]); this.hud.positionTravelActions({});
            if (this.journey?.destination) { this.hud.positionOverviewWorlds([]); return; }
            // Compact views use a naturally proportioned narrow numbered plank;
            // the full island name stays in the footer and accessible label.
            const compact = this.width < 640 || this.height < 480;
            const owners: MapControlBounds[] = [];
            const names = Array.from({ length: 6 }, (_, index) => {
                const id = index + 1, metadata = this.activeArt.get(id)!.metadata;
                // Island identity follows the terrain, never an outboard dock
                // or a neighboring destination. No leader can resemble a route.
                const bounds = atlasIslandBounds({ world: id, metadata, placement: placementFor(id) });
                const a = mapToScreen({ x: bounds.left, y: bounds.top }, this.camera), b = mapToScreen({ x: bounds.right, y: bounds.bottom }, this.camera);
                owners.push({ left: a.x, top: a.y, right: b.x, bottom: b.y });
                const point = mapToScreen({ x: (bounds.left + bounds.right) / 2, y: bounds.bottom }, this.camera);
                return { x: point.x, y: point.y + (compact ? 8 : 32), width: compact ? 44 : 128, height: 44 };
            });
            if (this.callbacks.guaira) {
                const terrain = campaignTerrainBounds('guaira');
                const a = mapToScreen({ x: terrain.left, y: terrain.top }, this.camera), b = mapToScreen({ x: terrain.right, y: terrain.bottom }, this.camera);
                owners.push({ left: a.x, top: a.y, right: b.x, bottom: b.y });
                names.push({ x: (a.x + b.x) / 2, y: b.y + (compact ? 8 : 32), width: 128, height: 44 });
            }
            const bounds = { left: 8, right: this.width - 8, top: this.frameInsets.top + 2, bottom: this.height - this.frameInsets.bottom - 2 };
            const layoutKey = JSON.stringify([names, owners, bounds]);
            if (compact && layoutKey !== this.compactOverviewKey) {
                this.compactOverviewKey = layoutKey;
                this.compactOverviewPositions = layoutCompactIslandControls(names, owners, bounds);
            }
            const positions = compact ? this.compactOverviewPositions : layoutMapControls(names, bounds);
            this.hud.positionOverviewWorlds(positions ?? [], compact, !positions);
            return;
        }
        this.hud.positionOverviewWorlds([]);
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
        const travel: Partial<Record<WorldMapTravelActionId, WorldMapHudPoint | null>> = {};
        for (const id of WORLD_MAP_TRAVEL_ACTION_IDS) {
            travel[id] = null;
            if (hide || this.journey?.destination || !inAtlas(world)) continue;
            const action = WORLD_MAP_TRAVEL_ACTIONS[id], departure = action.fromWorld;
            if (departure !== world) continue;
            const anchor = action.mode === 'ferry' && this.connectionActive && this.connection && (departure === 1 || departure === 2)
                ? this.connection.docks[departure].dock
                : action.mode === 'ferry' && this.dominioActive && this.dominioConnection && (departure === 5 || departure === 6)
                    ? this.dominioConnection.docks[departure].dock
                : action.mode === 'bridge' && this.bridgeActive && this.bridge && (departure === 2 || departure === 3)
                    ? this.bridge.landings[departure].landing
                        : action.mode === 'cable' && this.passengerActive && this.passengerCable && (departure === 4 || departure === 5)
                            ? this.passengerCable.stations[departure === 4 ? 'lower' : 'upper'].platform : null;
            if (!anchor) continue;
            const point = mapToScreen(localToAtlas(anchor, placementFor(departure)), this.camera);
            travel[id] = { ...point, visible: point.x > 8 && point.x < this.width - 8 && point.y > this.frameInsets.top && point.y < this.height - this.frameInsets.bottom,
                available: !!this.save && isUnlocked(action.toStage ?? `${action.toWorld}-1`, this.save) &&
                    (!action.requiresStage || isUnlocked(action.requiresStage, this.save)) };
        }
        const visible = [...stages.map((point, n) => point ? { id: `stage:${world}-${n + 1}`, point, anchor: anchors[n], width: 56, height: 58 } : null),
            ...WORLD_MAP_TRAVEL_ACTION_IDS.map(id => {
                const point = travel[id], { width, height } = WORLD_MAP_TRAVEL_ACTIONS[id];
                return point?.visible ? { id, point, anchor: { x: point.x, y: point.y }, width, height } : null;
            })].filter((entry): entry is NonNullable<typeof entry> => !!entry);
        const controlBounds = { left: 8, right: this.width - 8, top: this.frameInsets.top + 2, bottom: this.height - this.frameInsets.bottom - 2 };
        const positions = layoutMapControls(visible.map(({ point, width, height }) => ({ ...point, width, height })),
            controlBounds, 8, this.media.matches ? [] : visible.map(entry => this.controlOffsets.get(entry.id)));
        const actor = mapToScreen(this.marker, this.camera), scale = inAtlas(world) ? atlasActorScale(this.camera) : mapActorScale(this.camera);
        const obstacles = [{ left: actor.x - 10 * scale - 2, right: actor.x + 10 * scale + 2, top: actor.y - 28 * scale - 2, bottom: actor.y + 3 }];
        for (const bounds of [...boats.map(boat => atlasBoatBounds(boat.foot, boat.frame)), ...cableCars.map(atlasCableBounds)]) {
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
        this.hud.positionNodes(stages);
        this.hud.positionTravelActions(travel);
    }
}
