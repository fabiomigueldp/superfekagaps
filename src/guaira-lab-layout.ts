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

export function fitGuairaLabCanvas(canvas: HTMLCanvasElement): void {
    const nav = document.querySelector<HTMLElement>('nav');
    const controlsHeight = document.getElementById('guaira-touch-controls')?.getBoundingClientRect().height ?? 0;
    if (nav) nav.style.maxHeight = `${Math.max(0, innerHeight - controlsHeight)}px`;
    const navHeight = nav?.getBoundingClientRect().height ?? 100;
    const size = guairaLabCanvasSize(innerWidth, innerHeight, navHeight, controlsHeight);
    document.body.style.paddingTop = `${navHeight}px`;
    document.body.style.paddingBottom = `${controlsHeight}px`;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
}
