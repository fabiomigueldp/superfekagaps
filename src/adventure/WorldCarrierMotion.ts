import type { Vector2 } from '../types';

/** An authored motor profile. Period includes both journeys and both stops. */
export interface CarrierMotionProfile {
    kind: 'shuttle';
    /** Maximum speed along the route, in world pixels per second. */
    maxSpeed: number;
    /** Duration of each cosine-velocity acceleration/deceleration ramp. */
    rampMs: number;
    dwellMs: number;
}
export const CARGO_CARRIER_PROFILE: Readonly<CarrierMotionProfile> = Object.freeze({ kind: 'shuttle', maxSpeed: 90, rampMs: 350, dwellMs: 450 });
export const SERRA_CARRIER_PROFILE: Readonly<CarrierMotionProfile> = Object.freeze({ kind: 'shuttle', maxSpeed: 80, rampMs: 350, dwellMs: 450 });
export const CARRIER_CLEARANCE = 40;

export interface CarrierRouteInput {
    x: number;
    y: number;
    width: number;
    to?: Vector2;
    home?: Vector2;
}
export interface CarrierMotionInput extends CarrierRouteInput {
    period?: number;
    phase?: number;
    motion?: CarrierMotionProfile;
}
export interface CarrierRoute {
    /** Immutable deck-top-left endpoints, not the moving body's current pose. */
    home: Vector2;
    to: Vector2;
    length: number;
    tangent: Vector2;
    normal: Vector2;
    rail: { from: Vector2; to: Vector2 };
}
export interface CarrierPose {
    position: Vector2;
    progress: number;
    distance: number;
    velocity: number;
    leg: 'home' | 'outbound' | 'end' | 'return';
}

export function carrierRoute(body: CarrierRouteInput, clearance = CARRIER_CLEARANCE): CarrierRoute | null {
    const home = body.home ?? body, to = body.to;
    if (!to || ![home.x, home.y, to.x, to.y, body.width, clearance].every(Number.isFinite)) return null;
    const dx = to.x - home.x, dy = to.y - home.y, length = Math.hypot(dx, dy);
    if (length === 0) return null;
    const tangent = { x: dx / length, y: dy / length };
    return { home: { x: home.x, y: home.y }, to: { ...to }, length, tangent,
        normal: { x: -tangent.y, y: tangent.x },
        rail: { from: { x: home.x + body.width / 2, y: home.y - clearance },
            to: { x: to.x + body.width / 2, y: to.y - clearance } } };
}

export function carrierTrolley(body: CarrierRouteInput, clearance = CARRIER_CLEARANCE): Vector2 {
    return { x: body.x + body.width / 2, y: body.y - clearance };
}

/** Signed wheel travel. It stops at a dock and reverses with the real carriage. */
export function carrierDistance(body: CarrierRouteInput): number {
    const route = carrierRoute(body);
    return route ? (body.x - route.home.x) * route.tangent.x + (body.y - route.home.y) * route.tangent.y : 0;
}

function validProfile(profile: CarrierMotionProfile): boolean {
    return profile.kind === 'shuttle' && [profile.maxSpeed, profile.rampMs, profile.dwellMs].every(Number.isFinite)
        && profile.maxSpeed > 0 && profile.rampMs > 0 && profile.dwellMs >= 0;
}

/** Authoring aid only: the runtime never silently lengthens an authored period. */
export function minimumCarrierPeriod(length: number, profile: CarrierMotionProfile): number {
    if (!Number.isFinite(length) || length < 0 || !validProfile(profile)) return Infinity;
    return 2 * (profile.dwellMs + Math.max(2 * profile.rampMs, length / profile.maxSpeed * 1000 + profile.rampMs));
}

export function carrierMotionErrors(body: CarrierMotionInput, legacySpeedLimit = 90): string[] {
    const errors: string[] = [];
    if (body.to && ![body.to.x, body.to.y].every(Number.isFinite)) errors.push('Destino deve ter coordenadas finitas');
    if (body.period !== undefined && (!Number.isFinite(body.period) || body.period <= 0)) errors.push('Período deve ser positivo');
    const route = carrierRoute(body), profile = body.motion, period = body.period ?? 5000;
    if (profile && !validProfile(profile)) errors.push('Perfil de transporte inválido: informe velocidade, aceleração e parada válidas');
    if (!route || errors.length) return errors;
    if (profile) {
        const minimum = minimumCarrierPeriod(route.length, profile);
        if (period + 1e-7 < minimum) errors.push(`Período insuficiente: use pelo menos ${Math.ceil(minimum)} ms para este percurso e perfil`);
        if (body.phase !== undefined && !Number.isFinite(body.phase)) errors.push('Fase do transporte deve ser finita');
    } else if (route.length * Math.PI / period * 1000 > legacySpeedLimit + 1e-7) {
        errors.push(`Transporte legado rápido demais: aumente o período para ${Math.ceil(route.length * Math.PI / legacySpeedLimit * 1000)} ms ou defina um perfil de transporte explícito`);
    }
    return errors;
}

/** One scalar owns the deck and its trolley. No axis can lag behind its route.
 * Legacy axis-aligned Guaíra paths retain their exact sinusoid. The historical
 * `swing` kind is a linear shuttle alias, not an invented pendulum trajectory. */
export function sampleCarrierMotion(body: CarrierMotionInput, time: number): CarrierPose | null {
    const route = carrierRoute(body), period = body.period ?? 5000;
    if (!route || !Number.isFinite(time) || !Number.isFinite(period) || period <= 0) return null;
    const profile = body.motion;
    let progress: number, velocity: number, leg: CarrierPose['leg'];
    if (!profile) {
        // Phase was not used by the original carrier simulation. Preserve that
        // legacy contract; explicit shuttle profiles support a phase in ms.
        const angle = time / period * Math.PI * 2;
        progress = (1 - Math.cos(angle)) / 2;
        velocity = route.length * Math.PI / period * Math.sin(angle) * 1000;
        leg = progress === 0 ? 'home' : progress === 1 ? 'end' : velocity >= 0 ? 'outbound' : 'return';
    } else {
        if (!validProfile(profile) || period + 1e-7 < minimumCarrierPeriod(route.length, profile)
            || body.phase !== undefined && !Number.isFinite(body.phase)) return null;
        const cycle = (((time + (body.phase ?? 0)) % period) + period) % period, returning = cycle >= period / 2;
        const travelMs = period / 2 - profile.dwellMs, elapsed = cycle - (returning ? period / 2 : 0) - profile.dwellMs;
        const t = Math.max(0, Math.min(travelMs, elapsed)), ramp = profile.rampMs;
        const speed = route.length / (travelMs - ramp);
        let distance: number, rate: number;
        if (t <= 0) { distance = 0; rate = 0; }
        else if (t < ramp) {
            distance = speed / 2 * (t - ramp / Math.PI * Math.sin(Math.PI * t / ramp));
            rate = speed / 2 * (1 - Math.cos(Math.PI * t / ramp));
        } else if (t <= travelMs - ramp) { distance = speed * (t - ramp / 2); rate = speed; }
        else {
            const remaining = travelMs - t;
            distance = route.length - speed / 2 * (remaining - ramp / Math.PI * Math.sin(Math.PI * remaining / ramp));
            rate = speed / 2 * (1 - Math.cos(Math.PI * remaining / ramp));
        }
        progress = Math.max(0, Math.min(1, distance / route.length));
        if (returning) progress = 1 - progress;
        velocity = rate === 0 ? 0 : rate * (returning ? -1000 : 1000);
        leg = elapsed <= 0 ? returning ? 'end' : 'home' : returning ? 'return' : 'outbound';
    }
    return { position: { x: route.home.x + (route.to.x - route.home.x) * progress,
        y: route.home.y + (route.to.y - route.home.y) * progress }, progress,
        distance: progress * route.length, velocity, leg };
}
