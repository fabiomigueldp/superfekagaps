import type { MapPoint } from './WorldMapModel';

/** Ground coordinates use the same 8:5 atlas metric as the island artwork. */
export interface AircraftRoute {
    departureStart: MapPoint;
    departureLift: MapPoint;
    arrivalTouchdown: MapPoint;
    arrivalStop: MapPoint;
    /** Optional authored airborne handles; default handles preserve runway velocity. */
    cruiseControls?: readonly [MapPoint, MapPoint];
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
        (!route.cruiseControls || route.cruiseControls.length === 2 && route.cruiseControls.every(finitePoint)) &&
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
