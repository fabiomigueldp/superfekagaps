import { journeyLegPoint, sailClockVelocity, sailDistanceProgress, sailPathPoints, type JourneyEdgeDirection, type JourneyLeg, type JourneyState } from './WorldJourneyModel';
import { samplePath, type MapPoint } from './WorldMapModel';
import type { BoatAtlasFrame } from './WorldAtlasArt';
import { advanceVesselWake, dampedMotion, sampleVesselDynamics, VESSEL_MAX_ROTATION, VESSEL_MOORED_SWELL, type VesselDynamics, type VesselMotion, type VesselWakeState } from './WorldVesselMotion';

/** Sail edges run worlds[0] → worlds[1]; both boarding edges run dock → berth. */
export interface FerryDefinition {
    id: string;
    sailEdge: string;
    worlds: readonly [number, number];
    boardingEdges: Readonly<Record<number, string>>;
    berths: Readonly<Record<number, string>>;
}
/** Vehicle positions and heading easing belong to this map session, never save. */
export interface FerryState {
    mooredWorld: number; headingIndex: number; headingAt: number; headingRadians?: number; poseAt?: number;
    yawVelocity?: number;
    dynamics?: VesselDynamics;
    wake?: VesselWakeState;
}
export interface FerryGeometry {
    berths: Readonly<Record<number, { foot: MapPoint; headingFrame: number }>>;
    /** Forward order and reversed path order, respectively. */
    segmentHeadings: readonly number[];
    reverseSegmentHeadings: readonly number[];
    art?: { frames: readonly (BoatAtlasFrame & { worldHeadingRadians: number; screenHeadingRadians: number })[];
        headingProjection?: { xAxis: MapPoint; yAxis: MapPoint } };
}
export interface FerryPose {
    /** Authored deck anchor, before the shared hull/passenger visual motion. */
    foot: MapPoint; frameIndex: number; state: FerryState;
    motion?: VesselMotion }

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
    if (geometry.art) return sampleFluidFerry(state, definition, geometry, options);
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

const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mixAngle = (from: number, to: number, t: number) => from + angleDelta(from, to) * t;
const hullRotation = (dynamics: VesselDynamics | undefined, heading: number) => Math.max(-VESSEL_MAX_ROTATION, Math.min(VESSEL_MAX_ROTATION,
    (dynamics?.roll.value ?? 0) * Math.sin(heading) + (dynamics?.pitch.value ?? 0) * Math.cos(heading)));
function sampleFluidFerry(state: FerryState, definition: FerryDefinition, geometry: FerryGeometry,
    options: { active?: JourneyLeg; point?: MapPoint; time: number; reducedMotion?: boolean }): FerryPose {
    const art = geometry.art!, { active, time, reducedMotion } = options;
    const nearest = (angle: number) => art.frames.reduce((best, frame, index) =>
        Math.abs(angleDelta(angle, frame.worldHeadingRadians)) < Math.abs(angleDelta(angle, art.frames[best].worldHeadingRadians)) ? index : best, 0);
    const berthAngle = (world: number) => geometry.berths[world].headingFrame * Math.PI / 4;
    const offset = (index: number) => {
        const frame = art.frames[index], water = frame.waterlineAnchor ?? frame.passengerFoot, pixel = frame.widthInMap / frame.width;
        return { x: (water.x - frame.passengerFoot.x) * pixel, y: (water.y - frame.passengerFoot.y) * pixel * 1.6 };
    };
    const dock = geometry.berths[state.mooredWorld];
    const elapsed = (time - (state.poseAt ?? time)) / 1000;
    const dt = elapsed > 0 && elapsed <= .25 ? elapsed : 0;
    const previousDynamics = elapsed < 0 || elapsed > .25 ? undefined : state.dynamics;
    if (active?.mode !== 'sail' || active.id !== definition.sailEdge) {
        const angle = berthAngle(state.mooredWorld), frameIndex = nearest(angle);
        const deck = offset(frameIndex), waterline = { x: dock.foot.x + deck.x, y: dock.foot.y + deck.y };
        const screenHeading = art.frames[frameIndex].screenHeadingRadians;
        // Mooring removes propulsion, not buoyancy or momentum. The very same
        // springs settle the arrival load and keep following sheltered swell.
        const dynamics = reducedMotion ? undefined : sampleVesselDynamics(previousDynamics,
            waterline, screenHeading, 0, 0, time, dt, VESSEL_MOORED_SWELL);
        const wake = !reducedMotion && state.wake ? advanceVesselWake(state.wake,
            { ...state.wake.emitter, time, speed: 0 }) : undefined;
        return { foot: { ...dock.foot }, frameIndex,
            state: { ...state, headingIndex: frameIndex, headingAt: time, headingRadians: angle, poseAt: time,
                yawVelocity: 0, dynamics, wake: wake?.samples.length ? wake : undefined },
            motion: reducedMotion ? undefined : { waterline, screenHeading, speed: 0,
                heave: dynamics!.heave.value, rotation: hullRotation(dynamics, screenHeading), wake: wake?.samples } };
    }
    const distance = sailDistanceProgress(active.progress), path = sailPathPoints(active.points);
    const reference = options.point ?? journeyLegPoint(active), start = offset(nearest(berthAngle(definition.worlds[0]))), end = offset(nearest(berthAngle(definition.worlds[1])));
    const lengths = active.points.slice(1).map((p, i) => Math.hypot((p.x - active.points[i].x) * 1.6, p.y - active.points[i].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const openStart = Math.min(.4, lengths[0] / total + .015), openEnd = Math.max(.6, 1 - lengths[lengths.length - 1] / total - .015);
    // Keep the authored dock-side manoeuvres in their exact berth pose. The
    // hull turns only in clear water, not through the gangway beside its bow.
    const offsetMix = (progress: number) => smooth((progress - openStart) / (openEnd - openStart));
    const waterline = { x: reference.x + start.x + (end.x - start.x) * offsetMix(distance),
        y: reference.y + start.y + (end.y - start.y) * offsetMix(distance) };
    const headingDirection = active.sailHeadingDirection ?? active.direction;
    const from = Math.max(0, Math.min(1, distance - headingDirection * .008));
    const to = Math.max(0, Math.min(1, distance + headingDirection * .025));
    const a = samplePath(path, from), b = samplePath(path, to);
    const dx = ((b.x - a.x) + (end.x - start.x) * (offsetMix(to) - offsetMix(from))) * 1.6;
    const dy = (b.y - a.y) + (end.y - start.y) * (offsetMix(to) - offsetMix(from));
    // Older eight-view metadata also contains enough projected bearings to
    // recover this basis. New dense exports provide the measured axes directly.
    let projection = art.headingProjection;
    if (!projection) {
        const angles = [0, Math.PI / 4, Math.PI / 2].map(angle => art.frames[nearest(angle)].screenHeadingRadians);
        const ratio = -Math.sin(angles[1] - angles[0]) / Math.sin(angles[1] - angles[2]);
        projection = { xAxis: { x: Math.cos(angles[0]), y: Math.sin(angles[0]) },
            yAxis: { x: Math.cos(angles[2]) * ratio, y: Math.sin(angles[2]) * ratio } };
    }
    const { xAxis: x, yAxis: y } = projection, determinant = x.x * y.y - x.y * y.x;
    let target = Math.atan2((x.x * dy - x.y * dx) / determinant, (dx * y.y - dy * y.x) / determinant);
    const departureStart = headingDirection === 1 ? openStart * .5 : openStart;
    const departureEnd = headingDirection === -1 ? 1 - (1 - openEnd) * .5 : openEnd;
    const firstBlend = smooth((distance - departureStart) / (headingDirection === 1 ? .1 : .2));
    const lastBlend = smooth((distance - departureEnd + (headingDirection === 1 ? .2 : .1)) / (headingDirection === 1 ? .2 : .1));
    target = mixAngle(berthAngle(definition.worlds[0]), target, firstBlend);
    target = mixAngle(target, berthAngle(definition.worlds[1]), lastBlend);
    let angle = state.headingRadians ?? berthAngle(state.mooredWorld);
    const steering = dampedMotion({ value: angle, velocity: state.yawVelocity ?? 0 }, angle + angleDelta(angle, target), dt, 8);
    const amount = Math.max(-dt * 2.4, Math.min(dt * 2.4, steering.value - angle));
    angle += amount;
    const yawVelocity = reducedMotion ? 0 : Math.max(-2.4, Math.min(2.4, steering.velocity));
    if (reducedMotion) angle = target;
    const frameIndex = nearest(angle), deckOffset = offset(frameIndex);
    const velocity = sailClockVelocity(active);
    const speed = Math.abs(velocity) * Math.min(1, (1 - Math.cos(Math.PI * Math.min(active.progress, 1 - active.progress, .15) / .15)) / 2);
    const projected = { x: x.x * Math.cos(angle) + y.x * Math.sin(angle), y: x.y * Math.cos(angle) + y.y * Math.sin(angle) };
    const screenHeading = Math.atan2(projected.y, projected.x);
    const before = Math.max(0, distance - .0001), after = Math.min(1, distance + .0001);
    const previous = samplePath(path, before), next = samplePath(path, after);
    const actualHeading = Math.atan2((next.y - previous.y + (end.y - start.y) * (offsetMix(after) - offsetMix(before))) * velocity,
        (next.x - previous.x + (end.x - start.x) * (offsetMix(after) - offsetMix(before))) * 1.6 * velocity);
    // A stern wake would point ahead of an astern departure/retarget. Omit it
    // while braking or manoeuvring, and whenever the bow opposes actual travel.
    const wakeSpeed = !active.sailManeuver && Math.cos(actualHeading - screenHeading) > .5 ? speed : 0;
    const swell = VESSEL_MOORED_SWELL + (1 - VESSEL_MOORED_SWELL) * smooth(Math.min(active.progress, 1 - active.progress) / .12);
    const dynamics = reducedMotion ? undefined : sampleVesselDynamics(previousDynamics,
        waterline, screenHeading, speed * Math.cos(actualHeading - screenHeading), yawVelocity, time, dt, swell);
    // Change the forces near the quay, never multiply the resulting displacement
    // by zero. This preserves position AND velocity across sailing ↔ mooring.
    const heave = dynamics?.heave.value ?? 0, rotation = hullRotation(dynamics, screenHeading);
    const foot = { x: waterline.x - deckOffset.x, y: waterline.y - deckOffset.y };
    const pixel = art.frames[frameIndex].widthInMap * art.frames[frameIndex].passengerPixelScale / art.frames[frameIndex].width;
    const wake = reducedMotion ? undefined : advanceVesselWake(state.wake, {
        point: { x: waterline.x - Math.cos(screenHeading) * 15 * pixel, y: waterline.y - Math.sin(screenHeading) * 15 * pixel * 1.6 },
        heading: screenHeading, speed: wakeSpeed, time,
    });
    return { foot, frameIndex, state: { ...state, headingIndex: frameIndex, headingAt: time, headingRadians: angle, poseAt: time,
        yawVelocity, dynamics, wake },
        motion: { waterline, screenHeading, speed: reducedMotion ? 0 : wakeSpeed, heave, rotation, wake: wake?.samples } };
}
