import type { MapPoint } from './WorldMapModel';

/** Ground coordinates use the same 8:5 atlas metric as the island artwork. */
export interface AircraftRunwayContacts {
    departureStart: MapPoint;
    departureLift: MapPoint;
    arrivalTouchdown: MapPoint;
    arrivalStop: MapPoint;
}
export interface AircraftRoute extends AircraftRunwayContacts {
    /** Optional authored airborne handles; default handles preserve runway velocity. */
    cruiseControls?: readonly [MapPoint, MapPoint];
    /** Straight low-altitude extensions in seconds; turns start/end above these corridors. */
    runwayCorridors?: {
        departure: number;
        arrival: number;
        /** Build offshore clearance with a two-second squared smoothstep before cruise height. */
        departureOffshoreClimb?: boolean;
        arrivalOffshoreClimb?: boolean;
        bendControls?: readonly [MapPoint, MapPoint];
        /** Preserve the other airport's established low-altitude route exactly. */
        oppositeTerminalContacts?: AircraftRunwayContacts;
    };
    /** Vertical screen/map displacement, not a world z coordinate. */
    altitude?: number;
    scale?: number;
}
export type AircraftStage = 'boarding' | 'takeoff-roll' | 'climb' | 'cruise' | 'approach' | 'landing-roll' | 'arrived';
export interface AircraftPose {
    stage: AircraftStage;
    ground: MapPoint;
    position: MapPoint;
    heading: number;
    altitude: number;
    bank: number;
    pitch: number;
    suspension: number;
    speed: number;
    propellerSpeed: number;
    dust: number;
    airWisps: number;
    progress: number;
    complete: boolean;
    reducedMotion: boolean;
    scale: number;
}
export const AIRCRAFT_TRAVEL_DURATION = 7.4;
export const AIRCRAFT_REDUCED_DURATION = 1.15;
export const AIRCRAFT_TIMING = Object.freeze({ boarding: .55, departure: 1.55, flight: 4, landing: 1.3 });
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: MapPoint, b: MapPoint, t: number): MapPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const delta = (a: MapPoint, b: MapPoint): MapPoint => ({ x: b.x - a.x, y: b.y - a.y });
const metric = (v: MapPoint) => Math.hypot(v.x * 1.6, v.y);
const finitePoint = (p: MapPoint) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
export function validAircraftRoute(route: AircraftRoute): boolean {
    return !!route && [route.departureStart, route.departureLift, route.arrivalTouchdown, route.arrivalStop].every(finitePoint) &&
        metric(delta(route.departureStart, route.departureLift)) > .001 && metric(delta(route.arrivalTouchdown, route.arrivalStop)) > .001 &&
        (!route.cruiseControls || Array.isArray(route.cruiseControls) && route.cruiseControls.length === 2 && route.cruiseControls.every(finitePoint)) &&
        (!route.runwayCorridors || !route.cruiseControls &&
            [route.runwayCorridors.departure, route.runwayCorridors.arrival].every(n => Number.isFinite(n) && n >= 0 && n <= 1) &&
            route.runwayCorridors.departure + route.runwayCorridors.arrival > 0 &&
            [route.runwayCorridors.departureOffshoreClimb, route.runwayCorridors.arrivalOffshoreClimb].every(n => n === undefined || typeof n === 'boolean') &&
            (!route.runwayCorridors.bendControls || Array.isArray(route.runwayCorridors.bendControls) && route.runwayCorridors.bendControls.length === 2 && route.runwayCorridors.bendControls.every(finitePoint)) &&
            (!route.runwayCorridors.oppositeTerminalContacts || validAircraftRoute({
                departureStart: route.runwayCorridors.oppositeTerminalContacts.departureStart,
                departureLift: route.runwayCorridors.oppositeTerminalContacts.departureLift,
                arrivalTouchdown: route.runwayCorridors.oppositeTerminalContacts.arrivalTouchdown,
                arrivalStop: route.runwayCorridors.oppositeTerminalContacts.arrivalStop,
            }))) &&
        (route.altitude === undefined || Number.isFinite(route.altitude) && route.altitude >= 0 && route.altitude <= 2) &&
        (route.scale === undefined || Number.isFinite(route.scale) && route.scale > 0 && route.scale <= 8);
}
function cubic(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint, t: number): MapPoint {
    const q = 1 - t;
    return { x: q ** 3 * a.x + 3 * q ** 2 * t * b.x + 3 * q * t ** 2 * c.x + t ** 3 * d.x,
        y: q ** 3 * a.y + 3 * q ** 2 * t * b.y + 3 * q * t ** 2 * c.y + t ** 3 * d.y };
}
function tangent(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint, t: number): MapPoint {
    const q = 1 - t;
    return { x: 3 * q * q * (b.x - a.x) + 6 * q * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
        y: 3 * q * q * (b.y - a.y) + 6 * q * t * (c.y - b.y) + 3 * t * t * (d.y - c.y) };
}
/** Runway-aligned acceleration through the low corridor. The central Bézier has
 * matching first derivatives and zero second derivatives at both straight joins,
 * so the aircraft cannot sweep a turning wing across a terminal at low altitude. */
function alignedCorridorFlight(route: AircraftRoute, seconds: number): { ground: MapPoint; velocity: MapPoint } {
    const { departure, arrival } = route.runwayCorridors!;
    const take = delta(route.departureStart, route.departureLift), land = delta(route.arrivalTouchdown, route.arrivalStop);
    const v = { x: take.x * 2 / 1.55, y: take.y * 2 / 1.55 };
    const w = { x: land.x * 2 / 1.3, y: land.y * 2 / 1.3 };
    const advance = (p: MapPoint, speed: MapPoint, time: number) => ({ x: p.x + speed.x * time, y: p.y + speed.y * time });
    // Airspeed grows gently to twice roll speed while climbing straight, and
    // reverses that easing on final approach. Endpoint acceleration is zero.
    const corridorDistance = (time: number, duration: number) => {
        const u = time / duration;
        return duration * (u + u ** 3 - .5 * u ** 4);
    };
    if (departure && seconds <= departure) return {
        ground: advance(route.departureLift, v, corridorDistance(seconds, departure)),
        velocity: { x: v.x * (1 + smooth(seconds / departure)), y: v.y * (1 + smooth(seconds / departure)) },
    };
    if (arrival && seconds >= 4 - arrival) return {
        ground: advance(route.arrivalTouchdown, w, -corridorDistance(4 - seconds, arrival)),
        velocity: { x: w.x * (1 + smooth((4 - seconds) / arrival)), y: w.y * (1 + smooth((4 - seconds) / arrival)) },
    };
    const duration = 4 - departure - arrival, t = (seconds - departure) / duration;
    const a = advance(route.departureLift, v, 1.5 * departure), b = advance(route.arrivalTouchdown, w, -1.5 * arrival);
    if (departure) { v.x *= 2; v.y *= 2; }
    if (arrival) { w.x *= 2; w.y *= 2; }
    const controls = route.runwayCorridors!.bendControls, degree = controls ? 7 : 5;
    const points = [a, advance(a, v, duration / degree), advance(a, v, 2 * duration / degree),
        ...(controls ?? []), advance(b, w, -2 * duration / degree), advance(b, w, -duration / degree), b];
    const bezier = (controls: MapPoint[]): MapPoint => {
        const work = controls.map(p => ({ ...p }));
        for (let count = work.length - 1; count > 0; count--) for (let i = 0; i < count; i++) work[i] = mix(work[i], work[i + 1], t);
        return work[0];
    };
    return { ground: bezier(points), velocity: bezier(points.slice(1).map((p, i) => ({
        x: (p.x - points[i].x) * degree / duration, y: (p.y - points[i].y) * degree / duration,
    }))) };
}
/** Weight one in the Guaíra corridor, zero throughout the opposite terminal's
 * first/last airborne second. Value, first and second derivatives match at joins. */
function corridorBlend(route: AircraftRoute, seconds: number): { weight: number; derivative: number } {
    const corridor = route.runwayCorridors!;
    if (!corridor.oppositeTerminalContacts || corridor.departure && corridor.arrival) return { weight: 1, derivative: 0 };
    const increasing = !corridor.departure, u = clamp(increasing ? seconds - 1 : seconds - 2);
    const eased = u ** 3 * (10 + u * (-15 + 6 * u));
    const slope = 30 * u ** 2 * (1 - u) ** 2;
    return { weight: increasing ? eased : 1 - eased, derivative: increasing ? slope : -slope };
}
function originalTerminalRoute(route: AircraftRoute): AircraftRoute {
    const contacts = route.runwayCorridors!.oppositeTerminalContacts!;
    // Copy only the validated contact contract; unrelated options must not
    // change baseline motion or recursively introduce another corridor route.
    return { departureStart: contacts.departureStart, departureLift: contacts.departureLift,
        arrivalTouchdown: contacts.arrivalTouchdown, arrivalStop: contacts.arrivalStop,
        altitude: route.altitude, scale: route.scale };
}
function corridorFlight(route: AircraftRoute, seconds: number): { ground: MapPoint; velocity: MapPoint } {
    const current = alignedCorridorFlight(route, seconds), { weight, derivative } = corridorBlend(route, seconds);
    if (weight === 1) return current;
    const baseline = originalTerminalRoute(route), take = delta(baseline.departureStart, baseline.departureLift), land = delta(baseline.arrivalTouchdown, baseline.arrivalStop);
    const b = { x: baseline.departureLift.x + take.x * 8 / (1.55 * 3), y: baseline.departureLift.y + take.y * 8 / (1.55 * 3) };
    const c = { x: baseline.arrivalTouchdown.x - land.x * 8 / (1.3 * 3), y: baseline.arrivalTouchdown.y - land.y * 8 / (1.3 * 3) };
    const ground = cubic(baseline.departureLift, b, c, baseline.arrivalTouchdown, seconds / 4);
    const tangentVector = tangent(baseline.departureLift, b, c, baseline.arrivalTouchdown, seconds / 4);
    const velocity = { x: tangentVector.x / 4, y: tangentVector.y / 4 };
    return { ground: mix(ground, current.ground, weight), velocity: {
        x: velocity.x + (current.velocity.x - velocity.x) * weight + (current.ground.x - ground.x) * derivative,
        y: velocity.y + (current.velocity.y - velocity.y) * weight + (current.ground.y - ground.y) * derivative,
    } };
}
/** Default transition travels across a fixed camera. Reverse endpoints produce a
 * genuinely reversed route, rather than mirroring a perspective sprite. */
export function createAircraftRoute(from: MapPoint = { x: .13, y: .72 }, to: MapPoint = { x: .87, y: .56 }): AircraftRoute {
    const dx = to.x - from.x, dy = to.y - from.y;
    return { departureStart: { ...from }, departureLift: { x: from.x + dx * .19, y: from.y + dy * .12 },
        arrivalTouchdown: { x: to.x - dx * .19, y: to.y - dy * .12 }, arrivalStop: { ...to }, altitude: .20, scale: .82 };
}
/** Deterministic, seekable motion. The host owns navigation/persistence and commits
 * arrival only after complete; sampling or drawing can never mutate game saves.
 * No accumulated integrator state: suspension and inertia remain stable on tab
 * resume, skipped frames, cancellation, replay, and time going backwards. */
export function sampleAircraftTravel(route: AircraftRoute, elapsedSeconds: number, reducedMotion = false): AircraftPose {
    if (!validAircraftRoute(route)) throw new RangeError('Aircraft route needs finite nonzero runways and positive scale');
    const duration = reducedMotion ? AIRCRAFT_REDUCED_DURATION : AIRCRAFT_TRAVEL_DURATION;
    const elapsed = Number.isFinite(elapsedSeconds) ? clamp(elapsedSeconds, 0, duration) : elapsedSeconds === Infinity ? duration : 0;
    const progress = elapsed / duration, complete = elapsed >= duration;
    const corridor = route.runwayCorridors;
    if (!reducedMotion && corridor?.oppositeTerminalContacts &&
        (!corridor.departure && elapsed <= 3.1 || !corridor.arrival && elapsed >= 5.1)) {
        return sampleAircraftTravel(originalTerminalRoute(route), elapsed);
    }
    const take = delta(route.departureStart, route.departureLift), land = delta(route.arrivalTouchdown, route.arrivalStop);
    let ground: MapPoint, velocity = take, stage: AircraftStage, altitude = 0, bank = 0, pitch = 0, suspension = 0, dust = 0, airWisps = 0, speed = 0;
    let propellerSpeed = 0;
    if (reducedMotion) {
        // Calm ground-level transfer: no bank, bob, trail, propeller flashing or
        // camera motion. Hosts may also replace this by a simple dissolve.
        ground = mix(route.departureStart, route.arrivalStop, smooth(progress));
        velocity = delta(route.departureStart, route.arrivalStop);
        stage = complete ? 'arrived' : 'cruise';
    } else if (elapsed < AIRCRAFT_TIMING.boarding) {
        ground = { ...route.departureStart }; stage = 'boarding';
        propellerSpeed = 2 + smooth(elapsed / AIRCRAFT_TIMING.boarding) * 13;
    } else if (elapsed < 2.1) {
        const t = (elapsed - .55) / 1.55;
        ground = mix(route.departureStart, route.departureLift, t * t); stage = 'takeoff-roll';
        speed = metric(take) * 2 * t / 1.55; propellerSpeed = 15 + 22 * smooth(t);
        pitch = -.038 * smooth((t - .58) / .42);
        suspension = Math.sin(t * 36) * .0012 * Math.sin(Math.PI * t);
        dust = smooth(t * 2) * (1 - smooth((t - .85) / .15));
    } else if (elapsed < 6.1) {
        const t = (elapsed - 2.1) / 4;
        if (route.runwayCorridors) {
            const seconds = elapsed - 2.1, corridor = route.runwayCorridors;
            ({ ground, velocity } = corridorFlight(route, seconds));
            speed = metric(velocity);
            const headingAt = (u: number) => { const v = corridorFlight(route, clamp(u, 0, 4)).velocity; return Math.atan2(v.y, v.x * 1.6); };
            const turn = Math.atan2(Math.sin(headingAt(seconds + .1) - headingAt(seconds - .1)), Math.cos(headingAt(seconds + .1) - headingAt(seconds - .1)));
            const turnWindow = smooth((seconds - corridor.departure) / .25) * smooth((4 - corridor.arrival - seconds) / .25);
            bank = clamp(turn * 1.25, -.14, .14) * Math.sin(Math.PI * t) * turnWindow;
            if (corridor.oppositeTerminalContacts && corridorBlend(route, seconds).weight < 1) {
                const original = sampleAircraftTravel(originalTerminalRoute(route), elapsed);
                bank = original.bank + (bank - original.bank) * corridorBlend(route, seconds).weight;
            }
            // Guaíra reaches cruise height while aligned. Rocky coastal terminals
            // climb gradually offshore, meeting that same height at mid-flight.
            // An unmodified opposite airport retains its original profile.
            const endSeconds = t < .5 ? seconds : 4 - seconds;
            const corridorSeconds = t < .5 ? corridor.departure : corridor.arrival;
            const offshoreClimb = t < .5 ? corridor.departureOffshoreClimb : corridor.arrivalOffshoreClimb;
            altitude = (route.altitude ?? .20) * (offshoreClimb ? smooth(endSeconds / 2) ** 2 : corridorSeconds ? smooth(endSeconds / corridorSeconds) : Math.sin(Math.PI * t) ** 2);
            pitch = -.065 * Math.sin(t * Math.PI * 2) - (corridor.departure ? .038 * (1 - smooth(seconds / .3)) : 0);
        } else {
            const [b, c] = route.cruiseControls ?? [
                { x: route.departureLift.x + take.x * 8 / (1.55 * 3), y: route.departureLift.y + take.y * 8 / (1.55 * 3) },
                { x: route.arrivalTouchdown.x - land.x * 8 / (1.3 * 3), y: route.arrivalTouchdown.y - land.y * 8 / (1.3 * 3) },
            ];
            ground = cubic(route.departureLift, b, c, route.arrivalTouchdown, t);
            velocity = tangent(route.departureLift, b, c, route.arrivalTouchdown, t);
            speed = metric(velocity) / 4;
            const headingAt = (u: number) => { const v = tangent(route.departureLift, b, c, route.arrivalTouchdown, clamp(u)); return Math.atan2(v.y, v.x * 1.6); };
            const turn = Math.atan2(Math.sin(headingAt(t + .025) - headingAt(t - .025)), Math.cos(headingAt(t + .025) - headingAt(t - .025)));
            bank = clamp(turn * 1.25, -.14, .14) * Math.sin(Math.PI * t);
            altitude = (route.altitude ?? .20) * Math.sin(Math.PI * t) ** 2;
            pitch = -.065 * Math.sin(t * Math.PI * 2);
        }
        propellerSpeed = 37 - 10 * smooth(t);
        stage = t < .26 ? 'climb' : t > .73 ? 'approach' : 'cruise';
        airWisps = Math.sin(Math.PI * t) ** 2 * Math.min(1, Math.abs(bank) * 6 + .10);
    } else {
        const t = clamp((elapsed - 6.1) / 1.3);
        ground = mix(route.arrivalTouchdown, route.arrivalStop, 2 * t - t * t); velocity = land;
        speed = metric(land) * 2 * (1 - t) / 1.3;
        stage = complete ? 'arrived' : 'landing-roll';
        // A single damped landing compression; exact zero at arrival.
        suspension = Math.sin(t * Math.PI * 3) * Math.exp(-t * 7) * .005 * (1 - t);
        pitch = .026 * Math.sin(t * Math.PI) * Math.exp(-t * 3);
        dust = Math.sin(Math.PI * Math.min(1, t * 2)) * (1 - t);
        propellerSpeed = complete ? 0 : 27 * (1 - smooth(t));
    }
    return { stage, ground, position: { x: ground.x, y: ground.y - altitude + suspension },
        heading: Math.atan2(velocity.y, velocity.x * 1.6), altitude, bank, pitch, suspension, speed, propellerSpeed,
        dust, airWisps, progress, complete, reducedMotion, scale: route.scale ?? 1 };
}
