import { campaignWaterRestored, GUAIRA_RESTORED_WATER_IMAGE } from './GuairaCampaignConsequences';
import { GUAIRA_CAMPAIGN_ART } from './GuairaCampaignArt';
import type { AdventureSave } from './types';
import { guairaTravelDirections } from './CampaignWayfinding';
import { campaignJournal } from './CampaignJournal';

export const CAMPAIGN_REGION_ORDER = ['costa', 'porto', 'factory', 'guaira', 'serra', 'reserva', 'dominio'] as const;
export const GUAIRA_ATLAS = { left: 3.65, top: .05, widthInMap: 1.1, heightInMap: 1.1 };
export const GUAIRA_CAMPAIGN_IMAGE = GUAIRA_CAMPAIGN_ART.guaira.path;

/** A region has a chapter host, not five invented numeric campaign stages. */
export function showGuairaRegion(save: AdventureSave, arrived: string, callbacks: {
    fly(from: 'factory' | 'serra'): void;
    goToFactory(): void;
    goToSerra(): void;
}): () => void {
    const dialog = document.createElement('dialog'); dialog.className = 'guaira-region';
    dialog.setAttribute('aria-labelledby', 'guaira-region-title');
    const title = document.createElement('h2'); title.id = 'guaira-region-title'; title.textContent = 'Guaíra · entre a Fábrica e a Serra';
    const art = document.createElement('img'); art.src = GUAIRA_CAMPAIGN_IMAGE;
    art.alt = campaignWaterRestored(save) ? 'Guaíra: água liberada no bebedouro público e nos canais dos arrozais'
        : 'Guaíra: aeródromo, arrozais, canais e a cidade do Prefeito';
    const artPanel = document.createElement('div');
    artPanel.setAttribute('style', 'position:relative;line-height:0');
    art.setAttribute('style', 'display:block'); artPanel.append(art);
    if (campaignWaterRestored(save)) {
        const water = document.createElement('img'); water.src = GUAIRA_RESTORED_WATER_IMAGE; water.alt = '';
        water.setAttribute('aria-hidden', 'true');
        water.setAttribute('style', 'position:absolute;inset:0;height:100%;background:transparent;pointer-events:none');
        water.addEventListener('error', () => water.remove(), { once: true });
        artPanel.append(water);
    }
    const journal = campaignJournal(save);
    const summary = document.createElement('p');
    summary.textContent = `${save.guaira.completed.length}/5 trechos concluídos · Galeria ${save.guaira.optional.gallery ? 'concluída' : 'opcional'} · Câmara ${save.guaira.optional.relief ? 'concluída' : 'opcional'}`;
    const hint = document.createElement('p');
    const directions = guairaTravelDirections(save, arrived);
    hint.textContent = `${directions.route} ${journal.objective}`;
    const receipts = document.createElement('ol'); receipts.className = 'guaira-receipts';
    receipts.setAttribute('aria-label', 'Caderno de Guaíra');
    for (const entry of journal.entries) {
        const item = document.createElement('li');
        item.textContent = `${entry.complete ? 'Concluído' : entry.id === journal.next?.id ? 'Próximo' : 'À frente'} · ${entry.title}`;
        item.dataset.complete = String(entry.complete); receipts.append(item);
    }
    const reward = document.createElement('p'); reward.textContent = journal.water;
    const optional = document.createElement('p'); optional.className = 'guaira-optional-note';
    optional.textContent = 'Galeria e Câmara são passeios opcionais no Bairro da Vala Seca. Os trechos concluídos podem ser revisitados; suas conquistas continuam no caderno.';
    const controls = document.createElement('nav'); controls.setAttribute('aria-label', 'Viagem a Guaíra');
    const fly = document.createElement('button'), back = document.createElement('button');
    const { from, atAirRegion } = directions;
    fly.textContent = directions.action;
    fly.disabled = !directions.available;
    back.textContent = 'Voltar ao mapa';
    const previous = document.activeElement;
    const close = () => { dialog.close(); dialog.remove(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
    fly.addEventListener('click', () => { close(); if (atAirRegion) callbacks.fly(from); else if (from === 'serra') callbacks.goToSerra(); else callbacks.goToFactory(); });
    back.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    controls.append(fly, back); dialog.append(title, artPanel, summary, hint, receipts, reward, optional, controls); document.body.append(dialog); dialog.showModal();
    return close;
}
