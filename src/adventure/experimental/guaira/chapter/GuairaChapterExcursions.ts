import type { WorldGame } from '../../../WorldGame';

export type GuairaChapterExcursionSceneId = 'gallery' | 'relief';
export const CHAPTER_EXCURSIONS = {
    gallery: { title: 'Galeria dos Remendos', objective: 'Abra as tampas rachadas e alcance o patamar de inspeção' },
    relief: { title: 'Câmara de Alívio', objective: 'Atravesse a grelha no intervalo seco ou suba e abra a tampa de alívio · pule, depois baixo no ar · morrer ou Tentar restaura tampa e jato' }
} as const;

/** Optional attempts never enter the chapter receipt/result model. */
export interface GuairaChapterExcursionToken {
    readonly sceneId: GuairaChapterExcursionSceneId;
    readonly sessionId: number;
    readonly attemptId: number;
    readonly navigationRevision: number;
}
interface ExcursionRuntime {
    readonly game: WorldGame;
    readonly finished: boolean;
    togglePause(): void;
}
export type GuairaChapterExcursionRuntime = ExcursionRuntime & (
    | { readonly sceneId: 'gallery' }
    | { readonly sceneId: 'relief'; readonly reliefOpened: boolean }
);
export type GuairaChapterExcursionFactory = (canvas: HTMLCanvasElement, status: HTMLElement) => GuairaChapterExcursionRuntime;

/** Load native classes only; standalone Gallery keeps its separate page owner. */
export async function loadGuairaChapterExcursion(sceneId: GuairaChapterExcursionSceneId = 'gallery'): Promise<GuairaChapterExcursionFactory> {
    if (sceneId === 'relief') {
        const { GuairaRelief } = await import('../relief/GuairaRelief');
        return (canvas, status) => {
            const game = new GuairaRelief(canvas, status);
            return { sceneId, game, get finished() { return !game.isDisposed && game.finished; },
                get reliefOpened() { return !game.isDisposed && game.reliefOpened; }, togglePause: () => game.toggleReliefPause() };
        };
    }
    const { GuairaGallery } = await import('../gallery/GuairaGallery');
    return (canvas, status) => {
        const game = new GuairaGallery(canvas, status);
        return { sceneId, game, get finished() { return !game.isDisposed && game.finished; }, togglePause: () => game.toggleGalleryPause() };
    };
}
