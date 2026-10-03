import { hasAcceptedPublicWater } from './GuairaChapterWater';
import type { GuairaChapterSnapshot } from './GuairaChapterSession';
import data from './GuairaBairroWaterData.json';

/** Audio observes the same accepted receipt as the water painting; it creates no progress. */
export function publicWaterAudioLevel(snapshot: GuairaChapterSnapshot, point?: { x: number; y: number }): number {
    if (!point || snapshot.activeAttempt || !hasAcceptedPublicWater(snapshot)) return 0;
    const [x, y, width, height] = data.bounds;
    const distance = Math.hypot(point.x - x - width / 2, point.y - y - height / 2);
    return Math.max(0, Math.min(1, (190 - distance) / 130));
}
