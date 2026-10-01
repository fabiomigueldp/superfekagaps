import type { JourneyEdgeDirection, JourneyLeg, JourneyState } from './WorldJourneyModel';
import { samplePath, type MapPoint } from './WorldMapModel';

/** Sail edges run worlds[0] → worlds[1]; both boarding edges run dock → berth. */
export interface FerryDefinition {
    id: string;
    sailEdge: string;
    worlds: readonly [number, number];
    boardingEdges: Readonly<Record<number, string>>;
    berths: Readonly<Record<number, string>>;
}
/** Vehicle positions and heading easing belong to this map session, never save. */
export interface FerryState { mooredWorld: number; headingIndex: number; headingAt: number }
export interface FerryGeometry {
    berths: Readonly<Record<number, { foot: MapPoint; headingFrame: number }>>;
    /** Forward order and reversed path order, respectively. */
    segmentHeadings: readonly number[];
    reverseSegmentHeadings: readonly number[];
}
export interface FerryPose { foot: MapPoint; frameIndex: number; state: FerryState }

/** Preserve the released identifiers used by routing and rendering. */
export const COAST_PORT_FERRY: FerryDefinition = {
    id: 'coast-port-sail', sailEdge: 'coast-port-sail', worlds: [1, 2],
    boardingEdges: { 1: '1-board', 2: '2-board' }, berths: { 1: '1-berth', 2: '2-berth' },
};

/** Seed from the actual restored/played world, after recovering a locked save.
 * Earlier worlds leave each ferry at its first terminal; later worlds leave it
 * at the second. Call only on explicit session/return initialization, not select.
 */
export const createFerry = (definition: FerryDefinition, restoredWorld: number): FerryState => ({
    mooredWorld: restoredWorld < definition.worlds[1] ? definition.worlds[0] : definition.worlds[1],
    headingIndex: -1, headingAt: 0,
});

/** Reverse boarding always permits disembarking at a future arrival or retreat.
 * An active JourneyLeg can reverse independently of these departure permissions.
 * Merge with other ferry/cable capabilities before each selection and after travel.
 */
export function ferryEdgeDirections(state: FerryState, definition: FerryDefinition,
    enabled: boolean): Record<string, JourneyEdgeDirection> {
    const [from, to] = definition.worlds;
    return {
        [definition.sailEdge]: enabled ? state.mooredWorld === from ? 'forward' : 'reverse' : 'none',
        [definition.boardingEdges[from]]: enabled && state.mooredWorld === from ? 'both' : 'reverse',
        [definition.boardingEdges[to]]: enabled && state.mooredWorld === to ? 'both' : 'reverse',
    };
}

/** Apply only around advanceJourney/skipJourney, which consume a leg prefix.
 * Select normally then skip for reduced motion so the consumed ride is observed.
 * A partial ride, selection, art reload, or another ferry cannot move this berth.
 */
export function updateFerryAfterTravel(state: FerryState, definition: FerryDefinition,
    before: JourneyState, after: JourneyState): FerryState {
    const consumed = before.legs.length - after.legs.length;
    if (consumed <= 0) return state;
    let mooredWorld = state.mooredWorld;
    for (const leg of before.legs.slice(0, consumed)) {
        if (leg.mode !== 'sail' || leg.id !== definition.sailEdge) continue;
        const endpoint = leg.direction === 1 ? leg.to : leg.from;
        const world = definition.worlds.find(world => definition.berths[world] === endpoint);
        if (world !== undefined) mooredWorld = world;
    }
    return mooredWorld === state.mooredWorld ? state : { ...state, mooredWorld };
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

/** Only this ferry's actual sail leg moves its hull or eases its heading. Parked
 * boats snap to their own berth frame even while another ferry/cable is moving.
 * Returned state is independent, allowing all hulls to be sampled in any order.
 */
export function sampleFerry(state: FerryState, definition: FerryDefinition, geometry: FerryGeometry,
    options: { active?: JourneyLeg; point?: MapPoint; time: number; reducedMotion?: boolean }): FerryPose {
    const { active, time, reducedMotion } = options, dock = geometry.berths[state.mooredWorld];
    const sailing = active?.mode === 'sail' && active.id === definition.sailEdge;
    let frameIndex = dock.headingFrame, foot = { ...dock.foot };
    if (sailing) {
        foot = options.point ? { ...options.point } : samplePath(active.points, active.progress);
        const segment = journeyPathSegment(active.points, active.progress);
        const headings = active.direction === 1 ? geometry.segmentHeadings : geometry.reverseSegmentHeadings;
        const heading = headings[active.direction === 1 ? segment : active.points.length - 2 - segment];
        const remaining = active.duration * (active.direction === 1 ? 1 - active.progress : active.progress);
        const arrivalWorld = definition.worlds[active.direction === 1 ? 1 : 0];
        frameIndex = remaining < .65 ? geometry.berths[arrivalWorld].headingFrame : heading;
    }
    let headingIndex = state.headingIndex, headingAt = state.headingAt;
    if (headingIndex < 0 || reducedMotion || !sailing) { headingIndex = frameIndex; headingAt = time; }
    else if (headingIndex !== frameIndex && time - headingAt >= 120) {
        const turn = (frameIndex - headingIndex + 8) % 8;
        headingIndex = (headingIndex + (turn <= 4 ? 1 : 7)) % 8; headingAt = time;
    }
    return { foot, frameIndex: headingIndex, state: { ...state, headingIndex, headingAt } };
}
