import { connectedPads } from './ControlPreferences';

// A touchscreen is a capability, not evidence that the player uses touch.
let pointerTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
window.addEventListener('pointerdown', event => {
    pointerTouch = event.pointerType === 'touch';
}, true);
window.addEventListener('keydown', () => { pointerTouch = false; }, true);

export function touchControlsEnabled(): boolean {
    // Handheld PCs report a touchscreen even while their built-in pad is active.
    return navigator.maxTouchPoints > 0 && pointerTouch && connectedPads().length === 0;
}
