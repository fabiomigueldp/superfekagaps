/** Leave the runtime, preserving its origin's saves and the portal's edition. */
export async function exitGame(edition: 'classic' | 'remastered' | 'world'): Promise<void> {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    const origin = document.referrer ? new URL(document.referrer).origin : '';
    if (parent !== window && ['https://torbware.space', 'https://www.torbware.space'].includes(origin)) {
        parent.postMessage({ type: 'feka-exit' }, origin);
        return;
    }
    location.assign(`https://torbware.space/jogos/super-feka-gaps/#${edition}`);
}
