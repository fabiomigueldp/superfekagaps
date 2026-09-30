import { samplePath, type MapPoint } from './WorldMapModel';

/** Geography belongs to the map author. Dock nodes are ordinary named points. */
export interface JourneyEdge {
    id: string;
    from: string;
    to: string;
    points?: readonly MapPoint[];
    duration: number;
    /** Author boarding edges from the shore to the boat; reverse is disembark. */
    mode: 'walk' | 'board' | 'sail';
}
export interface JourneyNetwork {
    nodes: Readonly<Record<string, MapPoint>>;
    edges: readonly JourneyEdge[];
}
export interface JourneyCapabilities {
    /** Derive these IDs with the existing progression rules, including secrets. */
    availableStages: readonly string[];
    /** Omit to enable every authored edge; supply to gate shortcuts or crossings. */
    availableEdges?: readonly string[];
}
export interface JourneyLeg extends JourneyEdge {
    points: readonly MapPoint[];
    /** Always measured along the authored edge, even after repeated reversals. */
    progress: number;
    direction: 1 | -1;
}
export interface JourneyState {
    selected: string;
    /** Last reached stage; the only journey value written to save.selected. */
    arrived: string;
    entered: string | null;
    /** The actual journey target can differ from a locked selection being inspected. */
    destination: string | null;
    node: string | null;
    point: MapPoint;
    legs: readonly JourneyLeg[];
    blocked: 'unavailable' | 'no-route' | null;
}
export type JourneyMode = 'arrived' | 'walk' | 'board' | 'sail' | 'disembark' | 'entered';
const stageId = (id: string) => /^[1-6]-[1-5]$/.test(id);
const stageIndex = (id: string) => Number(id[0]) * 5 + Number(id[2]);
const copy = (point: MapPoint): MapPoint => ({ x: point.x, y: point.y });
const same = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;
const validPoint = (point: MapPoint | undefined): point is MapPoint => !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
const available = (id: string, capabilities: JourneyCapabilities) => stageId(id) && capabilities.availableStages.includes(id);

/** Old saves may point to a locked selection. Recover at the nearest earlier
 * available stage, while retaining the selected ID so the UI can explain its gate.
 * No in-flight position is serialized: reloading during travel returns to arrived.
 */
export function createJourney(savedSelected: string, network: JourneyNetwork, capabilities: JourneyCapabilities): JourneyState {
    const stages = capabilities.availableStages.filter(id => stageId(id) && validPoint(network.nodes[id]))
        .sort((a, b) => stageIndex(a) - stageIndex(b));
    if (!stages.length) throw new Error('Journey needs an available campaign stage with an authored point.');
    const selected = stageId(savedSelected) ? savedSelected : stages[0];
    const earlier = stages.filter(id => stageIndex(id) <= stageIndex(selected));
    const arrived = stages.includes(selected) ? selected : earlier[earlier.length - 1] ?? stages[0];
    return { selected, arrived, entered: null, destination: null, node: arrived, point: copy(network.nodes[arrived]), legs: [],
        blocked: selected === arrived ? null : available(selected, capabilities) ? 'no-route' : 'unavailable' };
}

/** Normalize only authored edges. Invalid geometry never becomes an invented line. */
function authoredLegs(network: JourneyNetwork, capabilities: JourneyCapabilities): JourneyLeg[] {
    return network.edges.flatMap(edge => {
        if (capabilities.availableEdges && !capabilities.availableEdges.includes(edge.id)) return [];
        const from = network.nodes[edge.from], to = network.nodes[edge.to];
        if (!validPoint(from) || !validPoint(to) || !Number.isFinite(edge.duration) || edge.duration < 0 ||
            edge.points?.some(point => !validPoint(point))) return [];
        const points = [from, ...edge.points ?? [], to].filter((point, index, all) => !index || !same(point, all[index - 1])).map(copy);
        return [{ ...edge, points, progress: 0, direction: 1 as const }];
    });
}

/** Small weighted route search over authored paths, not terrain or rendered pixels. */
function route(from: string, to: string, edges: readonly JourneyLeg[]): JourneyLeg[] | null {
    const queue = [{ node: from, cost: 0, legs: [] as JourneyLeg[] }], visited = new Set<string>();
    while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift()!;
        if (current.node === to) return current.legs;
        if (visited.has(current.node)) continue;
        visited.add(current.node);
        for (const edge of edges) {
            if (edge.from !== current.node && edge.to !== current.node) continue;
            const forward = edge.from === current.node, node = forward ? edge.to : edge.from;
            if (!visited.has(node)) queue.push({ node, cost: current.cost + edge.duration,
                legs: [...current.legs, { ...edge, direction: forward ? 1 : -1, progress: forward ? 0 : 1 }] });
        }
    }
    return null;
}
const remaining = (leg: JourneyLeg) => leg.duration * (leg.direction === 1 ? 1 - leg.progress : leg.progress);
const cost = (legs: readonly JourneyLeg[]) => legs.reduce((sum, leg) => sum + remaining(leg), 0);
const endpoint = (leg: JourneyLeg) => leg.direction === 1 ? leg.to : leg.from;

/** A selection is a destination request, never permission to enter gameplay.
 * Mid-edge retargeting can use either endpoint, without abandoning the authored
 * edge or changing Feka's current point. Repeated reverse commands remain stable.
 */
export function selectJourney(state: JourneyState, selected: string, network: JourneyNetwork,
    capabilities: JourneyCapabilities, options: { reducedMotion?: boolean } = {}): JourneyState {
    if (state.entered) return state;
    if (!available(selected, capabilities)) return { ...state, selected, blocked: 'unavailable' };
    if (!validPoint(network.nodes[selected])) return { ...state, selected, blocked: 'no-route' };
    const edges = authoredLegs(network, capabilities), active = state.legs[0];
    let legs: JourneyLeg[] | null;
    if (active) {
        // Preserve the current edge even if a gate changed mid-trip: either endpoint
        // is a safe exit. Every subsequent edge still obeys current capabilities.
        const candidates = [active.direction, -active.direction].flatMap(direction => {
            const partial: JourneyLeg = { ...active, direction: direction as 1 | -1 };
            const rest = route(endpoint(partial), selected, edges);
            return rest ? [[partial, ...rest]] : [];
        });
        candidates.sort((a, b) => cost(a) - cost(b));
        legs = candidates[0] ?? null;
    } else legs = route(state.node ?? state.arrived, selected, edges);
    if (!legs) return { ...state, selected, blocked: 'no-route' };
    const next = { ...state, selected, destination: selected, entered: null, legs, blocked: null };
    return options.reducedMotion ? skipJourney(next) : advanceJourney(next, 0);
}

/** Seconds, supplied by the owning game loop. A large delta consumes all finished
 * legs, including zero-duration docks; NaN/Infinity never corrupt position.
 */
export function advanceJourney(state: JourneyState, seconds: number, reducedMotion = false): JourneyState {
    if (!state.destination || state.entered) return state;
    if (reducedMotion) return skipJourney(state);
    let budget = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    let point = state.point, node = state.node;
    const legs = [...state.legs];
    while (legs.length) {
        const leg = legs[0], duration = remaining(leg);
        if (duration > budget) {
            const progress = leg.progress + leg.direction * budget / leg.duration;
            legs[0] = { ...leg, progress };
            return { ...state, point: samplePath(leg.points, progress), node: null, legs };
        }
        budget -= duration;
        point = samplePath(leg.points, leg.direction === 1 ? 1 : 0);
        node = endpoint(leg);
        legs.shift();
    }
    return { ...state, point: copy(point), node, legs, arrived: state.destination, destination: null };
}

/** Optional skip and reduced motion complete travel, but still require Enter. */
export function skipJourney(state: JourneyState): JourneyState {
    if (!state.destination || state.entered) return state;
    const last = state.legs[state.legs.length - 1];
    return { ...state, point: last ? samplePath(last.points, last.direction === 1 ? 1 : 0) : copy(state.point),
        node: state.destination, arrived: state.destination, destination: null, legs: [] };
}

export function canEnterJourney(state: JourneyState, capabilities: JourneyCapabilities): boolean {
    return !state.entered && !state.destination && !state.legs.length && state.selected === state.arrived &&
        available(state.selected, capabilities);
}
export function enterJourney(state: JourneyState, capabilities: JourneyCapabilities): JourneyState {
    return canEnterJourney(state, capabilities) ? { ...state, entered: state.selected } : state;
}
export function journeyMode(state: JourneyState): JourneyMode {
    if (state.entered) return 'entered';
    const leg = state.legs[0];
    return !leg ? 'arrived' : leg.mode === 'board' && leg.direction === -1 ? 'disembark' : leg.mode;
}
export function journeyBlockReason(state: JourneyState): string {
    return state.blocked === 'unavailable' ? 'Conclua o caminho anterior para visitar esta fase.'
        : state.blocked === 'no-route' ? 'Esta ligação ainda não está disponível no mapa.' : '';
}
export const journeySaveSelection = (state: JourneyState): string => state.arrived;

/** Gameplay returns to the stage actually played. finishStage's newly selected
 * next stage becomes a fresh trip, so a Costa clear does not teleport to Porto.
 * Pass playedStage for both IDs when returning without completing the phase.
 */
export function returnToJourney(playedStage: string, selectedStage: string, network: JourneyNetwork,
    capabilities: JourneyCapabilities, options: { reducedMotion?: boolean } = {}): JourneyState {
    return selectJourney(createJourney(playedStage, network, capabilities), selectedStage, network, capabilities, options);
}
