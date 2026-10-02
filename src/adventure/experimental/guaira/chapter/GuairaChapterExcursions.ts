import type { WorldGame } from '../../../WorldGame';

/** Optional attempts never enter the chapter receipt/result model. */
export interface GuairaChapterExcursionToken {
    readonly sessionId: number;
    readonly attemptId: number;
    readonly navigationRevision: number;
}
export interface GuairaChapterExcursionRuntime {
    readonly game: WorldGame;
    readonly finished: boolean;
    togglePause(): void;
}
export type GuairaChapterExcursionFactory = (canvas: HTMLCanvasElement, status: HTMLElement) => GuairaChapterExcursionRuntime;

/** Load the native class only; the standalone page entrypoint has its own owner. */
export async function loadGuairaChapterExcursion(): Promise<GuairaChapterExcursionFactory> {
    const { GuairaGallery } = await import('../gallery/GuairaGallery');
    return (canvas, status) => {
        const game = new GuairaGallery(canvas, status);
        return { game, get finished() { return !game.isDisposed && game.finished; }, togglePause: () => game.toggleGalleryPause() };
    };
}
