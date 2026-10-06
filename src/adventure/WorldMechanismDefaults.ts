import type { MechanismKind, MechanismSpec } from './types';
import { CARGO_CARRIER_PROFILE, SERRA_CARRIER_PROFILE } from './WorldCarrierMotion';

/** New equipment starts with a compatible route; importing remains explicit. */
export function editorCarrierDefaults(kind: MechanismKind, x: number, y: number, world: number): Pick<MechanismSpec, 'to' | 'period' | 'motion'> {
    if (kind === 'platform') return { to: { x: x + 64, y }, period: 4000,
        motion: { ...(world === 4 ? SERRA_CARRIER_PROFILE : CARGO_CARRIER_PROFILE) } };
    if (kind === 'lift') return { to: { x, y: y - 32 }, period: 4000 };
    if (kind === 'support') return { to: { x, y: y + 32 } };
    return {};
}

/** Moving equipment in the editor translates its whole authored assembly.
 * Destination fields remain the explicit way to reshape the route itself. */
export function translateEditorMechanism(spec: MechanismSpec, x: number, y: number): MechanismSpec {
    const dx = x - spec.x, dy = y - spec.y;
    const moved = { ...spec, x, y };
    if (!['platform', 'lift', 'swing', 'support'].includes(spec.kind) || ![dx, dy].every(Number.isFinite)) return moved;
    if (spec.to) moved.to = { x: spec.to.x + dx, y: spec.to.y + dy };
    if (spec.mounts) moved.mounts = spec.mounts.map(mount => ({ ...mount, x: mount.x + dx, y: mount.y + dy })) as NonNullable<MechanismSpec['mounts']>;
    return moved;
}
