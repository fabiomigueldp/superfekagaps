import type { GuairaChapterSceneId, GuairaChapterSnapshot } from './GuairaChapterSession';
import { hasAcceptedPublicWater } from './GuairaChapterWater';

const BULL_TO_HOUSE = 'Ossabravo descansou. A água ainda falta no bairro. Suba à Casa da Vazão.';
const WATER_FOR_NEIGHBORS = 'Ramal público aberto. Os moradores têm água na bica outra vez. Os gaps continuam.';

/** Context follows accepted chapter facts, never geography, URLs or a native hint.
 * Deriving it on demand adds no seen flags, timers, dialogue or navigation gates. */
export function chapterJourneyStory(snapshot: GuairaChapterSnapshot): string | null {
    if (snapshot.disposed) return null;
    if (hasAcceptedPublicWater(snapshot)) return WATER_FOR_NEIGHBORS;
    // The ascent already reveals the private diversion. Do not replay or spoil it.
    if (snapshot.nextRecommendedScene !== 'guaira-subida') return null;
    const bull = snapshot.accepted.some(receipt => receipt.sceneId === 'guaira-lab'
        && receipt.result.sceneId === 'guaira-lab' && receipt.result.kind === 'defeated-bull'
        && receipt.attempt.sceneId === 'guaira-lab' && receipt.attempt.sessionId === snapshot.generation.sessionId);
    return bull ? BULL_TO_HOUSE : null;
}

/** Called only for a currently completed, living native attempt. Earlier-scene
 * replays must not describe a dry neighborhood after public water was earned. */
export function chapterCompletionStory(snapshot: GuairaChapterSnapshot, sceneId: GuairaChapterSceneId): string | null {
    if (sceneId === 'guaira-prefeito' && hasAcceptedPublicWater(snapshot)) return WATER_FOR_NEIGHBORS;
    if (sceneId === 'guaira-lab' && snapshot.nextRecommendedScene === 'guaira-subida') return chapterJourneyStory(snapshot);
    return null;
}
