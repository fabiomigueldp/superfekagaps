import type { JourneyEdgeDirection, JourneyLeg, JourneyState } from './WorldJourneyModel';
import { samplePath, type MapPoint } from './WorldMapModel';

export type CableCar = 'a' | 'b';
export type CableTerminal = 'lower' | 'upper';
/** Each car stays on its own fixed lane. Ride edges are authored lower → upper;
 * both boarding edges are authored platform → berth, regardless of terminal.
 */
export interface CableLane {
    rideEdge: string;
    boardingEdges: Readonly<Record<CableTerminal, string>>;
    berths: Readonly<Record<CableTerminal, string>>;
}
export interface CablePairDefinition { lanes: Readonly<Record<CableCar, CableLane>> }
/** Session-only parked configuration. During a ride, JourneyState supplies the
 * moving positions; this value changes only when a car reaches a terminal.
 */
export interface CablePairState { aAt: CableTerminal }
export type CableFootPaths = Readonly<Record<CableCar, readonly MapPoint[]>>;
export interface CablePairPose { feet: Record<CableCar, MapPoint>; movingCar: CableCar | null }

const cars = ['a', 'b'] as const;
const terminals = ['lower', 'upper'] as const;
const opposite = (terminal: CableTerminal): CableTerminal => terminal === 'lower' ? 'upper' : 'lower';

/** Reload needs no vehicle save: either valid pair configuration has a car at
 * both terminals. Use this deterministic configuration for a fresh map session.
 */
export const createCablePair = (): CablePairState => ({ aAt: 'lower' });
export const cableCarTerminal = (state: CablePairState, car: CableCar): CableTerminal => car === 'a' ? state.aAt : opposite(state.aAt);
export const cableCarAt = (state: CablePairState, terminal: CableTerminal): CableCar => state.aAt === terminal ? 'a' : 'b';

/** Both paths stay lower → upper in the caller's coordinate system. Canonical
 * progress decreases during reversal, so neither route nor either car is swapped.
 * Board/walk legs leave both cabins parked; the passenger moves independently.
 */
export function sampleCablePair(state: CablePairState, definition: CablePairDefinition, paths: CableFootPaths,
    active?: Pick<JourneyLeg, 'id' | 'mode' | 'progress'>): CablePairPose | null {
    if (cars.some(car => paths[car].length < 2 || paths[car].some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)))) return null;
    const movingCar = active?.mode === 'cable' ? cars.find(car => definition.lanes[car].rideEdge === active.id) ?? null : null;
    if (movingCar && !Number.isFinite(active!.progress)) return null;
    const t = movingCar ? Math.max(0, Math.min(1, active!.progress)) : 0;
    const a = movingCar === 'a' ? t : movingCar === 'b' ? 1 - t : state.aAt === 'lower' ? 0 : 1;
    return { feet: { a: samplePath(paths.a, a), b: samplePath(paths.b, 1 - a) }, movingCar };
}

/** Gate boarding only toward a car that is actually waiting. Reverse boarding
 * remains available at BOTH terminals, so a planned ride can disembark on arrival
 * and an in-flight rider can still leave safely if the shortcut becomes closed.
 * While Feka occupies one lane, prevent a continuation from boarding the other
 * car using its old parked position after the current ride would have moved it.
 * Recompute before every selection and after travel/skip, including rapid inputs.
 * Merge this result into the controller's existing edgeDirections; do not replace
 * availableEdges or unrelated ferry/bridge capabilities.
 */
export function cableEdgeDirections(state: CablePairState, definition: CablePairDefinition,
    enabled: boolean, active?: Pick<JourneyLeg, 'id' | 'mode'>): Record<string, JourneyEdgeDirection> {
    const result: Record<string, JourneyEdgeDirection> = {};
    const occupied = active && (active.mode === 'cable' || active.mode === 'cable-board')
        ? cars.find(car => definition.lanes[car].rideEdge === active.id ||
            terminals.some(terminal => definition.lanes[car].boardingEdges[terminal] === active.id)) : undefined;
    for (const car of cars) {
        const lane = definition.lanes[car], parked = cableCarTerminal(state, car);
        const departure = enabled && (!occupied || occupied === car);
        result[lane.rideEdge] = departure ? parked === 'lower' ? 'forward' : 'reverse' : 'none';
        for (const terminal of terminals)
            result[lane.boardingEdges[terminal]] = departure && parked === terminal ? 'both' : 'reverse';
    }
    return result;
}

/** Call only around advanceJourney or skipJourney, which consume a prefix of
 * the existing legs. Call before accepting another selection, including while
 * the remaining trip is still disembarking or walking toward its final stage.
 * For reduced motion, select normally, then skip and apply this same transition.
 * Never call around selection, return-to-map or reload: those replace the plan.
 */
export function updateCablePairAfterTravel(state: CablePairState, definition: CablePairDefinition,
    before: JourneyState, after: JourneyState): CablePairState {
    const consumed = before.legs.length - after.legs.length;
    if (consumed <= 0) return state;
    let aAt = state.aAt;
    for (const leg of before.legs.slice(0, consumed)) {
        if (leg.mode !== 'cable') continue;
        const car = cars.find(car => definition.lanes[car].rideEdge === leg.id);
        if (!car) continue;
        const endpoint = leg.direction === 1 ? leg.to : leg.from, lane = definition.lanes[car];
        const terminal = terminals.find(terminal => lane.berths[terminal] === endpoint);
        if (terminal) aAt = car === 'a' ? terminal : opposite(terminal);
    }
    return aAt === state.aAt ? state : { aAt };
}
