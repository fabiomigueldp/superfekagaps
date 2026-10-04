import type { MovingBody } from '../../WorldPhysics';

/** Cosmetic hardware reads actual travel, never a second clock or predicted physics.
 * Reversing, pausing and rebuilding a checkpoint therefore keep the mechanism in sync.
 */
export function ascentMechanicalPose(body: MovingBody, axis: 'x' | 'y', reducedMotion: boolean) {
    const home = body.home?.[axis] ?? body[axis];
    const end = body.to?.[axis] ?? home;
    const position = body[axis];
    if (reducedMotion || !Number.isFinite(home) || !Number.isFinite(end) || !Number.isFinite(position) || home === end)
        return { turn: 0, homeCompression: 0, endCompression: 0 };
    const radius = axis === 'x' ? 3 : 4;
    // Bounded phase avoids precision loss on long sessions; the same physical
    // position produces the same spoke pose on the outbound and return legs.
    const turn = ((position - home) / radius) % (Math.PI * 2);
    return { turn,
        homeCompression: Math.round(2 * Math.max(0, 1 - Math.abs(position - home) / 12)),
        endCompression: Math.round(2 * Math.max(0, 1 - Math.abs(position - end) / 12)) };
}
