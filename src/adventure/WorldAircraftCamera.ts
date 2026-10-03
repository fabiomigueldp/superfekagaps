import { sampleAircraftTravel, AIRCRAFT_TRAVEL_DURATION, type AircraftRoute } from './WorldAircraftModel';
import type { MapCamera, MapPoint } from './WorldMapModel';

export interface AircraftCameraOptions {
    width: number;
    height: number;
    reducedMotion?: boolean;
    /** Fixed for the whole shot: airfields never inflate as the aircraft arrives. */
    zoom?: number;
    /** Optional landmark centers (not runway stops), in the same atlas coordinates. */
    departureFocus?: MapPoint;
    arrivalFocus?: MapPoint;
}
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: MapPoint, b: MapPoint, t: number): MapPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const limited = (a: MapPoint, b: MapPoint, amount: number): MapPoint => {
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx * 1.6, dy);
    return mix(a, b, length > amount ? amount / length : 1);
};

/** Seekable film framing, independent of frame rate, prior calls and physics.
 * A symmetric soft shutter smooths path acceleration without spring overshoot or
 * phase-boundary camera cuts. It follows the ground, not wheel/airframe vibration.
 * Bounded directional lead leaves landscape ahead of the plane; terminal context
 * gently replaces that lead on arrival. World scale remains constant throughout.
 */
export function sampleAircraftCamera(route: AircraftRoute, elapsedSeconds: number, options: AircraftCameraOptions): MapCamera {
    const width = Math.max(1, options.width), height = Math.max(1, options.height);
    const zoom = options.zoom ?? .9;
    if (options.reducedMotion) {
        // One static establishing shot, with enough room for both endpoints even
        // on long routes. No pan, shake, zoom, anticipation or altitude tracking.
        const center = mix(route.departureStart, route.arrivalStop, .5);
        const scale = Math.min(width / 1.6, height);
        const spanX = Math.abs(route.arrivalStop.x - route.departureStart.x) * 1.6 + .5;
        const spanY = Math.abs(route.arrivalStop.y - route.departureStart.y) + .4;
        return { center, width, height, zoom: Math.min(zoom, .52, width * .76 / (scale * spanX), height * .65 / (scale * spanY)) };
    }
    const elapsed = Number.isFinite(elapsedSeconds) ? clamp(elapsedSeconds, 0, AIRCRAFT_TRAVEL_DURATION)
        : elapsedSeconds === Infinity ? AIRCRAFT_TRAVEL_DURATION : 0;
    const framingPoint = (time: number): MapPoint => {
        const pose = sampleAircraftTravel(route, time);
        return { x: pose.ground.x, y: pose.ground.y - pose.altitude * .55 };
    };
    // Compact, positive weights give inertia without history, lag accumulation,
    // or a camera overshoot on skip/replay/tab resume. No suspension is sampled.
    let center = { x: 0, y: 0 };
    for (const [offset, weight] of [[-.16, 1], [-.08, 2], [0, 3], [.08, 2], [.16, 1]]) {
        const p = framingPoint(elapsed + offset);
        center.x += p.x * weight / 9; center.y += p.y * weight / 9;
    }
    const flying = smooth((elapsed - .55) / 1.2) * (1 - smooth((elapsed - 5.4) / 1.7));
    const ahead = limited(center, framingPoint(elapsed + .32), .13);
    center = mix(center, ahead, flying * .8);
    const depart = 1 - smooth((elapsed - .55) / 1.55);
    const arrive = smooth((elapsed - 4.65) / 1.45);
    const departure = limited(center, options.departureFocus ?? route.departureStart, .48);
    center = mix(center, departure, depart * .55);
    const destination = limited(center, options.arrivalFocus ?? route.arrivalStop, .48);
    center = mix(center, destination, arrive * .55);
    // Compose the plane above center, leaving the lower edge clear for controls.
    center.y += .045;
    return { center, width, height, zoom };
}
