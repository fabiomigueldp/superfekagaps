import type { WorldGame } from '../../../WorldGame';
import { guairaArrivalFromSearch, type GuairaArrival } from '../GuairaMapModel';
import type { GuairaChapterAttempt, GuairaChapterLiveResult, GuairaChapterResult, GuairaChapterSceneId } from './GuairaChapterSession';

export const CHAPTER_SCENES: Record<GuairaChapterSceneId, {
    title: string; short: string; place: string; arrival: GuairaArrival; objective: string;
}> = {
    'guaira-travessia': { title: 'Travessia da Vala Seca', short: 'TRAVESSIA', place: 'Estrada do Vento', arrival: 'town', objective: 'Abra a comporta e atravesse até o arrozal.' },
    'guaira-patio-comportas': { title: 'Pátio das Comportas', short: 'PATIO', place: 'Estrada do Vento', arrival: 'town', objective: 'Desvie a água entre A e B para chegar ao arrozal.' },
    'guaira-respiros': { title: 'Passagem dos Respiros', short: 'RESPIROS', place: 'Passarela dos Arrozais', arrival: 'rice', objective: 'Observe a pressão e atravesse nas janelas secas.' },
    'guaira-lab': { title: 'Ossabravo', short: 'OSSABRAVO', place: 'Curral da Comporta', arrival: 'corral', objective: 'Leia os ataques e acerte a ossada na recuperação.' },
    'guaira-subida': { title: 'Subida à Casa da Vazão', short: 'SUBIDA', place: 'Curral da Comporta', arrival: 'corral', objective: 'Embarque na prancha e alcance a Casa da Vazão.' },
    'guaira-prefeito': { title: 'Prefeito da Vazão', short: 'PREFEITO', place: 'Casa da Vazão', arrival: 'vazao', objective: 'Reabra o registro, cruze a passarela e solte os três lacres.' }
};

export interface GuairaChapterRuntime {
    readonly game: WorldGame;
    /** Re-read the native result at the action, never derive it from a URL. */
    sample(attempt: GuairaChapterAttempt): GuairaChapterLiveResult;
    returnArrival(): GuairaArrival;
    togglePause(): void;
}
export type GuairaChapterSceneFactory = (canvas: HTMLCanvasElement, status: HTMLElement) => GuairaChapterRuntime;

function bind(game: WorldGame, sceneId: GuairaChapterSceneId, complete: () => boolean,
    href: () => string, pause: () => void): GuairaChapterRuntime {
    return {
        game,
        sample: attempt => {
            const usable = !game.isDisposed && game.stage.id === sceneId;
            let result: GuairaChapterResult | null = null;
            if (usable && complete()) {
                result = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' }
                    : sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' }
                    : { sceneId, kind: 'reached-finish' };
            }
            return { attempt, state: usable ? game.state : 'disposed', alive: usable && !game.player.data.isDead, result };
        },
        // This getter supplies geography only. Its visit parameter is ignored.
        returnArrival: () => { const query = href().split('?')[1]; return guairaArrivalFromSearch(query ? `?${query}` : ''); },
        togglePause: () => { if (!game.isDisposed) pause(); }
    };
}

/** Imports have no entrypoint side effects; the host checks its generation before constructing. */
export async function loadGuairaChapterScene(sceneId: GuairaChapterSceneId): Promise<GuairaChapterSceneFactory> {
    switch (sceneId) {
        case 'guaira-travessia': {
            const { GuairaTraversal } = await import('../GuairaTraversal');
            return (canvas, status) => { const game = new GuairaTraversal(canvas, status, 'CONTINUAR: VER OS RESPIROS');
                return bind(game, sceneId, () => game.finished, () => game.mapReturnHref, () => game.toggleTraversalPause()); };
        }
        case 'guaira-patio-comportas': {
            const { GuairaJunction } = await import('../junction/GuairaJunction');
            return (canvas, status) => { const game = new GuairaJunction(canvas, status);
                return bind(game, sceneId, () => game.finished, () => game.mapReturnHref, () => game.toggleJunctionPause()); };
        }
        case 'guaira-respiros': {
            const { GuairaRespiros } = await import('../respiros/GuairaRespiros');
            return (canvas, status) => { const game = new GuairaRespiros(canvas, status);
                return bind(game, sceneId, () => game.finished, () => game.mapReturnHref, () => game.toggleRespirosPause()); };
        }
        case 'guaira-lab': {
            const { GuairaBullLab } = await import('../GuairaBullLab');
            return (canvas, status) => { const game = new GuairaBullLab(canvas, status, 'CONTINUAR: VOLTAR A MAQUETE');
                return bind(game, sceneId, () => game.boss?.phase === 'defeated', () => game.mapReturnHref, () => game.toggleLabPause()); };
        }
        case 'guaira-subida': {
            const { GuairaAscent } = await import('../GuairaAscent');
            return (canvas, status) => { const game = new GuairaAscent(canvas, status);
                return bind(game, sceneId, () => game.finished, () => game.mapReturnHref, () => game.toggleAscentPause()); };
        }
        case 'guaira-prefeito': {
            const { GuairaMayorLab } = await import('../GuairaMayorLab');
            return (canvas, status) => { const game = new GuairaMayorLab(canvas, status);
                return bind(game, sceneId, () => game.mayor.publicWaterOpen, () => game.mapReturnHref, () => game.toggleLabPause()); };
        }
    }
}
