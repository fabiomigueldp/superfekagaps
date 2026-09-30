/** Original little expedition emblems. Shared shapes keep the HUD's materials consistent. */
export type MapIcon = 'coast' | 'port' | 'factory' | 'mountain' | 'snow' | 'castle' | 'seal' | 'flag' | 'compass' | 'menu' | 'arrow' | 'lock' | 'check';
export const ISLAND_ICONS: readonly MapIcon[] = ['coast', 'port', 'factory', 'mountain', 'snow', 'castle'];
const paths: Record<MapIcon, string[]> = {
    coast: ['M10 23h12l-2-13h-8z', 'M11 10h10V7H11z', 'M10 7l6-4 6 4', 'M12 15h8M11 20h10', 'M5 27c3-3 5 3 8 0s5 3 8 0 5 3 7 0', 'M16 3V1'],
    port: ['M16 11v16M9 15h14', 'M6 20c0 6 5 8 10 8s10-2 10-8', 'M3 22l3-3 3 3M23 22l3-3 3 3', 'M16 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
    factory: ['M5 27V14l8-5v8l8-5v15z', 'M21 19h6v8H5', 'M23 12V5h4v14', 'M9 21h1M16 21h1M23 23h1', 'M24 2h3'],
    mountain: ['M2 27 13 6l6 10 3-5 8 16z', 'M8 16l5 3 4-5M19 17l3 3 3-3', 'M21 5V1M19 3h4'],
    snow: ['M16 2v28M4 9l24 14M4 23 28 9', 'M11 5l5 5 5-5M11 27l5-5 5 5', 'M4 15l7-2-1-7M28 17l-7 2 1 7', 'M4 17l7 2-1 7M28 15l-7-2 1-7'],
    castle: ['M5 27V11h5v4h4V8h4v7h4v-4h5v16z', 'M13 27v-6h6v6', 'M16 8V2l7 2-7 2M4 27h24'],
    seal: ['M16 2l4 3 5 1 1 5 3 5-3 4-1 5-5 1-4 3-5-3-5-1-1-5-3-4 3-5 1-5 5-1z', 'M16 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'],
    flag: ['M7 29V4M8 5c7-6 11 6 18 0v14c-7 6-11-6-18 0'],
    compass: ['M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26', 'M21 10l-3 9-8 3 3-9z'],
    menu: ['M7 9h18M7 16h18M7 23h18'],
    arrow: ['M5 16h21M18 8l8 8-8 8'],
    lock: ['M9 14V9a7 7 0 0 1 14 0v5', 'M6 14h20v15H6z', 'M16 20v4'],
    check: ['M6 16l7 7L27 8']
};

export function mapIcon(name: MapIcon): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('class', `world-map-icon world-map-icon-${name}`);
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    for (const d of paths[name]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.append(path);
    }
    return svg;
}
