import type { AdventureSave } from './types';
import { canContinueFromGuaira, isGuairaUnlocked, isUnlocked } from './progress';

/** Read-only directions: receipts and access always remain owned by progression. */
export function guairaTravelDirections(save: AdventureSave, arrived: string) {
    const from: 'serra' | 'factory' = Number(arrived.split('-')[0]) >= 4 ? 'serra' : 'factory';
    const region = from === 'serra' ? 'Serra' : 'Fábrica';
    const atAirRegion = arrived.startsWith('3-') || arrived.startsWith('4-');
    const available = isGuairaUnlocked(save);
    const waterReleased = save.guaira.completed.includes('guaira-prefeito');
    const action = atAirRegion ? `Voar da ${region} para Guaíra` : `Ir à ${region} para embarcar`;
    const route = !available ? 'Embarque fechado · conclua 3-5 na Fábrica.'
        : from === 'serra' ? 'Revisita a Guaíra · o aeródromo permite voltar à Serra.'
        : waterReleased ? 'Para chegar à Serra, voe até Guaíra e embarque de lá para a Serra.'
        : canContinueFromGuaira(save) ? 'Seu acesso antigo à Serra continua aberto pelo aeródromo de Guaíra.'
        : 'Rumo à Serra · voe até Guaíra e libere a água com o Prefeito.';
    // Approach an open stage, including saves which have only just reached Serra.
    const world = from === 'serra' ? 4 : 3;
    const approach = [5, 4, 3, 2, 1].map(n => `${world}-${n}`).find(id => isUnlocked(id, save)) ?? `${world}-1`;
    return { from, atAirRegion, available, action, route, approach };
}

/** A cue on the existing map placard, only while resting at the selected stop. */
export function campaignMapDirection(save: AdventureSave, arrived: string, selected: string, traveling: boolean): string {
    if (traveling || arrived !== selected || !isGuairaUnlocked(save)) return '';
    if (arrived === '3-5') return `${guairaTravelDirections(save, arrived).route} Abra Arquipélago → Guaíra.`;
    if (arrived.startsWith('4-') && save.completed.includes(arrived))
        return 'Revisitar Guaíra ou voltar à Fábrica: abra Arquipélago → Guaíra.';
    return '';
}
