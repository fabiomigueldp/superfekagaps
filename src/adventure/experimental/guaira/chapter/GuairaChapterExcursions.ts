import type { GuairaInspectionRoomSceneId } from '../GuairaInspectionRooms';

export { INSPECTION_ROOMS as CHAPTER_EXCURSIONS, loadGuairaInspectionRoom as loadGuairaChapterExcursion } from '../GuairaInspectionRooms';
export type { GuairaInspectionRoomSceneId as GuairaChapterExcursionSceneId, GuairaInspectionRoomRuntime as GuairaChapterExcursionRuntime, GuairaInspectionRoomFactory as GuairaChapterExcursionFactory } from '../GuairaInspectionRooms';

/** Optional attempts never enter the chapter receipt/result model. */
export interface GuairaChapterExcursionToken {
    readonly sceneId: GuairaInspectionRoomSceneId;
    readonly sessionId: number;
    readonly attemptId: number;
    readonly navigationRevision: number;
}
