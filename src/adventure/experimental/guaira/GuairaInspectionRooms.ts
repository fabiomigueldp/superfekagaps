import type { WorldGame } from '../../WorldGame';

export type GuairaInspectionRoomSceneId = 'gallery' | 'relief';
export const INSPECTION_ROOMS = {
    gallery: { title: 'Galeria dos Remendos', objective: 'Abra as tampas rachadas e alcance o patamar de inspeção' },
    relief: { title: 'Câmara de Alívio', objective: 'Atravesse a grelha no intervalo seco ou suba e abra a tampa de alívio · pule, depois baixo no ar · morrer ou Tentar restaura tampa e jato' }
} as const;

interface ExcursionRuntime {
    readonly game: WorldGame;
    readonly finished: boolean;
    togglePause(): void;
}
export type GuairaInspectionRoomRuntime = ExcursionRuntime & (
    | { readonly sceneId: 'gallery' }
    | { readonly sceneId: 'relief'; readonly reliefOpened: boolean }
);
export type GuairaInspectionRoomFactory = (canvas: HTMLCanvasElement, status: HTMLElement) => GuairaInspectionRoomRuntime;

/** Native optional rooms shared by chapter and free-map owners; no persistence. */
export async function loadGuairaInspectionRoom(sceneId: GuairaInspectionRoomSceneId = 'gallery'): Promise<GuairaInspectionRoomFactory> {
    if (sceneId === 'relief') {
        const { GuairaRelief } = await import('./relief/GuairaRelief');
        return (canvas, status) => {
            const game = new GuairaRelief(canvas, status);
            return { sceneId, game, get finished() { return !game.isDisposed && game.finished; },
                get reliefOpened() { return !game.isDisposed && game.reliefOpened; }, togglePause: () => game.toggleReliefPause() };
        };
    }
    const { GuairaGallery } = await import('./gallery/GuairaGallery');
    return (canvas, status) => {
        const game = new GuairaGallery(canvas, status);
        return { sceneId, game, get finished() { return !game.isDisposed && game.finished; }, togglePause: () => game.toggleGalleryPause() };
    };
}
