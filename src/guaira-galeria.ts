import { DisposalScope } from './engine/DisposalScope';
import { fitGuairaLabCanvas } from './guaira-lab-layout';
import { installGuairaLabControls } from './guaira-lab-controls';
import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';
import { GuairaGallery, GUAIRA_GALLERY } from './adventure/experimental/guaira/gallery/GuairaGallery';

/** One optional attempt per document visit; no chapter or campaign persistence. */
export function mountGuairaGalleryPage(): () => void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const status = document.getElementById('lab-status')!;
    const pause = document.getElementById('lab-pause') as HTMLButtonElement;
    const retry = document.getElementById('lab-retry') as HTMLButtonElement;
    const map = document.getElementById('lab-exit') as HTMLAnchorElement;
    let lifetime = new DisposalScope(), closed = false;

    function mount() {
        if (closed) return;
        lifetime.dispose(); lifetime = new DisposalScope();
        const owner = lifetime;
        try {
            const game = new GuairaGallery(canvas, status);
            owner.add(() => game.dispose());
            const controls = installGuairaLabControls(game, canvas, () => game.finished);
            owner.add(() => controls.dispose());
            const pauseArt = new LabToolbarAction(pause);
            new LabToolbarAction(retry).setLabel('TENTAR', 'Recomeçar Galeria dos Remendos');
            new LabToolbarAction(map).setLabel('MAPA', 'Voltar à Estrada do Vento');
            map.href = game.mapReturnHref;
            pause.disabled = false;
            status.setAttribute('role', 'status');
            const sync = () => {
                if (owner.isDisposed) return;
                controls.sync();
                pauseArt.setLabel(game.state === 'paused' ? 'CONTINUAR' : 'PAUSA',
                    game.state === 'paused' ? 'Continuar a tentativa' : 'Pausar');
            };
            owner.listen(pause, 'click', () => { game.toggleGalleryPause(); sync(); canvas.focus(); });
            owner.listen(retry, 'click', () => { game.load(GUAIRA_GALLERY.id); sync(); canvas.focus(); });
            // The exit is geography only, independent of victory or checkpoint.
            owner.listen(map, 'click', () => { map.href = game.mapReturnHref; });
            canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
            owner.listen(canvas, 'pointerdown', () => canvas.focus({ preventScroll: true }));
            const fit = () => { if (!owner.isDisposed) fitGuairaLabCanvas(canvas); };
            owner.listen(window, 'resize', fit);
            const nav = document.querySelector('nav');
            if (nav && typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(fit); owner.add(() => observer.disconnect()); observer.observe(nav);
            }
            let frame: number | null = null;
            const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
            owner.add(stop);
            const reflect = () => {
                frame = null; if (owner.isDisposed) return;
                sync(); if (!document.hidden) frame = requestAnimationFrame(reflect);
            };
            owner.listen(document, 'visibilitychange', () => { stop(); if (!document.hidden) reflect(); });
            if (document.hidden && game.state === 'playing') game.toggleGalleryPause();
            sync(); fit(); reflect(); game.start(); canvas.focus({ preventScroll: true });
        } catch (error) {
            // Keep a usable retry and the ordinary exit even if device setup fails.
            owner.dispose(); lifetime = new DisposalScope();
            pause.disabled = true; status.setAttribute('role', 'alert');
            pause.textContent = 'PAUSA'; retry.textContent = 'TENTAR'; map.textContent = 'MAPA';
            status.textContent = 'Não foi possível abrir a galeria. Tentar repete o carregamento; Mapa volta à Estrada do Vento.';
            lifetime.listen(retry, 'click', mount);
            console.error('Gallery initialization failed', error);
        }
    }
    mount();
    return () => { if (closed) return; closed = true; lifetime.dispose(); };
}

let disposeGallery = mountGuairaGalleryPage();
window.addEventListener('pagehide', () => disposeGallery());
window.addEventListener('pageshow', event => {
    if (event.persisted) { disposeGallery(); disposeGallery = mountGuairaGalleryPage(); }
});
