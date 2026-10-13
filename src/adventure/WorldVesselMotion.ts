import type { MapPoint } from './WorldMapModel';

export interface SpringMotion { value: number; velocity: number }
export interface VesselDynamics {
    heave: SpringMotion;
    roll: SpringMotion;
    pitch: SpringMotion;
    speed: number;
}
export interface VesselWakeSample {
    point: MapPoint;
    heading: number;
    strength: number;
    time: number;
}
export interface VesselEmitter { point: MapPoint; heading: number; speed: number; time: number }
export interface VesselWakeState { samples: readonly VesselWakeSample[]; emitter: VesselEmitter }
export interface VesselMotion {
    waterline: MapPoint;
    screenHeading: number;
    /** Forward prop wash; zero when moving astern or holding position. */
    speed: number;
    /** Visual displacement in map y units; navigation/deck anchors stay fixed. */
    heave?: number;
    /** Body rotation about the waterline, shared by hull and passenger. */
    rotation?: number;
    wake?: readonly VesselWakeSample[];
}
export const VESSEL_WAKE_LIFETIME = 2200;
export const VESSEL_WAKE_INTERVAL = 60;
export const VESSEL_WAKE_LIMIT = 38;
export const VESSEL_MAX_ROTATION = .045;
/** Framing allowance for the bounded wave response, in normalized map y. */
export const VESSEL_HEAVE_CLEARANCE = .004;
/** Sheltered water alongside the quay, with the same swell phase as the sea. */
export const VESSEL_MOORED_SWELL = .55;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export const headingDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Exact damped spring solution for a fixed load over this step. Unlike Euler
 * integration it remains stable at 30/60/120 Hz and does not gain energy. */
export function dampedMotion(previous: SpringMotion, target: number, seconds: number, frequency: number, damping = 1): SpringMotion {
    if (seconds <= 0) return previous;
    const offset = previous.value - target, decay = Math.exp(-frequency * damping * seconds);
    if (damping >= 1) {
        const c = previous.velocity + frequency * offset;
        return { value: target + (offset + c * seconds) * decay,
            velocity: (previous.velocity - frequency * c * seconds) * decay };
    }
    const rate = frequency * Math.sqrt(1 - damping * damping), angle = rate * seconds;
    const c = (previous.velocity + damping * frequency * offset) / rate;
    const position = offset * Math.cos(angle) + c * Math.sin(angle);
    return { value: target + position * decay,
        velocity: (rate * (-offset * Math.sin(angle) + c * Math.cos(angle)) - damping * frequency * position) * decay };
}

/** Two crossing swells in atlas space, so nearby floating objects encounter the
 * same water. The long period and damped response convey displacement/mass. */
export function vesselWaterHeight(point: MapPoint, time: number): number {
    const seconds = time / 1000;
    return .0021 * Math.sin(point.x * 14 + point.y * 9 - seconds * 1.8)
        + .0008 * Math.sin(point.x * -23 + point.y * 17 - seconds * 2.65 + 1.4);
}

export function sampleVesselDynamics(previous: VesselDynamics | undefined, point: MapPoint, heading: number,
    signedSpeed: number, yawRate: number, time: number, seconds: number, swell = 1): VesselDynamics {
    const state = previous ?? { heave: { value: 0, velocity: 0 }, roll: { value: 0, velocity: 0 },
        pitch: { value: 0, velocity: 0 }, speed: signedSpeed };
    if (seconds <= 0) return state;
    const dx = Math.cos(heading), dy = Math.sin(heading);
    const surface = (fore: number, side: number) => swell * vesselWaterHeight({
        x: point.x + (dx * fore - dy * side) / 1.6, y: point.y + dy * fore + dx * side,
    }, time);
    const bow = surface(.045, 0), stern = surface(-.045, 0);
    const acceleration = clamp((signedSpeed - state.speed) / seconds, -2, 2);
    // The narrower beam reacts more to cross swell. Steering loads grow with
    // speed; thrust lifts the bow, braking lets the loaded bow settle.
    const roll = clamp((surface(0, .022) - surface(0, -.022)) * 8 - yawRate * Math.abs(signedSpeed) * .018, -.055, .055);
    const pitch = clamp((bow - stern) * 5 - signedSpeed * Math.abs(signedSpeed) * .012 - acceleration * .009, -.04, .04);
    return { heave: dampedMotion(state.heave, (bow + stern) / 2, seconds, 4.6, .82),
        roll: dampedMotion(state.roll, roll, seconds, 5.2, .78),
        pitch: dampedMotion(state.pitch, pitch, seconds, 4, .92), speed: signedSpeed };
}

/** Fixed-rate world-space emission. Interpolating between render samples keeps
 * density independent of refresh rate. Pauses/seeks discard stale trails instead
 * of joining unrelated positions. All arrays/points remain caller-owned. */
export function advanceVesselWake(previous: VesselWakeState | undefined, emitter: VesselEmitter): VesselWakeState {
    const last = previous?.emitter, dt = last ? emitter.time - last.time : 0;
    if (last && dt === 0) return previous!;
    const continuous = last && dt > 0 && dt <= 250 && Math.hypot((emitter.point.x - last.point.x) * 1.6, emitter.point.y - last.point.y) < .15;
    const samples: VesselWakeSample[] = continuous
        ? previous!.samples.filter(sample => emitter.time - sample.time < VESSEL_WAKE_LIFETIME) : [];
    if (continuous) for (let at = (Math.floor(last.time / VESSEL_WAKE_INTERVAL) + 1) * VESSEL_WAKE_INTERVAL;
        at <= emitter.time; at += VESSEL_WAKE_INTERVAL) {
        const t = (at - last.time) / dt, speed = clamp(last.speed + (emitter.speed - last.speed) * t, 0, 1);
        if (speed <= .025) continue;
        samples.push({ point: { x: last.point.x + (emitter.point.x - last.point.x) * t,
            y: last.point.y + (emitter.point.y - last.point.y) * t },
            heading: last.heading + headingDelta(last.heading, emitter.heading) * t,
            strength: speed * speed * (3 - 2 * speed), time: at });
    }
    return { samples: samples.slice(-VESSEL_WAKE_LIMIT), emitter };
}
