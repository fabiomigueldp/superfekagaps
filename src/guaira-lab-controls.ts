import type { WorldGame } from './adventure/WorldGame';
import { DisposalScope } from './engine/DisposalScope';
import { GuairaTouchControls } from './adventure/experimental/guaira/GuairaTouchControls';
import { fitGuairaLabCanvas } from './guaira-lab-layout';

/** Page-local controls; the engine and every other page retain their defaults. */
export function installGuairaLabControls(game: WorldGame, canvas: HTMLCanvasElement, isComplete: () => boolean) {
    const lifetime = new DisposalScope();
    let mounted = new DisposalScope();
    let controls: GuairaTouchControls | null = null;
    const fit = () => fitGuairaLabCanvas(canvas);
    function mount() {
        // Older touch browsers keep the original canvas controls as a fallback.
        if (lifetime.isDisposed || controls || typeof PointerEvent === 'undefined') return;
        const next = new GuairaTouchControls({ input: game.input,
            isPlaying: () => game.state === 'playing' && !game.player.data.isDead && !isComplete(),
            onInteract: () => game.audio.unlock(),
            onVisibilityChange: visible => { game.renderer.setTouchControlsVisible(!visible); fit(); }
        });
        controls = next;
        mounted.add(() => { controls = null; next.dispose(); });
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(fit);
            mounted.add(() => observer.disconnect());
            observer.observe(next.root);
        }
        fit();
    }
    function suspend() {
        mounted.dispose(); mounted = new DisposalScope();
        game.renderer.setTouchControlsVisible(true); fit();
    }
    const restore = (event: PageTransitionEvent) => {
        if (!event.persisted) return;
        try { mount(); } catch (error) { lifetime.dispose(); throw error; }
    };
    lifetime.add(suspend);
    lifetime.listen(window, 'pagehide', suspend);
    lifetime.listen(window, 'pageshow', restore);
    try { mount(); } catch (error) { lifetime.dispose(); throw error; }
    return { sync: () => controls?.sync(), dispose: () => lifetime.dispose() };
}
