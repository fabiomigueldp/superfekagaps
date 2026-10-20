import { controlCode, keyAction } from './ControlPreferences';

export type MovementAction = 'left' | 'right' | 'run';
const keys = new Set<string>();

// These listeners precede modal capture handlers. A key released in a dialog
// must also stop being held when gameplay resumes.
window.addEventListener('keyup', event => keys.delete(controlCode(event)), true);
window.addEventListener('blur', () => keys.clear(), true);
window.addEventListener('pagehide', () => keys.clear(), true);
window.addEventListener('feka-controls-change', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });

/** Called only after a gameplay host has accepted this keyboard event. */
export function rememberMovementKey(event: KeyboardEvent): void {
    const code = controlCode(event), action = keyAction(code);
    if (!action || !['left', 'right', 'run'].includes(action)) return;
    if (!event.repeat) keys.delete(code);
    keys.add(code);
}

/** Physical holds survive simulation resets, but never focus loss or keyup. */
export function heldKeyboardMovement(): ReadonlyMap<string, MovementAction> {
    return new Map([...keys].flatMap(code => {
        const action = keyAction(code);
        return action && ['left', 'right', 'run'].includes(action) ? [[code, action as MovementAction] as const] : [];
    }));
}
