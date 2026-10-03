import type { AdventureSave } from './types';
import { canContinueFromGuaira, isGuairaUnlocked } from './progress';

export const CAMPAIGN_REGION_ORDER = ['costa', 'porto', 'factory', 'guaira', 'serra', 'reserva', 'dominio'] as const;
export const GUAIRA_ATLAS = { left: 3.65, top: .05, widthInMap: 1.1, heightInMap: 1.1 };
export const GUAIRA_CAMPAIGN_IMAGE = '/assets/world/map/guaira-campaign/guaira.webp';

/** A region has a chapter host, not five invented numeric campaign stages. */
export function showGuairaRegion(save: AdventureSave, arrived: string, callbacks: {
    fly(from: 'factory' | 'serra'): void;
    goToFactory(): void;
}): () => void {
    const dialog = document.createElement('dialog'); dialog.className = 'guaira-region';
    dialog.setAttribute('aria-labelledby', 'guaira-region-title');
    const title = document.createElement('h2'); title.id = 'guaira-region-title'; title.textContent = 'Guaíra · entre a Fábrica e a Serra';
    const art = document.createElement('img'); art.src = GUAIRA_CAMPAIGN_IMAGE;
    art.alt = 'Guaíra: aeródromo, arrozais, canais e a cidade do Prefeito';
    const summary = document.createElement('p');
    summary.textContent = `${save.guaira.completed.length}/5 trechos concluídos · Galeria ${save.guaira.optional.gallery ? 'concluída' : 'opcional'} · Câmara ${save.guaira.optional.relief ? 'concluída' : 'opcional'}`;
    const hint = document.createElement('p');
    hint.textContent = !isGuairaUnlocked(save) ? 'Conclua Controle de Qualidade na Fábrica para embarcar.'
        : canContinueFromGuaira(save) ? 'A rota aérea entre Fábrica, Guaíra e Serra está aberta. Seu progresso fica salvo.'
        : 'Atravesse os canais, vença Ossabravo e faça o Prefeito liberar a água para seguir à Serra.';
    const controls = document.createElement('nav'); controls.setAttribute('aria-label', 'Viagem a Guaíra');
    const fly = document.createElement('button'), back = document.createElement('button');
    const from = arrived.startsWith('4-') ? 'serra' : 'factory';
    const atAirRegion = arrived.startsWith('3-') || arrived.startsWith('4-');
    fly.textContent = atAirRegion ? `Voar da ${from === 'serra' ? 'Serra' : 'Fábrica'} para Guaíra` : 'Ir à Fábrica para embarcar';
    fly.disabled = !isGuairaUnlocked(save);
    back.textContent = 'Voltar ao mapa';
    const previous = document.activeElement;
    const close = () => { dialog.close(); dialog.remove(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
    fly.addEventListener('click', () => { close(); if (atAirRegion) callbacks.fly(from); else callbacks.goToFactory(); });
    back.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    controls.append(fly, back); dialog.append(title, art, summary, hint, controls); document.body.append(dialog); dialog.showModal();
    return close;
}
