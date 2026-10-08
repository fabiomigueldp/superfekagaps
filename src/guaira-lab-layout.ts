/** Guaíra page layout only: the simulation always keeps its native 320×180 view. */
export function guairaLabCanvasSize(viewportWidth: number, viewportHeight: number, toolbarHeight: number, controlsHeight = 0) {
    const width = Math.max(0, viewportWidth);
    const availableHeight = Math.max(0, viewportHeight - Math.max(0, toolbarHeight) - Math.max(0, controlsHeight) - 12);
    const fit = Math.min(width / 320, availableHeight / 180);
    // Keep whole pixel multiples when they fit. Below 1×, use the available space
    // instead of jumping to 0.5× or imposing a minimum that can crop the canvas.
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    return { width: 320 * scale, height: 180 * scale, scale };
}

/** Keep a readable slice of play visible when long guidance makes the toolbar scroll.
 * One complete 44px control and its safe-area padding take priority on tiny viewports.
 */
export function guairaLabToolbarMaxHeight(viewportHeight: number, controlsHeight: number, minimumToolbarHeight = 56): number {
    const availableHeight = Math.max(0, viewportHeight - Math.max(0, controlsHeight) - 12);
    const toolbarFloor = Math.min(availableHeight, Math.max(0, minimumToolbarHeight));
    const reservedPlayHeight = Math.min(90, availableHeight - toolbarFloor);
    return availableHeight - reservedPlayHeight;
}

export function fitGuairaLabCanvas(canvas: HTMLCanvasElement): void {
    const host = canvas.closest?.<HTMLElement>('.world-chapter-host');
    const nav = host?.querySelector<HTMLElement>('.chapter-game-toolbar') ?? document.querySelector<HTMLElement>('nav');
    const controlsHeight = document.getElementById('guaira-touch-controls')?.getBoundingClientRect().height ?? 0;
    if (nav) {
        let minimumToolbarHeight = 56;
        if (typeof getComputedStyle === 'function') {
            const style = getComputedStyle(nav);
            const px = (value: string) => Number.parseFloat(value) || 0;
            minimumToolbarHeight = 44 + px(style.paddingTop) + px(style.paddingBottom)
                + px(style.borderTopWidth) + px(style.borderBottomWidth);
        }
        nav.style.maxHeight = `${guairaLabToolbarMaxHeight(innerHeight, controlsHeight, minimumToolbarHeight)}px`;
    }
    const navHeight = nav?.getBoundingClientRect().height ?? 100;
    const size = guairaLabCanvasSize(innerWidth, innerHeight, navHeight, controlsHeight);
    const layout = host ?? document.body;
    layout.style.paddingTop = `${navHeight}px`;
    layout.style.paddingBottom = `${controlsHeight}px`;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
}
