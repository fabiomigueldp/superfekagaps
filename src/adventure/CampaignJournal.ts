import type { AdventureSave } from './types';
import { STAGES } from './campaign';
import { FACTORY_SALON } from './factory/FactorySalon';
import { CHAPTER_SCENES } from './experimental/guaira/chapter/GuairaChapterScenes';
import { guairaChapterRoute, sanitizeGuairaChapterProgress } from './experimental/guaira/chapter/GuairaChapterProgress';

/** Presentation of earned facts only: optional visits never award campaign completion or seals. */
export function campaignJournal(save: AdventureSave) {
    const guaira = sanitizeGuairaChapterProgress(save.guaira);
    const route = guairaChapterRoute(guaira.opening);
    const entries = route.map(id => ({ id, ...CHAPTER_SCENES[id], complete: guaira.completed.includes(id) }));
    const next = entries.find(entry => !entry.complete) ?? null;
    const waterReleased = guaira.completed.includes('guaira-prefeito');
    const optional = [
        { title: 'Galeria dos Remendos', complete: guaira.optional.gallery },
        { title: 'Câmara de Alívio', complete: guaira.optional.relief },
        { title: 'Turbosuco · Fábrica', complete: save.seen.includes(FACTORY_SALON.victory) },
    ];
    const water = waterReleased ? 'Guaíra: água liberada · caminho da Serra aberto'
        : save.legacySerraAccess ? 'Guaíra: água pendente · acesso antigo à Serra mantido'
        : 'Guaíra: libere a água para seguir à Serra';
    const objective = !save.completed.includes('3-5') ? 'Conclua Controle de Qualidade na Fábrica para embarcar.'
        : next ? `Próxima parada: ${next.title}. ${next.objective}`
        : 'Água liberada! Siga à Serra pelo aeródromo ou revisite os caminhos de Guaíra.';
    return { entries, next, waterReleased, water, objective, optional,
        completed: STAGES.filter(stage => save.completed.includes(stage.id)).length + guaira.completed.length,
        total: STAGES.length + route.length, guairaCompleted: guaira.completed.length,
        optionalCompleted: optional.filter(entry => entry.complete).length };
}
