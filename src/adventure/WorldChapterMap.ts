import type { AdventureSave } from './types';
import type { MapPoint } from './WorldMapModel';
import { isGuairaUnlocked } from './progress';
import { GUAIRA_JOURNEY, GUAIRA_LANDMARKS, guairaJourneyCapabilities } from './GuairaMapJourney';
import { CHAPTER_SCENES } from './experimental/guaira/chapter/GuairaChapterScenes';
import { guairaChapterRoute } from './experimental/guaira/chapter/GuairaChapterProgress';
import { ALL_DELICIA_STAGES, DELICIA_STAGES } from './delicia/DeliciaContent';
import { deliciaUnlocked, type DeliciaSave } from './delicia/DeliciaProgress';
import { DELICIA_JOURNEY } from './delicia/DeliciaMapJourney';

export type WorldChapter = 'guaira' | 'delicia';
export interface ChapterMapStage {
    id: string;
    label: string;
    name: string;
    place?: string;
    landmarkCue?: string;
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
        const point = DELICIA_JOURNEY.nodes[stage.id];
        const previous = DELICIA_STAGES[stage.number - 2];
        return { id: stage.id, label: stage.optional ? '★' : String(stage.number), name: stage.name,
            point,
            open: deliciaUnlocked(stage.id, delicia), completed: delicia.completed.includes(stage.id), optional: stage.optional,
            seals: stage.boss ? undefined : stage.pickups.filter(p => p.kind === 'seal' && delicia.collected.includes(p.id)).length,
            sealTotal: stage.boss ? undefined : stage.pickups.filter(p => p.kind === 'seal').length,
            gate: stage.optional ? `Conclua ${stage.id === 'delicia-raizes' ? '3' : '9'} para abrir este santuário.`
                : previous ? `Conclua ${previous.number}: ${previous.name}.` : '' };
    });
    const progress = save.guaira, route = guairaChapterRoute(progress.opening), available = isGuairaUnlocked(save);
    const capabilities = guairaJourneyCapabilities(save);
    const stages: ChapterMapStage[] = route.map((id, index) => ({ id, label: String(index + 1), name: CHAPTER_SCENES[id].title,
        place: GUAIRA_LANDMARKS[id].place, landmarkCue: GUAIRA_LANDMARKS[id].cue,
        point: GUAIRA_JOURNEY.nodes[id],
        open: capabilities.availableStages.includes(id),
        completed: progress.completed.includes(id),
        gate: !available ? 'Conclua 3-5: Controle de Qualidade.' : `Conclua ${CHAPTER_SCENES[route[Math.max(0, index - 1)]].title}.` }));
    if (!progress.completed.length) {
        const alternative = progress.opening === 'guaira-travessia' ? 'guaira-patio-comportas' : 'guaira-travessia';
        stages.push({ id: alternative, label: 'B', name: CHAPTER_SCENES[alternative].title, optional: true,
            place: GUAIRA_LANDMARKS[alternative].place, landmarkCue: GUAIRA_LANDMARKS[alternative].cue,
            point: GUAIRA_JOURNEY.nodes[alternative],
            open: available, completed: false, gate: 'Conclua 3-5: Controle de Qualidade.' });
    }
    for (const [id, name] of [['gallery', 'Galeria dos Remendos'], ['relief', 'Câmara de Alívio']] as const) {
        stages.push({ id, label: id === 'gallery' ? 'G' : 'A', name, optional: true, open: available, completed: progress.optional[id],
            place: GUAIRA_LANDMARKS[id].place, landmarkCue: GUAIRA_LANDMARKS[id].cue,
            point: GUAIRA_JOURNEY.nodes[id],
            gate: 'Conclua 3-5: Controle de Qualidade.' });
    }
    return stages;
}

export function chapterSelection(stages: readonly ChapterMapStage[], preferred: string): number {
    const saved = stages.findIndex(stage => stage.id === preferred && stage.open);
    return saved >= 0 ? saved : Math.max(0, stages.findIndex(stage => stage.open && !stage.completed));
}
