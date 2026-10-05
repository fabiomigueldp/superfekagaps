import type { MovingBody } from '../../WorldPhysics';

/** Read the latest real displacement, never a predicted destination or animation clock.
 * Pausing/completing neutralizes the dial; reduced motion still keeps this useful state.
 */
export function ascentTravelDirection(body: MovingBody, axis: 'x' | 'y', running = true): -1 | 0 | 1 {
    const position = body[axis], previous = axis === 'x' ? body.px : body.py;
    if (!running || !Number.isFinite(position) || !Number.isFinite(previous)) return 0;
    const distance = position - previous;
    // Ignore floating-point residue at a stationary turnaround, not slow approaches.
    return Math.abs(distance) <= 1e-6 ? 0 : distance < 0 ? -1 : 1;
}
