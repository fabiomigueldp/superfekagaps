/** Presentation belongs to the chapter host; standalone diagnostic scenes keep their own copy. */
export function chapterExitPresentation(campaign: boolean) {
    return campaign
        ? { label: 'FÁBRICA', description: 'Voltar à Fábrica e continuar a viagem' }
        : { label: 'SAIR', description: 'Sair do capítulo e voltar aos extras' };
}

export function chapterTitle(scene?: string): string {
    return `Super Feka Gaps · Guaíra${scene ? ` · ${scene}` : ''}`;
}

/** Keep native mechanism hints, but let the host describe persistence and navigation. */
export function chapterGuidance(native: string | null | undefined, objective: string): string {
    const message = native?.replace(/ · setas\/A D:.*| · setas:.*| · Esc:.*/, '');
    if (!message || message === 'Guaíra fictícia' || message.startsWith('Protótipo experimental')) return objective;
    return message
        .replace(/ · sair e reentrar reinicia o protótipo$/, ' · reentrar reinicia esta tentativa');
}
