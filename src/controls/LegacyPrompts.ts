import { connectedPads, profileFor, bindingLabel } from '../engine/ControlPreferences';
import { selectedGamepad } from '../engine/GamepadDevice';
import { touchControlsEnabled } from '../engine/TouchMode';

export function menuHint(label: string): string {
    if (touchControlsEnabled()) return label;
    const pad = selectedGamepad() ?? connectedPads()[0];
    const binding = pad ? profileFor(pad).bindings.confirm[0] : undefined;
    return `${binding ? bindingLabel(binding, pad) : 'ENTER'}: ${label}`;
}
export function movementHint(): string {
    return connectedPads().length ? 'DIRECIONAL: MOVER   A: PULAR   X/RT: CORRER'
        : touchControlsEnabled() ? '← → MOVER   ↑ PULAR   X CORRER' : 'A/D OU ←/→ MOVER   ESPAÇO PULAR   SHIFT CORRER';
}
