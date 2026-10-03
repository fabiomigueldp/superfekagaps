import type { GuairaChapterOpening, GuairaChapterSceneId } from './GuairaChapterSession';

/** Durable facts only. Runtime generations, checkpoints and boss state never cross a reload. */
export interface GuairaChapterProgress {
    version: 1;
    opening: GuairaChapterOpening;
    completed: GuairaChapterSceneId[];
    selectedScene: GuairaChapterSceneId;
    resumeScene: GuairaChapterSceneId | 'gallery' | 'relief' | null;
    optional: { gallery: boolean; relief: boolean };
    audioEnabled: boolean;
}
export const guairaChapterRoute = (opening: GuairaChapterOpening): GuairaChapterSceneId[] =>
    [opening, 'guaira-respiros', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'];
export const freshGuairaChapterProgress = (): GuairaChapterProgress => ({ version: 1,
    opening: 'guaira-travessia', completed: [], selectedScene: 'guaira-travessia', resumeScene: null,
    optional: { gallery: false, relief: false }, audioEnabled: true });
export function sanitizeGuairaChapterProgress(value: unknown): GuairaChapterProgress {
    const result = freshGuairaChapterProgress();
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return result;
    const data = value as Record<string, unknown>;
    if (data.opening === 'guaira-patio-comportas') result.opening = data.opening;
    const route = guairaChapterRoute(result.opening);
    for (const scene of route) {
        if (!Array.isArray(data.completed) || !data.completed.includes(scene)) break;
        result.completed.push(scene);
    }
    const next = route[result.completed.length] ?? route[route.length - 1];
    const selectable = (scene: unknown): scene is GuairaChapterSceneId =>
        scene === next || result.completed.includes(scene as GuairaChapterSceneId);
    result.selectedScene = selectable(data.selectedScene) ? data.selectedScene : next;
    result.resumeScene = selectable(data.resumeScene) ? data.resumeScene
        : data.resumeScene === 'gallery' || data.resumeScene === 'relief' ? data.resumeScene : null;
    if (data.optional && typeof data.optional === 'object') {
        const optional = data.optional as Record<string, unknown>;
        result.optional = { gallery: optional.gallery === true, relief: optional.relief === true };
    }
    if (typeof data.audioEnabled === 'boolean') result.audioEnabled = data.audioEnabled;
    return result;
}
/** Completion is monotonic; latest navigation/preferences win without erasing earned receipts. */
export function mergeGuairaChapterProgress(earned: GuairaChapterProgress, incoming: GuairaChapterProgress): GuairaChapterProgress {
    const old = sanitizeGuairaChapterProgress(earned), next = sanitizeGuairaChapterProgress(incoming);
    const opening = old.completed.length ? old.opening : next.opening;
    return sanitizeGuairaChapterProgress({ ...next, opening,
        completed: [...new Set([...old.completed, ...next.completed])],
        optional: { gallery: old.optional.gallery || next.optional.gallery, relief: old.optional.relief || next.optional.relief } });
}
