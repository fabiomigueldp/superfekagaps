/** Closed navigation vocabulary: queries never supply a destination or session data. */
export const EXPERIMENTAL_HUB_RETURN = './?experiments=1';
export const EXPERIMENTAL_ROUTES = Object.freeze([
    { href: './guaira-capitulo.html', label: 'CAPÍTULO DE GUAÍRA', description: 'Progresso salvo neste navegador.', name: 'Jogar o capítulo de Guaíra' },
    { href: './guaira.html', label: 'GUAÍRA LIVRE', description: 'Explore percursos em treino, sem salvar.', name: 'Explorar Guaíra livremente' },
    { href: './juice-lab.html', label: 'TREINO TURBOSUCO', description: 'Treine a arena, sem salvar progresso.', name: 'Treinar o desafio do Turbosuco' }
] as const);
export function requestsExperimentalHub(search: string): boolean {
    const params = new URLSearchParams(search);
    return params.getAll('experiments').length === 1 && params.get('experiments') === '1';
}

/** Reserve a native 44px entry plus breathing room, only on the main title. */
export function experimentalTitleSize(width: number, height: number) {
    const rendererScale = Math.max(1, Math.floor(Math.min(width / 320, height / 180)));
    // Keep the renderer's integer size whenever it fits. If the new rail needs
    // room, shrink proportionally only as far as necessary, including below 1x.
    const scale = Math.min(rendererScale, width / 320, Math.max(1, height - 60) / 180);
    return { width: 320 * scale, height: 180 * scale };
}
