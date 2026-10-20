import './fullscreen.css';

/** Fullscreen belongs to this game document, including its dialogs and chapters. */
export function installFullscreen(): void {
    if (!document.fullscreenEnabled || document.getElementById('game-fullscreen')) return;
    const button = document.createElement('button');
    button.id = 'game-fullscreen'; button.type = 'button';
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
    const update = () => {
        const active = !!document.fullscreenElement;
        button.title = active ? 'Sair da tela cheia' : 'Tela cheia';
        button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-pressed', String(active));
        // Some embedded browsers deliver fullscreenchange before resize.
        window.dispatchEvent(new Event('resize'));
    };
    button.addEventListener('click', async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
            document.querySelector<HTMLCanvasElement>('canvas:not([hidden])')?.focus({preventScroll:true});
        } catch {
            button.title = 'Tela cheia indisponível neste navegador';
            button.setAttribute('aria-label', button.title);
        }
    });
    document.body.append(button);
    document.addEventListener('fullscreenchange', update);
    update();
}
