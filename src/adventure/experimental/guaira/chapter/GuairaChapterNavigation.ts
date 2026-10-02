import type { GuairaChapterSceneId } from './GuairaChapterSession';

/** A map destination is independent of the chapter's five required receipts. */
export type GuairaChapterMapTarget =
    | Readonly<{ kind: 'chapter'; sceneId: GuairaChapterSceneId }>
    | Readonly<{ kind: 'optional'; stop: 'bairro' }>;

/** Capture this immutable value when rendering actions; do not read a newer revision later. */
export interface GuairaChapterNavigation {
    readonly target: GuairaChapterMapTarget;
    readonly revision: number;
}

export function sameChapterMapTarget(a: GuairaChapterMapTarget, b: GuairaChapterMapTarget): boolean {
    return a.kind === 'chapter' ? b.kind === 'chapter' && a.sceneId === b.sceneId
        : b.kind === 'optional' && a.stop === b.stop;
}
