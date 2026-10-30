import { controlPreferences, keyAction, keyLabel } from '../../../../engine/ControlPreferences';

/** One effective key per native action keeps the canvas announcement brief. */
export function chapterCanvasLabel(description: string): string {
    const actions = [['left', 'Esquerda'], ['right', 'Direita'], ['jump', 'Pular'], ['run', 'Correr'],
        ['down', 'Sentada no ar'], ['pause', 'Pausar'], ['mute', 'Som']] as const;
    const controls = actions.flatMap(([action, label]) => {
        // Input always pauses on Escape, including when an imported mapping assigns it elsewhere.
        const code = controlPreferences.keys[action].find(code => (code !== 'Escape' || action === 'pause')
            && (code === 'Escape' || keyAction(code) === action)) ?? (action === 'pause' ? 'Escape' : undefined);
        return code ? [`${label}: ${keyLabel(code)}`] : [];
    });
    return `${description} Teclado: ${controls.join('; ')}.`;
}

/** Presentation belongs to the chapter host; standalone diagnostic scenes keep their own copy. */
export function chapterExitPresentation(campaign: boolean) {
    return campaign
        ? { label: 'FÁBRICA', description: 'Voltar à Fábrica e continuar a viagem' }
        : { label: 'VOLTAR', description: 'Voltar ao jogo' };
}

export function chapterTitle(scene?: string): string {
    return `Super Feka Gaps · Guaíra${scene ? ` · ${scene}` : ''}`;
}

/** Keep native mechanism hints, but let the host describe persistence and navigation. */
export function chapterGuidance(native: string | null | undefined, objective: string): string {
    const message = native?.replace(/ · setas\/A D:.*| · setas:.*| · Esc:.*/, '');
    if (!message || message === 'Guaíra fictícia' || message.startsWith('Protótipo experimental')) return objective;
    return message
        .replace(/ \(nome provisório\)/g, '')
        .replace(/ · sair e reentrar reinicia o protótipo$/, ' · reentrar reinicia esta tentativa');
}

/** Reentry restores durable receipts, not native mechanisms, position or attempt coins. */
export function chapterResumeGuidance(): string {
    return 'Sair ou recarregar reinicia o trecho; checkpoint só nesta tentativa';
}

export function chapterAttemptSummary(coins: number): string {
    const count = Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0;
    return `${count} ${count === 1 ? 'moeda coletada' : 'moedas coletadas'} nesta tentativa`;
}
