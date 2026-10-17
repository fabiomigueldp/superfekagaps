import type { WorldGame } from '../../WorldGame';
import { GUAIRA_COURSE_DETOURS, GUAIRA_MAINTENANCE_ROUTES, type GuairaCourseId, type GuairaCourseDetour } from './GuairaCourseDesign';

const stages: Record<GuairaCourseId, string> = {
    travessia: 'guaira-travessia', patio: 'guaira-patio-comportas', respiros: 'guaira-respiros',
    subida: 'guaira-subida', galeria: 'guaira-galeria', alivio: 'guaira-camara-alivio',
};
export type GuairaExplorationId = `${GuairaCourseId}:detour` | 'travessia:maintenance' | 'respiros:maintenance' | 'alivio:maintenance';
/** Unique coin indices earned on completed visits. Replays can fill missing
 * finds without turning one coin into another reward or chapter receipt. */
export type GuairaExplorationProgress = Partial<Record<GuairaExplorationId, number[]>>;
export const GUAIRA_EXPLORATION_ROUTES = (Object.keys(stages) as GuairaCourseId[]).flatMap(course =>
    (['detour', 'maintenance'] as const).flatMap(kind => {
        const route = kind === 'detour' ? GUAIRA_COURSE_DETOURS[course] : GUAIRA_MAINTENANCE_ROUTES[course];
        return route ? [{ id: `${course}:${kind}` as GuairaExplorationId, course, stageId: stages[course], route,
            prefix: `${stages[course]}:course:${kind}:coin:`, total: route.rewards.length }] : [];
    }));

export function sanitizeGuairaExploration(value: unknown, allowed: (stageId: string) => boolean = () => true): GuairaExplorationProgress | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const result: GuairaExplorationProgress = {};
    for (const route of GUAIRA_EXPLORATION_ROUTES) {
        const indices = (value as Record<string, unknown>)[route.id];
        if (!allowed(route.stageId) || !Array.isArray(indices)) continue;
        const unique = [...new Set(indices.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < route.total))].sort((a,b) => a-b);
        if (unique.length) result[route.id] = unique;
    }
    return Object.keys(result).length ? result : undefined;
}
export function mergeGuairaExploration(a?: GuairaExplorationProgress, b?: GuairaExplorationProgress) {
    return sanitizeGuairaExploration(Object.fromEntries(GUAIRA_EXPLORATION_ROUTES.map(route =>
        [route.id, [...(a?.[route.id] ?? []), ...(b?.[route.id] ?? [])]])));
}
/** Read only the native collision ledger. Total coins, enemy flags, selection
 * and entering a route cannot manufacture an exploration record. */
export function sampleGuairaExploration(game: Pick<WorldGame, 'stage' | 'hasCollectedPickup'>): GuairaExplorationProgress | undefined {
    const result: GuairaExplorationProgress = {};
    for (const route of GUAIRA_EXPLORATION_ROUTES.filter(route => route.stageId === game.stage.id)) {
        const collected = route.route.rewards.flatMap((_, index) => game.hasCollectedPickup(route.prefix + index) ? [index] : []);
        if (collected.length) result[route.id] = collected;
    }
    return Object.keys(result).length ? result : undefined;
}
export function guairaDetourCoinCount(game: Pick<WorldGame, 'hasCollectedPickup'>, course: GuairaCourseId, detour: GuairaCourseDetour) {
    const route = GUAIRA_EXPLORATION_ROUTES.find(route => route.course === course && route.route === detour)!;
    return { collected: route.route.rewards.filter((_, i) => game.hasCollectedPickup(route.prefix + i)).length, total: route.total };
}
export function guairaExplorationRows(stageId: string, progress?: GuairaExplorationProgress) {
    return guairaExplorationDetails(stageId, progress).map(route =>
        `${route.name} · ${route.found}/${route.total} moedas${route.found === route.total ? ' · explorado' : ''}`);
}
export function guairaExplorationDetails(stageId: string, progress?: GuairaExplorationProgress) {
    const nativeId = stageId === 'gallery' ? stages.galeria : stageId === 'relief' ? stages.alivio : stageId;
    return GUAIRA_EXPLORATION_ROUTES.filter(route => route.stageId === nativeId).map(route =>
        ({ name: route.route.name, found: progress?.[route.id]?.length ?? 0, total: route.total }));
}
