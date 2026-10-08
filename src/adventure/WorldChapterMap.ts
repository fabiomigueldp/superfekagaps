import type { AdventureSave } from './types';
import type { MapPoint } from './WorldMapModel';
import { hasDevelopmentAccess } from './DevelopmentProgress';
import { isGuairaUnlocked } from './progress';
import { GUAIRA_CAMPAIGN_ART, GUAIRA_CAMPAIGN_NODES } from './GuairaCampaignArt';
import { localToAtlas } from './WorldAtlasModel';
import { CHAPTER_SCENES } from './experimental/guaira/chapter/GuairaChapterScenes';
import { guairaChapterRoute } from './experimental/guaira/chapter/GuairaChapterProgress';
import { ALL_DELICIA_STAGES, DELICIA_STAGES } from './delicia/DeliciaContent';
import { deliciaUnlocked, type DeliciaSave } from './delicia/DeliciaProgress';
import { DELICIA_ATLAS } from './delicia/DeliciaIsland';
import deliciaMap from '../../public/assets/delicia/island-map.json';

export type WorldChapter = 'guaira' | 'delicia';
export interface ChapterMapStage {
    id: string;
    label: string;
    name: string;
    point: MapPoint;
    open: boolean;
    completed: boolean;
    optional?: boolean;
    seals?: number;
    sealTotal?: number;
    gate: string;
}
export const WORLD_CHAPTER_NAMES: Record<WorldChapter, string> = {
    guaira: 'Guaíra', delicia: 'Império da Delícia',
};
const DELICIA_SEALS = ALL_DELICIA_STAGES.flatMap(stage => stage.pickups.filter(pickup => pickup.kind === 'seal').map(pickup => pickup.id));
export function deliciaMapProgress(save: DeliciaSave) {
    return { completed: DELICIA_STAGES.filter(stage => save.completed.includes(stage.id)).length, stages: DELICIA_STAGES.length,
        seals: DELICIA_SEALS.filter(id => save.collected.includes(id)).length, sealTotal: DELICIA_SEALS.length };
}

/** Map inspection never changes a save or awards progress. Runtime entry checks again. */
export function chapterMapStages(chapter: WorldChapter, save: AdventureSave, delicia: DeliciaSave): ChapterMapStage[] {
    if (chapter === 'delicia') return ALL_DELICIA_STAGES.map(stage => {
        const point = (deliciaMap.nodes as Record<string, MapPoint>)[stage.id]
            ?? (stage.id === 'delicia-raizes' ? { x: deliciaMap.nodes['delicia-3'].x - .08, y: deliciaMap.nodes['delicia-3'].y + .08 }
                : stage.id === 'delicia-relogio' ? { x: deliciaMap.nodes['delicia-9'].x + .07, y: deliciaMap.nodes['delicia-9'].y - .025 } : stage.map);
        const previous = DELICIA_STAGES[stage.number - 2];
        return { id: stage.id, label: stage.optional ? '★' : String(stage.number), name: stage.name,
            point: { x: DELICIA_ATLAS.left + point.x * DELICIA_ATLAS.widthInMap,
                y: DELICIA_ATLAS.top + point.y * DELICIA_ATLAS.heightInMap },
            open: deliciaUnlocked(stage.id, delicia), completed: delicia.completed.includes(stage.id), optional: stage.optional,
            seals: stage.boss ? undefined : stage.pickups.filter(p => p.kind === 'seal' && delicia.collected.includes(p.id)).length,
            sealTotal: stage.boss ? undefined : stage.pickups.filter(p => p.kind === 'seal').length,
            gate: stage.optional ? `Conclua ${stage.id === 'delicia-raizes' ? '3' : '9'} para abrir este santuário.`
                : previous ? `Conclua ${previous.number}: ${previous.name}.` : '' };
    });
    const progress = save.guaira, route = guairaChapterRoute(progress.opening), available = isGuairaUnlocked(save);
    const next = route.find(id => !progress.completed.includes(id));
    const nodes = GUAIRA_CAMPAIGN_NODES;
    const points = [nodes['guaira-1'], nodes['guaira-3'], nodes['guaira-4'],
        { x: (nodes['guaira-4'].x + nodes['guaira-5'].x) / 2, y: (nodes['guaira-4'].y + nodes['guaira-5'].y) / 2 }, nodes['guaira-5']];
    const stages: ChapterMapStage[] = route.map((id, index) => ({ id, label: String(index + 1), name: CHAPTER_SCENES[id].title,
        point: localToAtlas(points[index], GUAIRA_CAMPAIGN_ART.guaira.placement),
        open: available && (hasDevelopmentAccess(save) || id === next || progress.completed.includes(id)),
        completed: progress.completed.includes(id),
        gate: !available ? 'Conclua 3-5: Controle de Qualidade.' : `Conclua ${CHAPTER_SCENES[route[Math.max(0, index - 1)]].title}.` }));
    if (!progress.completed.length) {
        const alternative = progress.opening === 'guaira-travessia' ? 'guaira-patio-comportas' : 'guaira-travessia';
        stages.push({ id: alternative, label: 'B', name: CHAPTER_SCENES[alternative].title, optional: true,
            point: localToAtlas({ x: nodes['guaira-1'].x + .07, y: nodes['guaira-1'].y + .055 }, GUAIRA_CAMPAIGN_ART.guaira.placement),
            open: available, completed: false, gate: 'Conclua 3-5: Controle de Qualidade.' });
    }
    for (const [id, name, offset] of [['gallery', 'Galeria dos Remendos', -.025], ['relief', 'Câmara de Alívio', .025]] as const) {
        stages.push({ id, label: '★', name, optional: true, open: available, completed: progress.optional[id],
            point: localToAtlas({ x: nodes['guaira-2'].x + offset, y: nodes['guaira-2'].y }, GUAIRA_CAMPAIGN_ART.guaira.placement),
            gate: 'Conclua 3-5: Controle de Qualidade.' });
    }
    return stages;
}

export function chapterSelection(stages: readonly ChapterMapStage[], preferred: string): number {
    const saved = stages.findIndex(stage => stage.id === preferred && stage.open);
    return saved >= 0 ? saved : Math.max(0, stages.findIndex(stage => stage.open && !stage.completed));
}
