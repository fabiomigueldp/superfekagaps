import { campaignWaterRestored, GUAIRA_RESTORED_WATER_IMAGE } from './GuairaCampaignConsequences';
import { GUAIRA_CAMPAIGN_ART } from './GuairaCampaignArt';
import type { AdventureSave } from './types';
import { guairaTravelDirections } from './CampaignWayfinding';
import { campaignJournal } from './CampaignJournal';
import { pixelText, textWidth } from '../graphics/BitmapFont';
import { ART } from '../graphics/palette';

export const CAMPAIGN_REGION_ORDER = ['costa', 'porto', 'factory', 'guaira', 'serra', 'reserva', 'dominio'] as const;
export const GUAIRA_ATLAS = { left: 3.65, top: .05, widthInMap: 1.1, heightInMap: 1.1 };
export const GUAIRA_CAMPAIGN_IMAGE = GUAIRA_CAMPAIGN_ART.guaira.path;

/** Keep real text for assistive technology and when Canvas is unavailable. */
function label(parent: HTMLElement, value: string, color: string = ART.paper, scale = 2): void {
    const text = document.createElement('span'); text.textContent = value;
    const canvas = document.createElement('canvas'); canvas.className = 'guaira-region-bitmap';
    canvas.width = (textWidth(value) + 2) * scale; canvas.height = 11 * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.imageSmoothingEnabled = false;
        pixelText(ctx, value, scale, 2 * scale, color, scale);
        canvas.setAttribute('aria-hidden', 'true');
        text.className = 'guaira-region-sr'; parent.append(canvas);
    }
    parent.append(text);
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    return node;
}

/** A region has a chapter host, not five invented numeric campaign stages. */
export function showGuairaRegion(save: AdventureSave, arrived: string, callbacks: {
    fly(from: 'factory' | 'serra'): void;
    goToFactory(): void;
    goToSerra(): void;
}): () => void {
    const directions = guairaTravelDirections(save, arrived), journal = campaignJournal(save);
    const dialog = element('dialog', 'guaira-region');
    dialog.setAttribute('aria-labelledby', 'guaira-region-title');
    dialog.setAttribute('aria-describedby', 'guaira-region-hint');
    const header = element('header', 'guaira-region-header');
    const heading = element('div', 'guaira-region-heading');
    const title = element('h2', 'guaira-region-title'); title.id = 'guaira-region-title';
    label(title, 'GUAÍRA', ART.goldLight, 3);
    const route = element('p', 'guaira-region-route', 'Fábrica → Guaíra → Serra');
    heading.append(title, route);
    const artPanel = element('div', 'guaira-region-art');
    // The overview already shows this island; the thumbnail is decorative.
    const art = element('img', 'guaira-region-island'); art.src = GUAIRA_CAMPAIGN_IMAGE; art.alt = '';
    artPanel.setAttribute('aria-hidden', 'true'); artPanel.append(art);
    if (campaignWaterRestored(save)) {
        const water = element('img', 'guaira-region-water'); water.src = GUAIRA_RESTORED_WATER_IMAGE; water.alt = '';
        water.addEventListener('error', () => water.remove(), { once: true }); artPanel.append(water);
    }
    header.append(heading, artPanel);

    const content = element('div', 'guaira-region-content');
    const state = element('section', 'guaira-region-state');
    const status = element('p', 'guaira-region-status');
    label(status, !directions.available ? 'BLOQUEADO' : journal.next ? 'A SEGUIR' : 'CONCLUÍDO', ART.goldLight);
    const hint = element('p', 'guaira-region-hint'); hint.id = 'guaira-region-hint';
    hint.textContent = !directions.available ? 'Conclua 3-5 · Controle de Qualidade, na Fábrica.'
        : journal.next ? journal.next.title : 'Água liberada. O caminho para a Serra está aberto.';
    state.append(status, hint);
    if (directions.available && journal.next) {
        state.append(element('p', 'guaira-region-objective', journal.next.objective));
    }
    content.append(state);

    const details = element('details', 'guaira-region-details');
    const summary = element('summary', 'guaira-region-summary');
    label(summary, `ETAPAS ${journal.guairaCompleted}/5`);
    const receipts = element('ol', 'guaira-receipts'); receipts.setAttribute('aria-label', 'Etapas de Guaíra');
    for (const entry of journal.entries) {
        const item = element('li', 'guaira-receipt');
        item.dataset.complete = String(entry.complete);
        item.dataset.next = String(entry.id === journal.next?.id);
        const name = element('span', 'guaira-receipt-title', entry.title);
        const progress = element('span', 'guaira-receipt-status', entry.complete ? 'Concluída' : entry.id === journal.next?.id ? 'Próxima' : '');
        item.append(name, progress); receipts.append(item);
    }
    const optional = element('p', 'guaira-optional-note', `Opcionais: Galeria${save.guaira.optional.gallery ? ' (concluída)' : ''} e Câmara${save.guaira.optional.relief ? ' (concluída)' : ''}.`);
    details.append(summary, receipts, optional);
    if (save.legacySerraAccess && !journal.waterReleased) {
        details.append(element('p', 'guaira-optional-note', 'Seu acesso à Serra continua aberto.'));
    }
    content.append(details);

    const controls = element('nav', 'guaira-region-controls'); controls.setAttribute('aria-label', 'Viagem a Guaíra');
    const previous = document.activeElement;
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true; dialog.close(); dialog.remove();
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
    const back = element('button', directions.available ? 'guaira-region-back' : 'guaira-region-primary');
    back.type = 'button'; label(back, 'VOLTAR AO MAPA', directions.available ? ART.paper : ART.ink);
    back.addEventListener('click', close);
    if (directions.available) {
        const fly = element('button', 'guaira-region-primary'); fly.type = 'button';
        const { from, atAirRegion } = directions;
        label(fly, atAirRegion ? 'VOAR PARA GUAÍRA' : from === 'serra' ? 'IR À SERRA' : 'IR À FÁBRICA', ART.ink);
        fly.setAttribute('aria-label', atAirRegion ? `Voar para Guaíra, saindo da ${from === 'serra' ? 'Serra' : 'Fábrica'}` : directions.action);
        fly.addEventListener('click', () => {
            if (closed) return;
            close();
            if (atAirRegion) callbacks.fly(from);
            else if (from === 'serra') callbacks.goToSerra(); else callbacks.goToFactory();
        });
        controls.append(fly);
    }
    controls.append(back);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key)) event.preventDefault();
    });
    dialog.addEventListener('keyup', event => event.stopPropagation());
    dialog.append(header, content, controls); document.body.append(dialog); dialog.showModal();
    // Start on an action, not the optional stage list; native dialog contains Tab focus.
    (controls.firstElementChild as HTMLElement).focus();
    return close;
}
