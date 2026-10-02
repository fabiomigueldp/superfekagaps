/** Isolated local navigation. These names never enter the campaign or saved progress. */
export type GuairaDestination = 'town' | 'curral' | 'subida';
export type GuairaArrival = 'town' | 'rice' | 'corral' | 'vazao';
/** A summary of the visit just left, never saved progress or a world-state flag. */
export type GuairaReturnContext = 'traversal-clear' | 'bull-clear' | 'ascent-clear' | 'mayor-clear';
const RETURN_ARRIVALS: Record<GuairaReturnContext, GuairaArrival> = {
    'traversal-clear': 'rice', 'bull-clear': 'corral', 'ascent-clear': 'vazao', 'mayor-clear': 'vazao',
};
function validReturnContext(at: GuairaArrival, value: unknown): value is GuairaReturnContext {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RETURN_ARRIVALS, value) &&
        RETURN_ARRIVALS[value as GuairaReturnContext] === at;
}
export interface GuairaPoint { x: number; y: number }
export interface GuairaMetadata {
    worldId: 'guaira'; size: { width: 1920; height: 1200 };
    nodes: Record<string, GuairaPoint>;
    routes: Record<string, GuairaPoint[]>;
    artBounds: { left: number; top: number; right: number; bottom: number };
}
export const GUAIRA_DESTINATIONS = {
    town: { node: 'guaira-1', arrival: 'town', title: 'Estrada do Vento', short: 'TRAVESSIA', action: 'JOGAR', href: './guaira-travessia.html', description: 'Abra a comporta, atravesse até os arrozais e siga ao curral.' },
    curral: { node: 'guaira-4', arrival: 'corral', title: 'Curral da Comporta', short: 'ARENA', action: 'ARENA', href: './guaira-lab.html', description: 'Enfrente Ossabravo na arena experimental.' },
    subida: { node: 'guaira-4', arrival: 'corral', title: 'Subida à Casa', short: 'SUBIDA', action: 'SUBIR', href: './guaira-subida.html', description: 'Parta do curral e suba até o terraço da Casa da Vazão.' },
} as const;
const ARRIVAL_NODES = { town: 'guaira-1', rice: 'guaira-3', corral: 'guaira-4', vazao: 'guaira-5' } as const;
export function guairaArrivalFromSearch(search: string): GuairaArrival {
    const at = new URLSearchParams(search).get('at');
    return at === 'rice' || at === 'corral' || at === 'vazao' ? at : 'town';
}
export function guairaReturnContextFromSearch(search: string): GuairaReturnContext | null {
    const params = new URLSearchParams(search), value = params.get('visit');
    return params.getAll('at').length === 1 && params.getAll('visit').length === 1 &&
        validReturnContext(guairaArrivalFromSearch(search), value) ? value : null;
}
export function guairaReturnHref(at: GuairaArrival, context?: GuairaReturnContext | null): string {
    return `./guaira.html?at=${at}${validReturnContext(at, context) ? `&visit=${context}` : ''}`;
}
const isPoint = (v: unknown): v is GuairaPoint => !!v && typeof v === 'object' && ['x', 'y'].every(k => {
    const n = (v as Record<string, unknown>)[k]; return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
});
const samePoint = (a: GuairaPoint, b: GuairaPoint) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Fail closed: the rendered scene and its exact five projected landmarks form one contract. */
export function parseGuairaMetadata(value: unknown): GuairaMetadata | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as GuairaMetadata & { campaignIntegrated?: unknown; version?: unknown };
    if (data.version !== 1 || data.worldId !== 'guaira' || data.campaignIntegrated !== false ||
        data.size?.width !== 1920 || data.size?.height !== 1200 || !isRecord(data.nodes) || !isRecord(data.routes)) return null;
    if (![1, 2, 3, 4, 5].every(i => isPoint(data.nodes[`guaira-${i}`]))) return null;
    for (let i = 0; i < 4; i++) {
        const route = data.routes[`${i}:${i + 1}`];
        if (!Array.isArray(route) || route.length < 2 || !route.every(isPoint) ||
            !samePoint(route[0], data.nodes[`guaira-${i + 1}`]) || !samePoint(route[route.length - 1], data.nodes[`guaira-${i + 2}`])) return null;
    }
    const b = data.artBounds;
    if (!isRecord(b) || !isPoint({ x: b.left, y: b.top }) || !isPoint({ x: b.right, y: b.bottom }) || b.left >= b.right || b.top >= b.bottom) return null;
    // Copy only local geometric data; no external IDs or links can become destinations.
    return { worldId: 'guaira', size: { width: 1920, height: 1200 },
        nodes: Object.fromEntries([1, 2, 3, 4, 5].map(i => { const key = `guaira-${i}`, p = data.nodes[key]; return [key, { x: p.x, y: p.y }]; })),
        routes: Object.fromEntries(['0:1', '1:2', '2:3', '3:4'].map(key => [key, data.routes[key].map(p => ({ x: p.x, y: p.y }))])),
        artBounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } };
}
/** One continuous authored road: rapid reversals change direction at the current foot position. */
export class GuairaMapModel {
    readonly path: GuairaPoint[];
    readonly distances: number[] = [0];
    readonly length: number;
    readonly landmarkDistances: Record<string, number>;
    readonly destinationDistances: Record<GuairaDestination, number>;
    readonly arrivalDistances: Record<GuairaArrival, number>;
    selected: GuairaDestination | null;
    distance: number;
    facingLeft = false;
    closed = false;
    reducedMotion = false;
    returnContext: GuairaReturnContext | null;
    constructor(readonly metadata: GuairaMetadata, initial: GuairaArrival = 'town', context: GuairaReturnContext | null = null) {
        this.path = ['0:1', '1:2', '2:3', '3:4'].flatMap((key, index) => metadata.routes[key].slice(index ? 1 : 0));
        for (let i = 1; i < this.path.length; i++) this.distances.push(this.distances[i - 1] +
            Math.hypot((this.path[i].x - this.path[i - 1].x) * 1920, (this.path[i].y - this.path[i - 1].y) * 1200));
        this.length = this.distances[this.distances.length - 1];
        this.landmarkDistances = Object.fromEntries(Object.entries(metadata.nodes).map(([id, point]) =>
            [id, this.distances[this.path.findIndex(p => samePoint(p, point))]]));
        this.destinationDistances = Object.fromEntries(Object.entries(GUAIRA_DESTINATIONS).map(([id, destination]) =>
            [id, this.landmarkDistances[destination.node]])) as Record<GuairaDestination, number>;
        this.arrivalDistances = Object.fromEntries(Object.entries(ARRIVAL_NODES).map(([arrival, node]) =>
            [arrival, this.landmarkDistances[node]])) as Record<GuairaArrival, number>;
        this.returnContext = validReturnContext(initial, context) ? context : null;
        this.selected = initial === 'rice' || initial === 'vazao' ? null : initial === 'corral'
            ? this.returnContext === 'bull-clear' ? 'subida' : 'curral' : 'town';
        this.distance = this.arrivalDistances[initial];
    }
    get targetDistance(): number { return this.selected === null ? this.distance : this.destinationDistances[this.selected]; }
    get arrival(): GuairaArrival | null {
        return (Object.keys(ARRIVAL_NODES) as GuairaArrival[]).find(at => Math.abs(this.arrivalDistances[at] - this.distance) < 1e-6) ?? null;
    }
    get moving(): boolean { return !this.closed && Math.abs(this.targetDistance - this.distance) > 1e-6; }
    /** Casa is a contextual experiment entry, never a fourth map destination. */
    get canEnterMayor(): boolean { return !this.closed && this.selected === null && this.arrival === 'vazao' && !this.moving; }
    get canWalkToCorral(): boolean { return !this.closed && this.selected === null && this.arrival === 'rice' && !this.moving; }
    get canEnter(): boolean { return this.canEnterMayor || (!this.closed && this.selected !== null && !this.moving); }
    get point(): GuairaPoint { return this.pointAt(this.distance); }
    pointAt(distance: number): GuairaPoint {
        const d = Math.min(this.length, Math.max(0, distance));
        for (let i = 1; i < this.path.length; i++) {
            if (d > this.distances[i]) continue;
            const a = this.path[i - 1], b = this.path[i], segment = this.distances[i] - this.distances[i - 1];
            const t = segment > 0 ? (d - this.distances[i - 1]) / segment : 0;
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
        return { ...this.path[this.path.length - 1] };
    }
    select(destination: GuairaDestination): void {
        if (this.closed || !Object.prototype.hasOwnProperty.call(GUAIRA_DESTINATIONS, destination)) return;
        this.returnContext = null;
        this.selected = destination;
        if (this.reducedMotion) this.skip();
    }
    tick(seconds: number): void {
        if (!this.moving || !Number.isFinite(seconds) || seconds <= 0) return;
        const before = this.point;
        const delta = this.targetDistance - this.distance;
        // Suspension never teleports the actor across the route on focus return.
        this.distance += Math.sign(delta) * Math.min(Math.abs(delta), Math.min(seconds, .05) * 170);
        this.facingLeft = this.point.x < before.x;
    }
    skip(): void { if (!this.closed) this.distance = this.targetDistance; }
    setReducedMotion(reduced: boolean): void { this.reducedMotion = reduced; if (reduced) this.skip(); }
    returnToCorral(): void { if (this.canEnterMayor) this.select('curral'); }
    walkToCorral(): void { if (this.canWalkToCorral) this.select('curral'); }
    enterHref(): string | null {
        if (this.canEnterMayor) return './guaira-prefeito.html';
        return this.canEnter && this.selected ? GUAIRA_DESTINATIONS[this.selected].href : null;
    }
    close(): void { this.closed = true; }
}
