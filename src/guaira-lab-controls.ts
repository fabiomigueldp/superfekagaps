import type { WorldGame } from './adventure/WorldGame';
import { GuairaTouchControls } from './adventure/experimental/guaira/GuairaTouchControls';
import { fitGuairaLabCanvas } from './guaira-lab-layout';

/** Page-local controls; the engine and every other page retain their defaults. */
export function installGuairaLabControls(game: WorldGame, canvas: HTMLCanvasElement, isComplete: () => boolean) {
    let controls: GuairaTouchControls | null = null;
    let observer: ResizeObserver | null = null;
    const fit = () => fitGuairaLabCanvas(canvas);
    function mount() {
        // Older touch browsers keep the original canvas controls as a fallback.
        if (controls || typeof PointerEvent === 'undefined') return;
        controls = new GuairaTouchControls({ input: game.input,
            isPlaying: () => game.state === 'playing' && !game.player.data.isDead && !isComplete(),
            onInteract: () => game.audio.unlock(),
            onVisibilityChange: visible => { game.renderer.setTouchControlsVisible(!visible); fit(); }
        });
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(fit); observer.observe(controls.root);
        }
        fit();
    }
    function suspend() {
        observer?.disconnect(); observer = null;
        controls?.dispose(); controls = null;
        game.renderer.setTouchControlsVisible(true); fit();
    }
    const restore = (event: PageTransitionEvent) => { if (event.persisted) mount(); };
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', restore);
    mount();
    return {
        sync: () => controls?.sync(),
        dispose: () => { window.removeEventListener('pagehide', suspend); window.removeEventListener('pageshow', restore); suspend(); }
    };
}
